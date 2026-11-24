import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { displayDatasetLabel, shortRegionTag, Icon } from "../ui";
import { scrollToElement, useReveal } from "../motion";
import IntroSequence from "../scene/IntroSequence";
import { REGION_COLORS, parcelStill } from "../scene/fieldLayout";
import { useSceneValue } from "../scene/sceneStore";
import { Meter, RegionStrip } from "../analysis/charts";
import { numberLocale, tr, useI18n } from "../i18n";

// Lo que se puede hacer en Terra, en el orden en que suele necesitarse (funciones: siguen el idioma).
const actions = () => [
  { to: "/producto/recomendar", title: tr("Consultar cultivos", "Explore crops"), text: tr("Compara tu suelo con los datos de referencia y mira en qué ecorregión cae.", "Compare your soil with the reference data and see which ecoregion it falls into.") },
  { to: "/producto/plan", title: tr("Preparar mi plan", "Prepare my plan"), text: tr("Organiza cultivos, espacio y estimaciones de cosecha para tu huerta o tu finca.", "Organize crops, space and harvest estimates for your garden or your farm.") },
  { to: "/analisis/resumen", title: tr("Conocer el análisis", "See the analysis"), text: tr("Explora los datos y el modelo detrás de cada recomendación.", "Explore the data and the model behind every recommendation.") },
];

const steps = () => [
  { title: tr("Describe tu parcela", "Describe your plot"), text: tr("Siete señales: nitrógeno, fósforo, potasio, temperatura, humedad, pH y lluvia.", "Seven signals: nitrogen, phosphorus, potassium, temperature, humidity, pH and rainfall.") },
  { title: tr("Terra la ubica", "Terra places it"), text: tr("Busca la ecorregión con condiciones más parecidas entre 12.784 muestras reales de Colombia.", "It finds the ecoregion with the most similar conditions among 12,784 real samples from Colombia.") },
  { title: tr("Recibe un plan", "Get a plan"), text: tr("Qué sembrar, cuánto espacio dar a cada cultivo y qué esperar de la cosecha.", "What to plant, how much space to give each crop and what to expect from the harvest.") },
];

const percent = (value) => `${Number(value).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })} %`;

// Explorador: eliges una ecorregión y ves su parcela en el render junto a sus datos reales.
function RegionExplorer({ selected, onSelect }) {
  const regions = useSceneValue((state) => state.regions);
  const { tx } = useI18n();
  const ordered = regions ? [...regions].sort((a, b) => a.id - b.id) : [];
  const region = ordered.find((r) => r.id === selected) || ordered[0];
  if (!region) {
    return <p className="explorer-offline">{tx("No pudimos leer las ecorregiones ahora mismo. Vuelve a intentarlo en un momento.", "We couldn't load the ecoregions right now. Please try again in a moment.")}</p>;
  }
  const color = REGION_COLORS[region.id];
  const maxShare = Math.max(...(region.crops || []).map((c) => c.share), 1);
  return (
    <div className="explorer" style={{ "--region": color }}>
      <RegionStrip regions={ordered} selected={region.id} onSelect={onSelect} />
      <div className="explorer-body">
        <figure className="explorer-photo">
          {/* La clave reinicia el fundido al cambiar de parcela. */}
          <img key={region.id} src={parcelStill(region.id)} alt={tx(`Parcela de la Ecorregión ${region.id} en la finca renderizada`, `Ecoregion ${region.id} plot on the rendered farm`)} width="1152" height="648" loading="lazy" />
          <figcaption>
            <i aria-hidden="true" /> {tx(`Parcela de la Ecorregión ${region.id} en la finca`, `Ecoregion ${region.id} plot on the farm`)}
          </figcaption>
        </figure>
        <div key={region.id} className="explorer-data">
          <h3>{tx("Ecorregión", "Ecoregion")} {region.id} · {shortRegionTag(region.profile)}</h3>
          <p>
            {tx(
              `${percent(region.share)} de las muestras reales (${Number(region.count).toLocaleString(numberLocale())} registros). La define su suelo y su clima —por eso el mismo cultivo puede dominar en dos ecorregiones con distinto ambiente.`,
              `${percent(region.share)} of the real samples (${Number(region.count).toLocaleString(numberLocale())} records). It is defined by its soil and climate, which is why the same crop can lead in two ecoregions with different conditions.`
            )}
          </p>
          {(region.crops || []).slice(0, 4).map((crop, i) => (
            <Meter key={crop.name} label={displayDatasetLabel(crop.name)} detail={percent(crop.share)} value={crop.share / maxShare} color={color} delay={i * 70} />
          ))}
          <Link className="button ghost" to="/analisis/regiones">
            {tx("Ver su firma ambiental", "See its environmental signature")} <Icon />
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
  const { tx } = useI18n();
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
            {tx("Cinco ecorregiones, cinco parcelas.", "Five ecoregions, five plots.")}
          </h2>
          <p data-reveal="0.08">
            {tx(
              "Cada parcela de la finca representa un grupo real del modelo. Elige una para ver cuántos registros reúne y qué cultivos aparecen en ella.",
              "Each plot on the farm stands for a real group in the model. Pick one to see how many records it holds and which crops appear in it."
            )}
          </p>
        </div>
        <div data-reveal="0.12">
          <RegionExplorer selected={selected} onSelect={setSelected} />
        </div>
      </section>

      <section className="home-section home-act" aria-labelledby="act-title">
        <div className="section-intro">
          <h2 id="act-title" data-reveal>
            {tx("¿Qué quieres hacer hoy?", "What would you like to do today?")}
          </h2>
        </div>
        <ul className="action-grid">
          {actions().map(({ to, title, text }, index) => (
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
            {tx("Cómo funciona", "How it works")}
          </h2>
        </div>
        <ol className="steps" ref={stepsRef}>
          {steps().map(({ title, text }, index) => (
            <li key={index} style={{ "--i": index }}>
              <span className="step-n">{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-close" aria-labelledby="close-title">
        <h2 id="close-title" data-reveal>
          {tx("La recomendación empieza bajo tus pies.", "The recommendation starts beneath your feet.")}
        </h2>
        <p data-reveal="0.08">{tx("Terra compara tu parcela con 12.784 muestras reales de Colombia y siete variables de suelo y clima.", "Terra compares your plot with 12,784 real samples from Colombia across seven soil and climate variables.")}</p>
        <div className="home-actions" data-reveal="0.16">
          <Link className="button cta" to="/producto/recomendar">
            {tx("Describir mi parcela", "Describe my plot")}
          </Link>
          <Link className="button ghost" to="/analisis/resumen">
            {tx("Conocer el análisis", "See the analysis")}
          </Link>
        </div>
      </section>
    </div>
  );
}
