# Project Terra

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-Machine_Learning-orange?logo=scikit-learn)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-In_Progress-yellow)

> Análisis exploratorio y clustering de zonas agrícolas para la recomendación inteligente de cultivos.

**Project Terra** explora si es posible descubrir "ecorregiones funcionales" agrícolas a partir de variables de suelo y clima (N, P, K, pH, temperatura, humedad y precipitación), sin depender de fronteras políticas ni reglas empíricas. Usando técnicas de aprendizaje no supervisado (K-Means, Clustering Jerárquico, PCA), el proyecto agrupa zonas de muestreo en perfiles ambientales homogéneos y valida su coherencia agronómica contrastando los clústeres contra el cultivo real reportado en cada registro.

Proyecto del curso **Analítica y Minería de Datos** — Escuela de Transformación Digital, Universidad Tecnológica de Bolívar (UTB).

## Equipo

- Dariem Antonio García Cardona
- Jasen Mihovil Yukopila Escobar
- Carlos Miguel Toro Torres

## Objetivos

**Objetivo general:** implementar un modelo de clustering sobre un dataset de recomendación de cultivos para segmentar los registros en grupos homogéneos según sus condiciones climáticas y edáficas.

**Objetivos específicos:**
- Realizar un EDA exhaustivo (distribuciones, atípicos, correlaciones multivariantes, relaciones no lineales).
- Preprocesar y estandarizar variables (StandardScaler / RobustScaler).
- Reducir dimensionalidad con PCA para visualización y eficiencia computacional.
- Segmentar con K-Means y Clustering Jerárquico Aglomerativo, determinando K óptimo (Método del Codo, Silueta, Davies-Bouldin).
- Caracterizar cada clúster (estadísticos descriptivos, radar charts / boxplots paralelos).
- Validar coherencia agronómica contra `label` (cultivo real) y, si aplica, rendimiento (ANOVA / Kruskal-Wallis).

## Dataset

Dataset tipo *Crop Recommendation* con variables predictoras N, P, K, temperatura, humedad, pH y precipitación, más `label` (cultivo) como variable de validación post-hoc.

| Variable | Descripción | Unidad Típica |
| :--- | :--- | :--- |
| **N** | Ratio de contenido de Nitrógeno en el suelo | ppm / razón |
| **P** | Ratio de contenido de Fósforo en el suelo | ppm / razón |
| **K** | Ratio de contenido de Potasio en el suelo | ppm / razón |
| **Temperature** | Temperatura ambiente | °C |
| **Humidity** | Humedad relativa | % |
| **pH** | Valor de pH del suelo | 0-14 |
| **Rainfall** | Precipitación acumulada | mm |
| **Label** | Tipo de cultivo recomendado (Validación) | Categórica |

Fuente: [Crop Recommendation Dataset — Kaggle](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset)

> El CSV original no se versiona en este repo (ver `.gitignore`). Descárgalo y colócalo en `data/raw/`.

## Estructura del repositorio

```
project-terra/
├── data/
│   ├── raw/            # Dataset original sin modificar (no versionado)
│   └── processed/      # Datos limpios (ej. sensor_Crop_Dataset_scaled.csv)
├── notebooks/          # EDA (01_eda), Preprocesamiento y PCA (02_pca)
├── src/                # Funciones y pipeline reutilizable
├── reports/            # Informe técnico, figuras, dashboards
├── requirements.txt
├── LICENSE
└── README.md
```

## Cómo empezar

```bash
git clone https://github.com/Dmgar/Project_Terra.git
cd project_terra
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Descarga el dataset desde Kaggle y colócalo en `data/raw/sensor_Crop_Dataset.csv`.

## Metodología (fases)

```mermaid
flowchart TD
    A[Data Ingestion<br>Kaggle CSV] --> B[EDA & Preprocessing<br>Standard/Robust Scaler]
    B --> C[Reducción Dimensional<br>PCA]
    C --> D[Modelado No Supervisado<br>K-Means / Jerárquico]
    D --> E[Validación Agronómica<br>vs. Label]
    E --> F[Exportación de Resultados]
```

- [x] 1. **Ingeniería de datos y EDA avanzado** — limpieza, correlaciones, pairplots, PCA preliminar. *(Completado)*
- [x] 2. **Determinación del número de clústeres (K)** — codo, silueta, Davies-Bouldin. *(Completado, [`03_clustering.ipynb`](notebooks/03_clustering.ipynb): ninguna métrica marca un K claramente óptimo — silueta baja en todo el rango (0.09–0.11) y Davies-Bouldin decrece de forma monótona; se fijó K=4 por interpretabilidad)*
- [x] 3. **Ejecución del clustering** — asignación de etiqueta de clúster al dataframe. *(Completado, [`03_clustering.ipynb`](notebooks/03_clustering.ipynb): K-Means y Jerárquico Aglomerativo ejecutados con K=4; acuerdo entre ambos casi nulo — ARI = 0.004)*
- [x] 4. **Análisis diferencial** — perfil/firma ambiental de cada clúster. *(Completado, [`04_cluster_profiling.ipynb`](notebooks/04_cluster_profiling.ipynb): los clústeres se explican casi enteramente por Nitrógeno, Fósforo y pH; el cultivo dominante por clúster apenas supera la proporción base del dataset (~17-19%), es decir, coherencia agronómica débil)*
- [x] 5. **Tablero interpretativo** — reporte visual como sistema de recomendación preliminar. *(Completado, [`05_dashboard.ipynb`](notebooks/05_dashboard.ipynb): dashboard interactivo con Plotly y función `recomendar_cultivo()` por centroide más cercano)*

> **Hallazgo clave**: con las variables disponibles (N, P, K, temperatura, humedad, pH, precipitación), el dataset no muestra una estructura de clústeres fuerte ni agronómicamente coherente — ver conclusiones de cada notebook para el detalle y las alternativas propuestas (usar solo N/P/pH, incorporar `Soil_Type`/`Variety`, etc.).

## Entregables esperados

- Dataset enriquecido con la variable de clúster asignada.
- Informe técnico del EDA, algoritmo elegido e interpretación de perfiles.
- Dashboards/gráficos de radar comparando perfiles ambientales.
- Conclusiones prácticas y estratégicas para asignación de recursos agrícolas.

## Licencia

Este proyecto está bajo la licencia MIT — ver [LICENSE](LICENSE) para más detalles.
