import streamlit as st
import pandas as pd
from pathlib import Path
import sys

# Agregar path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.utils import load_dataset, FEATURE_COLS

st.set_page_config(
    page_title="Project Terra — Ecorregiones Agrícolas",
    page_icon="🌱",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilos CSS de la interfaz Streamlit heredada
st.markdown("""
<style>
    .main-title {
        font-size: 2.8rem;
        font-weight: 800;
        color: #1b4332;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 1.3rem;
        color: #40916c;
        margin-bottom: 1.5rem;
        font-weight: 500;
    }
    .card {
        background-color: #f8f9fa;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        border: 1px solid #e9ecef;
        margin-bottom: 15px;
    }
    .badge-eco {
        background-color: #d8f3dc;
        color: #1b4332;
        padding: 4px 10px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.85rem;
    }
</style>
""", unsafe_allow_html=True)

st.markdown('<div class="main-title">🌱 Project Terra</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Segmentación Inteligente de Zonas Agrícolas y Recomendación de Cultivos</div>', unsafe_allow_html=True)

try:
    df = load_dataset()
    has_clusters = "kmeans_cluster" in df.columns
except Exception as e:
    df = None
    has_clusters = False

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total de Muestras", f"{len(df):,}" if df is not None else "20,000")
with col2:
    st.metric("Variables Ambientales", "7 (Suelo y Clima)")
with col3:
    n_clusters = df["kmeans_cluster"].nunique() if (df is not None and has_clusters) else 5
    st.metric("Ecorregiones Descubiertas", f"{n_clusters} Grupos")
with col4:
    n_crops = df["Crop"].nunique() if (df is not None and "Crop" in df.columns) else "Multi-Cultivo"
    st.metric("Cultivos Analizados", f"{n_crops}")

st.markdown("---")

c_left, c_right = st.columns([3, 2])

with c_left:
    st.markdown("### 🎯 Propósito del Proyecto")
    st.write("""
    **Project Terra** explora si es posible descubrir **"ecorregiones funcionales"** agrícolas
    directamente a partir de variables de suelo y clima (**Nitrógeno, Fósforo, Potasio, pH, Temperatura, Humedad y Precipitación**),
    sin depender de fronteras políticas ni clasificaciones empíricas.
    
    A través de **Machine Learning No Supervisado (K-Means y Clustering Jerárquico)**, agrupamos zonas
    con condiciones agronómicas equivalentes y validamos su coherencia contrastándolas con los cultivos
    reales reportados.
    """)

    st.markdown("### 🔬 Metodología Implementada")
    st.write("""
    1. **Exploración y Limpieza (EDA):** Verificación de integridad, ausencia de duplicados/nulos y análisis de distribuciones.
    2. **Escalado Estándar:** Normalización con `StandardScaler` para garantizar que variables en escalas dispares (ej. Precipitación vs. pH) tengan igual peso en la distancia euclídea.
    3. **Determinación de K Óptimo:** Evaluación conjunta de *Inercia (Método del Codo)*, *Coeficiente de Silueta* e *Índice de Davies-Bouldin*.
    4. **Clustering Multivariado:** Agrupamiento K-Means sobre las 7 dimensiones escaladas reales (usando PCA solo para proyección y visualización 2D).
    5. **Caracterización Diferencial:** Generación de la *firma agronómica* (radar charts) y validación post-hoc contra los cultivos de cada zona.
    """)

with c_right:
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown("### 🧭 Explora Project Terra")
    st.write("""
    Usa el menú lateral para explorar los diferentes módulos de la aplicación:
    
    * **📊 01 Overview:** Conoce la distribución del dataset original, los tipos de suelo (`Soil_Type`) y el balance de cultivos.
    * **🗺️ 02 Explorer:** Inspecciona cada ecorregión en el espacio bidimensional de PCA y compara sus polígonos de radar ambiental.
    * **🧪 03 Recommender:** **¡Simulador en vivo!** Modifica las condiciones del terreno con los deslizadores interactivos y averigua qué cultivos recomienda Project Terra para tu suelo.
    """)
    st.markdown('</div>', unsafe_allow_html=True)

    if df is not None:
        st.markdown("#### Vista Previa de Muestra Agronómica")
        sample_cols = [c for c in ["Crop", "Soil_Type", "Nitrogen", "pH_Value", "Rainfall"] if c in df.columns]
        st.dataframe(df[sample_cols].head(5), width="stretch")

st.info("Dirígete a **03 Recommender** para analizar las condiciones de una parcela.")
