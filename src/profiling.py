"""
Módulo para análisis diferencial, perfilado ambiental,
validación agronómica y visualizaciones en Project Terra.
"""

from typing import List, Optional, Tuple, Union
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from sklearn.decomposition import PCA
from sklearn.metrics import confusion_matrix


def cluster_summary(
    df: pd.DataFrame,
    cluster_col: str,
    feature_cols: List[str],
    agg: str = "mean",
) -> pd.DataFrame:
    """
    Calcula el resumen descriptivo de las variables agronómicas agrupadas por clúster.

    Args:
        df: DataFrame que contiene las variables y la asignación de clúster.
        cluster_col: Nombre de la columna de clúster.
        feature_cols: Lista de nombres de columnas numéricas.
        agg: Función de agregación ('mean', 'median', 'std', etc.).

    Returns:
        DataFrame con las estadísticas agregadas por clúster.
    """
    grouped = df.groupby(cluster_col)[feature_cols].agg(agg)
    return grouped


def create_radar_chart(
    df: pd.DataFrame,
    cluster_col: str,
    feature_cols: List[str],
    title: str = "Firma Ambiental por Clúster (Ecorregiones)",
) -> go.Figure:
    """
    Genera un gráfico de radar (Spider Chart) en Plotly comparando
    los perfiles agronómicos medios de cada clúster.
    Las variables son normalizadas de 0 a 1 para una visualización uniforme,
    mostrando el valor real en el tooltip (hover).

    Args:
        df: DataFrame con variables numéricas y columna de clúster.
        cluster_col: Nombre de la columna de clúster.
        feature_cols: Lista de variables a incluir en el radar.
        title: Título del gráfico.

    Returns:
        plotly.graph_objects.Figure
    """
    means = df.groupby(cluster_col)[feature_cols].mean()

    # Normalizar entre 0 y 1 para que el polígono sea proporcional
    min_vals = df[feature_cols].min()
    max_vals = df[feature_cols].max()
    norm_means = (means - min_vals) / (max_vals - min_vals + 1e-9)

    fig = go.Figure()
    categories = feature_cols + [feature_cols[0]]

    colors = px.colors.qualitative.Safe

    for i, cluster_id in enumerate(means.index):
        # Valores normalizados para el radio (cerrando el ciclo)
        r_norm = norm_means.loc[cluster_id].tolist() + [norm_means.loc[cluster_id].iloc[0]]
        # Valores reales para el hover
        r_real = means.loc[cluster_id].tolist() + [means.loc[cluster_id].iloc[0]]

        color = colors[i % len(colors)]

        fig.add_trace(go.Scatterpolar(
            r=r_norm,
            theta=categories,
            fill='toself',
            name=f'Clúster {cluster_id}',
            line=dict(color=color, width=2),
            customdata=r_real,
            hovertemplate=(
                f"<b>Clúster {cluster_id}</b><br>"
                "Variable: %{theta}<br>"
                "Valor promedio real: %{customdata:.2f}<br>"
                "<extra></extra>"
            )
        ))

    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 1],
                showticklabels=False
            )
        ),
        showlegend=True,
        title=dict(text=title, x=0.5, font=dict(size=18)),
        template="plotly_white",
        margin=dict(l=40, r=40, t=60, b=40)
    )

    return fig


def contingency_table(
    df: pd.DataFrame,
    cluster_col: str,
    label_col: str = "Crop",
    normalize: Optional[str] = "index",
) -> pd.DataFrame:
    """
    Genera una tabla de contingencia cruzando la asignación de clústeres
    con los cultivos reales o tipos de suelo.

    Args:
        df: DataFrame con datos.
        cluster_col: Columna de clúster.
        label_col: Columna categórica (ej: 'Crop' o 'Soil_Type').
        normalize: 'index' (proporción dentro del clúster), 'columns', 'all' o None.

    Returns:
        DataFrame de contingencia.
    """
    ct = pd.crosstab(df[cluster_col], df[label_col], normalize=normalize)
    if normalize:
        ct = (ct * 100).round(2)
    return ct


from sklearn.metrics.cluster import contingency_matrix


def purity_score(y_true: Union[pd.Series, np.ndarray], y_pred: Union[pd.Series, np.ndarray]) -> float:
    """
    Calcula la métrica de pureza del clustering respecto a una etiqueta real:
    Purity = (1 / N) * sum_k(max_j |w_k ∩ c_j|)
    """
    cm = contingency_matrix(y_true, y_pred)
    return float(np.sum(np.amax(cm, axis=0)) / np.sum(cm))


def plot_pca_clusters(
    X_scaled: np.ndarray,
    labels: np.ndarray,
    pca_obj: Optional[PCA] = None,
    hover_df: Optional[pd.DataFrame] = None,
    sample_size: Optional[int] = 3000,
    random_state: int = 42,
    title: str = "Proyección PCA 2D de Clústeres",
) -> Tuple[go.Figure, PCA]:
    """
    Proyecta los datos en 2 dimensiones usando PCA y genera un gráfico interactivo
    de dispersión en Plotly coloreado por clúster.

    Args:
        X_scaled: Datos originales escalados.
        labels: Etiquetas de clúster asignadas.
        pca_obj: Objeto PCA opcional preentrenado; si es None, se entrena uno nuevo de 2 componentes.
        hover_df: DataFrame con información adicional para el tooltip (ej: cultivo, variedad).
        sample_size: Tamaño de muestra para renderizado fluido en el navegador.
        random_state: Semilla aleatoria.
        title: Título del gráfico.

    Returns:
        Tupla (figura_plotly, objeto_pca)
    """
    if pca_obj is None:
        pca_obj = PCA(n_components=2, random_state=random_state)
        pca_coords = pca_obj.fit_transform(X_scaled)
    else:
        pca_coords = pca_obj.transform(X_scaled)

    var_ratio = pca_obj.explained_variance_ratio_

    plot_df = pd.DataFrame({
        "PC1": pca_coords[:, 0],
        "PC2": pca_coords[:, 1],
        "Cluster": [f"Clúster {lbl}" for lbl in labels]
    })

    if hover_df is not None:
        for col in hover_df.columns:
            plot_df[col] = hover_df[col].values

    # Muestra representativa para interacción rápida si excede sample_size
    if sample_size and len(plot_df) > sample_size:
        plot_df_sample = plot_df.sample(sample_size, random_state=random_state)
    else:
        plot_df_sample = plot_df

    hover_data_cols = [c for c in plot_df.columns if c not in ["PC1", "PC2", "Cluster"]]

    fig = px.scatter(
        plot_df_sample,
        x="PC1",
        y="PC2",
        color="Cluster",
        hover_data=hover_data_cols if hover_data_cols else None,
        title=f"{title} (Varianza explicada: {var_ratio[0]*100:.1f}% + {var_ratio[1]*100:.1f}% = {sum(var_ratio)*100:.1f}%)",
        template="plotly_white",
        opacity=0.7,
        color_discrete_sequence=px.colors.qualitative.Safe
    )

    fig.update_traces(marker=dict(size=6, line=dict(width=0.5, color='DarkSlateGrey')))
    fig.update_layout(
        xaxis_title=f"Componente Principal 1 ({var_ratio[0]*100:.1f}%)",
        yaxis_title=f"Componente Principal 2 ({var_ratio[1]*100:.1f}%)",
        legend_title="Asignación",
        margin=dict(l=40, r=40, t=60, b=40)
    )

    return fig, pca_obj
