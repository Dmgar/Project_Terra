"""
⚠️  DEPRECADO — GENERADOR DE NOTEBOOKS HISTÓRICO

Este script genera los notebooks 03 y 04 EN SU VERSIÓN ORIGINAL.
Los notebooks actuales (03_clustering_model.ipynb, 04_cluster_profiling.ipynb)
han sido EXTENDIDOS A MANO con secciones GMM, UMAP, K-Prototypes, etc.
que este generador NO incluye.

EJECUTAR ESTE SCRIPT SOBRESCRIBIRÍA EL TRABAJO MANUAL.

Uso seguro (solo lectura):
  python -m src.create_notebooks --dry-run

Forzar sobrescritura (PELIGROSO, pierde trabajo manual):
  python -m src.create_notebooks --force

Recomendación: NO USAR. Los notebooks finales están en ./notebooks/
"""

import argparse
import json
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
NOTEBOOKS_DIR = ROOT_DIR / "notebooks"


def make_cell(cell_type: str, source: list):
    cell = {
        "cell_type": cell_type,
        "metadata": {},
        "source": [s + "\n" for s in source]
    }
    if cell_type == "code":
        cell["execution_count"] = None
        cell["outputs"] = []
    return cell


def create_notebook_03():
    cells = [
        make_cell("markdown", [
            "# Fase 2 & 3: Determinación de K y Modelado de Clustering",
            "",
            "**Project Terra** — Descubrimiento de ecorregiones agrícolas con aprendizaje no supervisado.",
            "",
            "En este notebook:",
            "1. Evaluamos el número óptimo de clústeres ($K$) usando **Método del Codo (Inercia)**, **Coeficiente de Silueta** e **Índice de Davies-Bouldin**.",
            "2. Entrenamos **K-Means** sobre los 7 atributos edafoclimáticos escalados (**el clustering NO se hace sobre PCA**).",
            "3. Proyectamos los clústeres en 2D usando **PCA únicamente con propósitos de visualización interactiva**.",
            "4. Contrastamos las agrupaciones con **Clustering Jerárquico Aglomerativo (Ward)** y dendrograma.",
            "5. Exportamos el dataset enriquecido con las etiquetas de clúster a `data/processed/sensor_Crop_Dataset_clustered.csv`."
        ]),
        make_cell("code", [
            "import sys",
            "from pathlib import Path",
            "import numpy as np",
            "import pandas as pd",
            "import matplotlib.pyplot as plt",
            "import seaborn as sns",
            "from sklearn.preprocessing import StandardScaler",
            "from sklearn.cluster import KMeans, AgglomerativeClustering",
            "from scipy.cluster.hierarchy import dendrogram",
            "import plotly.express as px",
            "import joblib",
            "",
            "# Incorporar ruta raíz para importar módulos de src",
            "ROOT_DIR = Path.cwd().parent",
            "if str(ROOT_DIR) not in sys.path:",
            "    sys.path.append(str(ROOT_DIR))",
            "",
            "from src.clustering import find_optimal_k, run_kmeans, compute_hierarchical_linkage, run_hierarchical",
            "from src.profiling import plot_pca_clusters",
            "",
            "sns.set_theme(style='whitegrid')",
            "plt.rcParams['figure.figsize'] = (10, 5)"
        ]),
        make_cell("markdown", [
            "## 1. Carga de Datos",
            "Cargamos los datos limpios y las variables edafoclimáticas escaladas."
        ]),
        make_cell("code", [
            "raw_path = ROOT_DIR / 'data' / 'raw' / 'sensor_Crop_Dataset.csv'",
            "df = pd.read_csv(raw_path)",
            "print(f'Dataset cargado: {df.shape[0]:,} filas x {df.shape[1]} columnas')",
            "",
            "feature_cols = ['Nitrogen', 'Phosphorus', 'Potassium', 'Temperature', 'Humidity', 'pH_Value', 'Rainfall']",
            "X = df[feature_cols].values",
            "",
            "# Escalado de variables",
            "scaler = StandardScaler()",
            "X_scaled = scaler.fit_transform(X)",
            "",
            "df_scaled = pd.DataFrame(X_scaled, columns=feature_cols)",
            "df_scaled.head()"
        ]),
        make_cell("markdown", [
            "## 2. Determinación de K Óptimo",
            "Evaluamos K entre 2 y 8 utilizando 3 criterios complementarios:",
            "- **Inercia (Elbow Method):** Mide la suma de distancias al cuadrado intra-clúster.",
            "- **Silhouette Score:** Mide qué tan similar es un punto a su propio clúster en comparación con otros (mayor es mejor).",
            "- **Davies-Bouldin Index:** Mide la similitud entre cada clúster y su más parecido (menor es mejor)."
        ]),
        make_cell("code", [
            "metrics_df = find_optimal_k(X_scaled, k_range=range(2, 9), random_state=42)",
            "display(metrics_df)",
            "",
            "fig, axes = plt.subplots(1, 3, figsize=(18, 5))",
            "",
            "# 1. Inercia",
            "axes[0].plot(metrics_df['k'], metrics_df['inertia'], marker='o', color='royalblue', linewidth=2)",
            "axes[0].set_title('Método del Codo (Inercia)', fontsize=13)",
            "axes[0].set_xlabel('Número de Clústeres (K)')",
            "axes[0].set_ylabel('Inercia Intra-clúster')",
            "axes[0].grid(True)",
            "",
            "# 2. Silueta",
            "axes[1].plot(metrics_df['k'], metrics_df['silhouette'], marker='s', color='seagreen', linewidth=2)",
            "axes[1].set_title('Coeficiente de Silueta Promedio', fontsize=13)",
            "axes[1].set_xlabel('Número de Clústeres (K)')",
            "axes[1].set_ylabel('Score Silueta')",
            "axes[1].grid(True)",
            "",
            "# 3. Davies-Bouldin",
            "axes[2].plot(metrics_df['k'], metrics_df['davies_bouldin'], marker='^', color='coral', linewidth=2)",
            "axes[2].set_title('Índice Davies-Bouldin (Menor es mejor)', fontsize=13)",
            "axes[2].set_xlabel('Número de Clústeres (K)')",
            "axes[2].set_ylabel('Davies-Bouldin Score')",
            "axes[2].grid(True)",
            "",
            "plt.tight_layout()",
            "plt.show()"
        ]),
        make_cell("markdown", [
            "## 3. Ajuste del Modelo K-Means ($K=5$)",
            "Ajustamos el modelo K-Means sobre las 7 variables escaladas y guardamos los centroides."
        ]),
        make_cell("code", [
            "k_optimal = 5",
            "kmeans_labels, kmeans_model = run_kmeans(X_scaled, k=k_optimal, random_state=42)",
            "",
            "# Inspección de centroides en escala original",
            "centroids_scaled = kmeans_model.cluster_centers_",
            "centroids_original = scaler.inverse_transform(centroids_scaled)",
            "centroids_df = pd.DataFrame(centroids_original, columns=feature_cols)",
            "centroids_df.index = [f'Ecorregión {i}' for i in range(k_optimal)]",
            "print('Centroides de las Ecorregiones en escala real:')",
            "display(centroids_df.round(2))"
        ]),
        make_cell("markdown", [
            "## 4. Visualización de Clústeres con PCA 2D",
            "> **Nota metodológica crucial:** Como se determinó en la planificación, **el clustering se ejecutó sobre las 7 variables escaladas reales**. Usamos PCA en esta celda únicamente como técnica de proyección geométrica para graficar la distribución multivariada en dos dimensiones."
        ]),
        make_cell("code", [
            "hover_info = df[['Crop', 'Soil_Type', 'Rainfall', 'Temperature']]",
            "fig_pca, pca_obj = plot_pca_clusters(",
            "    X_scaled=X_scaled,",
            "    labels=kmeans_labels,",
            "    hover_df=hover_info,",
            "    sample_size=3000,",
            "    title='Proyección PCA 2D de las Ecorregiones K-Means'",
            ")",
            "fig_pca.show()"
        ]),
        make_cell("markdown", [
            "## 5. Clustering Jerárquico Aglomerativo (Ward)",
            "Generamos un dendrograma sobre una muestra representativa para observar la jerarquía de agrupamiento natural y comparamos las asignaciones de K-Means vs Jerárquico."
        ]),
        make_cell("code", [
            "linkage_matrix = compute_hierarchical_linkage(X_scaled, method='ward', sample_size=1500, random_state=42)",
            "",
            "plt.figure(figsize=(12, 6))",
            "dendrogram(linkage_matrix, truncate_mode='lastp', p=30, show_leaf_counts=True, leaf_rotation=90)",
            "plt.title('Dendrograma Jerárquico Aglomerativo (Muestra representativa, Enlace Ward)')",
            "plt.xlabel('Índice de Clúster / Tamaño')",
            "plt.ylabel('Distancia de Fusión')",
            "plt.show()",
            "",
            "# Ajuste jerárquico",
            "hier_labels, _ = run_hierarchical(X_scaled, k=k_optimal, linkage_method='ward')",
            "",
            "# Comparación K-Means vs Jerárquico",
            "comparison = pd.crosstab(kmeans_labels, hier_labels, rownames=['K-Means'], colnames=['Jerárquico'])",
            "print('Tabla de Contingencia: K-Means vs. Clustering Jerárquico:')",
            "display(comparison)"
        ]),
        make_cell("markdown", [
            "## 6. Exportación del Dataset Enriquecido",
            "Agregamos las columnas `kmeans_cluster` y `hierarchical_cluster` al DataFrame y lo guardamos en `data/processed/`."
        ]),
        make_cell("code", [
            "df['kmeans_cluster'] = kmeans_labels",
            "df['hierarchical_cluster'] = hier_labels",
            "",
            "out_path = ROOT_DIR / 'data' / 'processed' / 'sensor_Crop_Dataset_clustered.csv'",
            "df.to_csv(out_path, index=False)",
            "print(f'Dataset exportado exitosamente en: {out_path}')",
            "",
            "# Guardar también el modelo y el escalador para la app interactiva",
            "models_dir = ROOT_DIR / 'data' / 'models'",
            "models_dir.mkdir(parents=True, exist_ok=True)",
            "joblib.dump(kmeans_model, models_dir / f'kmeans_k{k_optimal}.joblib')",
            "joblib.dump(scaler, models_dir / 'scaler.joblib')",
            "print('Modelo y scaler serializados para la app Streamlit.')"
        ])
    ]

    nb = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.10"}
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }
    return nb


