import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { displayDatasetLabel, shortRegionTag } from "../ui";
import { ScrollTrigger, prefersReducedMotion } from "../motion";
import { PARCEL_STATIONS, REGION_COLORS } from "./fieldLayout";
import { useSceneValue } from "./sceneStore";

// Entrada de la portada al estilo de las páginas de producto: una sección que se queda fija
// mientras el scroll recorre los fotogramas reales del render (public/field/intro), sin
// intermedios inventados. Encima, textos por tramos y las parcelas resaltables. El resto de la
// página es una página normal.

const BASE = "/field";
const CACHE_SIZE = 24; // fotogramas decodificados a la vez (~3 MB cada uno a 1152×648)

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Fotogramas en dos calidades, como en las páginas de producto: primero llega una versión ligera
// de toda la secuencia (~24 KB por fotograma), así el recorrido responde al scroll en un par de
// segundos; después la versión nítida (~165 KB) la va sustituyendo, empezando por donde se mira.
// La decodificación va fuera del hilo principal y con un tope de memoria.
const QUALITIES = { lq: `${BASE}/intro/lq`, hq: `${BASE}/intro` };

class FrameStore {
  constructor(count, onChange) {
    this.count = count;
    this.blobs = { lq: new Array(count), hq: new Array(count) };
    this.bitmaps = new Map(); // índice → { bitmap, quality }
    this.pending = new Set();
    this.inflight = new Set();
    this.focus = 0;
    this.onChange = onChange;
    this.aborted = false;
  }

  best(index) {
    if (this.blobs.hq[index]) return { blob: this.blobs.hq[index], quality: "hq" };
    if (this.blobs.lq[index]) return { blob: this.blobs.lq[index], quality: "lq" };
    return null;
  }

  async fetch(index, quality, priority = "low") {
    const key = `${quality}:${index}`;
    if (index < 0 || index >= this.count || this.blobs[quality][index] || this.inflight.has(key) || this.aborted) return;
    this.inflight.add(key);
    try {
      const response = await fetch(`${QUALITIES[quality]}/f_${String(index).padStart(4, "0")}.avif`, { priority });
      // Un servidor de SPA devuelve index.html con 200 si el archivo no existe: solo vale imagen.
      if (response.ok && response.headers.get("content-type")?.startsWith("image/")) {
        this.blobs[quality][index] = await response.blob();
        // Si ya había una versión ligera decodificada, se descarta para pintar la nítida.
        const cached = this.bitmaps.get(index);
        if (quality === "hq" && cached?.quality === "lq") {
          cached.bitmap.close();
          this.bitmaps.delete(index);
        }
        this.onChange();
      }
    } catch {
      // El fotograma que falte se sustituye por el más cercano cargado.
    } finally {
      this.inflight.delete(key);
    }
  }

