import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from pathlib import Path
import sys

# Agregar path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.utils import load_dataset, get_model_and_scaler, get_gmm_model, FEATURE_COLS, FEATURE_INFO

st.set_page_config(page_title="Simulador & Recomendador — Project Terra", page_icon="🧪", layout="wide")

st.title("🧪 Simulador Agronómico en Vivo (Feria)")
st.write("""
**Prueba el sistema en tiempo real:** Ajusta las características de suelo y clima con los deslizadores o elige un escenario predeterminado.
El modelo asignará tu terreno a una **Ecorregión Funcional** y te presentará los cultivos con mayor idoneidad agronómica.
""")

# ---------------------------------------------------------------------------
# Selector de modelo
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### ⚙️ Configuración del Modelo")
    model_choice = st.radio(
        "Algoritmo de Clustering:",
        options=["K-Means", "GMM (Gaussian Mixture)"],
        index=0,
        help=(
            "**K-Means**: Asignación determinista. Más rápido e interpretable.\n\n"
            "**GMM**: Asignación probabilística. Muestra la probabilidad de pertenencia "
            "a cada ecorregión (útil para zonas de transición)."
        ),
    )
    use_gmm = model_choice == "GMM (Gaussian Mixture)"
    st.caption(
        "🟢 Activo: **GMM**" if use_gmm else "🔵 Activo: **K-Means**"
    )

try:
    df = load_dataset()
    kmeans_model, scaler = get_model_and_scaler(k_clusters=5)
    if use_gmm:
        gmm_model, _ = get_gmm_model(k_clusters=5, covariance_type="full")
except Exception as e:
    st.error(f"Error cargando el modelo: {e}")
    st.stop()

# Presets para acelerar la demostración en la feria
presets = {
    "Personalizado": None,
    "Zona Húmeda y Lluviosa (Tropical)": {
        "Nitrogen": 85.0, "Phosphorus": 45.0, "Potassium": 40.0,
        "Temperature": 28.5, "Humidity": 88.0, "pH_Value": 6.2, "Rainfall": 260.0
    },
    "Suelo Templado Fértil (Cereales/Maíz)": {
        "Nitrogen": 110.0, "Phosphorus": 75.0, "Potassium": 80.0,
        "Temperature": 22.0, "Humidity": 65.0, "pH_Value": 6.8, "Rainfall": 120.0
    },
    "Región Seca o de Secano": {
        "Nitrogen": 40.0, "Phosphorus": 35.0, "Potassium": 30.0,
        "Temperature": 32.0, "Humidity": 40.0, "pH_Value": 7.4, "Rainfall": 45.0
    },
    "Zona Alta / Fresca (Papa / Tubérculos)": {
        "Nitrogen": 50.0, "Phosphorus": 90.0, "Potassium": 120.0,
        "Temperature": 15.0, "Humidity": 75.0, "pH_Value": 5.8, "Rainfall": 140.0
    }
}

col_preset, _ = st.columns([1, 1])
with col_preset:
    selected_preset = st.selectbox("⚡ Cargar escenario típico de demostración:", options=list(presets.keys()))

active_values = presets[selected_preset] if presets[selected_preset] is not None else {}

st.markdown("### 🎛️ Parámetros del Terreno")

c1, c2, c3, c4 = st.columns(4)
with c1:
    val_n = st.slider("Nitrógeno (N)", min_value=0.0, max_value=180.0,
                      value=float(active_values.get("Nitrogen", 70.0)), step=1.0, help="mg/kg")
    val_p = st.slider("Fósforo (P)", min_value=5.0, max_value=150.0,
                      value=float(active_values.get("Phosphorus", 50.0)), step=1.0, help="mg/kg")
with c2:
    val_k = st.slider("Potasio (K)", min_value=5.0, max_value=210.0,
                      value=float(active_values.get("Potassium", 60.0)), step=1.0, help="mg/kg")
    val_ph = st.slider("pH del Suelo", min_value=3.5, max_value=9.5,
                       value=float(active_values.get("pH_Value", 6.5)), step=0.1, help="Escala 0-14")
with c3:
    val_temp = st.slider("Temperatura (°C)", min_value=5.0, max_value=45.0,
                         value=float(active_values.get("Temperature", 24.0)), step=0.5)
    val_hum = st.slider("Humedad (%)", min_value=10.0, max_value=100.0,
                        value=float(active_values.get("Humidity", 70.0)), step=1.0)
with c4:
    val_rain = st.slider("Precipitación (mm)", min_value=20.0, max_value=350.0,
                         value=float(active_values.get("Rainfall", 130.0)), step=5.0)
    st.write("")
    st.write("")
    run_btn = st.button("🚀 Analizar Terreno", type="primary", use_container_width=True)

user_input = {
    "Nitrogen": val_n,
    "Phosphorus": val_p,
    "Potassium": val_k,
    "Temperature": val_temp,
    "Humidity": val_hum,
    "pH_Value": val_ph,
    "Rainfall": val_rain,
}

