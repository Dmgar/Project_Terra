from pathlib import Path
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler
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
    
    source_path = PROCESSED_DATA_PATH if PROCESSED_DATA_PATH.exists() else RAW_DATA_PATH
    print(f"Loading data from {source_path}...")
    df = pd.read_csv(source_path)
    X = df[FEATURE_COLS].to_numpy()
    
    scaler_path = MODELS_DIR / "scaler.joblib"
    if scaler_path.exists():
        scaler = joblib.load(scaler_path)
        X_scaled = scaler.transform(X)
    else:
        print("Scaling features...")
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        joblib.dump(scaler, scaler_path)

    if "kmeans_cluster" not in df.columns:
        kmeans_path = MODELS_DIR / "kmeans_k5.joblib"
        if not kmeans_path.exists():
            raise FileNotFoundError("Falta kmeans_k5.joblib; ejecuta primero src/run_pipeline.py.")
        df["kmeans_cluster"] = joblib.load(kmeans_path).predict(X_scaled)
    
    print("Computing UMAP 2D coordinates for visualization...")
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42)
    X_umap = reducer.fit_transform(X_scaled)
    
    print("Updating dataset with UMAP 2D coordinates (preserving 7D kmeans_cluster)...")
    df["umap_1"] = X_umap[:, 0]
    df["umap_2"] = X_umap[:, 1]
    df.to_csv(PROCESSED_DATA_PATH, index=False)
    
    print("Done!")

if __name__ == "__main__":
    main()