  async preload() {
    // 1. Toda la secuencia en ligera, en orden de recorrido (el principio con prioridad alta).
    const lq = Array.from({ length: this.count }, (_, i) => i);
    const worker = async () => {
      while (lq.length && !this.aborted) {
        const index = lq.shift();
        await this.fetch(index, "lq", index < 16 ? "high" : "auto");
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    // 2. La nítida, siempre el fotograma pendiente más cercano a donde está la vista
    //    (con preferencia hacia delante, que es hacia donde suele ir el scroll).
    const nextHq = () => {
      let best = -1;
      let bestScore = Infinity;
      for (let i = 0; i < this.count; i++) {
        if (this.blobs.hq[i] || this.inflight.has(`hq:${i}`)) continue;
        const distance = i - this.focus;
        const score = distance >= 0 ? distance : -distance * 2;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      return best;
    };
    const hqWorker = async () => {
      for (let index = nextHq(); index >= 0 && !this.aborted; index = nextHq()) await this.fetch(index, "hq", "low");
    };
    await Promise.all(Array.from({ length: 3 }, hqWorker));
  }

  nearestLoaded(index) {
    for (let d = 0; d < this.count; d++) {
      if (this.best(index - d)) return index - d;
      if (this.best(index + d)) return index + d;
    }
    return -1;
  }

  bitmap(index) {
    const cached = this.bitmaps.get(index);
    if (cached) {
      this.bitmaps.delete(index);
      this.bitmaps.set(index, cached); // LRU: el más reciente al final
      return cached.bitmap;
    }
    const source = this.best(index);
    if (source && !this.pending.has(index)) {
      this.pending.add(index);
      createImageBitmap(source.blob)
        .then((decoded) => {
          this.pending.delete(index);
          if (this.aborted) return decoded.close();
          this.bitmaps.get(index)?.bitmap.close();
          this.bitmaps.set(index, { bitmap: decoded, quality: source.quality });
          while (this.bitmaps.size > CACHE_SIZE) {
            const [oldest, stale] = this.bitmaps.entries().next().value;
            this.bitmaps.delete(oldest);
            stale.bitmap.close();
          }
          this.onChange();
        })
        .catch(() => {
          this.pending.delete(index);
          this.blobs[source.quality][index] = undefined;
        });
    }
    return null;
  }

  // Decodifica por adelantado los fotogramas que vienen en la dirección del scroll (cada AVIF
  // tarda ~40 ms), y marca dónde está la vista para que la descarga nítida empiece por ahí.
  warm(index, direction) {
    this.focus = index;
    for (let k = 1; k <= 6; k++) {
      const next = index + direction * k;
      if (next < 0 || next >= this.count) break;
      if (this.best(next)) this.bitmap(next);
    }
  }

  dispose() {
    this.aborted = true;
    this.bitmaps.forEach(({ bitmap }) => bitmap.close());
    this.bitmaps.clear();
  }
}

// Tramos de texto sobre la secuencia (progreso 0..1 de la sección).
const CAPTIONS = [
  { id: "senales", from: 0.12, to: 0.3 },
  { id: "parcelas", from: 0.33, to: 0.82 },
  { id: "cierre", from: 0.86, to: 1.01 },
];

const percent = (value) => `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

export default function IntroSequence({ onPickParcel }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const regions = useSceneValue((state) => state.regions);
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const passingRef = useRef(null);
  const [passing, setPassing] = React.useState(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const context = canvas.getContext("2d", { alpha: false });
    let track = null;
    let store = null;
    let progress = 0;
    let direction = 1;
    let drawnKey = "";
    let animation = 0;
    let hovered = null;
    const view = { width: 0, height: 0, offsetX: 0, offsetY: 0, drawnWidth: 0, drawnHeight: 0 };

    const frameIndex = () => (track ? Math.round(progress * (track.frames - 1)) : 0);

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.width = canvas.clientWidth;
      view.height = canvas.clientHeight;
      canvas.width = Math.round(view.width * ratio);
      canvas.height = Math.round(view.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingQuality = "high";
      drawnKey = "";
      schedule();
    };

    // Encaje "cover"; en pantalla vertical el recorte sigue al tractor (su x viene del render).
    const layout = (index) => {
      const scale = Math.max(view.width / track.width, view.height / track.height);
      view.drawnWidth = track.width * scale;
      view.drawnHeight = track.height * scale;
      let focusX = 0.5;
      if (view.width < view.height) focusX = clamp(track.tractor[index]?.[0] ?? 0.5, 0.25, 0.75);
      view.offsetX = clamp(view.width / 2 - focusX * view.drawnWidth, view.width - view.drawnWidth, 0);
      view.offsetY = (view.height - view.drawnHeight) / 2;
    };
    const toScreen = ([x, y]) => [view.offsetX + x * view.drawnWidth, view.offsetY + y * view.drawnHeight];

    // Ecorregión junto a la que pasa el tractor en este fotograma (o null entre parcelas).
    const parcelPassing = (index) => {
      const t = track.t[index];
      let best = null;
      PARCEL_STATIONS.forEach((station, id) => {
        if (Math.abs(station - t) < 0.06 && (best == null || Math.abs(station - t) < Math.abs(PARCEL_STATIONS[best] - t))) best = id;
      });
      return best;
    };

    const drawOverlay = (index, active) => {
      if (active == null) {
        overlay.innerHTML = "";
        return;
      }
      const corners = track.parcels[index][active];
      if (!corners.every(([, , z]) => z > 0)) {
        overlay.innerHTML = "";
        return;
      }
      const color = REGION_COLORS[active];
      const points = corners.map((c) => toScreen(c).map((v) => v.toFixed(1)).join(",")).join(" ");
      overlay.innerHTML = `<polygon points="${points}" fill="${color}" fill-opacity="${hovered === active ? 0.22 : 0.12}" stroke="${color}" stroke-width="3" stroke-linejoin="round" />`;
    };

    const draw = () => {
      animation = 0;
      if (!track) return;
      const index = frameIndex();
      const passingNow = parcelPassing(index);
      const active = hovered ?? passingNow;
      const key = `${index}|${active}|${hovered}|${view.width}x${view.height}`;
      if (key === drawnKey) return;
      const bitmap = store.bitmap(index) || store.bitmap(store.nearestLoaded(index));
      if (!bitmap) return;
      layout(index);
      context.drawImage(bitmap, view.offsetX, view.offsetY, view.drawnWidth, view.drawnHeight);
      store.warm(index, direction);
      drawOverlay(index, active);
      drawnKey = store.bitmaps.get(index)?.quality === "hq" ? key : `${key}|lq`;
      if (passingNow !== passingRef.current) {
        passingRef.current = passingNow;
        setPassing(passingNow);
      }
      section.classList.add("is-ready");
    };

    function schedule() {
      if (!animation) animation = requestAnimationFrame(draw);
    }

    // Textos por tramos: opacidad y desplazamiento según el progreso, sin re-render de React.
    const updateCaptions = () => {
      CAPTIONS.forEach(({ id, from, to }) => {
        const element = section.querySelector(`[data-caption="${id}"]`);
        if (!element) return;
        const fade = 0.04;
        const visibility = clamp(Math.min((progress - from) / fade, (to - progress) / fade), 0, 1);
        element.style.opacity = visibility;
        element.style.transform = prefersReducedMotion() ? "none" : `translateY(${(1 - visibility) * 24}px)`;
        element.style.visibility = visibility > 0 ? "visible" : "hidden";
      });
      const hero = section.querySelector("[data-caption='hero']");
      if (hero) {
        const visibility = clamp((0.1 - progress) / 0.06, 0, 1);
        hero.style.opacity = visibility;
        hero.style.transform = prefersReducedMotion() ? "none" : `translateY(${(1 - visibility) * -30}px)`;
        hero.style.visibility = visibility > 0 ? "visible" : "hidden";
      }
    };

    // Hover y clic sobre la parcela resaltada: lleva al explorador con esa ecorregión elegida.
    const parcelAt = (event) => {
      if (!track) return null;
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const index = frameIndex();
      let found = null;
      track.parcels[index].forEach((corners, id) => {
        if (corners.every(([, , z]) => z > 0) && pointInPolygon(x, y, corners.map(toScreen))) found = id;
      });
      return found;
    };
    const onMove = (event) => {
      const found = parcelAt(event);
      if (found !== hovered) {
        hovered = found;
        canvas.style.cursor = found == null ? "" : "pointer";
        schedule();
      }
    };
    const onLeave = () => {
      hovered = null;
      canvas.style.cursor = "";
      schedule();
    };
    const onClick = (event) => {
      const found = parcelAt(event);
      if (found != null) onPickParcel?.(found);
    };

    let trigger = null;
    let cancelled = false;
    fetch(`${BASE}/track.json`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        track = data;
        store = new FrameStore(track.frames, schedule);
        store.preload();
        store.warm(0, 1);
        trigger = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            direction = self.progress < progress ? -1 : 1;
            progress = self.progress;
            updateCaptions();
            schedule();
          },
        });
        resize();
        updateCaptions();
      })
      .catch(() => section.classList.add("is-offline"));

    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animation);
      trigger?.kill();
      store?.dispose();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [onPickParcel]);

  const region = regions?.find((r) => r.id === passing);

  return (
    <section className="home-intro" ref={sectionRef} aria-labelledby="home-title">
      <div className="intro-stage">
        <canvas ref={canvasRef} className="intro-canvas" role="img" aria-label="Recorrido de un tractor por la finca de Terra: cinco parcelas, una por ecorregión" />
        <svg ref={overlayRef} className="intro-overlay" aria-hidden="true" />
        <div className="intro-shade" aria-hidden="true" />

        <div className="intro-copy intro-hero" data-caption="hero">
          <h1 id="home-title">
            Cada suelo tiene una <span>posibilidad.</span>
          </h1>
          <p>Terra lee siete señales de tu suelo y tu clima, ubica tu parcela en una de cinco ecorregiones y te dice qué sembrar.</p>
          <div className="home-actions">
            <Link className="button cta" to="/producto/recomendar">
              Ver qué sembrar
            </Link>
            <Link className="button ghost" to="/producto/plan">
              Planear mi siembra
            </Link>
          </div>
          <p className="intro-cue" aria-hidden="true">
            Desliza para recorrer la finca
          </p>
        </div>

        <div className="intro-copy intro-side" data-caption="senales">
          <h2>Siete señales bajo tus pies.</h2>
          <p>Nitrógeno, fósforo, potasio, temperatura, humedad, pH y lluvia. Con ellas, 12.784 muestras reales de Colombia se ordenan en cinco ecorregiones.</p>
        </div>

        <div className="intro-copy intro-side intro-parcels" data-caption="parcelas" aria-live="polite">
          <h2>Cinco parcelas, una por ecorregión.</h2>
          {region ? (
            <p className="intro-parcel" style={{ "--region": REGION_COLORS[region.id] }}>
              <i aria-hidden="true" />
              <span>
                <b>Ecorregión {region.id}</b>
                {shortRegionTag(region.profile)} · {percent(region.share)} · líder: {displayDatasetLabel(region.topCrop).toLowerCase()}
              </span>
            </p>
          ) : (
            <p className="intro-parcel">Cada parcela representa una ecorregión del modelo. Toca una para ver sus datos.</p>
          )}
        </div>

        <div className="intro-copy intro-close" data-caption="cierre">
          <h2>El siguiente viaje empieza en tu parcela.</h2>
          <Link className="button cta" to="/producto/recomendar">
            Describir mi parcela
          </Link>
        </div>
      </div>
    </section>
  );
}

