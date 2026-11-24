"""Promote the winning real Colombian K=5 clustering pipeline to production.

Reads:
- data/processed/colombia_agroclimatic_real.csv
- docs/real_data_benchmark.json (if present, for provenance)

Writes:
- data/models/scaler.joblib
- data/models/kmeans_k5.joblib
- data/models/gmm_k5_full.joblib
- data/models/model_metadata.json
- data/processed/sensor_Crop_Dataset_clustered.csv (with kmeans_cluster, umap_1, umap_2)
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    adjusted_rand_score,
    calinski_harabasz_score,
    davies_bouldin_score,
    normalized_mutual_info_score,
    silhouette_score,
)
from sklearn.metrics.cluster import contingency_matrix
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
import umap

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from src.clustering import run_kmeans  # noqa: E402

FEATURE_COLS = [
    "Nitrogen",
    "Phosphorus",
    "Potassium",
    "Temperature",
    "Humidity",
    "pH_Value",
    "Rainfall",
]

REAL_DATA_PATH = ROOT_DIR / "data" / "processed" / "colombia_agroclimatic_real.csv"
PROD_DATA_PATH = ROOT_DIR / "data" / "processed" / "sensor_Crop_Dataset_clustered.csv"
MODELS_DIR = ROOT_DIR / "data" / "models"
METADATA_PATH = MODELS_DIR / "model_metadata.json"


def purity_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    cm = contingency_matrix(y_true, y_pred)
    return float(np.sum(np.amax(cm, axis=0)) / np.sum(cm))


def main() -> None:
    if not REAL_DATA_PATH.exists():
        raise FileNotFoundError(
            f"No se encontró {REAL_DATA_PATH}. Ejecuta primero scripts/ingest_real_colombia.py."
        )

    df = pd.read_csv(REAL_DATA_PATH)
    X = df[FEATURE_COLS].to_numpy(dtype=float)
    y_crop = df["Crop"].astype(str).to_numpy()

    print(f"1/4 Scaling {len(df)} real Colombian samples (StandardScaler 7D)...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Calibrate empirical OOD threshold at p99.5 of Euclidean Z-score norm
    z_norms = np.linalg.norm(X_scaled, axis=1)
    ood_p995 = round(float(np.percentile(z_norms, 99.5)), 4)
    print(f"    Calibrated OOD threshold (p99.5 ||z||_2): {ood_p995}")

    print("2/4 Training canonical K-Means (K=5) and GMM (K=5, full)...")
    km_labels, km_model = run_kmeans(X_scaled, k=5, random_state=42)
    gmm_model = GaussianMixture(
        n_components=5, covariance_type="full", random_state=42
    ).fit(X_scaled)

    sample_n = min(5000, len(X_scaled))
    metrics = {
        "silhouette": round(
            float(silhouette_score(X_scaled, km_labels, sample_size=sample_n, random_state=42)),
            4,
        ),
        "davies_bouldin": round(float(davies_bouldin_score(X_scaled, km_labels)), 4),
        "calinski_harabasz": round(float(calinski_harabasz_score(X_scaled, km_labels)), 1),
        "purity_vs_crop": round(purity_score(y_crop, km_labels), 4),
        "ari_vs_crop": round(float(adjusted_rand_score(y_crop, km_labels)), 4),
        "nmi_vs_crop": round(float(normalized_mutual_info_score(y_crop, km_labels)), 4),
    }
    print(f"    K-Means K=5 metrics: {metrics}")

    print("3/4 Computing UMAP 2D projection for interactive visualization...")
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42)
    X_umap = reducer.fit_transform(X_scaled)

    df_prod = df.copy()
    df_prod["kmeans_cluster"] = km_labels.astype(int)
    df_prod["umap_1"] = np.round(X_umap[:, 0], 4)
    df_prod["umap_2"] = np.round(X_umap[:, 1], 4)

    print("4/4 Saving production models, metadata, and clustered dataset...")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    joblib.dump(km_model, MODELS_DIR / "kmeans_k5.joblib")
    joblib.dump(gmm_model, MODELS_DIR / "gmm_k5_full.joblib")

    metadata = {
        "promoted_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_origin": "Real Colombian Agroclimatic Dataset (AGROSAVIA + UPRA EVA + DANE DIVIPOLA + NASA POWER)",
        "sources": {
            "soil_lab": "datos.gov.co/ch4u-f3i5 (AGROSAVIA)",
            "wheat_municipalities": "datos.gov.co/uejq-wxrr (UPRA EVA 2019-2025)",
            "georeference": "datos.gov.co/gdxc-w37w (DANE DIVIPOLA)",
            "climatology": "NASA POWER Climatology API (community=AG: T2M, RH2M, PRECTOTCORR)",
        },
        "n_samples": int(len(df_prod)),
        "n_municipalities": int(df_prod["cod_mpio"].nunique()),
        "k_regions": 5,
        "features": FEATURE_COLS,
        "selected_pipeline": "StandardScaler (7D) + K-Means (K=5) + GMM (K=5, full)",
        "selection_rationale": (
            "Outperformed synthetic baseline (Silhouette 0.2402 vs 0.0986, Purity 55.71% vs 17.50%, "
            "ARI 0.2698 vs 0.0000) and beat SCARF contrastive embeddings (Silhouette 0.2006, ARI 0.0859) "
            "and PowerTransformer (Silhouette 0.1893, ARI 0.2064) on internal geometry and ARI while "
            "preserving exact Z-score geometry for OOD calibration."
        ),
        "ood_z_norm_p995": ood_p995,
        "metrics": metrics,
        "benchmark_reference": "docs/real_data_benchmark.json",
    }
    METADATA_PATH.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    df_prod.to_csv(PROD_DATA_PATH, index=False)

    print(f"Done! Promoted {len(df_prod)} real records to {PROD_DATA_PATH}")
    print(f"Metadata written to {METADATA_PATH}")


if __name__ == "__main__":
    main()
