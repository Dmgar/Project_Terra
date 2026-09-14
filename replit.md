# Project Terra on Replit

## Run the product

The main Replit workflow builds the React frontend and starts the FastAPI server:

```bash
cd frontend && npm run build && cd .. && python -m uvicorn api.server:app --host 0.0.0.0 --port 5000
```

## Data required for the complete product

The API requires the original CSV or the processed clustered CSV:

```text
data/raw/sensor_Crop_Dataset.csv
```

The CSV is intentionally excluded from Git. After adding it, run the clustering
pipeline once to generate the processed dataset:

```bash
python -m src.run_pipeline
```

Then restart the main workflow.

## Project structure

- `frontend/`: React product interface
- `api/`: FastAPI endpoints and static frontend serving
- `app/`: legacy Streamlit interface
- `src/`: clustering and profiling modules
- `notebooks/`: analysis notebooks
- `data/models/`: trained model and scaler artifacts
- `data/raw/` and `data/processed/`: local datasets excluded from Git