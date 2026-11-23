import warnings
from pathlib import Path

import joblib
import numpy as np
import pytest
import sklearn.exceptions
from fastapi.testclient import TestClient

from api.economics_engine import optimize_plan
from api.economics_models import OptimizationRequest
from api.server import FEATURE_COLS, FRONTEND_DIST, MODEL_PATH, SCALER_PATH, app


def test_all_serialized_models_load_without_version_warning():
    models_dir = Path("data/models")
    joblib_files = sorted(models_dir.glob("*.joblib"))
    assert joblib_files, "Se esperan artefactos .joblib en data/models"
    with warnings.catch_warnings():
        warnings.simplefilter("error", sklearn.exceptions.InconsistentVersionWarning)
        for path in joblib_files:
            joblib.load(path)


def test_static_assets_and_api_404_contracts():
    client = TestClient(app)

    missing_api = client.get("/api/does-not-exist")
    assert missing_api.status_code == 404
    assert "application/json" in missing_api.headers["content-type"]

    if FRONTEND_DIST.exists():
        root = client.get("/")
        assert root.status_code == 200
        assert "text/html" in root.headers["content-type"]

        assets_dir = FRONTEND_DIST / "assets"
        js_files = list(assets_dir.glob("*.js"))
        assert js_files, "Se espera al menos un bundle JS compilado en frontend/dist/assets"
        asset_res = client.get(f"/assets/{js_files[0].name}")
        assert asset_res.status_code == 200


def test_recommend_uses_canonical_7d_kmeans_and_clean_outlier_label():
    client = TestClient(app)
    payload = {
        "Nitrogen": 180,
        "Phosphorus": 150,
        "Potassium": 210,
        "Temperature": 49,
        "Humidity": 10,
        "pH_Value": 9.4,
        "Rainfall": 350,
    }
    res = client.post("/api/recommend", json=payload)
    assert res.status_code == 200
    body = res.json()

    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    vec = np.array([[payload[c] for c in FEATURE_COLS]])
    expected_cluster = int(model.predict(scaler.transform(vec))[0])
    assert body["cluster"] == expected_cluster
    assert body["isOutlier"] is True
    assert body["confidenceLabel"] == "Fuera de rango típico"
    assert "\ufe0f" not in body["advice"][0]


def test_suitability_tiebreak_weight_has_effect_and_zero_min_ha_not_binding():
    base_kwargs = {
        "area_ha": 10,
        "department": "Cundinamarca",
        "market": "Bogotá",
        "budget_cop": 100_000_000,
        "water_m3": 100_000,
        "risk_profile": "expected",
        "environmental_values": {
            "nitrogen": 180,
            "phosphorus": 150,
            "potassium": 210,
            "temperature": 49,
            "humidity": 10,
            "ph": 9.4,
            "rainfall": 350,
        },
        "crops": [
            {
                "crop_id": "maiz",
                "price_cop_per_kg": 1450,
                "yield_t_per_ha": 5.0,
                "cost_cop_per_ha": 5_200_000,
                "water_m3_per_ha": 5000,
                "min_ha": 0,
                "max_ha": 10,
            },
            {
                "crop_id": "frijol",
                "price_cop_per_kg": 4200,
                "yield_t_per_ha": 1.8,
                "cost_cop_per_ha": 6_200_000,
                "water_m3_per_ha": 3500,
                "min_ha": 0,
                "max_ha": 10,
            },
        ],
    }
    strict = optimize_plan(OptimizationRequest(**base_kwargs, suitability_tiebreak_weight=0.0))
    flexible = optimize_plan(OptimizationRequest(**base_kwargs, suitability_tiebreak_weight=1.0))

    assert strict.total_profit_cop == pytest.approx(20_500_000)
    assert flexible.total_profit_cop < strict.total_profit_cop
    assert flexible.total_profit_cop >= strict.total_profit_cop * 0.80 - 1e-3
    assert all(not c.startswith("min_ha:") for c in strict.binding_constraints)
