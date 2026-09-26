import numpy as np
import pytest

import pandas as pd
from src.clustering import (
    compute_hierarchical_linkage,
    find_optimal_gmm,
    find_optimal_k,
    run_gmm,
    run_hdbscan,
    run_hierarchical,
    run_kmeans,
    run_tsne_projection,
    run_umap_projection,
    compare_models,
    select_features_kruskal,
    select_features_mi,
    encode_categorical_for_clustering,
    prepare_mixed_data,
    run_kprototypes,
)


def test_run_kmeans_returns_fitted_model_and_labels(separated_points):
    labels, model = run_kmeans(separated_points, k=2)

    assert labels.shape == (len(separated_points),)
    assert set(labels) == {0, 1}
    assert model.cluster_centers_.shape == (2, separated_points.shape[1])
    assert np.array_equal(labels, model.predict(separated_points))


def test_find_optimal_k_reports_expected_metrics(separated_points):
    metrics = find_optimal_k(
        separated_points,
        k_range=[2, 3],
        sample_size_silhouette=None,
    )

    assert metrics["k"].tolist() == [2, 3]
    assert list(metrics.columns) == [
        "k",
        "inertia",
        "silhouette",
        "davies_bouldin",
    ]
    assert np.isfinite(metrics.iloc[:, 1:].to_numpy()).all()
    assert (metrics["inertia"] > 0).all()
    assert metrics.loc[metrics["k"] == 2, "silhouette"].iloc[0] > 0.9


def test_hierarchical_helpers_return_valid_shapes(separated_points):
    linkage = compute_hierarchical_linkage(
        separated_points,
        sample_size=10,
        random_state=7,
    )
    labels, model = run_hierarchical(separated_points, k=2)

    assert linkage.shape == (9, 4)
    assert labels.shape == (len(separated_points),)
    assert set(labels) == {0, 1}
    assert model.n_clusters == 2


def test_find_optimal_gmm_reports_bic_aic_silhouette(separated_points):
    metrics = find_optimal_gmm(
        separated_points,
        k_range=[2, 3],
        covariance_types=("full", "diag"),
        n_init=2,
        random_state=42,
    )

    # Order is: for each k, iterate covariance_types
    assert metrics["k"].tolist() == [2, 3, 2, 3]
    assert set(metrics["covariance_type"]) == {"full", "diag"}
    assert list(metrics.columns) == [
        "k",
        "covariance_type",
        "bic",
        "aic",
        "log_likelihood",
        "silhouette",
        "converged",
    ]
    assert np.isfinite(metrics[["bic", "aic", "log_likelihood"]].to_numpy()).all()
    assert (metrics["converged"] == True).all()


def test_run_gmm_returns_labels_probs_and_model(separated_points):
    labels, probs, model = run_gmm(
        separated_points,
        k=2,
        covariance_type="full",
        random_state=42,
        n_init=2,
    )

    assert labels.shape == (len(separated_points),)
    assert set(labels) == {0, 1}
    assert probs.shape == (len(separated_points), 2)
    assert np.allclose(probs.sum(axis=1), 1.0)
    assert np.array_equal(labels, probs.argmax(axis=1))
    assert model.n_components == 2


def test_compare_models_returns_dataframe_with_expected_columns(separated_points):
    km_labels, km_model = run_kmeans(separated_points, k=2, random_state=42)
    gmm_labels, gmm_probs, gmm_model = run_gmm(
        separated_points, k=2, random_state=42, n_init=2
    )

    comparison = compare_models(
        separated_points,
        labels_kmeans=km_labels,
        labels_gmm=gmm_labels,
        y_true=None,
        gmm_model=gmm_model,
    )

    assert comparison.index.tolist() == ["kmeans", "gmm"]
    expected_cols = [
        "silhouette",
        "davies_bouldin",
        "calinski_harabasz",
        "bic",
        "aic",
        "purity",
    ]
    assert list(comparison.columns) == expected_cols
    # kmeans has NaN for bic/aic, gmm has values
    assert np.isnan(comparison.loc["kmeans", "bic"])
    assert np.isfinite(comparison.loc["gmm", "bic"])
    # Silhouette should be finite for both
    assert np.isfinite(comparison["silhouette"]).all()


