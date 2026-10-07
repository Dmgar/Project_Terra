import React, { useEffect, useMemo, useRef, useState } from "react";
import { displayDatasetLabel, labels, api, Header, State, Bars, useSlidingIndicator } from "../ui";

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
              <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.15" />
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

export default function Analysis() {
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pca");
  const tabsRef = useRef(null);
  useSlidingIndicator(tabsRef, tab);

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
    <>
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
        <div ref={tabsRef} className="tabs" role="tablist" aria-label="Vistas de análisis">
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

        <div key={tab} className="tab-panel">
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
        </div>
      </State>
    </>
  );
}