if run_btn or selected_preset != "Personalizado":
    # Preparar vector y escalar
    input_vector = np.array([[user_input[col] for col in FEATURE_COLS]])
    input_scaled = scaler.transform(input_vector)

    # -----------------------------------------------------------------------
    # Predicción según modelo activo
    # -----------------------------------------------------------------------
    if use_gmm:
        predicted_cluster = int(gmm_model.predict(input_scaled)[0])
        soft_probs = gmm_model.predict_proba(input_scaled)[0]  # shape (k,)
        cluster_col = "gmm_cluster" if "gmm_cluster" in df.columns else "kmeans_cluster"
    else:
        predicted_cluster = int(kmeans_model.predict(input_scaled)[0])
        soft_probs = None
        cluster_col = "kmeans_cluster"

    st.markdown("---")
    model_tag = "🟢 GMM" if use_gmm else "🔵 K-Means"
    st.success(f"### 📍 Resultado [{model_tag}]: Tu terreno pertenece a la **Ecorregión {predicted_cluster}**")

    # Muestras históricas del clúster
    cluster_df = df[df[cluster_col] == predicted_cluster] if cluster_col in df.columns else df[df["kmeans_cluster"] == predicted_cluster]
    centroid_real = df.groupby(cluster_col if cluster_col in df.columns else "kmeans_cluster")[FEATURE_COLS].mean().loc[predicted_cluster]

    res_col1, res_col2 = st.columns([1, 1])

    with res_col1:
        st.subheader("🌾 Cultivos Recomendados para tu Zona")
        st.write("Basado en la compatibilidad histórica observada dentro de esta ecorregión:")

        if "Crop" in cluster_df.columns:
            crop_counts = cluster_df["Crop"].value_counts(normalize=True).head(5)
            for rank, (crop, pct) in enumerate(crop_counts.items(), start=1):
                badge_color = "🥇" if rank == 1 else ("🥈" if rank == 2 else "🥉")
                st.markdown(f"**{badge_color} {crop}** — Afinidad del grupo: `{pct * 100:.1f}%`")
                st.progress(float(pct))

        # Probabilidades GMM — exclusivo del modo GMM
        if use_gmm and soft_probs is not None:
            st.markdown("#### 🎲 Probabilidad de Pertenencia por Ecorregión (GMM)")
            st.caption("Una barra alta indica asignación clara; varias barras similares indican zona de transición.")
            n_components = len(soft_probs)
            fig_prob = go.Figure(go.Bar(
                x=[f"Ecorregión {i}" for i in range(n_components)],
                y=soft_probs,
                marker_color=[
                    "#2d6a4f" if i == predicted_cluster else "#a8dadc"
                    for i in range(n_components)
                ],
                text=[f"{p*100:.1f}%" for p in soft_probs],
                textposition="outside",
            ))
            fig_prob.update_layout(
                yaxis=dict(range=[0, 1], title="Probabilidad"),
                xaxis_title="Ecorregión",
                title="Distribución de Probabilidad GMM",
                template="plotly_white",
                height=300,
                margin=dict(l=20, r=20, t=50, b=20),
            )
            st.plotly_chart(fig_prob, use_container_width=True)

        st.markdown("#### 💡 Diagnóstico y Recomendaciones de Manejo")
        advice = []
        if val_ph < 5.5:
            advice.append("⚠️ **Suelo Ácido:** Se recomienda considerar encalado para elevar el pH a niveles óptimos.")
        elif val_ph > 7.5:
            advice.append("ℹ️ **Suelo Alcalino:** Monitorear la asimilación de micronutrientes como hierro y zinc.")

        if val_rain > 220:
            advice.append("🌧️ **Alta Pluviosidad:** Implementar zanjas de drenaje o caballones para evitar asfixia radicular.")
        elif val_rain < 60:
            advice.append("☀️ **Déficit Hídrico:** Obligatorio contar con sistema de riego suplementario o por goteo.")

        if val_n < 40:
            advice.append("🌱 **Nitrógeno Bajo:** Requiere fertilización de base con fuentes nitrogenadas (ej. urea o materia orgánica).")

        if not advice:
            advice.append("✅ **Condiciones Balanceadas:** Las condiciones nutricionales y climáticas se encuentran en rangos equilibrados para la ecorregión.")

        for a in advice:
            st.write(a)

    with res_col2:
        st.subheader("🕸️ Comparación: Tu Suelo vs. Perfil de la Ecorregión")
        st.caption("Contrasta las condiciones ingresadas (línea roja) contra el centroide típico de la ecorregión (área verde).")

        # Radar normalizado
        min_vals = df[FEATURE_COLS].min()
        max_vals = df[FEATURE_COLS].max()

        user_series = pd.Series(user_input)
        user_norm = (user_series - min_vals) / (max_vals - min_vals + 1e-9)
        cent_norm = (centroid_real - min_vals) / (max_vals - min_vals + 1e-9)

        categories = FEATURE_COLS + [FEATURE_COLS[0]]
        r_user = user_norm.tolist() + [user_norm.iloc[0]]
        r_cent = cent_norm.tolist() + [cent_norm.iloc[0]]

        fig_sim_radar = go.Figure()
        fig_sim_radar.add_trace(go.Scatterpolar(
            r=r_cent,
            theta=categories,
            fill='toself',
            name=f'Centroide Ecorregión {predicted_cluster}',
            line=dict(color='#2d6a4f', width=2),
            fillcolor='rgba(45, 106, 79, 0.25)'
        ))
        fig_sim_radar.add_trace(go.Scatterpolar(
            r=r_user,
            theta=categories,
            name='Tu Suelo Ingresado',
            line=dict(color='#e63946', width=3, dash='solid')
        ))

        fig_sim_radar.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 1], showticklabels=False)),
            title=dict(text="Perfil Agronómico Comparativo", x=0.5),
            template="plotly_white",
            margin=dict(l=30, r=30, t=50, b=30)
        )
        st.plotly_chart(fig_sim_radar, use_container_width=True)
