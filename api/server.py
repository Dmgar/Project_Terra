"""FastAPI service for Project Terra's data product."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sklearn.decomposition import PCA

from .economics_routes import router as economics_router


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT_DIR / "data" / "processed" / "sensor_Crop_Dataset_clustered.csv"
RAW_DATA_PATH = ROOT_DIR / "data" / "raw" / "sensor_Crop_Dataset.csv"
MODEL_PATH = ROOT_DIR / "data" / "models" / "kmeans_k5.joblib"
SCALER_PATH = ROOT_DIR / "data" / "models" / "scaler.joblib"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

FEATURE_COLS = [
    "Nitrogen",
    "Phosphorus",
    "Potassium",
    "Temperature",
    "Humidity",
    "pH_Value",
    "Rainfall",
]

FEATURE_RANGES = {
    "Nitrogen": (0.0, 180.0),
    "Phosphorus": (5.0, 150.0),
    "Potassium": (5.0, 210.0),
    "Temperature": (5.0, 50.0),
    "Humidity": (10.0, 100.0),
    "pH_Value": (3.5, 9.5),
    "Rainfall": (20.0, 350.0),
}


class RecommendationInput(BaseModel):
    Nitrogen: Annotated[float, Field(ge=0, le=180)]
    Phosphorus: Annotated[float, Field(ge=5, le=150)]
    Potassium: Annotated[float, Field(ge=5, le=210)]
    Temperature: Annotated[float, Field(ge=5, le=50)]
    Humidity: Annotated[float, Field(ge=10, le=100)]
    pH_Value: Annotated[float, Field(ge=3.5, le=9.5)]
    Rainfall: Annotated[float, Field(ge=20, le=350)]


class DistributionItem(BaseModel):
    name: str
    value: int
    share: float


class FeatureStat(BaseModel):
    feature: str
    mean: float
    std: float
    min: float
    median: float
    max: float


class OverviewMetrics(BaseModel):
    samples: int
    features: int
    regions: int
    crops: int
    soils: int


class OverviewResponse(BaseModel):
    metrics: OverviewMetrics
    cropDistribution: list[DistributionItem]
    soilDistribution: list[DistributionItem]
    clusterDistribution: list[DistributionItem]
    featureStats: list[FeatureStat]


class RegionProfile(BaseModel):
    id: int
    count: int
    share: float
    topCrop: str | None
    crops: list[DistributionItem]
    soils: list[DistributionItem]
    profile: dict[str, float]
    normalizedProfile: dict[str, float]


class RegionsResponse(BaseModel):
    regions: list[RegionProfile]


class PCAPoint(BaseModel):
    x: float
    y: float
    cluster: int
    crop: str
    soil: str


class PCAResponse(BaseModel):
    points: list[PCAPoint]
    explainedVariance: list[float]


app = FastAPI(title="Project Terra API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(economics_router)


def distribution(series: pd.Series) -> list[dict]:
    counts = series.value_counts()
    total = int(counts.sum())
    return [
        {
            "name": str(name),
            "value": int(value),
            "share": round(float(value / total * 100), 2),
        }
        for name, value in counts.items()
    ]


@lru_cache(maxsize=1)
def load_dataset() -> pd.DataFrame:
    path = DATA_PATH if DATA_PATH.exists() else RAW_DATA_PATH
    if not path.exists():
        raise FileNotFoundError(
            "No se encontró el dataset. Añade sensor_Crop_Dataset.csv y ejecuta el pipeline."
        )
    frame = pd.read_csv(path)
    missing = set(FEATURE_COLS) - set(frame.columns)
    if missing:
        raise ValueError(f"Faltan columnas requeridas: {', '.join(sorted(missing))}")
    if "kmeans_cluster" not in frame.columns:
        model, scaler = load_model()
        frame["kmeans_cluster"] = model.predict(
            scaler.transform(frame[FEATURE_COLS].to_numpy())
        )
    return frame


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.exists() or not SCALER_PATH.exists():
        raise FileNotFoundError("No se encontraron los artefactos del modelo entrenado.")
    return joblib.load(MODEL_PATH), joblib.load(SCALER_PATH)


@lru_cache(maxsize=1)
def load_gmm_model():
    gmm_path = ROOT_DIR / "data" / "models" / "gmm_k5_full.joblib"
    if not gmm_path.exists() or not SCALER_PATH.exists():
        return None, None
    return joblib.load(gmm_path), joblib.load(SCALER_PATH)


def normalize_profile(profile: dict[str, float], frame: pd.DataFrame) -> dict[str, float]:
    mins = frame[FEATURE_COLS].min()
    spans = frame[FEATURE_COLS].max() - mins
    return {
        key: round(float((profile[key] - mins[key]) / (spans[key] or 1)), 4)
        for key in FEATURE_COLS
    }


def feature_stats(frame: pd.DataFrame) -> list[dict]:
    stats = frame[FEATURE_COLS].describe().T
    return [
        {
            "feature": feature,
            "mean": round(float(row["mean"]), 2),
            "std": round(float(row["std"]), 2),
            "min": round(float(row["min"]), 2),
            "median": round(float(row["50%"]), 2),
            "max": round(float(row["max"]), 2),
        }
        for feature, row in stats.iterrows()
    ]


def region_payload(frame: pd.DataFrame, cluster_id: int) -> dict:
    subset = frame[frame["kmeans_cluster"] == cluster_id]
    profile = {
        key: round(float(value), 2)
        for key, value in subset[FEATURE_COLS].mean().items()
    }
    crops = distribution(subset["Crop"]) if "Crop" in subset else []
    soils = distribution(subset["Soil_Type"]) if "Soil_Type" in subset else []
    return {
        "id": int(cluster_id),
        "count": int(len(subset)),
        "share": round(float(len(subset) / len(frame) * 100), 2),
        "topCrop": crops[0]["name"] if crops else None,
        "crops": crops,
        "soils": soils,
        "profile": profile,
        "normalizedProfile": normalize_profile(profile, frame),
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/overview", response_model=OverviewResponse)
def overview():
    try:
        frame = load_dataset()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "metrics": {
            "samples": int(len(frame)),
            "features": len(FEATURE_COLS),
            "regions": int(frame["kmeans_cluster"].nunique()),
            "crops": int(frame["Crop"].nunique()) if "Crop" in frame else 0,
            "soils": int(frame["Soil_Type"].nunique()) if "Soil_Type" in frame else 0,
        },
        "cropDistribution": distribution(frame["Crop"]) if "Crop" in frame else [],
        "soilDistribution": distribution(frame["Soil_Type"]) if "Soil_Type" in frame else [],
        "clusterDistribution": distribution(frame["kmeans_cluster"]),
        "featureStats": feature_stats(frame),
    }


@app.get("/api/regions", response_model=RegionsResponse)
def regions():
    try:
        frame = load_dataset()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    ids = sorted(int(value) for value in frame["kmeans_cluster"].unique())
    return {"regions": [region_payload(frame, cluster_id) for cluster_id in ids]}


@app.get("/api/pca", response_model=PCAResponse)
def pca():
    try:
        frame = load_dataset()
        _, scaler = load_model()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    scaled = scaler.transform(frame[FEATURE_COLS].to_numpy())
    reducer = PCA(n_components=2, random_state=42)
    coordinates = reducer.fit_transform(scaled)
    rng = np.random.default_rng(42)
    indices = np.sort(rng.choice(len(frame), size=min(2500, len(frame)), replace=False))
    points = []
    for index in indices:
        row = frame.iloc[index]
        points.append(
            {
                "x": round(float(coordinates[index, 0]), 4),
                "y": round(float(coordinates[index, 1]), 4),
                "cluster": int(row["kmeans_cluster"]),
                "crop": str(row["Crop"]) if "Crop" in frame else "",
                "soil": str(row["Soil_Type"]) if "Soil_Type" in frame else "",
            }
        )
    return {
        "points": points,
        "explainedVariance": [
            round(float(value * 100), 2) for value in reducer.explained_variance_ratio_
        ],
    }


def management_advice(values: dict[str, float]) -> list[str]:
    advice = []
    if values["pH_Value"] < 5.5:
        advice.append("Considera un análisis de encalado para corregir la acidez del suelo.")
    elif values["pH_Value"] > 7.5:
        advice.append("Monitorea la disponibilidad de hierro y zinc en este suelo alcalino.")
    if values["Rainfall"] > 220:
        advice.append("Prioriza drenaje superficial para reducir el riesgo de saturación radicular.")
    elif values["Rainfall"] < 60:
        advice.append("Evalúa riego suplementario eficiente para compensar el déficit hídrico.")
    if values["Nitrogen"] < 40:
        advice.append("Valida el nitrógeno disponible antes de definir el plan de fertilización.")
    return advice or [
        "Las condiciones ingresadas están dentro de rangos equilibrados para esta ecorregión."
    ]


@app.post("/api/recommend")
def recommend(payload: RecommendationInput):
    try:
        frame = load_dataset()
        model, scaler = load_model()
        gmm_model, gmm_scaler = load_gmm_model()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    values = payload.model_dump()
    vector = np.array([[values[key] for key in FEATURE_COLS]])
    cluster_id = int(model.predict(scaler.transform(vector))[0])
    region = region_payload(frame, cluster_id)
    
    # GMM soft probabilities
    gmm_probs = None
    if gmm_model is not None and gmm_scaler is not None:
        gmm_probs = gmm_model.predict_proba(gmm_scaler.transform(vector))[0].tolist()
    
    response = {
        "cluster": cluster_id,
        "confidenceLabel": "Perfil ambiental más cercano",
        "sampleCount": region["count"],
        "share": region["share"],
        "crops": region["crops"][:5],
        "advice": management_advice(values),
        "userProfile": values,
        "centroidProfile": region["profile"],
        "normalizedUser": normalize_profile(values, frame),
        "normalizedCentroid": region["normalizedProfile"],
    }
    if gmm_probs is not None:
        response["gmmProbabilities"] = [
            {"cluster": i, "probability": round(float(p), 4)} for i, p in enumerate(gmm_probs)
        ]
    return response


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        dist_root = FRONTEND_DIST.resolve()
        requested = (dist_root / path).resolve()
        if not requested.is_relative_to(dist_root):
            raise HTTPException(status_code=404, detail="Recurso no encontrado.")
        if path and requested.is_file():
            return FileResponse(requested)
        return FileResponse(dist_root / "index.html")