# Project Terra on Replit

## Run the app

The main Replit workflow runs the Streamlit application with:

```bash
python -m streamlit run app/main.py --server.address 0.0.0.0 --server.port 5000 --server.headless true
```

## Data required for the complete demo

The landing page opens without the dataset, but the Overview, Explorer, and
Recommender pages require the original CSV at:

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

- `app/`: Streamlit application and pages
- `src/`: clustering and profiling modules
- `notebooks/`: analysis notebooks
- `data/models/`: trained model and scaler artifacts
- `data/raw/` and `data/processed/`: local datasets excluded from Git