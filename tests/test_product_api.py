"""Integration checks for the Project Terra product API."""

from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.server import DATA_PATH, RAW_DATA_PATH, app

client = TestClient(app)
HAS_DATA = Path(DATA_PATH).exists() or Path(RAW_DATA_PATH).exists()


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_benchmark_endpoint_exposes_model_comparison():
    response = client.get("/api/benchmark")
    assert response.status_code == 200
    body = response.json()
    assert body["k"] == 5
    assert len(body["models"]) >= 5
    assert body["activeModel"].get("selected_pipeline")


def test_static_route_cannot_escape_frontend_directory():
    response = client.get("/%2e%2e/%2e%2e/README.md")
    assert response.status_code == 404
    assert "Project Terra" not in response.text


@pytest.mark.skipif(not HAS_DATA, reason="The dataset is intentionally not versioned.")
def test_product_data_endpoints_use_real_dataset():
    overview = client.get("/api/overview")
    regions = client.get("/api/regions")
    pca = client.get("/api/pca")

    expected_samples = len(pd.read_csv(DATA_PATH if Path(DATA_PATH).exists() else RAW_DATA_PATH))
    assert overview.status_code == 200
    assert overview.json()["metrics"]["samples"] == expected_samples
    assert expected_samples >= 10_000
    assert regions.status_code == 200
    assert len(regions.json()["regions"]) == 5
    assert pca.status_code == 200
    assert len(pca.json()["points"]) == 2_500


@pytest.mark.skipif(not HAS_DATA, reason="The dataset is intentionally not versioned.")
def test_recommendation_returns_evidence():
    response = client.post(
        "/api/recommend",
        json={
            "Nitrogen": 85,
            "Phosphorus": 45,
            "Potassium": 40,
            "Temperature": 28.5,
            "Humidity": 88,
            "pH_Value": 6.2,
            "Rainfall": 260,
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["cluster"] in range(5)
    assert result["sampleCount"] > 0
    assert result["crops"]
    assert result["advice"]
    assert "gmmProbabilities" in result
    assert len(result["gmmProbabilities"]) == 5