# Documentación de Project Terra

Bienvenido al directorio de documentación. Aquí encontrarás el registro detallado de las decisiones técnicas, benchmarks de ML y planes a futuro del proyecto.

## Estructura de la Documentación

- [CHANGELOG.md](./CHANGELOG.md): Registro histórico de fases completadas y cambios técnicos (Fases 1–8).
- [ROADMAP.md](./ROADMAP.md): Lista de hitos completados y próximos pasos planificados.
- [real_data_benchmark.json](./real_data_benchmark.json): Resultados reproducibles del benchmark comparativo $K=5$ (sintético vs. datos reales de Colombia vs. SCARF Contrastive Learning).
- [PAPER_MANUSCRIPT_PROPOSAL.md](./PAPER_MANUSCRIPT_PROPOSAL.md): Propuesta de manuscrito científico del proyecto.
- [design-review/README.md](./design-review/README.md): Revisión de diseño e interfaz del frontend.

## Referencias Técnicas de Datos y Modelos (Fase 8)

- **Ingesta de datos reales (Colombia):** [`scripts/ingest_real_colombia.py`](../scripts/ingest_real_colombia.py) → [`data/processed/colombia_agroclimatic_real.csv`](../data/processed/colombia_agroclimatic_real.csv) (12,784 muestras reales en 678 municipios: AGROSAVIA `ch4u-f3i5`, UPRA EVA `uejq-wxrr`, DANE DIVIPOLA `gdxc-w37w` y NASA POWER).
- **Contrastive Learning tabular (SCARF):** [`src/contrastive.py`](../src/contrastive.py) + [`tests/test_contrastive.py`](../tests/test_contrastive.py).
- **Benchmark comparativo:** [`scripts/benchmark_real_vs_synthetic.py`](../scripts/benchmark_real_vs_synthetic.py) → [`docs/real_data_benchmark.json`](./real_data_benchmark.json).
- **Promoción a producción y metadatos:** [`scripts/promote_real_model.py`](../scripts/promote_real_model.py) → [`data/models/model_metadata.json`](../data/models/model_metadata.json) y artefactos `.joblib` en `data/models/`.

## Acerca de la Arquitectura Actual

Project Terra se compone actualmente de:
- **Frontend (`frontend/`)**: SPA en React 18 + Vite con escena pre-renderizada en Blender para 5 ecorregiones (`frontend/src/scene/fieldLayout.js`), `Mi huerta`, `Plan comercial` (PDF/CSV) y `Recomendador 7D`.
- **Backend (`api/`)**: API REST en FastAPI (`api/server.py`, `api/economics_engine.py`) que sirve las predicciones 7D, probabilidades GMM, umbral OOD calibrado dinámicamente y el optimizador LP (`HiGHS`).
- **Modelos y Datos (`notebooks/`, `src/`, `scripts/`, `data/`)**: Pipeline reproducible de ingesta real, clustering 7D, SCARF Contrastive Learning y proyección UMAP 2D.
