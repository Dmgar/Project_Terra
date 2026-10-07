import React, { useLayoutEffect } from "react";

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

export async function api(url, options) {
  const response = await fetch(url, options);
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
          {process.env.NODE_ENV === "development" && (
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

export function Header({ eyebrow, title, description, action }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      {description && <p className="intro">{description}</p>}
      {action}
    </>
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

export function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  );
}

export function Bars({ items = [], accent = "" }) {
  const max = Math.max(...items.map((x) => x.value || 0), 1);
  return (
    <div>
      {items.slice(0, 8).map((x, i) => (
        <div className="bar-row" key={x.name}>
          <div className="bar-meta">
            <b>{displayDatasetLabel(x.name)}</b>
            <span>{x.share != null ? `${Number(x.share).toFixed(1)}%` : x.value}</span>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill ${accent}`}
              style={{ width: `${Math.max(4, (x.value || 0) / max * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
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
