# Changelog - Project Terra

Todas las actualizaciones, cambios notables y fases completadas del proyecto se documentan en este archivo. Nos permite tener un registro claro de la evolución técnica y analítica del proyecto.

## [Fase 9] - Producto: CORS Endurecido, Autenticación/Parcelas y Soporte Multilingüe ES/EN (2026-11-24)
- **Endurecido (CORS):** [`api/server.py`](../api/server.py) ahora lee una lista explícita desde la variable de entorno `ALLOWED_ORIGINS` (rechazando cualquier wildcard `*` y eliminando `allow_origin_regex` de `*.vercel.app`) para habilitar `allow_credentials=True` de forma segura.
- **Agregado (Autenticación, Sesiones y Parcelas Guardadas):** [`api/storage.py`](../api/storage.py) y [`api/auth_routes.py`](../api/auth_routes.py) implementan persistencia SQLite (`TERRA_DB_PATH`, sin dependencias nuevas), hashing `scrypt`, tokens HMAC-SHA256 en cookies `HttpOnly` (`SameSite=Lax`, `Secure` vía `TERRA_COOKIE_SECURE`) y `Bearer`, con endpoints `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` y CRUD `/api/parcels` con aislamiento por usuario. Validado en [`tests/test_auth_and_parcels.py`](../tests/test_auth_and_parcels.py).
- **Agregado (Frontend Auth + i18n ES/EN):** [`frontend/src/i18n.jsx`](../frontend/src/i18n.jsx) (`LanguageProvider` con selector `ES / EN` en [`Layout.jsx`](../frontend/src/Layout.jsx)), [`frontend/src/auth.jsx`](../frontend/src/auth.jsx), nueva vista [`frontend/src/product/Account.jsx`](../frontend/src/product/Account.jsx) (`/cuenta`) y guardado directo de parcelas desde [`frontend/src/product/Recommend.jsx`](../frontend/src/product/Recommend.jsx) sin modificar el render de Blender.

## [Fase 8] - Datos Agroclimáticos Reales de Colombia y Benchmark de Contrastive Learning (2026-11-24)
- **Agregado (Ingesta real reproducible):** [`scripts/ingest_real_colombia.py`](../scripts/ingest_real_colombia.py) descarga y cruza cuatro fuentes abiertas oficiales sin API key: análisis de laboratorio de suelos **AGROSAVIA** (`datos.gov.co/ch4u-f3i5`), municipios trigueros verificados **UPRA EVA 2019–2025** (`datos.gov.co/uejq-wxrr`), georreferenciación **DANE DIVIPOLA** (`datos.gov.co/gdxc-w37w`, 99.8 % de emparejamiento) y climatología real **NASA POWER** (`community=AG`: `T2M`, `RH2M`, `PRECTOTCORR`) con caché por municipio en [`data/processed/nasa_power_municipios_cache.json`](../data/processed/nasa_power_municipios_cache.json). Resultado: [`data/processed/colombia_agroclimatic_real.csv`](../data/processed/colombia_agroclimatic_real.csv) (**12,784 registros reales** en **678 municipios**, preservando los 6 cultivos y 6 tipos de suelo del proyecto).
- **Agregado (Contrastive Learning tabular SCARF):** [`src/contrastive.py`](../src/contrastive.py) implementa `SCARFEncoder` (MLP + Projection Head + pérdida NT-Xent/InfoNCE + corrupción tabular marginal con Adam) en NumPy puro compatible con `scikit-learn` y `joblib` (sin dependencia de PyTorch), validado en [`tests/test_contrastive.py`](../tests/test_contrastive.py).
- **Evaluado (Benchmark comparativo $K=5$):** [`scripts/benchmark_real_vs_synthetic.py`](../scripts/benchmark_real_vs_synthetic.py) y [`docs/real_data_benchmark.json`](./real_data_benchmark.json) confirman el salto de señal frente al dataset sintético (`max |r|`: `0.5534` vs `0.0136`, información mutua total $I(X;\text{Crop})$: `3.2178` vs `0.0039`, techo supervisado RF 5-fold: `85.2 %` vs `17.2 %`). En clustering no supervisado $K=5$, **`StandardScaler (7D)` + K-Means** superó tanto a `PowerTransformer` como a las variantes de SCARF en geometría interna y ARI (Silueta `0.2402`, Davies-Bouldin `1.3536`, Calinski-Harabasz `3,289.4`, Pureza `55.71 %`, ARI `0.2698`, NMI `0.2453`).
- **Promovido a producción (0 cambios en render Blender):** [`scripts/promote_real_model.py`](../scripts/promote_real_model.py) promovió el dataset real y el pipeline ganador ($K=5$) a [`data/processed/sensor_Crop_Dataset_clustered.csv`](../data/processed/sensor_Crop_Dataset_clustered.csv), regeneró `scaler.joblib`, `kmeans_k5.joblib`, `gmm_k5_full.joblib` y coordenadas UMAP 2D, y documentó la trazabilidad en [`data/models/model_metadata.json`](../data/models/model_metadata.json).
- **Actualizado (API & Tests):** [`api/server.py`](../api/server.py) ahora lee dinámicamente el umbral OOD `ood_z_norm_p995` (`7.5694`) desde `data/models/model_metadata.json` (con fallback a `3.6744`), y [`tests/test_product_api.py`](../tests/test_product_api.py) valida el conteo real del dataset cargado.

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
