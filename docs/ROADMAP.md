# Roadmap - Project Terra

Este archivo detalla las características planificadas, ideas de mejora y los próximos pasos del proyecto para escalar el producto y su análisis.

## Completado 

### Backend & Modelos
- [x] **Pruebas Automatizadas:** Tests Python (`pytest`) + tests JS (`node --test`) cubriendo clustering, profiling, economics API, product API, contratos estáticos/404, modelos `.joblib`, CSV comercial y planificación de huerta.
- [x] **CI/CD GitHub Actions:** Pipeline en `.github/workflows/ci.yml` ejecutando `pytest` (con `requirements-dev.txt`), verificación de todos los modelos `.joblib`, build de frontend, `node --test` y `ruff`.
- [x] **Configuración de Tests (`pytest.ini`):** `pythonpath = .` y `testpaths = tests` para ejecución directa.
- [x] **PDF/CSV Export Plan Comercial:** `commercialPdf.js` (2 páginas, trazabilidad, CSV RFC 4180 de 14 columnas anti-fórmulas) + botones en `Optimize.jsx`.
- [x] **GMM Soft Probabilities en `/api/recommend` y UI**: Devuelve y muestra 5 probabilidades por región junto con gráfico de radar SVG.
- [x] **Pydantic Response Models** en `/api/overview`, `/regions`, `/umap` — Swagger `/docs` funcional.
- [x] **sklearn version warning resuelto**: Todos los artefactos activos en `data/models/` (`kmeans_k5`, `scaler`, `gmm_k5_full`) cargan sin warnings en Python 3.13 / sklearn 1.9.0.
- [x] **Frontend compilado**: `frontend/dist/` compilado y servido desde raíz por FastAPI sin conflicto de `root_path="/api"`.
- [x] **Feature Selection (P3-7)**: `select_features_kruskal()` + `select_features_mi()` en `clustering.py` con tests dedicados.
- [x] **Mixed Data Clustering (P3-8)**: `prepare_mixed_data()` (one-hot/ordinal) + `run_kprototypes()` wrapper corregido y probado.
- [x] **Dockerfile & `.dockerignore`**: Multi-stage (Node 20 frontend build → Python deps → runtime non-root) excluyendo `data/raw/`.
- [x] **`management_advice()` data-driven**: Compara valores usuario vs. centroide de cluster.
- [x] **`max_ha` placeholders reemplazados**: 6 cultivos con valores realistas por región colombiana.
- [x] **Desminificación `App.jsx` + `index.css`**: CSS consolidado y token de alerta dedicado (`--terra-alert`).
- [x] **`create_notebooks.py` protegido**: Aborta si notebooks existen, `--dry-run`/`--force` disponibles.
- [x] **Partición canónica 7D + Proyección UMAP 2D**: Inferencia estable en 7D (`kmeans_k5.joblib`) y coordenadas `umap_1`/`umap_2` precalculadas para visualización 2D.
- [x] **Filtro matemático OOD (Out-of-Distribution)**: Cálculo de norma euclidiana basada en Z-scores (`||z||_2 > 3.6744`) con etiqueta clara `"Fuera de rango típico"`.

### Frontend
- [x] **`Mi huerta` (`/producto/plan/huerta`)**: Asistente doméstico con cobertura por personas en casa y PDF de 2 páginas.
- [x] **Exportación de Reportes (Plan Comercial):** PDF + CSV con trazabilidad, 3 escenarios y comparación manual.
- [x] **UMAP 2D Interactivo:** Gráfico de dispersión interactivo con zoom, paneo por arrastre, botones `+`/`−`, tooltips sin solape y filtros por cultivo y tipo de suelo.
- [x] **Router SPA:** `react-router-dom` con rutas dedicadas (`/`, `/producto/recomendar`, `/producto/plan`, `/producto/plan/huerta`, `/producto/plan/comercial`, `/analisis/*`), lazy loading con `Suspense`, `ErrorBoundary` y página 404 personalizada.

## Próximos Pasos (To-Do)

### Backend & Modelos
- [ ] **Ingesta de Datos Agroclimáticos Reales Georreferenciados (Prerrequisito):** Integrar datos reales (SoilGrids, IDEAM/WorldClim, EVA/AGROSAVIA) antes de reevaluar algoritmos avanzados. *(Nota: no incluir `Variety` en clustering por fuga determinista 3:1 hacia `Crop`).*
- [ ] **Contrastive Learning Tabular (condicionado a datos reales):** Evaluar un Encoder MLP + Projection Head con InfoNCE y augmentations tabulares (p. ej. SCARF) frente a K-Means 7D y GMM una vez existan datos reales.
- [ ] **Despliegue a Producción:** Desplegar contenedor Docker / FastAPI en entorno cloud (ej. Render, Railway, AWS ECS).
- [ ] **ETL Batch de Mercado y Clima:** Conectar ingesta periódica (batch) de series SIPSA/IDEAM antes de pasar a tiempo real.

### Frontend
- [ ] **Despliegue del Cliente:** Publicar el frontend web o distribuirlo a través de CDN/Vercel/Netlify.
- [ ] **Autenticación y Sesiones:** Permitir guardar parcelas e historial *(prerrequisito: restringir `ALLOWED_ORIGINS` en CORS sin regex wildcard con credenciales)*.
- [ ] **Soporte Multilingüe (i18n):** Traducir y habilitar el cambio de idioma (Español / Inglés).
