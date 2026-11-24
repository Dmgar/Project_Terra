import React, { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { parcelStill, routeStill } from "./scene/fieldLayout";
import { useSceneValue } from "./scene/sceneStore";
import { tr, useI18n } from "./i18n";

export const FEATURES = [
  "Nitrogen",
  "Phosphorus",
  "Potassium",
  "Temperature",
  "Humidity",
  "pH_Value",
  "Rainfall",
];

// Getters: cada lectura devuelve el nombre en el idioma activo.
export const labels = {
  get Nitrogen() { return tr("Nitrógeno", "Nitrogen"); },
  get Phosphorus() { return tr("Fósforo", "Phosphorus"); },
  get Potassium() { return tr("Potasio", "Potassium"); },
  get Temperature() { return tr("Temperatura", "Temperature"); },
  get Humidity() { return tr("Humedad", "Humidity"); },
  get pH_Value() { return tr("pH del suelo", "Soil pH"); },
  get Rainfall() { return tr("Precipitación", "Rainfall"); },
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

export function shortRegionTag(profile) {
  if (!profile) return "";
  const temp = Number(profile.Temperature);
  const ph = Number(profile.pH_Value);
  const rain = Number(profile.Rainfall);
  const n = Number(profile.Nitrogen);
  const p = Number(profile.Phosphorus);
  const k = Number(profile.Potassium);

  if (temp < 18) {
    if (ph < 5.6) return n >= 150 ? tr("Frío ácido · alto N", "Cool acidic · high N") : tr("Frío ácido", "Cool acidic");
    return p >= 80 || k >= 250 ? tr("Frío neutro · alto P/K", "Cool neutral · high P/K") : tr("Frío neutro", "Cool neutral");
  }
  if (temp >= 22) {
    if (rain >= 160) return ph < 5.6 ? tr("Trópico húmedo ácido", "Humid tropics, acidic") : tr("Trópico húmedo", "Humid tropics");
    if (rain < 100) return ph < 5.6 ? tr("Cálido seco ácido", "Warm dry acidic") : tr("Cálido seco · pH neutro", "Warm dry · neutral pH");
    return ph < 5.6 ? tr("Cálido ácido", "Warm acidic") : tr("Cálido neutro", "Warm neutral");
  }
  return ph < 5.6 ? tr("Templado ácido", "Temperate acidic") : tr("Templado · pH neutro", "Temperate · neutral pH");
}

export function describeRegion(id, profile) {
  const region = tr("Región", "Region");
  if (!profile) return `${region} ${id}`;
  const traits = [];
  const temp = Number(profile.Temperature);
  const ph = Number(profile.pH_Value);
  const rain = Number(profile.Rainfall);
  const n = Number(profile.Nitrogen);
  const p = Number(profile.Phosphorus);
  const k = Number(profile.Potassium);

  if (temp < 18) traits.push(tr("Clima frío", "Cool climate"));
  else if (temp >= 22) traits.push(tr("Clima cálido", "Warm climate"));
  else traits.push(tr("Clima templado", "Temperate climate"));

  if (ph < 5.6) traits.push(tr("pH ácido", "acidic pH"));
  else if (ph > 6.8) traits.push(tr("pH alcalino", "alkaline pH"));
  else traits.push(tr("pH neutro", "neutral pH"));

  if (rain >= 160) traits.push(tr("lluvia alta", "high rainfall"));
  else if (rain < 100) traits.push(tr("lluvia baja", "low rainfall"));
  else if (p >= 80 || k >= 250) traits.push(tr("alto P y K", "high P and K"));
  else if (n >= 150) traits.push(tr("alto N/MO", "high N/OM"));
  else traits.push(tr("lluvia media", "moderate rainfall"));

  return `${region} ${id} · ${traits.join(", ")}`;
}

export function formatApiDetail(detail, fallback = tr("No se pudo procesar la solicitud.", "The request could not be processed.")) {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const field = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
          return field ? `${field}: ${item.msg || tr("valor inválido", "invalid value")}` : item.msg || JSON.stringify(item);
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

// Cultivos y suelos del dataset (sus nombres originales están en inglés).
const datasetLabelsEs = {
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
const datasetLabelsEn = { Silt: "Silty", Clay: "Clay", Saline: "Saline", Sandy: "Sandy", Peaty: "Peaty", Loamy: "Loamy" };
export const datasetLabels = new Proxy(datasetLabelsEs, {
  get: (target, key) => (target[key] ? tr(target[key], datasetLabelsEn[key] ?? key) : undefined),
});

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
    throw new Error(tr(`La solicitud no pudo completarse (${response.status}).`, `The request could not be completed (${response.status}).`));
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
          <h2>{tr("Algo salió mal", "Something went wrong")}</h2>
          <p>{tr("No pudimos cargar esta sección. Por favor, recarga la página.", "We couldn't load this section. Please reload the page.")}</p>
          <button className="button secondary" onClick={() => window.location.reload()}>
            {tr("Recargar página", "Reload page")}
          </button>
          {import.meta.env.DEV && (
            <details style={{ marginTop: 20, textAlign: "left" }}>
              <summary>{tr("Detalles del error", "Error details")}</summary>
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
  useI18n(); // vuelve a pintar el pie de imagen al cambiar de idioma
  const highlight = useSceneValue((state) => state.highlight);
  const sceneCaption = useSceneValue((state) => state.caption);
  const route = routeStill(pathname);
  const src = highlight != null ? parcelStill(highlight) : route.src;
  // El pie puede llegar como función para que siga el idioma activo.
  const focusedCaption = typeof sceneCaption === "function" ? sceneCaption() : sceneCaption;
  const caption = (highlight != null && focusedCaption) || route.caption;

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
  const { tx } = useI18n();
  if (loading)
    return <div className="panel loading">{tx("Leyendo registros de campo…", "Reading field records…")}</div>;
  if (error)
    return (
      <div className="error">
        <b>{tx("No se pudo leer el registro de campo.", "The field records could not be read.")}</b>
        <br />
        {error}
        <br />
        <button className="button secondary" onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
          {tx("Intentar de nuevo", "Try again")}
        </button>
      </div>
    );
  if (empty)
    return <div className="panel result-empty">{tx("Aún no hay observaciones disponibles.", "No observations available yet.")}</div>;
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