def test_run_tsne_projection_returns_2d_embedding(separated_points):
    # perplexity must be < n_samples (24 in fixture)
    X_tsne = run_tsne_projection(separated_points, n_components=2, perplexity=10.0, random_state=42)

    assert X_tsne.shape == (len(separated_points), 2)
    assert np.isfinite(X_tsne).all()


def test_run_umap_projection_returns_2d_embedding(separated_points):
    X_umap = run_umap_projection(separated_points, n_components=2, random_state=42)

    assert X_umap.shape == (len(separated_points), 2)
    assert np.isfinite(X_umap).all()


def test_run_hdbscan_returns_labels_and_model(separated_points):
    labels, model = run_hdbscan(separated_points, min_cluster_size=5)

    assert labels.shape == (len(separated_points),)
    # With well-separated blobs, HDBSCAN finds 2 clusters (labels 0, 1)
    unique_labels = set(labels)
    assert unique_labels == {0, 1}  # Finds 2 clusters
    assert hasattr(model, "labels_")
    assert np.array_equal(labels, model.labels_)


def test_select_features_kruskal():
    X = pd.DataFrame({
        "feat_informative": [1, 2, 1, 2, 10, 11, 10, 12],
        "feat_noise": [5, 5, 5, 5, 5, 5, 5, 5],
    })
    y = pd.Series([0, 0, 0, 0, 1, 1, 1, 1])
    selected = select_features_kruskal(
        X,
        y,
        alpha=0.05,
        min_features=1,
    )
    assert "feat_informative" in selected
    assert len(selected) >= 1


def test_select_features_mi():
    X = pd.DataFrame({
        "feat_strong": [0, 0, 0, 0, 10, 10, 10, 10],
        "feat_weak": [1, 2, 3, 4, 1, 2, 3, 4],
    })
    y = pd.Series([0, 0, 0, 0, 1, 1, 1, 1])
    selected = select_features_mi(X, y, k=1)
    assert selected == ["feat_strong"]


def test_encode_categorical_for_clustering():
    df = pd.DataFrame({
        "soil": ["Arcilloso", "Arenoso", "Franco", "Arcilloso"],
        "num": [1.0, 2.0, 3.0, 4.0],
    })
    onehot_mat, onehot_cols = encode_categorical_for_clustering(df, ["soil"], method="onehot")
    assert onehot_mat.shape == (4, 3)
    assert len(onehot_cols) == 3

    ord_mat, ord_cols = encode_categorical_for_clustering(df, ["soil"], method="ordinal")
    assert ord_mat.shape == (4, 1)
    assert ord_cols == ["soil"]


def test_prepare_mixed_data():
    df = pd.DataFrame({
        "Nitrogen": [10.0, 20.0, 30.0, 40.0],
        "Phosphorus": [50.0, 60.0, 70.0, 80.0],
        "Soil_Type": ["Arcilloso", "Arenoso", "Franco", "Arcilloso"],
    })
    X_comb, feat_names = prepare_mixed_data(
        df, num_cols=["Nitrogen", "Phosphorus"], cat_cols=["Soil_Type"]
    )
    # 2 numeric scaled + 3 one-hot columns = 5 columns
    assert X_comb.shape == (4, 5)
    assert len(feat_names) == 5
    assert feat_names[:2] == ["Nitrogen", "Phosphorus"]


def test_run_kprototypes_returns_fallback_when_not_installed():
    df = pd.DataFrame({
        "Nitrogen": [10.0, 20.0],
        "Soil_Type": ["Arcilloso", "Arenoso"],
    })
    labels, model = run_kprototypes(df, num_cols=["Nitrogen"], cat_cols=["Soil_Type"], k=2)
    # kmodes is not installed in the standard test environment, so it returns None, None safely
    assert labels is None
    assert model is None