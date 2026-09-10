import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
from pathlib import Path
import sys

# Agregar path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.utils import load_dataset, get_model_and_scaler, FEATURE_COLS, FEATURE_INFO
from src.profiling import create_radar_chart, plot_pca_clusters, contingency_table

st.set_page_config(page_title="Explorador de Ecorregiones — Project Terra", page_icon="🗺️", layout="wide")

st.title("🗺️ Explorador de Ecorregiones Funcionales")
st.write("""
Inspecciona las ecorregiones descubiertas por el modelo de **K-Means**.
El clustering fue entrenado directamente sobre las 7 variables edafoclimáticas escaladas, 
utilizando el Análisis de Componentes Principales (PCA) exclusivamente para proyectar y visualizar los grupos en dos dimensiones.
""")

try:
    df = load_dataset()
    kmeans_model, scaler = get_model_and_scaler(k_clusters=5)
except Exception as e:
    st.error(f"Error cargando datos o modelos: {e}")
    st.stop()

cluster_col = "kmeans_cluster" if "kmeans_cluster" in df.columns else None

if cluster_col is None:
    st.warning("No se encontró la columna de clústeres. Ejecuta primero el pipeline de clustering.")
    st.stop()

# Pestañas de análisis
tab_radar, tab_pca, tab_detail = st.tabs(["🕸️ Firmas Ambientales (Radar)", "📍 Proyección PCA 2D", "🔬 Detalle por Ecorregión"])

with tab_radar:
    st.subheader("Firma Ambiental Multivariada por Ecorregión")
    st.write("Cada polígono representa el perfil agronómico medio de la ecorregión en escala normalizada (0 a 1). Pasa el cursor sobre cada vértice para ver el valor real en sus unidades físicas.")
    
    fig_radar = create_radar_chart(df, cluster_col=cluster_col, feature_cols=FEATURE_COLS)
    st.plotly_chart(fig_radar, use_container_width=True)

    st.write("#### Medias Agronómicas Reales por Clúster")
    cluster_means = df.groupby(cluster_col)[FEATURE_COLS].mean().round(2)
    st.dataframe(cluster_means, use_container_width=True)

with tab_pca:
    st.subheader("Visualización Espacial (PCA 2D)")
    st.caption("Nota metodológica: El clustering K-Means opera en el espacio de 7 dimensiones. Esta vista en 2D es una proyección que sintetiza la máxima varianza geométrica para inspección visual.")

    X_scaled = scaler.transform(df[FEATURE_COLS])
    hover_cols = [c for c in ["Crop", "Soil_Type"] if c in df.columns]
    hover_data = df[hover_cols] if hover_cols else None

    fig_pca, _ = plot_pca_clusters(
        X_scaled=X_scaled,
        labels=df[cluster_col].values,
        hover_df=hover_data,
        sample_size=2500,
        title="Distribución de Clústeres en el Espacio de Componentes Principales"
    )
    st.plotly_chart(fig_pca, use_container_width=True)

with tab_detail:
    clusters = sorted(df[cluster_col].unique())
    selected_c = st.selectbox("Selecciona una Ecorregión para inspeccionar a fondo:", options=clusters, format_func=lambda x: f"Ecorregión / Clúster {x}")

    sub_df = df[df[cluster_col] == selected_c]

    col_stat1, col_stat2, col_stat3 = st.columns(3)
    col_stat1.metric("Muestras en el clúster", f"{len(sub_df):,}")
    col_stat2.metric("% del total del territorio", f"{(len(sub_df)/len(df)*100):.1f}%")
    if "Crop" in sub_df.columns:
        top_crop = sub_df["Crop"].value_counts().index[0]
        col_stat3.metric("Cultivo predominante", top_crop)

    st.markdown("---")
    d_col1, d_col2 = st.columns(2)

    with d_col1:
        st.write("#### Cultivos más adaptados / frecuentes")
        if "Crop" in sub_df.columns:
            crop_dist = sub_df["Crop"].value_counts(normalize=True).reset_index()
            crop_dist.columns = ["Cultivo", "Proporción"]
            crop_dist["Porcentaje"] = (crop_dist["Proporción"] * 100).round(1).astype(str) + "%"
            fig_crop_dist = px.bar(
                crop_dist.head(6),
                x="Proporción",
                y="Cultivo",
                orientation="h",
                text="Porcentaje",
                color="Proporción",
                color_continuous_scale="Teal"
            )
            fig_crop_dist.update_layout(yaxis={'categoryorder': 'total ascending'}, template="plotly_white")
            st.plotly_chart(fig_crop_dist, use_container_width=True)

    with d_col2:
        st.write("#### Tipos de suelo en esta ecorregión")
        if "Soil_Type" in sub_df.columns:
            soil_dist = sub_df["Soil_Type"].value_counts().reset_index()
            soil_dist.columns = ["Tipo de Suelo", "Frecuencia"]
            fig_soil_dist = px.pie(
                soil_dist,
                names="Tipo de Suelo",
                values="Frecuencia",
                color_discrete_sequence=px.colors.qualitative.Pastel
            )
            fig_soil_dist.update_layout(template="plotly_white")
            st.plotly_chart(fig_soil_dist, use_container_width=True)
