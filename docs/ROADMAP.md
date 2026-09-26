# Roadmap - Project Terra

Este archivo detalla las características planificadas, ideas de mejora y los próximos pasos del proyecto para escalar el producto y su análisis.

## Completado ✅

### Backend & Modelos
- [x] **Pruebas Automatizadas:** 36 tests Python (`pytest`) + 6 tests JS (`node --test`) cubriendo clustering, profiling, economics API, product API, app utils, pipeline y feature selection.
- [x] **CI/CD GitHub Actions:** Pipeline completo en `.github/workflows/ci.yml` ejecutando `pytest`, verificación de modelos `joblib`, build de frontend, `node --test` y `ruff`.
- [x] **Configuración de Tests (`pytest.ini`):** `pythonpath = .` y `testpaths = tests` para ejecución directa.
- [x] **PDF/CSV Export Plan Comercial:** `commercialPdf.js` (2 páginas, siluetas vectoriales, trazabilidad) + botones en `Optimize.jsx`.
- [x] **GMM Soft Probabilities en `/api/recommend`**: Devuelve 5 probabilidades por cluster.
- [x] **Pydantic Response Models** en `/api/overview`, `/regions`, `/pca` — Swagger `/docs` funcional.
- [x] **sklearn version warning resuelto**: Artifacts regenerados con 1.9.0 (0 warnings).
- [x] **Frontend compilado**: `frontend/dist/` existe, FastAPI sirve SPA integrada con fallback para rutas.
- [x] **Feature Selection (P3-7)**: `select_features_kruskal()` + `select_features_mi()` en `clustering.py` con tests dedicados.
- [x] **Mixed Data Clustering (P3-8)**: `prepare_mixed_data()` (one-hot/ordinal) + `run_kprototypes()` wrapper corregido y probado.
- [x] **Dockerfile & `.dockerignore`**: Multi-stage (Node 20 frontend build → Python deps → runtime non-root) con exclusión eficiente de build context.
- [x] **`management_advice()` data-driven**: Compara valores usuario vs. centroide de cluster.
- [x] **`max_ha` placeholders reemplazados**: 6 cultivos con valores realistas por región colombiana.
- [x] **Desminificación `App.jsx` + `index.css`**: 25 líneas → 1100+ líneas legibles; CSS consolidado.
- [x] **`create_notebooks.py` protegido**: Aborta si notebooks existen, `--dry-run`/`--force` disponibles.

### Frontend
- [x] **Exportación de Reportes (Plan Comercial):** PDF + CSV con siluetas, trazabilidad, 3 escenarios, comparación manual.
- [x] **PCA Interactivo (P1-3):** Gráfico de dispersión interactivo con zoom con rueda de ratón, paneo por arrastre, tooltips dinámicos con sombra, y filtros por cultivo y tipo de suelo.
- [x] **Router SPA:** `react-router-dom` con rutas dedicadas (`/`, `/analysis`, `/regions`, `/recommend`, `/optimize`), lazy loading con `Suspense`, `ErrorBoundary` y página 404 personalizada con redirección wildcard.

## Próximos Pasos (To-Do)

### Backend & Modelos
- [ ] **Despliegue a Producción:** Desplegar contenedor Docker / FastAPI en entorno cloud (ej. Render, Railway, AWS ECS).
- [ ] **Mejora del Modelo de Clustering:** Explorar la inclusión de nuevas variables (como `Soil_Type`, `Variety`, altitud o datos satelitales) para mejorar el coeficiente de Silueta y la coherencia agronómica.
- [ ] **Integración en Tiempo Real:** Conectar con APIs climáticas (ej. OpenWeather / IDEAM) o sistemas de mercado (SIPSA) para que los datos de la planeación económica se actualicen dinámicamente.

### Frontend
- [ ] **Despliegue del Cliente:** Publicar el frontend web o distribuirlo a través de CDN/Vercel/Netlify si se desacopla del servidor FastAPI.
- [ ] **Autenticación y Sesiones:** Permitir a los usuarios (agricultores/inversores) crear una cuenta, guardar sus parcelas, y almacenar el historial de su planeación económica.
- [ ] **Soporte Multilingüe (i18n):** Traducir y habilitar el cambio de idioma (Español / Inglés) para abarcar un público más amplio.
