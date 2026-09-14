import numpy as np

from src.profiling import (
    cluster_summary,
    contingency_table,
    create_radar_chart,
    plot_pca_clusters,
    purity_score,
)


def test_cluster_summary_and_contingency_table(agronomy_frame):
    summary = cluster_summary(
        agronomy_frame,
        cluster_col="cluster",
        feature_cols=["Nitrogen", "Phosphorus"],
    )
    table = contingency_table(
        agronomy_frame,
        cluster_col="cluster",
        label_col="Crop",
    )

    assert summary.loc[0, "Nitrogen"] == 15.0
    assert summary.loc[1, "Phosphorus"] == 75.0
    assert table.loc[0, "rice"] == 100.0
    assert table.loc[1, "beans"] == 50.0
    assert table.loc[1, "maize"] == 50.0


def test_purity_score_handles_permuted_cluster_labels():
    assert purity_score(
        np.array(["a", "a", "b", "b"]),
        np.array([7, 7, 3, 3]),
    ) == 1.0


def test_visualizations_return_complete_figures(agronomy_frame):
    features = ["Nitrogen", "Phosphorus"]
    radar = create_radar_chart(agronomy_frame, "cluster", features)
    pca_figure, pca = plot_pca_clusters(
        agronomy_frame[features].to_numpy(),
        agronomy_frame["cluster"].to_numpy(),
        hover_df=agronomy_frame[["Crop"]],
        sample_size=None,
    )

    assert len(radar.data) == 2
    assert all(len(trace.r) == len(features) + 1 for trace in radar.data)
    assert pca.n_components_ == 2
    assert sum(len(trace.x) for trace in pca_figure.data) == len(agronomy_frame)