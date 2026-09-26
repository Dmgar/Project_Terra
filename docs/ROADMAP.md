# Roadmap - Project Terra

Este archivo detalla las características planificadas, ideas de mejora y los próximos pasos del proyecto para escalar el producto y su análisis.

## Completado ✅

### Backend & Modelos
- [x] **Pruebas Automatizadas:** 18 tests Python (`pytest`) + 6 tests JS (`node --test`) cubriendo clustering, profiling, economics API, product API y app utils.
- [x] **PDF/CSV Export Plan Comercial:** `commercialPdf.js` (2 páginas, siluetas vectoriales, trazabilidad) + botones en `Optimize.jsx`.
- [x] **GMM Soft Probabilities en `/api/recommend`**: Devuelve 5 probabilidades por cluster.
- [x] **Pydantic Response Models** en `/api/overview`, `/regions`, `/pca` — Swagger `/docs` funcional.
- [x] **sklearn version warning resuelto**: Artifacts regenerados con 1.9.0 (0 warnings).
- [x] **Frontend compilado**: `frontend/dist/` existe, FastAPI sirve SPA integrada.
- [x] **Feature Selection (P3-7)**: `select_features_kruskal()` + `select_features_mi()` en `clustering.py`.
- [x] **Mixed Data Clustering (P3-8)**: `prepare_mixed_data()` (one-hot/ordinal) + `run_kprototypes()` wrapper.
- [x] **Dockerfile**: Multi-stage (frontend build → python deps → runtime non-root).
- [x] **`management_advice()` data-driven**: Compara valores usuario vs. centroide de cluster.
- [x] **`max_ha` placeholders reemplazados**: 6 cultivos con valores realistas por región colombiana.
- [x] **Desminificación `App.jsx` + `index.css`**: 25 líneas → 300+ líneas legibles; 5 CSS → 1 consolidado.
- [x] **`create_notebooks.py` protegido**: Aborta si notebooks existen, `--dry-run`/`--force` disponibles.

### Frontend
- [x] **Exportación de Reportes (Plan Comercial):** PDF + CSV con siluetas, trazabilidad, 3 escenarios, comparación manual.

## Próximos Pasos (To-Do)

### Backend & Modelos
- [ ] **Despliegue a Producción:** Configurar CI/CD y desplegar la API de FastAPI en un entorno cloud (ej. Render, Railway, AWS).
- [ ] **Mejora del Modelo de Clustering:** Explorar la inclusión de nuevas variables (como `Soil_Type`, `Variety`, altitud o datos satelitales) para mejorar el coeficiente de Silueta y la coherencia agronómica.
- [ ] **Integración en Tiempo Real:** Conectar con APIs climáticas (ej. OpenWeather) o sistemas de mercado para que los datos de la planeación económica se actualicen dinámicamente.
- [ ] **CI/CD GitHub Actions:** Automatizar `pytest` + `node --test` en PRs.

### Frontend
- [ ] **Despliegue del Cliente:** Publicar el frontend web en Vercel, Netlify o GitHub Pages.
- [ ] **Autenticación y Sesiones:** Permitir a los usuarios (agricultores/inversores) crear una cuenta, guardar sus parcelas, y almacenar el historial de su planeación económica.
- [ ] **Soporte Multilingüe (i18n):** Traducir y habilitar el cambio de idioma (Español / Inglés) para abarcar un público más amplio.
- [ ] **PCA Interactivo (P1-3):** Tooltips, zoom, filtros por cultivo/suelo en `Scatter` (ya estructurado, pendiente implementar).
- [ ] **Router SPA**: `react-router` + 404 + lazy loading `Optimize` + error boundary.
