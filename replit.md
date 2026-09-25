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
- `data/economics/`: versioned Colombia planning references and provenance
- `data/raw/` and `data/processed/`: local datasets excluded from Git

## Economic optimizer

`GET /api/economics/catalog` exposes editable Colombia/COP assumptions and
their provenance. `POST /api/optimize` returns the constrained allocation,
three scenarios, financial totals, active constraints, and an optional manual
comparison. The bundled catalog is cached locally and remains available if an
external source is temporarily unavailable.

## Interface language

Use approachable, action-oriented Spanish for navigation and buttons (for example,
“Ver mi recomendación” rather than “Ejecutar recomendación”). Avoid decorative
numbered section labels such as “01 / Resumen de campo” across the website;
retain numbering only when it clarifies an actual process or identifies a region.