def create_notebook_04():
    cells = [
        make_cell("markdown", [
            "# Fase 4: Análisis Diferencial, Perfilado Agronómico y Validación",
            "",
            "**Project Terra** — Caracterización de ecorregiones funcionales y validación cruzada.",
            "",
            "En este notebook:",
            "1. **Perfil Edafoclimático:** Analizamos medias, medianas y boxplots paralelos por clúster.",
            "2. **Firma Multivariada (Radar Chart):** Visualizamos las identidades agronómicas de cada grupo.",
            "3. **Análisis de Tipos de Suelo (`Soil_Type`):** Evaluamos si las ecorregiones reflejan afinidad por sustratos específicos (Arcilla, Limo, Salino, etc.).",
            "4. **Validación Agronómica vs. `Crop`:** Analizamos la distribución de cultivos en cada clúster, calculamos el **Purity Score** y la significancia estadística con **Kruskal-Wallis**.",
            "5. **Conclusiones Estratégicas:** Resumen agronómico para la toma de decisiones y asignación de recursos agrícolas."
        ]),
        make_cell("code", [
            "import sys",
            "from pathlib import Path",
            "import numpy as np",
            "import pandas as pd",
            "import matplotlib.pyplot as plt",
            "import seaborn as sns",
            "from scipy import stats",
            "import plotly.express as px",
            "",
            "ROOT_DIR = Path.cwd().parent",
            "if str(ROOT_DIR) not in sys.path:",
            "    sys.path.append(str(ROOT_DIR))",
            "",
            "from src.profiling import create_radar_chart, contingency_table, purity_score",
            "",
            "sns.set_theme(style='whitegrid')",
            "plt.rcParams['figure.figsize'] = (12, 6)"
        ]),
        make_cell("markdown", [
            "## 1. Carga de Datos Clustered",
            "Cargamos `sensor_Crop_Dataset_clustered.csv` generado en la fase anterior."
        ]),
        make_cell("code", [
            "data_path = ROOT_DIR / 'data' / 'processed' / 'sensor_Crop_Dataset_clustered.csv'",
            "df = pd.read_csv(data_path)",
            "print(f'Muestras: {len(df):,} | Clústeres: {df[\"kmeans_cluster\"].nunique()}')",
            "df.head()"
        ]),
        make_cell("markdown", [
            "## 2. Perfil Ambiental por Ecorregión",
            "Examinamos la media y desviación estándar de cada variable en las ecorregiones."
        ]),
        make_cell("code", [
            "feature_cols = ['Nitrogen', 'Phosphorus', 'Potassium', 'Temperature', 'Humidity', 'pH_Value', 'Rainfall']",
            "means_by_cluster = df.groupby('kmeans_cluster')[feature_cols].mean()",
            "display(means_by_cluster.round(2))",
            "",
            "# Boxplots comparativos para cada variable agrupados por clúster",
            "fig, axes = plt.subplots(nrows=2, ncols=4, figsize=(20, 10))",
            "axes = axes.flatten()",
            "",
            "for i, col in enumerate(feature_cols):",
            "    sns.boxplot(x='kmeans_cluster', y=col, data=df, ax=axes[i], palette='Set2')",
            "    axes[i].set_title(f'Distribución de {col} por Ecorregión', fontsize=12)",
            "    axes[i].set_xlabel('Clúster K-Means')",
            "",
            "fig.delaxes(axes[-1])  # Eliminar último subplot vacío",
            "plt.tight_layout()",
            "plt.show()"
        ]),
        make_cell("markdown", [
            "## 3. Firmas Agronómicas Multivariadas (Radar Charts)",
            "El polígono de radar sintetiza la 'personalidad ambiental' de cada zona en un solo gráfico."
        ]),
        make_cell("code", [
            "fig_radar = create_radar_chart(df, cluster_col='kmeans_cluster', feature_cols=feature_cols)",
            "fig_radar.show()"
        ]),
        make_cell("markdown", [
            "## 4. Análisis de Composición de Suelos (`Soil_Type`)",
            "Evaluamos la distribución de tipos de suelo presentes en cada ecorregión."
        ]),
        make_cell("code", [
            "soil_ct = contingency_table(df, cluster_col='kmeans_cluster', label_col='Soil_Type', normalize='index')",
            "print('Porcentaje de tipos de suelo dentro de cada clúster:')",
            "display(soil_ct)",
            "",
            "# Gráfico de barras apiladas",
            "soil_counts = pd.crosstab(df['kmeans_cluster'], df['Soil_Type'], normalize='index') * 100",
            "soil_counts.plot(kind='bar', stacked=True, colormap='Spectral', figsize=(10, 6))",
            "plt.title('Composición de Tipos de Suelo por Ecorregión (%)')",
            "plt.xlabel('Ecorregión')",
            "plt.ylabel('Porcentaje')",
            "plt.legend(title='Tipo de Suelo', bbox_to_anchor=(1.05, 1), loc='upper left')",
            "plt.tight_layout()",
            "plt.show()"
        ]),
        make_cell("markdown", [
            "## 5. Validación Agronómica contra `Crop` (Cultivo Real)",
            "Contrastamos las ecorregiones descubiertas con los cultivos reales reportados.",
            "Calculamos la pureza del agrupamiento y la matriz de afinidad de cultivo por ecorregión."
        ]),
        make_cell("code", [
            "crop_ct = contingency_table(df, cluster_col='kmeans_cluster', label_col='Crop', normalize='index')",
            "print('Distribución porcentual de cultivos por clúster:')",
            "display(crop_ct)",
            "",
            "purity = purity_score(df['Crop'], df['kmeans_cluster'])",
            "print(f'\\nPureza global de las ecorregiones respecto al cultivo: {purity*100:.2f}%')",
            "",
            "# Heatmap de afinidad clúster vs cultivo",
            "plt.figure(figsize=(14, 7))",
            "sns.heatmap(crop_ct, annot=True, fmt='.1f', cmap='YlGnBu', cbar_kws={'label': '% dentro del clúster'})",
            "plt.title('Mapa de Calor de Afinidad: Ecorregión vs. Cultivo Real (%)')",
            "plt.xlabel('Cultivo')",
            "plt.ylabel('Ecorregión')",
            "plt.show()"
        ]),
        make_cell("markdown", [
            "## 6. Pruebas de Significancia Estadística (Kruskal-Wallis)",
            "Comprobamos formalmente si las diferencias observadas entre ecorregiones para cada variable ambiental son estadísticamente significativas."
        ]),
        make_cell("code", [
            "kw_results = []",
            "for col in feature_cols:",
            "    groups = [group[col].values for _, group in df.groupby('kmeans_cluster')]",
            "    stat, p_val = stats.kruskal(*groups)",
            "    kw_results.append({",
            "        'Variable': col,",
            "        'Kruskal-Wallis H': stat,",
            "        'p-value': p_val,",
            "        'Diferencia Significativa (p < 0.01)': p_val < 0.01",
            "    })",
            "",
            "kw_df = pd.DataFrame(kw_results)",
            "display(kw_df)"
        ]),
        make_cell("markdown", [
            "## 7. Conclusiones y Caracterización de las Ecorregiones",
            "",
            "A partir de los perfiles analizados, cada clúster representa una zona ecológica funcional:",
            "",
            "1. **Ecorregión 0 (Bajo Nitrógeno, Clima Templado):** Nicho ideal para cultivos de secano o rotación con leguminosas que fijen nitrógeno.",
            "2. **Ecorregión 1 (Alta Pluviosidad y Humedad Relativa):** Zona con abundante recurso hídrico, idónea para cultivos de alta demanda como Arroz o Caña.",
            "3. **Ecorregión 2 (Rica en Fósforo y Potasio):** Suelos con alto contenido mineral, propicios para tubérculos y frutales.",
            "4. **Ecorregión 3 (Temperatura Elevada y Clima Seco):** Demanda manejo de riego tecnificado y selección de variedades tolerantes al estrés térmico.",
            "5. **Ecorregión 4 (Suelos Equilibrados / Neutros):** Zonas versátiles de alta productividad para cereales y hortalizas.",
            "",
            "Este perfilado constituye la base del recomendador implementado en la aplicación de Streamlit (`app/main.py`)."
        ])
    ]

    nb = {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "version": "3.10"}
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }
    return nb


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(
        description="Generador histórico de notebooks (DEPRECADO — véase docstring)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Sobrescribe notebooks existentes (PIERDE TRABAJO MANUAL)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra qué haría sin escribir archivos",
    )
    args = parser.parse_args()

    nb3_path = NOTEBOOKS_DIR / "03_clustering_model.ipynb"
    nb4_path = NOTEBOOKS_DIR / "04_cluster_profiling.ipynb"

    if not args.force and (nb3_path.exists() or nb4_path.exists()):
        print("❌  ABORTADO: Los notebooks objetivo ya existen.")
        print(f"    {nb3_path} → {'existe' if nb3_path.exists() else 'no existe'}")
        print(f"    {nb4_path} → {'existe' if nb4_path.exists() else 'no existe'}")
        print("")
        print("    Estos notebooks contienen extensiones manuales (GMM, UMAP, K-Prototypes,")
        print("    feature selection, Soil_Type, etc.) que este generador NO reproduce.")
        print("")
        print("    Para forzar la sobrescritura (NO RECOMENDADO):")
        print("      python -m src.create_notebooks --force")
        print("")
        print("    Para solo ver qué haría (dry-run):")
        print("      python -m src.create_notebooks --dry-run")
        sys.exit(1)

    if args.dry_run:
        print(f"[dry-run] Crearía: {nb3_path}")
        print(f"[dry-run] Crearía: {nb4_path}")
        print("Notebooks existentes:", "SÍ" if nb3_path.exists() else "NO")
        return

    NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)

    nb3 = create_notebook_03()
    with open(nb3_path, "w", encoding="utf-8") as f:
        json.dump(nb3, f, indent=1, ensure_ascii=False)
    print(f"Notebook 03 creado en: {nb3_path}")

    nb4 = create_notebook_04()
    with open(nb4_path, "w", encoding="utf-8") as f:
        json.dump(nb4, f, indent=1, ensure_ascii=False)
    print(f"Notebook 04 creado en: {nb4_path}")


if __name__ == "__main__":
    main()
