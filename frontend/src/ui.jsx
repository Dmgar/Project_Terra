import React, { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { parcelStill, routeStill } from "./scene/fieldLayout";
import { useSceneValue } from "./scene/sceneStore";

export const FEATURES = [
  "Nitrogen",
  "Phosphorus",
  "Potassium",
  "Temperature",
  "Humidity",
  "pH_Value",
  "Rainfall",
];

export const labels = {
  Nitrogen: "Nitrógeno",
  Phosphorus: "Fósforo",
  Potassium: "Potasio",
  Temperature: "Temperatura",
  Humidity: "Humedad",
  pH_Value: "pH del suelo",
  Rainfall: "Precipitación",
};

export const units = {
  Nitrogen: "mg/kg",
  Phosphorus: "mg/kg",
  Potassium: "mg/kg",
  Temperature: "°C",
  Humidity: "%",
  pH_Value: "pH",
  Rainfall: "mm",
};

export const defaults = {
  Nitrogen: 70,
  Phosphorus: 50,
  Potassium: 60,
  Temperature: 24,
  Humidity: 70,
  pH_Value: 6.5,
  Rainfall: 130,
};

export function describeRegion(id, profile) {
  if (!profile) return `Región ${id}`;
  const traits = [];
  if (profile.Humidity >= 65) traits.push("Húmedo");
  else if (profile.Humidity <= 48) traits.push("Seco");
  else traits.push("Humedad media");

  if (profile.pH_Value < 6.1) traits.push("pH ácido");
  else if (profile.pH_Value > 6.9) traits.push("pH alcalino");
  else traits.push("pH neutro");

  if (profile.Rainfall >= 230) traits.push("lluvia alta");
  else if (profile.Rainfall <= 170) traits.push("lluvia baja");

  return `Región ${id} · ${traits.join(", ")}`;
}

export function formatApiDetail(detail, fallback = "No se pudo procesar la solicitud.") {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const field = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
          return field ? `${field}: ${item.msg || "valor inválido"}` : item.msg || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean);
    return msgs.length ? msgs.join(" · ") : fallback;
  }
  if (typeof detail === "object") return detail.msg || detail.message || fallback;
  return String(detail);
}

export const presets = {
  Balanced: { ...defaults },
  "Wet tropical": {
    Nitrogen: 85,
    Phosphorus: 45,
    Potassium: 40,
    Temperature: 28.5,
    Humidity: 88,
    pH_Value: 6.2,
    Rainfall: 260,
  },
  Dryland: {
    Nitrogen: 40,
    Phosphorus: 35,
    Potassium: 30,
    Temperature: 32,
    Humidity: 40,
    pH_Value: 7.4,
    Rainfall: 45,
  },
  "Cool highland": {
    Nitrogen: 50,
    Phosphorus: 90,
    Potassium: 120,
    Temperature: 15,
    Humidity: 75,
    pH_Value: 5.8,
    Rainfall: 140,
  },
};

export const ranges = {
  Nitrogen: [0, 180],
  Phosphorus: [5, 150],
  Potassium: [5, 210],
  Temperature: [5, 50],
  Humidity: [10, 100],
  pH_Value: [3.5, 9.5],
  Rainfall: [20, 350],
};

export const datasetLabels = {
  Wheat: "Trigo",
  Potato: "Papa",
  Maize: "Maíz",
  Tomato: "Tomate",
  Sugarcane: "Caña de azúcar",
  Rice: "Arroz",
  Silt: "Limoso",
  Clay: "Arcilloso",
  Saline: "Salino",
  Sandy: "Arenoso",
  Peaty: "Turboso",
  Loamy: "Franco",
};

export const displayDatasetLabel = (value) => datasetLabels[value] || value;

export const API_ORIGIN = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const API_BASE_URL = `${API_ORIGIN}/api`;

