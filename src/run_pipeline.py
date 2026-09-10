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

from src.clustering import find_optimal_k, run_kmeans, run_hierarchical
from src.profiling import purity_score, contingency_table

def main():
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

    # Búsqueda de K óptimo
    print("\nEvaluando métricas para K de 2 a 8...")
    metrics_df = find_optimal_k(X_scaled, k_range=range(2, 9), random_state=42)
    print(metrics_df.to_string(index=False))

    # Selección de K = 5 como número representativo de ecorregiones
    optimal_k = 5
    print(f"\nEntrenando K-Means con K={optimal_k} sobre características escaladas...")
    kmeans_labels, kmeans_model = run_kmeans(X_scaled, k=optimal_k, random_state=42)
    joblib.dump(kmeans_model, models_dir / f"kmeans_k{optimal_k}.joblib")
    print(f"Modelo KMeans guardado en data/models/kmeans_k{optimal_k}.joblib")

    # Clustering Jerárquico Aglomerativo
    print(f"Entrenando Clustering Jerárquico con K={optimal_k} (Ward)...")
    # Para jerárquico aglomerativo rápido y seguro con 20k registros
    hier_labels, _ = run_hierarchical(X_scaled, k=optimal_k, linkage_method="ward")

    # Asignación de etiquetas al dataframe original
    df_clustered = df_raw.copy()
    df_clustered["kmeans_cluster"] = kmeans_labels
    df_clustered["hierarchical_cluster"] = hier_labels

    output_csv = processed_dir / "sensor_Crop_Dataset_clustered.csv"
    df_clustered.to_csv(output_csv, index=False)
    print(f"\nDataset con clústeres guardado exitosamente en: {output_csv}")

    # Validación básica
    if "Crop" in df_clustered.columns:
        purity = purity_score(df_clustered["Crop"], df_clustered["kmeans_cluster"])
        print(f"Purity Score vs Cultivo Real: {purity:.4f}")

    print("\n=== Pipeline completado con éxito ===")

if __name__ == "__main__":
    main()
