import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { displayDatasetLabel, shortRegionTag } from "../ui";
import { ScrollTrigger, prefersReducedMotion } from "../motion";
import { PARCEL_STATIONS, REGION_COLORS } from "./fieldLayout";
import { useSceneValue } from "./sceneStore";
import { numberLocale, useI18n } from "../i18n";

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
        // La versión ligera ya decodificada se sigue pintando hasta que la nítida esté lista
        // (bitmap() la sustituye); descartarla antes dejaba el fotograma en blanco y el recorrido
        // se congelaba mientras se decodificaba.
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

  // Fotograma ya decodificado más cercano: es lo que se pinta mientras el exacto se decodifica,
  // para que la imagen siga al scroll en vez de quedarse quieta.
  nearestDecoded(index) {
    for (let d = 1; d < this.count; d++) {
      if (this.bitmaps.has(index - d)) return this.bitmaps.get(index - d).bitmap;
      if (this.bitmaps.has(index + d)) return this.bitmaps.get(index + d).bitmap;
    }
    return null;
  }

  bitmap(index) {
    const cached = this.bitmaps.get(index);
    if (cached) {
      this.bitmaps.delete(index);
      this.bitmaps.set(index, cached); // LRU: el más reciente al final
      // Llegó la versión nítida: se decodifica en segundo plano y la ligera sigue en pantalla.
      if (cached.quality === "lq" && this.blobs.hq[index]) this.decode(index);
      return cached.bitmap;
    }
    this.decode(index);
    return null;
  }

  decode(index) {
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

const percent = (value) => `${Number(value).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })} %`;

export default function IntroSequence({ onPickParcel }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const regions = useSceneValue((state) => state.regions);
  const { tx } = useI18n();
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
      // El render mide 1152 px de ancho: pasar de 1,5× solo añade píxeles que rellenar en cada
      // fotograma (en una pantalla retina de 1440 px eran ~15 millones por dibujo) sin ganar detalle.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
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
      // Posición exacta entre dos fotogramas del render: con solo 84 fotogramas en todo el
      // recorrido, cada uno ocupa ~40 px de scroll y el tractor avanzaba a saltos. Se funde el
      // siguiente fotograma según la fracción, así la imagen se mueve con cada píxel de scroll.
      const exact = progress * (track.frames - 1);
      const base = Math.floor(exact);
      const next = Math.min(base + 1, track.frames - 1);
      const blend = Math.round((exact - base) * 24) / 24;
      const passingNow = parcelPassing(index);
      const active = hovered ?? passingNow;
      const key = `${base}+${blend}|${active}|${hovered}|${view.width}x${view.height}`;
      if (key === drawnKey) return;
      // Si el fotograma exacto aún se decodifica, se pinta el decodificado más cercano en lugar
      // de no pintar nada (antes la imagen se congelaba hasta que terminaba la decodificación).
      const exactBase = store.bitmap(base);
      const bitmap = exactBase || store.nearestDecoded(base);
      if (!bitmap) return;
      const blendWith = exactBase && blend > 0 && next !== base ? store.bitmap(next) : null;
      layout(index);
      context.drawImage(bitmap, view.offsetX, view.offsetY, view.drawnWidth, view.drawnHeight);
      if (blendWith) {
        context.globalAlpha = blend;
        context.drawImage(blendWith, view.offsetX, view.offsetY, view.drawnWidth, view.drawnHeight);
        context.globalAlpha = 1;
      }
      store.warm(base, direction);
      drawOverlay(index, active);
      // Solo cuenta como definitivo si se pintó el fotograma exacto, nítido y con su fundido;
      // si no, se repinta en cuanto termine la decodificación pendiente.
      const isHq = (i) => store.bitmaps.get(i)?.quality === "hq";
      const complete = exactBase && isHq(base) && (blend === 0 || (blendWith && isHq(next)));
      drawnKey = complete ? key : `${key}|partial`;
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
        <canvas ref={canvasRef} className="intro-canvas" role="img" aria-label={tx("Recorrido de un tractor por la finca de Terra: cinco parcelas, una por ecorregión", "A tractor rides through the Terra farm: five plots, one per ecoregion")} />
        <svg ref={overlayRef} className="intro-overlay" aria-hidden="true" />
        <div className="intro-shade" aria-hidden="true" />

        <div className="intro-copy intro-hero" data-caption="hero">
          <h1 id="home-title">
            {tx("Cada suelo tiene una", "Every soil has a")} <span>{tx("posibilidad.", "possibility.")}</span>
          </h1>
          <p>{tx("Terra lee siete señales de tu suelo y tu clima, ubica tu parcela en una de cinco ecorregiones y te dice qué sembrar.", "Terra reads seven signals from your soil and climate, places your plot in one of five ecoregions and tells you what to plant.")}</p>
          <div className="home-actions">
            <Link className="button cta" to="/producto/recomendar">
              {tx("Ver qué sembrar", "See what to plant")}
            </Link>
            <Link className="button ghost" to="/producto/plan">
              {tx("Planear mi siembra", "Plan my planting")}
            </Link>
          </div>
          <p className="intro-cue" aria-hidden="true">
            {tx("Desliza para recorrer la finca", "Scroll to ride through the farm")}
          </p>
        </div>

        <div className="intro-copy intro-side" data-caption="senales">
          <h2>{tx("Siete señales bajo tus pies.", "Seven signals beneath your feet.")}</h2>
          <p>{tx("Nitrógeno, fósforo, potasio, temperatura, humedad, pH y lluvia. Con ellas, 12.784 muestras reales de Colombia se ordenan en cinco ecorregiones.", "Nitrogen, phosphorus, potassium, temperature, humidity, pH and rainfall. With them, 12,784 real samples from Colombia sort into five ecoregions.")}</p>
        </div>

        <div className="intro-copy intro-side intro-parcels" data-caption="parcelas" aria-live="polite">
          <h2>{tx("Cinco parcelas, una por ecorregión.", "Five plots, one per ecoregion.")}</h2>
          {region ? (
            <p className="intro-parcel" style={{ "--region": REGION_COLORS[region.id] }}>
              <i aria-hidden="true" />
              <span>
                <b>{tx("Ecorregión", "Ecoregion")} {region.id}</b>
                {shortRegionTag(region.profile)} · {percent(region.share)} · {tx("líder", "leading")}: {displayDatasetLabel(region.topCrop).toLowerCase()}
              </span>
            </p>
          ) : (
            <p className="intro-parcel">{tx("Cada parcela representa una ecorregión del modelo. Toca una para ver sus datos.", "Each plot stands for one ecoregion in the model. Tap one to see its data.")}</p>
          )}
        </div>

        <div className="intro-copy intro-close" data-caption="cierre">
          <h2>{tx("El siguiente viaje empieza en tu parcela.", "The next journey starts on your plot.")}</h2>
          <Link className="button cta" to="/producto/recomendar">
            {tx("Describir mi parcela", "Describe my plot")}
          </Link>
        </div>
      </div>
    </section>
  );
}

