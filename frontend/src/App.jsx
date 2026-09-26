import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

import "./index.css";

const FEATURES = [
  "Nitrogen",
  "Phosphorus",
  "Potassium",
  "Temperature",
  "Humidity",
  "pH_Value",
  "Rainfall",
];

const labels = {
  Nitrogen: "Nitrógeno",
  Phosphorus: "Fósforo",
  Potassium: "Potasio",
  Temperature: "Temperatura",
  Humidity: "Humedad",
  pH_Value: "pH del suelo",
  Rainfall: "Precipitación",
};

const units = {
  Nitrogen: "mg/kg",
  Phosphorus: "mg/kg",
  Potassium: "mg/kg",
  Temperature: "°C",
  Humidity: "%",
  pH_Value: "pH",
  Rainfall: "mm",
};

const defaults = {
  Nitrogen: 70,
  Phosphorus: 50,
  Potassium: 60,
  Temperature: 24,
  Humidity: 70,
  pH_Value: 6.5,
  Rainfall: 130,
};

const presets = {
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

const ranges = {
  Nitrogen: [0, 180],
  Phosphorus: [5, 150],
  Potassium: [5, 210],
  Temperature: [5, 50],
  Humidity: [10, 100],
  pH_Value: [3.5, 9.5],
  Rainfall: [20, 350],
};

const datasetLabels = {
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

const displayDatasetLabel = (value) => datasetLabels[value] || value;

async function api(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`La solicitud no pudo completarse (${response.status}).`);
  }
  return response.json();
}

