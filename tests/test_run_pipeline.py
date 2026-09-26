"""Tests for src.run_pipeline module."""

import pytest
import numpy as np
import pandas as pd
from pathlib import Path
import sys


def test_run_pipeline_imports():
    """Ensure the module can be imported without side effects."""
    import src.run_pipeline
    assert hasattr(src.run_pipeline, "main")


def test_run_pipeline_main_creates_expected_outputs(tmp_path, monkeypatch):
    """
    Smoke test: run the pipeline on a small synthetic dataset
    and verify it produces the expected output files.
    """
    # Create minimal synthetic data matching the expected schema
    rng = np.random.default_rng(42)
    n_samples = 100
    df = pd.DataFrame({
        "Nitrogen": rng.normal(70, 10, n_samples),
        "Phosphorus": rng.normal(50, 10, n_samples),
        "Potassium": rng.normal(60, 10, n_samples),
        "Temperature": rng.normal(24, 2, n_samples),
        "Humidity": rng.normal(70, 10, n_samples),
        "pH_Value": rng.normal(6.5, 0.5, n_samples),
        "Rainfall": rng.normal(130, 20, n_samples),
        "Crop": rng.choice(["arroz", "maiz", "papa"], n_samples),
        "Soil_Type": rng.choice(["Arcilloso", "Franco", "Arenoso"], n_samples),
        "Variety": rng.choice(["Var1", "Var2"], n_samples),
    })

    # Set up directory structure
    raw_dir = tmp_path / "data" / "raw"
    processed_dir = tmp_path / "data" / "processed"
    models_dir = tmp_path / "data" / "models"
    raw_dir.mkdir(parents=True)
    processed_dir.mkdir(parents=True)
    models_dir.mkdir(parents=True)

    raw_path = raw_dir / "sensor_Crop_Dataset.csv"
    df.to_csv(raw_path, index=False)

    # Patch ROOT_DIR to point to tmp_path
    monkeypatch.setattr(sys.modules["src.run_pipeline"], "ROOT_DIR", tmp_path)

    # Run pipeline main
    from src.run_pipeline import main
    main()

    # Verify outputs exist
    assert (processed_dir / "sensor_Crop_Dataset_clustered.csv").exists()
    assert (models_dir / "kmeans_k5.joblib").exists()
    assert (models_dir / "scaler.joblib").exists()
    assert (models_dir / "gmm_k5_full.joblib").exists()

    # Verify clustered CSV has expected columns
    clustered = pd.read_csv(processed_dir / "sensor_Crop_Dataset_clustered.csv")
    assert "kmeans_cluster" in clustered.columns
    assert "hierarchical_cluster" in clustered.columns
    assert "gmm_cluster" in clustered.columns
    assert all(f"gmm_prob_{i}" in clustered.columns for i in range(5))

    # Verify cluster counts
    assert len(clustered) == n_samples
    assert clustered["kmeans_cluster"].nunique() == 5
    assert clustered["gmm_cluster"].nunique() == 5


def test_run_pipeline_handles_missing_raw_csv(tmp_path, monkeypatch):
    """Pipeline should raise FileNotFoundError if raw CSV missing."""
    monkeypatch.setattr(sys.modules["src.run_pipeline"], "ROOT_DIR", tmp_path)

    from src.run_pipeline import main
    with pytest.raises(FileNotFoundError) as exc_info:
        main()
    # Verify the error mentions the missing file
    assert "sensor_Crop_Dataset.csv" in str(exc_info.value) or "No se encontró" in str(exc_info.value)