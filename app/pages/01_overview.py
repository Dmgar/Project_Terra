import streamlit as st
import pandas as pd
import plotly.express as px
from pathlib import Path
import sys

# Agregar path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.utils import load_dataset, FEATURE_COLS, FEATURE_INFO

st.set_page_config(page_title="Resumen del Dataset — Project Terra", page_icon="📊", layout="wide")

st.title("📊 Resumen y Análisis Exploratorio de Datos")
st.write("Explora las distribuciones, tipos de suelo y balance de cultivos del dataset original.")

try:
    df = load_dataset()
except Exception as e:
    st.error(f"Error al cargar el dataset: {e}")
    st.stop()

# Métricas superiores
m1, m2, m3, m4 = st.columns(4)
m1.metric("Registros analizados", f"{len(df):,}")
m2.metric("Cultivos únicos", f"{df['Crop'].nunique() if 'Crop' in df.columns else 'N/A'}")
m3.metric("Tipos de suelo", f"{df['Soil_Type'].nunique() if 'Soil_Type' in df.columns else 'N/A'}")
m4.metric("Variables edafoclimáticas", f"{len(FEATURE_COLS)}")

st.markdown("---")

tab1, tab2, tab3 = st.tabs(["🌾 Distribución de Cultivos y Suelos", "📈 Variables Edafoclimáticas", "📋 Datos Crudos"])

with tab1:
    col_a, col_b = st.columns(2)

    with col_a:
        st.subheader("Distribución de Cultivos")
        if "Crop" in df.columns:
            crop_counts = df["Crop"].value_counts().reset_index()
            crop_counts.columns = ["Cultivo", "Frecuencia"]
            fig_crop = px.bar(
                crop_counts,
                x="Frecuencia",
                y="Cultivo",
                orientation="h",
                color="Frecuencia",
                color_continuous_scale="Viridis",
                text="Frecuencia"
            )
            fig_crop.update_layout(yaxis={'categoryorder': 'total ascending'}, template="plotly_white")
            st.plotly_chart(fig_crop, width="stretch")

    with col_b:
        st.subheader("Distribución por Tipo de Suelo")
        if "Soil_Type" in df.columns:
            soil_counts = df["Soil_Type"].value_counts().reset_index()
            soil_counts.columns = ["Tipo de Suelo", "Frecuencia"]
            fig_soil = px.pie(
                soil_counts,
                names="Tipo de Suelo",
                values="Frecuencia",
                color_discrete_sequence=px.colors.qualitative.Prism,
                hole=0.4
            )
            fig_soil.update_layout(template="plotly_white")
            st.plotly_chart(fig_soil, width="stretch")

    if "Crop" in df.columns and "Soil_Type" in df.columns:
        st.subheader("Intersección Cultivo vs. Tipo de Suelo")
        crosstab_soil = pd.crosstab(df["Crop"], df["Soil_Type"])
        fig_heat = px.imshow(
            crosstab_soil,
            text_auto=True,
            aspect="auto",
            color_continuous_scale="Greens",
            labels=dict(x="Tipo de Suelo", y="Cultivo", color="Muestras")
        )
        st.plotly_chart(fig_heat, width="stretch")

with tab2:
    st.subheader("Inspección de Variables Ambientales")
    selected_feature = st.selectbox(
        "Selecciona una variable para analizar su distribución:",
        options=FEATURE_COLS,
        format_func=lambda x: f"{FEATURE_INFO[x]['name']} ({FEATURE_INFO[x]['unit']})"
    )

    f_col1, f_col2 = st.columns(2)
    with f_col1:
        fig_hist = px.histogram(
            df,
            x=selected_feature,
            nbins=35,
            color="Crop" if "Crop" in df.columns else None,
            marginal="box",
            template="plotly_white",
            title=f"Histograma y Boxplot: {FEATURE_INFO[selected_feature]['name']}"
        )
        st.plotly_chart(fig_hist, width="stretch")

    with f_col2:
        st.write("#### Estadísticos Descriptivos")
        stats_df = df[FEATURE_COLS].describe().T[["mean", "std", "min", "50%", "max"]]
        stats_df.columns = ["Media", "Desv. Estándar", "Mínimo", "Mediana", "Máximo"]
        st.dataframe(stats_df.style.format("{:.2f}"), width="stretch")

with tab3:
    st.subheader("Explorador de Registros")
    st.dataframe(df.head(100), width="stretch")