export async function api(endpoint, options) {
  const normalizedUrl = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : endpoint.startsWith("/api")
      ? `${API_ORIGIN}${endpoint}`
      : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await fetch(normalizedUrl, {
    credentials: "include",
    ...options,
  });
  if (!response.ok) {
    throw new Error(`La solicitud no pudo completarse (${response.status}).`);
  }
  return response.json();
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Algo salió mal</h2>
          <p>No pudimos cargar esta sección. Por favor, recarga la página.</p>
          <button className="button secondary" onClick={() => window.location.reload()}>
            Recargar página
          </button>
          {import.meta.env.DEV && (
            <details style={{ marginTop: 20, textAlign: "left" }}>
              <summary>Detalles del error</summary>
              <pre style={{ overflow: "auto", maxHeight: 300 }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// Cabecera común de las páginas internas: el texto a la izquierda y, a la derecha, una imagen del
// mismo render de la finca (el punto del recorrido de este módulo). Si la página enfoca una
// ecorregión (un gráfico, un resultado), la imagen pasa a su parcela con un fundido.
export function Header({ title, description, action }) {
  const { pathname } = useLocation();
  const highlight = useSceneValue((state) => state.highlight);
  const sceneCaption = useSceneValue((state) => state.caption);
  const route = routeStill(pathname);
  const src = highlight != null ? parcelStill(highlight) : route.src;
  const caption = (highlight != null && sceneCaption) || route.caption;

  return (
    <header className="page-banner">
      <div className="banner-inner">
        <div className="banner-copy">
          <h1 className="page-title">{title}</h1>
          {description && <p className="intro">{description}</p>}
          {action}
        </div>
        <figure className="banner-figure">
          <img key={src} className="banner-photo" src={src} alt="" width="1152" height="648" />
          <figcaption className="banner-caption" aria-live="polite">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M8 14.5s5-4.6 5-8.5a5 5 0 0 0-10 0c0 3.9 5 8.5 5 8.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8" cy="6" r="1.8" fill="currentColor" />
            </svg>
            {caption}
          </figcaption>
        </figure>
      </div>
    </header>
  );
}

// Iconos de trazo único para acciones (sustituyen a las flechas Unicode, que cambian de forma
// según la fuente). Heredan el color del texto y escalan con el tamaño de letra.
const ICON_PATHS = {
  right: "M4 10h11M11 5.5 15.5 10 11 14.5",
  left: "M16 10H5M9 5.5 4.5 10 9 14.5",
  down: "M10 4v11M5.5 11 10 15.5 14.5 11",
  external: "M7 5h8v8M15 5 5 15",
  refresh: "M15.5 8A6 6 0 1 0 16 11M15.5 3.5V8H11",
};

export function Icon({ name = "right" }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Section({ title, sub, children, action }) {
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function State({ loading, error, empty, children }) {
  if (loading)
    return <div className="panel loading">Leyendo registros de campo…</div>;
  if (error)
    return (
      <div className="error">
        <b>No se pudo leer el registro de campo.</b>
        <br />
        {error}
        <br />
        <button className="button secondary" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
          Intentar de nuevo
        </button>
      </div>
    );
  if (empty)
    return <div className="panel result-empty">Aún no hay observaciones disponibles.</div>;
  return children;
}

// Mide la pestaña activa dentro de `ref` y publica su posición como --ind-x/--ind-w.
// Un pseudo-elemento del contenedor usa esas variables para deslizarse entre pestañas.
// La transición se activa tras la primera medida para que no "viaje" desde cero al cargar.
export function useSlidingIndicator(ref, dep) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const place = () => {
      const active = el.querySelector(".active, [aria-selected='true']");
      if (!active) {
        el.style.setProperty("--ind-w", "0px");
        return;
      }
      el.style.setProperty("--ind-x", `${active.offsetLeft}px`);
      el.style.setProperty("--ind-w", `${active.offsetWidth}px`);
    };
    place();
    const frame = requestAnimationFrame(() => {
      el.dataset.ready = "1";
    });
    window.addEventListener("resize", place);
    // Las fuentes web cambian el ancho de los textos al cargar.
    document.fonts?.ready.then(place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
    };
  }, [ref, dep]);
}
