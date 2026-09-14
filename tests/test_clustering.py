import numpy as np

from src.clustering import (
    compute_hierarchical_linkage,
    find_optimal_k,
    run_hierarchical,
    run_kmeans,
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