function Icon({ children }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

class ErrorBoundary extends React.Component {
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

const Optimize = lazy(() => import("./Optimize"));

function LoadingFallback() {
  return <div className="panel loading">Cargando…</div>;
}

function NotFound() {
  return (
    <Layout route="/404">
      <Header
        eyebrow="Página no encontrada"
        title={
          <>
            La ruta no existe<br />
            <em>¿te has desviado?</em>
          </>
        }
        description="La página que buscas no está disponible. Usa la navegación lateral para volver al inicio."
      />
      <div className="callout" style={{ textAlign: "center", maxWidth: 400, margin: "40px auto" }}>
        <a className="button" href="/">
          Volver al inicio →
        </a>
      </div>
    </Layout>
  );
}

function Layout({ children }) {
  const links = [
    ["/", "Resumen", "◌"],
    ["/analysis", "Análisis", "⌁"],
    ["/regions", "Regiones", "⌖"],
    ["/recommend", "Recomendación", "＋"],
    ["/optimize", "Plan rentable", "↗"],
  ];
  const [healthy, setHealthy] = useState(null);

  useEffect(() => {
    api("/api/health")
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false));
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="mark" />
          <div>
            <strong>TERRA</strong>
            <small>inteligencia agronómica</small>
          </div>
        </Link>
        <div className="nav-label">Explora Terra</div>
        <nav className="nav" aria-label="Navegación principal">
          {links.map(([href, text, icon]) => (
            <Link
              key={href}
              to={href}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon>{icon}</Icon>
              <span>{text}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="health">
            <i className={`dot ${healthy === false ? "offline" : ""}`} />
            {healthy === null
              ? "Conectando…"
              : healthy
              ? "Terra disponible"
              : "No se pudo conectar"}
          </div>
          Inteligencia de campo, hecha legible.
        </div>
      </aside>
      <main className="main">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

function Header({ eyebrow, title, description, action }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      {description && <p className="intro">{description}</p>}
      {action}
    </>
  );
}

function Section({ title, sub, children, action }) {
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

function State({ loading, error, empty, children }) {
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

function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  );
}

function Bars({ items = [], accent = "" }) {
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

function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const m = data?.metrics || {};

  return (
    <Layout route="/">
      <Header
        eyebrow="Resumen de campo"
        title={
          <>
            Lee el terreno<br />
            <em>tal como es.</em>
          </>
        }
        description="Project Terra convierte siete señales de suelo y clima en ecorregiones funcionales: patrones que puedes inspeccionar, cuestionar y convertir en decisiones."
      />
      <State loading={!data && !error} error={error}>
        <div className="metrics">
          <Metric
            label="Muestras de campo"
            value={m.samples?.toLocaleString() || "—"}
            note="observaciones indexadas"
          />
          <Metric
            label="Clases de cultivo"
            value={m.crops || "—"}
            note="etiquetas históricas"
          />
          <Metric
            label="Ecorregiones"
            value={m.regions || "—"}
            note="grupos funcionales"
          />
          <Metric
            label="Señales"
            value={m.features || "—"}
            note={`${m.soils || "—"} tipos de suelo`}
          />
        </div>

        <Section
          title="Señal del conjunto"
          sub="Una lectura general de la evidencia"
        >
          <div className="grid-2">
            <div className="panel">
              <h3>Composición de cultivos</h3>
              <p className="panel-caption">
                Etiquetas de cultivo registradas en la muestra de campo.
              </p>
              <Bars items={data?.cropDistribution} />
            </div>
            <div className="panel">
              <h3>Composición del suelo</h3>
              <p className="panel-caption">
                Tipos de suelo en el mismo conjunto de observaciones.
              </p>
              <Bars items={data?.soilDistribution} accent="alt" />
            </div>
          </div>
        </Section>

        <Section
          title="Qué mide Terra"
          sub="Rangos de variables, en sus unidades nativas"
        >
          <div className="panel">
            <div className="feature-list">
              {(data?.featureStats || []).map((f, i) => (
                <div className="feature-line" key={f.feature}>
                  <b>{labels[f.feature] || f.feature}</b>
                  <div className="spark">
                    <i style={{ width: `${35 + (i * 9) % 58}%` }} />
                  </div>
                  <em>
                    {f.mean != null ? Number(f.mean).toFixed(1) : "—"}{" "}
                    {units[f.feature] || ""}
                  </em>
                </div>
              ))}
            </div>
            <div className="note">
              El modelo agrupa observaciones por similitud ambiental, no por
              fronteras políticas. Usa el análisis para ver dónde se sostienen
              esas similitudes y dónde no.
            </div>
          </div>
        </Section>

        <section className="callout" style={{ marginTop: 54 }}>
          <h3>¿Quieres leer una parcela?</h3>
          <p>
            Introduce un perfil de suelo y clima. Terra lo ubicará en la
            ecorregión funcional más cercana y mostrará la evidencia del
            resultado.
          </p>
          <Link className="button" to="/recommend">
            Ver la recomendación →
          </Link>
        </section>
      </State>
    </Layout>
  );
}

function Scatter({ points = [] }) {
  const colors = [
    "#b96b4b",
    "#719b68",
    "#6b9fa0",
    "#d79b51",
    "#7f78a5",
  ];

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [filterCrop, setFilterCrop] = useState("");
  const [filterSoil, setFilterSoil] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const crops = useMemo(
    () => [...new Set(points.map((p) => p.crop).filter(Boolean))].sort(),
    [points]
  );
  const soils = useMemo(
    () => [...new Set(points.map((p) => p.soil).filter(Boolean))].sort(),
    [points]
  );

  const filteredPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          (!filterCrop || p.crop === filterCrop) &&
          (!filterSoil || p.soil === filterSoil)
      ),
    [points, filterCrop, filterSoil]
  );

  const xScale = (x) => 55 + ((Number(x) || 0) + 4) / 8 / zoom * 600 + pan.x;
  const yScale = (y) => 322 - ((Number(y) || 0) + 4) / 8 / zoom * 285 + pan.y;

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.5), 5);
    setPan((prev) => ({
      x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
      y: mouseY - (mouseY - prev.y) * (newZoom / zoom),
    }));
    setZoom(newZoom);
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else {
      let nearest = null;
      let minDist = Infinity;
      filteredPoints.forEach((p) => {
        const px = xScale(p.x);
        const py = yScale(p.y);
        const dist = (px - mouseX) ** 2 + (py - mouseY) ** 2;
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      });
      if (minDist < 1600) {
        setHoveredPoint(nearest);
      } else {
        setHoveredPoint(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="scatter-wrap">
      <div className="scatter-controls">
        <select
          value={filterCrop}
          onChange={(e) => setFilterCrop(e.target.value)}
          aria-label="Filtrar por cultivo"
        >
          <option value="">Todos los cultivos</option>
          {crops.map((c) => (
            <option key={c} value={c}>
              {displayDatasetLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={filterSoil}
          onChange={(e) => setFilterSoil(e.target.value)}
          aria-label="Filtrar por suelo"
        >
          <option value="">Todos los suelos</option>
          {soils.map((s) => (
            <option key={s} value={s}>
              {displayDatasetLabel(s)}
            </option>
          ))}
        </select>
        <button
          className="button secondary"
          onClick={resetView}
          aria-label="Restablecer vista"
        >
          Restablecer vista
        </button>
        <span className="point-count">
          {filteredPoints.length} de {points.length} puntos
        </span>
      </div>

      <div className="scatter-container">
        <svg
          viewBox="0 0 700 380"
          role="img"
          aria-label="Gráfico de dispersión de componentes principales interactivo"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isPanning ? "grabbing" : "grab", touchAction: "none" }}
        >
          <defs>
            <filter id="tooltip-shadow">
              <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.15" />
            </filter>
          </defs>
          <path d="M52 330H665M52 330V24" stroke="#cfd8ce" fill="none" />
          <path d="M52 252H665M52 174H665M52 96H665" stroke="#dfe5dc" />
          {filteredPoints.map((p, i) => (
            <circle
              key={i}
              cx={xScale(p.x)}
              cy={yScale(p.y)}
              r="3.2"
              fill={colors[Number(p.cluster) % 5] || colors[i % 5]}
              opacity=".6"
              data-crop={p.crop}
              data-soil={p.soil}
              data-cluster={p.cluster}
            />
          ))}
          {hoveredPoint && (
            <g className="tooltip" filter="url(#tooltip-shadow)">
              <rect
                x={Math.min(Math.max(xScale(hoveredPoint.x) + 15, 60), 450)}
                y={Math.max(yScale(hoveredPoint.y) - 70, 30)}
                width="220"
                height="72"
                rx="6"
                fill="#173b35"
                opacity="0.98"
              />
              <text
                x={Math.min(Math.max(xScale(hoveredPoint.x) + 20, 65), 455)}
                y={Math.max(yScale(hoveredPoint.y) - 58, 38)}
                fill="#f7f4e9"
                fontSize="12"
                fontWeight="bold"
                fontFamily="var(--body)"
              >
                {displayDatasetLabel(hoveredPoint.crop)}
              </text>
              <text
                x={Math.min(Math.max(xScale(hoveredPoint.x) + 20, 65), 455)}
                y={Math.max(yScale(hoveredPoint.y) - 42, 44)}
                fill="#c3d8b6"
                fontSize="10"
                fontFamily="var(--body)"
              >
                Suelo: {displayDatasetLabel(hoveredPoint.soil)}
              </text>
              <text
                x={Math.min(Math.max(xScale(hoveredPoint.x) + 20, 65), 455)}
                y={Math.max(yScale(hoveredPoint.y) - 26, 50)}
                fill="#c3d8b6"
                fontSize="10"
                fontFamily="var(--body)"
              >
                Ecorregión: {hoveredPoint.cluster}
              </text>
              <text
                x={Math.min(Math.max(xScale(hoveredPoint.x) + 20, 65), 455)}
                y={Math.max(yScale(hoveredPoint.y) - 10, 56)}
                fill="#a8c39c"
                fontSize="10"
                fontFamily="var(--mono)"
              >
                PC1: {Number(hoveredPoint.x).toFixed(2)}, PC2:{' '}
                {Number(hoveredPoint.y).toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="legend">
        {[
          ["#b96b4b", "Ecorregión 0"],
          ["#719b68", "Ecorregión 1"],
          ["#6b9fa0", "Ecorregión 2"],
          ["#d79b51", "Ecorregión 3"],
          ["#7f78a5", "Ecorregión 4"],
        ].map((x) => (
          <span key={x[1]}>
            <i style={{ background: x[0] }} />
            {x[1]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Analysis() {
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pca");

  useEffect(() => {
    Promise.all([api("/api/pca"), api("/api/overview")])
      .then(([a, b]) => {
        setData(a);
        setOverview(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  const tabs = [
    ["pca", "Proyección PCA"],
    ["features", "Variables ambientales"],
    ["clusters", "Comparación de grupos"],
  ];

  return (
    <Layout route="/analysis">
      <Header
        eyebrow="Análisis"
        title={
          <>
            Mide las<br />
            <em>diferencias.</em>
          </>
        }
        description="Explora las distribuciones y proyecciones que sostienen las cinco ecorregiones funcionales de Terra."
      />
      <State loading={!data && !error} error={error}>
        <div className="tabs" role="tablist" aria-label="Vistas de análisis">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              className={`tab ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setTab(
                    tabs[
                      (tabs.findIndex((x) => x[0] === key) + 1) % tabs.length
                    ][0]
                  );
                }
                if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setTab(
                    tabs[
                      (tabs.findIndex((x) => x[0] === key) + tabs.length - 1) %
                        tabs.length
                    ][0]
                  );
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pca" && (
          <div className="grid-2">
            <div className="panel" style={{ gridColumn: "span 2" }}>
              <h3>Proyección de componentes principales</h3>
              <p className="panel-caption">
                Una vista bidimensional de la similitud ambiental en siete
                dimensiones. Cada punto es una observación.
              </p>
              <Scatter points={data?.points} />
              <div className="legend">
                {[
                  ["#b96b4b", "Ecorregión 0"],
                  ["#719b68", "Ecorregión 1"],
                  ["#6b9fa0", "Ecorregión 2"],
                  ["#d79b51", "Ecorregión 3"],
                  ["#7f78a5", "Ecorregión 4"],
                ].map((x) => (
                  <span key={x[1]}>
                    <i style={{ background: x[0] }} />
                    {x[1]}
                  </span>
                ))}
              </div>
              <div className="note">
                PC1 explica{" "}
                {(data?.explainedVariance?.[0] || 0).toFixed(1)}% de la
                varianza; PC2 explica{" "}
                {(data?.explainedVariance?.[1] || 0).toFixed(1)}%. La
                proyección sirve para inspección; el agrupamiento opera en las
                siete dimensiones.
              </div>
            </div>
          </div>
        )}

        {tab === "features" && (
          <div className="grid-2">
            <div className="panel">
              <h3>Distribuciones ambientales</h3>
              <p className="panel-caption">
                Media y extensión observada en unidades originales.
              </p>
              <div className="feature-list">
                {(overview?.featureStats || []).map((f, i) => (
                  <div className="feature-line" key={f.feature}>
                    <b>{labels[f.feature] || f.feature}</b>
                    <div className="spark">
                      <i
                        style={{
                          width: `${40 + (i * 8) % 50}%`,
                          background: i % 2 ? "#6b9fa0" : "#b96b4b",
                        }}
                      />
                    </div>
                    <em>
                      {Number(f.min || 0).toFixed(1)}—{" "}
                      {Number(f.max || 0).toFixed(1)}
                    </em>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3>Distribución de cultivos</h3>
              <p className="panel-caption">
                Las etiquetas de referencia junto a las señales del modelo.
              </p>
              <Bars items={overview?.cropDistribution} accent="sun" />
            </div>
          </div>
        )}

        {tab === "clusters" && (
          <div className="panel">
            <h3>Distribución de ecorregiones</h3>
            <p className="panel-caption">
              Proporción de la muestra observada en cada grupo funcional.
            </p>
            <Bars items={overview?.clusterDistribution} accent="alt" />
          </div>
        )}
      </State>
    </Layout>
  );
}

function Regions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    api("/api/regions")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const region = data?.regions?.[selected];

  return (
    <Layout route="/regions">
      <Header
        eyebrow="Regiones"
        title={
          <>
            Cinco formas de<br />
            <em>comportarse.</em>
          </>
        }
        description="Las ecorregiones funcionales son perfiles, no etiquetas: combinaciones recurrentes de nutrientes, clima y agua."
      />
      <State loading={!data && !error} error={error}>
        <div className="region-grid">
          {(data?.regions || []).map((r, i) => (
            <button
              className={`region-card ${selected === i ? "selected" : ""}`}
              key={r.id}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
            >
              <h3>Región {r.id}</h3>
              <strong>{Number(r.share || 0).toFixed(1)}%</strong>
              <small>{r.count?.toLocaleString()} observaciones</small>
              <div className="profile-bars">
                {Object.entries(r.normalizedProfile || {}).slice(0, 4).map(
                  ([k, v]) => (
                    <span className="profile-mini" key={k}>
                      {(labels[k] || k).slice(0, 3)}
                      <i
                        style={{ width: `${Math.max(10, Number(v) * 50)}px` }}
                      />
                    </span>
                  )
                )}
              </div>
            </button>
          ))}
        </div>

        {region && (
          <div className="detail grid-2">
            <div className="panel">
              <span className="kicker">Región {region.id} / perfil</span>
              <h2
                style={{
                  font: "34px var(--display)",
                  fontWeight: 400,
                  margin: "13px 0",
                }}
              >
                Territorio con predominio de{" "}
                {displayDatasetLabel(region.topCrop || "cultivo mixto")}
              </h2>
              <p className="intro">
                Este grupo contiene {region.count?.toLocaleString()} observaciones
                ({Number(region.share || 0).toFixed(1)}% de la muestra). Su cultivo
                más frecuente es{" "}
                <b>{displayDatasetLabel(region.topCrop || "cultivo mixto")}</b>.
              </p>
              <div style={{ marginTop: 18 }}>
                {(region.crops || []).slice(0, 6).map((x) => (
                  <span className="tag" key={x.name || x}>
                    {displayDatasetLabel(x.name || x)}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3>Firma ambiental</h3>
              <p className="panel-caption">
                Valores medios de esta región en unidades nativas.
              </p>
              <div className="feature-list">
                {Object.entries(region.profile || {}).map(([k, v]) => (
                  <div className="feature-line" key={k}>
                    <b>{labels[k] || k}</b>
                    <div className="spark">
                      <i
                        style={{
                          width: `${Math.min(100, Math.max(8, Number(v) / 3))}%`,
                          background: "#719b68",
                        }}
                      />
                    </div>
                    <em>{Number(v).toFixed(1)} {units[k] || ""}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </State>
    </Layout>
  );
}

function Recommend() {
  const [values, setValues] = useState(defaults);
  const [preset, setPreset] = useState("Equilibrado");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setValues((x) => ({ ...x, [k]: Number(v) }));

  const run = () => {
    setLoading(true);
    setError("");
    api("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <Layout route="/recommend">
      <Header
        eyebrow="Recomendación"
        title={
          <>
            Una segunda lectura<br />
            <em>para la parcela.</em>
          </>
        }
        description="Introduce las condiciones del terreno. Terra las compara con la ecorregión funcional observada más cercana y devuelve un perfil de cultivos basado en evidencia."
      />
      <div className="presets" aria-label="Escenarios de ejemplo">
        {Object.keys(presets).map((k, i) => {
          const spanish = ["Equilibrado", "Trópico húmedo", "Secano", "Tierra alta"][i];
          return (
            <button
              key={k}
              className={`preset ${preset === spanish ? "active" : ""}`}
              onClick={() => {
                setPreset(spanish);
                setValues(presets[k]);
              }}
            >
              {spanish}
            </button>
          );
        })}
      </div>
      <div className="form-layout">
        <div className="form-panel">
          <div className="kicker">Tu terreno · 7 señales</div>
          <h2
            style={{
              font: "28px var(--display)",
              fontWeight: 400,
              margin: "12px 0 26px",
            }}
          >
            Describe las condiciones
          </h2>
          <div className="field-grid">
            {FEATURES.map((k) => (
              <div className="field" key={k}>
                <label htmlFor={k}>
                  {labels[k]} <span>{values[k]} {units[k]}</span>
                </label>
                <input
                  id={k}
                  type="range"
                  className="range"
                  min={ranges[k][0]}
                  max={ranges[k][1]}
                  step={k === "pH_Value" || k === "Temperature" ? ".1" : "1"}
                  value={values[k]}
                  onChange={(e) => {
                    setPreset("Personalizado");
                    set(k, e.target.value);
                  }}
                />
                <input
                  aria-label={`${labels[k]} valor exacto`}
                  type="number"
                  min={ranges[k][0]}
                  max={ranges[k][1]}
                  step={k === "pH_Value" || k === "Temperature" ? ".1" : "1"}
                  value={values[k]}
                  onChange={(e) => {
                    setPreset("Personalizado");
                    set(k, e.target.value);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="submit-row">
            <span className="kicker">Listo para descubrir tu resultado</span>
            <button className="button" onClick={run} disabled={loading}>
              {loading ? "Buscando…" : "Ver mi recomendación →"}
            </button>
          </div>
          {error && <div className="error" style={{ marginTop: 18 }}>{error}</div>}
        </div>
        <div>
          {result ? (
            <div className="result">
              <span className="eyebrow">Ecorregión funcional coincidente</span>
              <h2>Región {result.cluster}</h2>
              <div className="confidence">
                <b>{result.confidenceLabel}</b>
                <span>
                  {result.sampleCount?.toLocaleString()} observaciones comparables ·
                  {Number(result.share || 0).toFixed(1)}% de la muestra
                </span>
              </div>
              <div className="crop-result">
                <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>
                  Afinidad de cultivos observada
                </h3>
                {(result.crops || []).map((c, i) => (
                  <div className="crop-item" key={c.name || c.crop || i}>
                    <b>{displayDatasetLabel(c.name || c.crop)}</b>
                    <span>{Number(c.share || c.value || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              {Array.isArray(result.advice) && result.advice.length > 0 && (
                <div className="note" style={{ marginTop: 22 }}>
                  <strong>Lectura de manejo</strong>
                  <ul>
                    {result.advice.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="panel result-empty">
              <div>
                <strong>Tu recomendación aparecerá aquí</strong>
                Ajusta los controles o elige un escenario. Después podrás ver la
                ecorregión más cercana.
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/regions" element={<Regions />} />
        <Route path="/recommend" element={<Recommend />} />
        <Route
          path="/optimize"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ErrorBoundary>
                <Optimize Layout={Layout} />
              </ErrorBoundary>
            </Suspense>
          }
        />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}