import React, { useEffect, useRef, useState } from "react";

import { displayDatasetLabel, shortRegionTag } from "../ui";
import { prefersReducedMotion } from "../motion";
import { REGION_COLORS } from "../scene/fieldLayout";
import { focusRegion, useSceneValue } from "../scene/sceneStore";

// Piezas de gráfico del panel de análisis. Todas leen datos reales de la API y se animan una sola
// vez al entrar en pantalla (transform/opacidad, nada que fuerce layout), sin animar con
// movimiento reducido.

export function useInView(options = { threshold: 0.25 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  return [ref, inView];
}

// Número que cuenta hasta su valor al aparecer.
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("es-CO") }) {
  const [ref, inView] = useInView();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView || value == null) return undefined;
    if (prefersReducedMotion()) {
      setShown(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / 1100);
      setShown(value * (1 - Math.pow(2, -10 * progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);
  return <span ref={ref}>{value == null ? "—" : format(shown)}</span>;
}

// Barra de proporción (0..1). Crece desde la izquierda con scaleX, que no recalcula el layout.
export function Meter({ value, color, label, detail, delay = 0 }) {
  const [ref, inView] = useInView();
  return (
    <div className="meter" ref={ref}>
      <div className="meter-head">
        <b>{label}</b>
        <span>{detail}</span>
      </div>
      <div className="meter-track">
        <i style={{ "--v": inView ? Math.max(0.02, Math.min(1, value)) : 0, "--d": `${delay}ms`, background: color }} />
      </div>
    </div>
  );
}

// Rango real de una variable en el conjunto: de mínimo a máximo, banda de media ± 1 desviación y
// la media marcada. Opcionalmente, un segundo marcador (la media de una ecorregión).
export function RangeBar({ stat, unit, label, marker, markerColor, delay = 0 }) {
  const [ref, inView] = useInView();
  const span = stat.max - stat.min || 1;
  const at = (value) => Math.min(100, Math.max(0, ((value - stat.min) / span) * 100));
  const fmt = (value) => Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 });
  return (
    <div className={`range-bar ${inView ? "is-in" : ""}`} ref={ref} style={{ "--d": `${delay}ms` }}>
      <b className="range-label">{label}</b>
      <div className="range-track" role="img" aria-label={`${label}: de ${fmt(stat.min)} a ${fmt(stat.max)} ${unit}, media ${fmt(stat.mean)}${marker != null ? `, esta ecorregión ${fmt(marker)}` : ""}`}>
        <span className="range-band" style={{ left: `${at(stat.mean - stat.std)}%`, right: `${100 - at(stat.mean + stat.std)}%` }} />
        <span className="range-mean" style={{ left: `${at(stat.mean)}%` }} />
        {marker != null && <span className="range-marker" style={{ left: `${at(marker)}%`, background: markerColor }} />}
      </div>
      <span className="range-values">
        {fmt(stat.min)}–{fmt(stat.max)} {unit}
      </span>
    </div>
  );
}

// Franja de las cinco ecorregiones con ancho proporcional a su peso real. Es también el mando de
// la cabecera: pasar por encima o elegir una muestra su parcela en la imagen del render.
export function RegionStrip({ regions, selected, onSelect, caption }) {
  const highlight = useSceneValue((state) => state.highlight);
  if (!regions?.length) return null;
  const ordered = [...regions].sort((a, b) => a.id - b.id);
  return (
    <div className="region-strip" role="group" aria-label="Ecorregiones: elige una para ver su parcela en la finca">
      <div className="region-strip-bar">
        {ordered.map((region) => {
          const active = (selected ?? highlight) === region.id;
          return (
            <button
              key={region.id}
              type="button"
              className={`region-strip-seg ${active ? "is-active" : ""}`}
              style={{ flexGrow: region.share, "--region": REGION_COLORS[region.id] }}
              aria-pressed={selected != null ? selected === region.id : undefined}
              onMouseEnter={() => focusRegion(region.id)}
              onFocus={() => focusRegion(region.id)}
              onClick={() => {
                focusRegion(region.id);
                onSelect?.(region.id);
              }}
            >
              <span className="seg-name">Ecorregión {region.id}</span>
              <span className="seg-short" aria-hidden="true">
                {region.id}
              </span>
              <span className="seg-detail">
                {shortRegionTag(region.profile) || `${Number(region.share).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`} · {displayDatasetLabel(region.topCrop).toLowerCase()}
              </span>
            </button>
          );
        })}
      </div>
      {caption && <p className="region-strip-caption">{caption}</p>}
    </div>
  );
}
