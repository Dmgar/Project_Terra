"""
Script para ejecutar el pipeline de clustering de principio a fin
y exportar los datos enriquecidos y modelos serializados.
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler

# Asegurar importación de src
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from src.clustering import (
    find_optimal_k,
    run_kmeans,
    run_hierarchical,
    find_optimal_gmm,
    run_gmm,
    compare_models,
)
from src.profiling import purity_score, contingency_table

def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=== Iniciando Pipeline de Clustering Project Terra ===")

    raw_path = ROOT_DIR / "data" / "raw" / "sensor_Crop_Dataset.csv"
    processed_dir = ROOT_DIR / "data" / "processed"
    models_dir = ROOT_DIR / "data" / "models"
    processed_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)

    df_raw = pd.read_csv(raw_path)
    print(f"Dataset original cargado: {df_raw.shape[0]:,} filas, {df_raw.shape[1]} columnas")

    feature_cols = ["Nitrogen", "Phosphorus", "Potassium", "Temperature", "Humidity", "pH_Value", "Rainfall"]
    X = df_raw[feature_cols].values

    # Escalado de variables
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    joblib.dump(scaler, models_dir / "scaler.joblib")
    print("StandardScaler entrenado y guardado en data/models/scaler.joblib")

    # -------------------------------------------------------------------------
    # K-Means — búsqueda de K óptimo y entrenamiento
    # -------------------------------------------------------------------------
    print("\nEvaluando métricas K-Means para K de 2 a 8...")
    metrics_df = find_optimal_k(X_scaled, k_range=range(2, 9), random_state=42)
    print(metrics_df.to_string(index=False))

    # Selección de K = 5 como número representativo de ecorregiones
    optimal_k = 5
    print(f"\nEntrenando K-Means con K={optimal_k}...")
    kmeans_labels, kmeans_model = run_kmeans(X_scaled, k=optimal_k, random_state=42)
    joblib.dump(kmeans_model, models_dir / f"kmeans_k{optimal_k}.joblib")
    print(f"Modelo KMeans guardado en data/models/kmeans_k{optimal_k}.joblib")

    # -------------------------------------------------------------------------
    # Clustering Jerárquico Aglomerativo
    # -------------------------------------------------------------------------
    print(f"Entrenando Clustering Jerárquico con K={optimal_k} (Ward)...")
    hier_labels, _ = run_hierarchical(X_scaled, k=optimal_k, linkage_method="ward")

    # -------------------------------------------------------------------------
    # GMM — búsqueda de K óptimo (BIC/AIC) y entrenamiento
    # -------------------------------------------------------------------------
    print("\nEvaluando GMM por BIC/AIC para K de 2 a 10 (covarianzas: full, tied, diag, spherical)...")
    gmm_search_df = find_optimal_gmm(
        X_scaled,
        k_range=range(2, 11),
        covariance_types=("full", "tied", "diag", "spherical"),
        random_state=42,
        n_init=5,
    )
    print(gmm_search_df.to_string(index=False))

    # Seleccionar K con menor BIC (tipo full) — usar mismo K si coincide con optimal_k
    best_gmm_row = gmm_search_df[gmm_search_df["covariance_type"] == "full"].nsmallest(1, "bic").iloc[0]
    best_gmm_k = int(best_gmm_row["k"])
    print(f"\nMejor K para GMM (full, mín BIC): K={best_gmm_k}")
    print(f"Usando K={optimal_k} para mantener comparabilidad directa con K-Means.")

    print(f"\nEntrenando GMM con K={optimal_k}, covariance_type='full'...")
    gmm_labels, gmm_probs, gmm_model = run_gmm(
        X_scaled, k=optimal_k, covariance_type="full", random_state=42, n_init=10
    )
    joblib.dump(gmm_model, models_dir / f"gmm_k{optimal_k}_full.joblib")
    print(f"Modelo GMM guardado en data/models/gmm_k{optimal_k}_full.joblib")
    print(f"GMM convergió: {gmm_model.converged_} | Iteraciones: {gmm_model.n_iter_}")

    # -------------------------------------------------------------------------
    # Comparación de modelos
    # -------------------------------------------------------------------------
    y_true = df_raw["Crop"].values if "Crop" in df_raw.columns else None
    print("\n=== Comparación de Métricas: K-Means vs. GMM ===")
    comparison = compare_models(
        X_scaled,
        labels_kmeans=kmeans_labels,
        labels_gmm=gmm_labels,
        y_true=y_true,
        gmm_model=gmm_model,
    )
    print(comparison.to_string())

    # Decisión automática basada en Silhouette
    km_sil = comparison.loc["kmeans", "silhouette"]
    gmm_sil = comparison.loc["gmm", "silhouette"]
    winner = "GMM" if gmm_sil > km_sil else "K-Means"
    print(f"\n→ Modelo con mayor Silhouette Score: {winner}")

    # -------------------------------------------------------------------------
    # Asignación de etiquetas al dataframe y exportación
    # -------------------------------------------------------------------------
    df_clustered = df_raw.copy()
    df_clustered["kmeans_cluster"] = kmeans_labels
    df_clustered["hierarchical_cluster"] = hier_labels
    df_clustered["gmm_cluster"] = gmm_labels

    # Columnas de probabilidad soft GMM (prob_cluster_0, prob_cluster_1, ...)
    prob_cols = {f"gmm_prob_{i}": gmm_probs[:, i] for i in range(optimal_k)}
    df_clustered = df_clustered.assign(**prob_cols)

    output_csv = processed_dir / "sensor_Crop_Dataset_clustered.csv"
    df_clustered.to_csv(output_csv, index=False)
    print(f"\nDataset con clústeres guardado en: {output_csv}")

    print("\n=== Pipeline completado con éxito ===")

if __name__ == "__main__":
    main()
