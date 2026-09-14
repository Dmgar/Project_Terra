import numpy as np
import pandas as pd
import pytest

from app import utils


@pytest.fixture
def separated_points():
    rng = np.random.default_rng(42)
    return np.vstack(
        (
            rng.normal(loc=-4.0, scale=0.15, size=(12, 3)),
            rng.normal(loc=4.0, scale=0.15, size=(12, 3)),
        )
    )


@pytest.fixture
def agronomy_frame():
    return pd.DataFrame(
        {
            "Nitrogen": [10.0, 20.0, 70.0, 90.0],
            "Phosphorus": [15.0, 25.0, 65.0, 85.0],
            "cluster": [0, 0, 1, 1],
            "Crop": ["rice", "rice", "maize", "beans"],
        }
    )


@pytest.fixture
def app_data_dir(tmp_path, monkeypatch):
    raw_dir = tmp_path / "data" / "raw"
    processed_dir = tmp_path / "data" / "processed"
    raw_dir.mkdir(parents=True)
    processed_dir.mkdir(parents=True)
    monkeypatch.setattr(utils, "ROOT_DIR", tmp_path)
    utils.load_dataset.clear()
    utils.get_model_and_scaler.clear()
    yield tmp_path
    utils.load_dataset.clear()
    utils.get_model_and_scaler.clear()