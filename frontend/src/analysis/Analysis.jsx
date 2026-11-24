import React, { useEffect, useMemo, useRef, useState } from "react";
import { displayDatasetLabel, labels, units, api, Header, State, useSlidingIndicator } from "../ui";
import { REGION_COLORS } from "../scene/fieldLayout";
import { focusRegion, useSceneValue } from "../scene/sceneStore";
import { Meter, RangeBar, RegionStrip } from "./charts";

function Scatter({ points = [] }) {
  const colors = REGION_COLORS;

  const [hoveredPoint, setHoveredPoint] = useState(null);
  // Ecorregión enfocada (por la leyenda o por el punto bajo el cursor): las demás se atenúan
  // y la cabecera muestra su parcela.
  const [focus, setFocus] = useState(null);
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

  // La escala se calcula con el rango real de los puntos. Antes asumía coordenadas de -4 a 4 (la proyección
  // PCA anterior); las de UMAP van de ~0,5 a ~10 y los puntos caían fuera del lienzo.
  const extent = useMemo(() => {
    const spanOf = (values) => {
      const finite = values.map(Number).filter(Number.isFinite);
      const min = Math.min(...finite);
      const max = Math.max(...finite);
      return finite.length ? { min, range: max - min || 1 } : { min: 0, range: 1 };
    };
    return { x: spanOf(points.map((p) => p.x)), y: spanOf(points.map((p) => p.y)) };
  }, [points]);
  // 0,03–0,97 deja un margen para que los puntos del borde no queden pegados a los ejes.
  const unit = (value, { min, range }) => 0.03 + 0.94 * (((Number(value) || 0) - min) / range);
  const xScale = (x) => 55 + unit(x, extent.x) * zoom * 600 + pan.x;
  const yScale = (y) => 322 - unit(y, extent.y) * zoom * 285 + pan.y;

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
        const cluster = Number(nearest.cluster);
        if (cluster !== focusRef.current) {
          focusRef.current = cluster;
          focusRegion(cluster);
        }
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
    focusRef.current = null;
  };
  const focusRef = useRef(null);

  // La capa de puntos solo se recalcula si cambian los datos, el encuadre o el foco: el hover
  // (que cambia en cada movimiento del ratón) ya no repinta los 2.500 círculos.
  const pointsLayer = useMemo(
    () =>
      filteredPoints.map((p, i) => {
        const cluster = Number(p.cluster);
        const dimmed = focus != null && cluster !== focus;
        return (
          <circle
            key={i}
            className="umap-point"
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r={dimmed ? 2.4 : 3.2}
            fill={colors[cluster % 5] || colors[i % 5]}
            opacity={dimmed ? 0.1 : focus != null ? 0.9 : 0.62}
            style={{ "--c": cluster }}
          />
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredPoints, zoom, pan, focus, extent]
  );

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
          type="button"
          className="button secondary"
          onClick={() => setZoom((z) => Math.min(5, +(z * 1.2).toFixed(2)))}
          aria-label="Acercar"
        >
          +
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setZoom((z) => Math.max(0.5, +(z / 1.2).toFixed(2)))}
          aria-label="Alejar"
        >
          −
        </button>
        <button
          type="button"
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
          aria-label="Proyección UMAP interactiva: cada punto es una observación, coloreada por ecorregión"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: isPanning ? "grabbing" : "grab", touchAction: "none" }}
        >
          <path d="M52 330H665M52 330V24" stroke="#cfd8ce" fill="none" />
          <path d="M52 252H665M52 174H665M52 96H665" stroke="#dfe5dc" />
          <g className="umap-points">{pointsLayer}</g>
        </svg>
        {/* Tooltip en HTML, fuera del SVG: moverlo no obliga a repintar los 2.500 puntos. */}
        {hoveredPoint && (
          <div
            className="umap-tooltip"
            style={{
              left: `${(xScale(hoveredPoint.x) / 700) * 100}%`,
              top: `${(yScale(hoveredPoint.y) / 380) * 100}%`,
              "--region": colors[Number(hoveredPoint.cluster) % 5],
            }}
          >
            <b>{displayDatasetLabel(hoveredPoint.crop)}</b>
            <span>Suelo {displayDatasetLabel(hoveredPoint.soil).toLowerCase()}</span>
            <span className="umap-tooltip-region">Ecorregión {hoveredPoint.cluster}</span>
          </div>
        )}
      </div>

      <div className="legend" role="group" aria-label="Enfocar una ecorregión">
        {REGION_COLORS.map((color, id) => (
          <button
            key={id}
            type="button"
            className={`legend-item ${focus === id ? "is-active" : ""}`}
            aria-pressed={focus === id}
            onMouseEnter={() => {
              setFocus(id);
              focusRegion(id);
            }}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => {
              setFocus(id);
              focusRegion(id);
            }}
            onBlur={() => setFocus(null)}
            onClick={() => setFocus((current) => (current === id ? null : id))}
          >
            <i style={{ background: color }} />
            Ecorregión {id}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Analysis() {
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("umap");
  const tabsRef = useRef(null);
  const regions = useSceneValue((state) => state.regions);
  // Las pestañas aparecen cuando llegan los datos: el indicador se vuelve a medir entonces.
  useSlidingIndicator(tabsRef, `${tab}-${Boolean(data)}`);

  useEffect(() => {
    Promise.all([api("/api/umap"), api("/api/overview")])
      .then(([a, b]) => {
        setData(a);
        setOverview(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  const tabs = [
    ["umap", "Proyección UMAP"],
    ["features", "Variables ambientales"],
    ["clusters", "Comparación de grupos"],
  ];

  return (
    <>
      <Header
        title={
          <>
            Mide las<br />
            <em>diferencias.</em>
          </>
        }
        description="La proyección UMAP y las variables que sostienen las cinco ecorregiones. Lo que enfoques aquí, la finca lo muestra."
        action={<RegionStrip regions={regions} />}
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
        {tab === "umap" && (
          <div className="grid-2">
            <div className="panel" style={{ gridColumn: "span 2" }}>
              <h3>Proyección UMAP</h3>
              <p className="panel-caption">
                Una vista bidimensional de la similitud ambiental en siete
                dimensiones. Cada punto es una observación.
              </p>
              {/* La leyenda ya la dibuja <Scatter>; estaba repetida aquí. */}
              <Scatter points={data?.points} />
              <div className="note">
                UMAP proyecta las 7 variables ambientales en dos dimensiones para inspección visual, mientras que el modelo
                K-Means (K=5) opera sobre el espacio escalado 7D.
              </div>
              <div className="note">
                <strong>Límites del conjunto de datos:</strong> Los 20.000 registros provienen de un dataset sintético
                uniforme sin correlación agronómica fuerte (Silhouette ≈ 0,10; pureza de cultivo ≈ 17,5 %). Úsalo como
                referencia exploratoria, no como diagnóstico agronómico definitivo.
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
              {(overview?.featureStats || []).map((f, i) => (
                <RangeBar key={f.feature} stat={f} label={labels[f.feature] || f.feature} unit={units[f.feature] || ""} delay={i * 60} />
              ))}
            </div>
            <div className="panel">
              <h3>Distribución de cultivos</h3>
              <p className="panel-caption">
                Las etiquetas de referencia junto a las señales del modelo.
              </p>
              {(overview?.cropDistribution || []).map((x, i) => (
                <Meter
                  key={x.name}
                  label={displayDatasetLabel(x.name)}
                  detail={`${Number(x.share).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
                  value={x.share / Math.max(...overview.cropDistribution.map((c) => c.share))}
                  color="var(--field-forest)"
                  delay={i * 60}
                />
              ))}
            </div>
          </div>
        )}

        {tab === "clusters" && (
          <div className="panel">
            <h3>Distribución de ecorregiones</h3>
            <p className="panel-caption">
              Proporción de la muestra en cada ecorregión. Pasa por una para verla en la finca.
            </p>
            {[...(overview?.clusterDistribution || [])]
              .sort((x, y) => Number(x.name) - Number(y.name))
              .map((x, i, all) => (
                <div key={x.name} className="meter-link" onMouseEnter={() => focusRegion(Number(x.name))}>
                  <Meter
                    label={`Ecorregión ${x.name}`}
                    detail={`${Number(x.share).toLocaleString("es-CO", { maximumFractionDigits: 1 })} % · ${Number(x.value).toLocaleString("es-CO")} muestras`}
                    value={x.share / Math.max(...all.map((c) => c.share))}
                    color={REGION_COLORS[Number(x.name)]}
                    delay={i * 60}
                  />
                </div>
              ))}
          </div>
        )}
        </div>
      </State>
    </>
  );
}

