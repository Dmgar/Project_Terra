"""Compare unsupervised clustering (K=5) and signal strength:
Synthetic Project Terra dataset vs. Real Colombian agroclimatic dataset,
evaluating K-Means, GMM, and SCARF Tabular Contrastive Learning (InfoNCE).
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import mutual_info_classif
from sklearn.metrics import (
    adjusted_rand_score,
    calinski_harabasz_score,
    davies_bouldin_score,
    normalized_mutual_info_score,
    silhouette_score,
)
from sklearn.metrics.cluster import contingency_matrix
from sklearn.mixture import GaussianMixture
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import PowerTransformer, StandardScaler

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from src.clustering import run_kmeans  # noqa: E402
from src.contrastive import SCARFEncoder  # noqa: E402

FEATURES = [
    "Nitrogen",
    "Phosphorus",
    "Potassium",
    "Temperature",
    "Humidity",
    "pH_Value",
    "Rainfall",
]

SYNTH_PATH = ROOT_DIR / "data" / "processed" / "sensor_Crop_Dataset_clustered.csv"
REAL_PATH = ROOT_DIR / "data" / "processed" / "colombia_agroclimatic_real.csv"
BENCHMARK_JSON = ROOT_DIR / "docs" / "real_data_benchmark.json"


def purity_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    cm = contingency_matrix(y_true, y_pred)
    return float(np.sum(np.amax(cm, axis=0)) / np.sum(cm))


def evaluate_representation(
    label: str,
    X_rep: np.ndarray,
    y_crop: np.ndarray,
    k: int = 5,
    extra: dict | None = None,
) -> dict:
    sample_n = min(5000, len(X_rep))

    km_labels, _ = run_kmeans(X_rep, k=k, random_state=42)
    km_sil = float(silhouette_score(X_rep, km_labels, sample_size=sample_n, random_state=42))
    km_db = float(davies_bouldin_score(X_rep, km_labels))
    km_ch = float(calinski_harabasz_score(X_rep, km_labels))
    km_pur = purity_score(y_crop, km_labels)
    km_ari = float(adjusted_rand_score(y_crop, km_labels))
    km_nmi = float(normalized_mutual_info_score(y_crop, km_labels))

    gmm = GaussianMixture(n_components=k, covariance_type="full", random_state=42)
    gmm_labels = gmm.fit_predict(X_rep)
    gmm_sil = float(silhouette_score(X_rep, gmm_labels, sample_size=sample_n, random_state=42))
    gmm_pur = purity_score(y_crop, gmm_labels)
    gmm_ari = float(adjusted_rand_score(y_crop, gmm_labels))
    gmm_nmi = float(normalized_mutual_info_score(y_crop, gmm_labels))

    row = {
        "pipeline": label,
        "n_rows": int(len(X_rep)),
        "dim": int(X_rep.shape[1]),
        "km_sil": round(km_sil, 4),
        "km_db": round(km_db, 4),
        "km_ch": round(km_ch, 1),
        "km_purity": round(km_pur, 4),
        "km_ari": round(km_ari, 4),
        "km_nmi": round(km_nmi, 4),
        "gmm_sil": round(gmm_sil, 4),
        "gmm_purity": round(gmm_pur, 4),
        "gmm_ari": round(gmm_ari, 4),
        "gmm_nmi": round(gmm_nmi, 4),
    }
    if extra:
        row.update(extra)
    return row, km_labels


def signal_diagnostics(df: pd.DataFrame) -> dict:
    X_raw = df[FEATURES].to_numpy(dtype=float)
    y_crop = df["Crop"].astype(str).to_numpy()
    corr = np.abs(np.corrcoef(X_raw, rowvar=False))
    np.fill_diagonal(corr, 0.0)
    mi = mutual_info_classif(X_raw, y_crop, random_state=42)
    X_std = StandardScaler().fit_transform(X_raw)
    rf = RandomForestClassifier(
        n_estimators=100, max_depth=12, random_state=42, n_jobs=-1
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    rf_acc = float(cross_val_score(rf, X_std, y_crop, cv=cv, scoring="accuracy").mean())
    return {
        "n_rows": int(len(df)),
        "max_abs_r": round(float(corr.max()), 4),
        "mean_abs_r": round(float(corr[np.triu_indices(len(FEATURES), k=1)].mean()), 4),
        "mi_total": round(float(mi.sum()), 4),
        "mi_per_feature": {
            f: round(float(v), 4) for f, v in zip(FEATURES, mi, strict=False)
        },
        "rf_5fold_acc": round(rf_acc, 4),
    }


def main() -> None:
    df_real = pd.read_csv(REAL_PATH)
    y_real = df_real["Crop"].astype(str).to_numpy()
    X_real = df_real[FEATURES].to_numpy(dtype=float)

    diagnostics = {"real_colombia": signal_diagnostics(df_real)}
    rows = []
    label_map: dict[str, np.ndarray] = {}

    # Include synthetic baseline if still present (20,000 rows)
    if SYNTH_PATH.exists():
        df_synth = pd.read_csv(SYNTH_PATH)
        if len(df_synth) == 20_000 and "cod_mpio" not in df_synth.columns:
            diagnostics["synthetic"] = signal_diagnostics(df_synth)
            X_s = StandardScaler().fit_transform(df_synth[FEATURES].to_numpy(dtype=float))
            r, _ = evaluate_representation(
                "Synthetic + StandardScaler",
                X_s,
                df_synth["Crop"].astype(str).to_numpy(),
            )
            rows.append(r)

    # 1. Classical baselines on real Colombia
    X_std = StandardScaler().fit_transform(X_real)
    r_std, lbl_std = evaluate_representation("Real + StandardScaler (7D)", X_std, y_real)
    rows.append(r_std)
    label_map["Real + StandardScaler (7D)"] = lbl_std

    X_pwr = PowerTransformer(method="yeo-johnson").fit_transform(X_real)
    r_pwr, lbl_pwr = evaluate_representation("Real + PowerTransformer (7D)", X_pwr, y_real)
    rows.append(r_pwr)
    label_map["Real + PowerTransformer (7D)"] = lbl_pwr

    # 2. SCARF Contrastive Learning variants (InfoNCE) on real Colombia
    scarf_configs = [
        ("Real + StandardScaler + SCARF (c=0.3, tau=0.3)", X_std, 0.3, 0.3, 60),
        ("Real + StandardScaler + SCARF (c=0.5, tau=0.2)", X_std, 0.5, 0.2, 60),
        ("Real + PowerTransformer + SCARF (c=0.3, tau=0.3)", X_pwr, 0.3, 0.3, 60),
        ("Real + PowerTransformer + SCARF (c=0.5, tau=0.2)", X_pwr, 0.5, 0.2, 60),
    ]
    for name, X_in, corr_rate, tau, epochs in scarf_configs:
        enc = SCARFEncoder(
            hidden_dims=(64, 32),
            embedding_dim=16,
            projection_dim=16,
            corruption_rate=corr_rate,
            temperature=tau,
            epochs=epochs,
            batch_size=256,
            learning_rate=3e-3,
            normalize_embeddings=True,
            random_state=42,
        )
        Z = enc.fit_transform(X_in)
        r_s, lbl_s = evaluate_representation(
            name,
            Z,
            y_real,
            extra={
                "loss_init": round(enc.loss_history_[0], 4),
                "loss_final": round(enc.loss_history_[-1], 4),
            },
        )
        rows.append(r_s)
        label_map[name] = lbl_s

    summary_df = pd.DataFrame(rows)
    print("=== BENCHMARK COMPLETO (K=5): SINTETICO vs REAL vs SCARF CONTRASTIVE ===")
    print(summary_df.to_string(index=False))

    payload = {
        "dataset": str(REAL_PATH.relative_to(ROOT_DIR)),
        "k": 5,
        "diagnostics": diagnostics,
        "models": rows,
    }
    BENCHMARK_JSON.parent.mkdir(parents=True, exist_ok=True)
    BENCHMARK_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved benchmark report: {BENCHMARK_JSON}")


if __name__ == "__main__":
    main()
