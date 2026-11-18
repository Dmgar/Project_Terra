import numpy as np
import pandas as pd
import pytest


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