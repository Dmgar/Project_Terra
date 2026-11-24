import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { displayDatasetLabel, shortRegionTag, Icon } from "../ui";
import { scrollToElement, useReveal } from "../motion";
import IntroSequence from "../scene/IntroSequence";
import { REGION_COLORS, parcelStill } from "../scene/fieldLayout";
import { useSceneValue } from "../scene/sceneStore";
import { Meter, RegionStrip } from "../analysis/charts";

// Lo que se puede hacer en Terra, en el orden en que suele necesitarse.
const ACTIONS = [
  { to: "/producto/recomendar", title: "Consultar cultivos", text: "Compara tu suelo con los datos de referencia y mira en qué ecorregión cae." },
  { to: "/producto/plan", title: "Preparar mi plan", text: "Organiza cultivos, espacio y estimaciones de cosecha para tu huerta o tu finca." },
  { to: "/analisis/resumen", title: "Conocer el análisis", text: "Explora los datos y el modelo detrás de cada recomendación." },
];

const STEPS = [
  { title: "Describe tu parcela", text: "Siete señales: nitrógeno, fósforo, potasio, temperatura, humedad, pH y lluvia." },
  { title: "Terra la ubica", text: "Busca la ecorregión con condiciones más parecidas entre 12.784 muestras reales de Colombia." },
  { title: "Recibe un plan", text: "Qué sembrar, cuánto espacio dar a cada cultivo y qué esperar de la cosecha." },
];

const percent = (value) => `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

// Explorador: eliges una ecorregión y ves su parcela en el render junto a sus datos reales.
function RegionExplorer({ selected, onSelect }) {
  const regions = useSceneValue((state) => state.regions);
  const ordered = regions ? [...regions].sort((a, b) => a.id - b.id) : [];
  const region = ordered.find((r) => r.id === selected) || ordered[0];
  if (!region) {
    return <p className="explorer-offline">No pudimos leer las ecorregiones ahora mismo. Vuelve a intentarlo en un momento.</p>;
  }
  const color = REGION_COLORS[region.id];
  const maxShare = Math.max(...(region.crops || []).map((c) => c.share), 1);
  return (
    <div className="explorer" style={{ "--region": color }}>
      <RegionStrip regions={ordered} selected={region.id} onSelect={onSelect} />
      <div className="explorer-body">
        <figure className="explorer-photo">
          {/* La clave reinicia el fundido al cambiar de parcela. */}
          <img key={region.id} src={parcelStill(region.id)} alt={`Parcela de la Ecorregión ${region.id} en la finca renderizada`} width="1152" height="648" loading="lazy" />
          <figcaption>
            <i aria-hidden="true" /> Parcela de la Ecorregión {region.id} en la finca
          </figcaption>
        </figure>
        <div key={region.id} className="explorer-data">
          <h3>Ecorregión {region.id} · {shortRegionTag(region.profile)}</h3>
          <p>
            {percent(region.share)} de las muestras reales ({Number(region.count).toLocaleString("es-CO")} registros). La
            define su suelo y su clima —por eso el mismo cultivo puede dominar en dos ecorregiones con distinto ambiente.
          </p>
          {(region.crops || []).slice(0, 4).map((crop, i) => (
            <Meter key={crop.name} label={displayDatasetLabel(crop.name)} detail={percent(crop.share)} value={crop.share / maxShare} color={color} delay={i * 70} />
          ))}
          <Link className="button ghost" to="/analisis/regiones">
            Ver su firma ambiental <Icon />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const rootRef = useRef(null);
  const explorerRef = useRef(null);
  const stepsRef = useRef(null);
  const [selected, setSelected] = useState(0);
  const regionsLoaded = useSceneValue((state) => Boolean(state.regions));
  useReveal(rootRef, [regionsLoaded]);

  // Tocar una parcela en la entrada lleva al explorador con esa ecorregión elegida.
  const pickParcel = useCallback((id) => {
    setSelected(id);
    scrollToElement(explorerRef.current);
  }, []);

  // El paso a paso dibuja su línea y entra escalonado cuando aparece en pantalla.
  useEffect(() => {
    const element = stepsRef.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && element.classList.add("is-in"), { threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="terra-home" ref={rootRef}>
      <IntroSequence onPickParcel={pickParcel} />

      <section className="home-section home-explorer" ref={explorerRef} aria-labelledby="explorer-title">
        <div className="section-intro">
          <h2 id="explorer-title" data-reveal>
            Cinco ecorregiones, cinco parcelas.
          </h2>
          <p data-reveal="0.08">
            Cada parcela de la finca representa un grupo real del modelo. Elige una para ver cuántos registros reúne y
            qué cultivos aparecen en ella.
          </p>
        </div>
        <div data-reveal="0.12">
          <RegionExplorer selected={selected} onSelect={setSelected} />
        </div>
      </section>

      <section className="home-section home-act" aria-labelledby="act-title">
        <div className="section-intro">
          <h2 id="act-title" data-reveal>
            ¿Qué quieres hacer hoy?
          </h2>
        </div>
        <ul className="action-grid">
          {ACTIONS.map(({ to, title, text }, index) => (
            <li key={to} data-reveal={index * 0.08}>
              <Link to={to}>
                <b>{title}</b>
                <span>{text}</span>
                <Icon />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section home-how" aria-labelledby="how-title">
        <div className="section-intro">
          <h2 id="how-title" data-reveal>
            Cómo funciona
          </h2>
        </div>
        <ol className="steps" ref={stepsRef}>
          {STEPS.map(({ title, text }, index) => (
            <li key={title} style={{ "--i": index }}>
              <span className="step-n">{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-close" aria-labelledby="close-title">
        <h2 id="close-title" data-reveal>
          La recomendación empieza bajo tus pies.
        </h2>
        <p data-reveal="0.08">Terra compara tu parcela con 12.784 muestras reales de Colombia y siete variables de suelo y clima.</p>
        <div className="home-actions" data-reveal="0.16">
          <Link className="button cta" to="/producto/recomendar">
            Describir mi parcela
          </Link>
          <Link className="button ghost" to="/analisis/resumen">
            Conocer el análisis
          </Link>
        </div>
      </section>
    </div>
  );
}
