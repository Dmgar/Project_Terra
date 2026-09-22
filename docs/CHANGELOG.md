# Changelog - Project Terra

Todas las actualizaciones, cambios notables y fases completadas del proyecto se documentan en este archivo. Nos permite tener un registro claro de la evolución técnica y analítica del proyecto.

## [Fase 6] - Planeación económica de la parcela
- **Agregado:** Optimizador de distribución por hectáreas mediante programación lineal. Contempla restricciones de área, presupuesto y agua.
- **Agregado:** Visualización de escenarios (conservador, esperado y favorable).
- **Agregado:** Integración con referencias estáticas de DANE SIPSA, UPRA/EVA y FAO CROPWAT para dar contexto de mercado, rendimientos y costos.

## [Fase 5] - Producto de inteligencia agronómica
- **Agregado:** Interfaz web responsive desarrollada con React + Vite, mejorando la usabilidad frente a prototipos anteriores.
- **Agregado:** API REST en FastAPI para exponer la ejecución de los modelos, clústeres, y lógicas económicas.
- **Cambio:** La interfaz inicial desarrollada en Streamlit ha sido depreciada y trasladada a la carpeta `app/` a modo de legado.

## [Fase 4] - Análisis diferencial y validación
- **Completado:** Generación de perfiles y firmas ambientales por clúster (visualizados mediante radar charts).
- **Completado:** Pruebas de validación mediante Kruskal-Wallis y análisis de pureza respecto al `label` original (cultivo real).
- **Hallazgo:** Se comprobó que el dataset se fragmenta mejor en base a Humedad, pH, Precipitación y Potasio.

## [Fase 3] - Ejecución del clustering multivariado
- **Completado:** Entrenamiento definitivo de los modelos no supervisados (K-Means y Jerárquico Aglomerativo).
- **Agregado:** Serialización del modelo elegido y su correspondiente escalador (StandardScaler/RobustScaler) dentro del directorio `data/models/`.

## [Fase 2] - Determinación del número de clústeres (K)
- **Completado:** Evaluación paramétrica utilizando los métodos del Codo (Inercia), coeficiente de Silueta y el índice Davies-Bouldin.
- **Decisión:** Se estableció $K=5$ priorizando la interpretabilidad agronómica y operativa, asumiendo las limitaciones del dataset para formar grupos estrictos.

## [Fase 1] - Ingeniería de datos y EDA avanzado
- **Completado:** Pipeline inicial de ingesta, limpieza de datos, análisis exploratorio (EDA), evaluación de distribuciones multivariantes y aplicación preliminar de PCA.
