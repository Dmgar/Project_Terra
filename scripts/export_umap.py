import sys
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import umap

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DATA_PATH = ROOT_DIR / "data" / "raw" / "sensor_Crop_Dataset.csv"
PROCESSED_DATA_PATH = ROOT_DIR / "data" / "processed" / "sensor_Crop_Dataset_clustered.csv"
MODELS_DIR = ROOT_DIR / "data" / "models"

FEATURE_COLS = [
    "Nitrogen",
    "Phosphorus",
    "Potassium",
    "Temperature",
    "Humidity",
    "pH_Value",
    "Rainfall",
]

def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    print("Loading raw data...")
    df = pd.read_csv(RAW_DATA_PATH)
    X = df[FEATURE_COLS].to_numpy()
    
    print("Scaling features...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print("Training UMAP...")
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42)
    X_umap = reducer.fit_transform(X_scaled)
    
    print("Training K-Means on UMAP embeddings...")
    kmeans = KMeans(n_clusters=5, init="k-means++", n_init=10, max_iter=300, random_state=42)
    kmeans_labels = kmeans.fit_predict(X_umap)
    
    print("Saving models...")
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    joblib.dump(reducer, MODELS_DIR / "umap_reducer.joblib")
    joblib.dump(kmeans, MODELS_DIR / "kmeans_umap_k5.joblib")
    
    print("Updating dataset...")
    # Overwrite the original kmeans_cluster with the new UMAP+KMeans labels
    df["kmeans_cluster"] = kmeans_labels
    df["umap_1"] = X_umap[:, 0]
    df["umap_2"] = X_umap[:, 1]
    df.to_csv(PROCESSED_DATA_PATH, index=False)
    
    print("Done!")

if __name__ == "__main__":
    main()
