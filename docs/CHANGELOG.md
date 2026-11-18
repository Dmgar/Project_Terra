# Changelog - Project Terra

Todas las actualizaciones, cambios notables y fases completadas del proyecto se documentan en este archivo. Nos permite tener un registro claro de la evolución técnica y analítica del proyecto.

## [Fase 7] - Auditoría Integral y Consolidación (2026-11-18)
- **Corregido (Backend & Estáticos):** Eliminado `root_path="/api"` en `api/server.py` para servir `/assets/*` correctamente con Uvicorn; catch-all SPA devuelve `404` JSON en rutas `/api/*` y `/app/*` inexistentes.
- **Unificado (ML 7D):** Inferencia canónica directa sobre `kmeans_k5.joblib` + `scaler.joblib` (7D), eliminando `umap_reducer.joblib` (roto en Python 3.13 / Numba) y `gmm_k5_diag.joblib`; `sensor_Crop_Dataset_clustered.csv` realineado a K-Means 7D manteniendo `umap_1`/`umap_2` para visualización.
- **Corregido (Economía LP):** Activada tolerancia acotada `20% * suitability_tiebreak_weight` en Etapa 2 de `economics_engine.py`, excluidos `min_ha == 0` de `binding_constraints`, y `str_strip_whitespace=True` en `OptimizationRequest`.
- **Corregido (Frontend & Público General):** Reparado zoom invertido y tooltip del scatter UMAP, barras reales en `Overview`/`Analysis`/`Regions`, gráfico de radar SVG + `gmmProbabilities` en `Recommend.jsx`/`Regions.jsx`, token de error `--terra-alert` para `.dot.offline`, actualización funcional y cobertura por personas en `Mi huerta`, formateo de errores `422`, y PDF/CSV comercial (14 columnas RFC 4180 anti-fórmulas).
- **Eliminado (Legado):** Retirada la carpeta `app/` heredada de Streamlit y los 4 scripts duplicados en la raíz.

## [Fase 6] - Planeación económica de la parcela
- **Agregado:** Optimizador de distribución por hectáreas mediante programación lineal. Contempla restricciones de área, presupuesto y agua.
- **Agregado:** Visualización de escenarios (conservador, esperado y favorable).
- **Agregado:** Integración con referencias estáticas de DANE SIPSA, UPRA/EVA y FAO CROPWAT para dar contexto de mercado, rendimientos y costos.

## [Fase 5] - Producto de inteligencia agronómica
- **Agregado:** Interfaz web responsive desarrollada con React + Vite, mejorando la usabilidad frente a prototipos anteriores.
- **Agregado:** API REST en FastAPI para exponer la ejecución de los modelos, clústeres, y lógicas económicas.
- **Agregado:** Detección automática de anomalías y datos OOD (Out-of-Distribution) mediante evaluación de norma Z-score.
- **Cambio:** La interfaz inicial desarrollada en Streamlit ha sido depreciada y trasladada a la carpeta `app/` a modo de legado.

## [Fase 4] - Análisis diferencial y validación
- **Completado:** Generación de perfiles y firmas ambientales por clúster (visualizados mediante radar charts).
- **Completado:** Pruebas de validación mediante Kruskal-Wallis y análisis de pureza respecto al `label` original (cultivo real).
- **Hallazgo:** Se comprobó que el dataset se fragmenta mejor en base a Humedad, pH, Precipitación y Potasio.

## [Fase 3] - Ejecución del clustering multivariado
- **Completado:** Entrenamiento definitivo de los modelos no supervisados (K-Means y Jerárquico Aglomerativo).
- **Mejora:** Transición de PCA a **UMAP** (Uniform Manifold Approximation and Projection) para aislar mejor la estructura local no lineal de los datos y utilizar embeddings mejorados en K-Means.
- **Agregado:** Serialización de los modelos elegidos (`umap_reducer`, `kmeans_umap`) y su correspondiente escalador dentro del directorio `data/models/`.

## [Fase 2] - Determinación del número de clústeres (K)
- **Completado:** Evaluación paramétrica utilizando los métodos del Codo (Inercia), coeficiente de Silueta y el índice Davies-Bouldin.
- **Decisión:** Se estableció $K=5$ priorizando la interpretabilidad agronómica y operativa, asumiendo las limitaciones del dataset para formar grupos estrictos.

## [Fase 1] - Ingeniería de datos y EDA avanzado
- **Completado:** Pipeline inicial de ingesta, limpieza de datos, análisis exploratorio (EDA), evaluación de distribuciones multivariantes y aplicación preliminar de PCA.
