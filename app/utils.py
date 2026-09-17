"""
Utilidades para la aplicación interactiva de Streamlit (Project Terra).
"""

import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np
import streamlit as st
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture

# Agregar directorio raíz al path para importar src
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from src.clustering import run_kmeans, run_gmm
from src.profiling import create_radar_chart, plot_pca_clusters, contingency_table

FEATURE_COLS = ["Nitrogen", "Phosphorus", "Potassium", "Temperature", "Humidity", "pH_Value", "Rainfall"]

FEATURE_INFO = {
    "Nitrogen": {"name": "Nitrógeno (N)", "unit": "mg/kg (ppm)", "min": 0.0, "max": 180.0, "default": 65.0, "step": 1.0},
    "Phosphorus": {"name": "Fósforo (P)", "unit": "mg/kg (ppm)", "min": 5.0, "max": 150.0, "default": 55.0, "step": 1.0},
    "Potassium": {"name": "Potasio (K)", "unit": "mg/kg (ppm)", "min": 5.0, "max": 210.0, "default": 50.0, "step": 1.0},
    "Temperature": {"name": "Temperatura", "unit": "°C", "min": 5.0, "max": 50.0, "default": 25.0, "step": 0.5},
    "Humidity": {"name": "Humedad Relativa", "unit": "%", "min": 10.0, "max": 100.0, "default": 70.0, "step": 1.0},
    "pH_Value": {"name": "pH del Suelo", "unit": "escala 0-14", "min": 3.5, "max": 9.5, "default": 6.5, "step": 0.1},
    "Rainfall": {"name": "Precipitación", "unit": "mm", "min": 20.0, "max": 350.0, "default": 120.0, "step": 5.0},
}


@st.cache_data
def load_dataset() -> pd.DataFrame:
    """Carga el dataset clustered si existe, o el original enriquecido."""
    clustered_path = ROOT_DIR / "data" / "processed" / "sensor_Crop_Dataset_clustered.csv"
    raw_path = ROOT_DIR / "data" / "raw" / "sensor_Crop_Dataset.csv"

    if clustered_path.exists():
        df = pd.read_csv(clustered_path)
    elif raw_path.exists():
        df = pd.read_csv(raw_path)
    else:
        raise FileNotFoundError("No se encontró el dataset en data/processed o data/raw.")
    return df


@st.cache_resource
def get_model_and_scaler(k_clusters: int = 5):
    """
    Carga o entrena el modelo KMeans y el StandardScaler sobre las variables numéricas.
    """
    models_dir = ROOT_DIR / "data" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    kmeans_path = models_dir / f"kmeans_k{k_clusters}.joblib"
    scaler_path = models_dir / "scaler.joblib"

    if kmeans_path.exists() and scaler_path.exists():
        scaler = joblib.load(scaler_path)
        kmeans = joblib.load(kmeans_path)
    else:
        raw_path = ROOT_DIR / "data" / "raw" / "sensor_Crop_Dataset.csv"
        df_raw = pd.read_csv(raw_path)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(df_raw[FEATURE_COLS])

        _, kmeans = run_kmeans(X_scaled, k=k_clusters, random_state=42)

        joblib.dump(scaler, scaler_path)
        joblib.dump(kmeans, kmeans_path)

    return kmeans, scaler


@st.cache_resource
def get_gmm_model(k_clusters: int = 5, covariance_type: str = "full"):
    """
    Carga o entrena el modelo GMM y el StandardScaler.

    Args:
        k_clusters: Número de componentes GMM.
        covariance_type: Tipo de estructura de covarianza ('full', 'diag', etc.).

    Returns:
        Tupla (gmm_model, scaler).
    """
    models_dir = ROOT_DIR / "data" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    gmm_path = models_dir / f"gmm_k{k_clusters}_{covariance_type}.joblib"
    scaler_path = models_dir / "scaler.joblib"

    if gmm_path.exists() and scaler_path.exists():
        scaler = joblib.load(scaler_path)
        gmm = joblib.load(gmm_path)
    else:
        raw_path = ROOT_DIR / "data" / "raw" / "sensor_Crop_Dataset.csv"
        df_raw = pd.read_csv(raw_path)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(df_raw[FEATURE_COLS])

        _, _, gmm = run_gmm(X_scaled, k=k_clusters, covariance_type=covariance_type, random_state=42)

        joblib.dump(scaler, scaler_path)
        joblib.dump(gmm, gmm_path)

    return gmm, scaler
