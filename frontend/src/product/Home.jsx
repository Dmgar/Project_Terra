import React from "react";
import { Link } from "react-router-dom";
import tractorAtardecer from "../assets/tractor-atardecer.webp";
import surcosLechuga from "../assets/surcos-lechuga.jpeg";
import { Wave } from "../ui";

// Lo que se puede hacer en Terra, en el orden en que suele necesitarse.
const ACTIONS = [
  { to: "/producto/plan", title: "Preparar mi plan", text: "Organiza cultivos, espacio y estimaciones de cosecha." },
  { to: "/producto/recomendar", title: "Consultar cultivos", text: "Compara tu suelo con los datos de referencia." },
  { to: "/analisis/resumen", title: "Conocer el análisis", text: "Explora los datos detrás de cada recomendación." },
];

const STEPS = [
  { n: "1", title: "Describe tu parcela", text: "Suelo, clima y el espacio con el que cuentas." },
  { n: "2", title: "Terra la compara", text: "Busca condiciones parecidas en los datos de referencia." },
  { n: "3", title: "Recibe un plan", text: "Qué sembrar, cuánto espacio dar a cada cultivo y qué esperar." },
];

export default function Home() {
  return (
    <div className="terra-home">
      {/* Foto a ancho completo, sin texto encima: la imagen se ve tal cual y el borde ondulado la une con el blanco */}
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-photo">
          <img
            src={tractorAtardecer}
            alt="Tractor junto a un campo de cultivo al atardecer"
            width="1200"
            height="1000"
            fetchPriority="high"
          />
          <Wave color="#ffffff" direction="up" />
        </div>
        <div className="hero-text">
          <div>
            <p className="hero-eyebrow">Tu tierra. Tu próxima cosecha.</p>
            <h1 id="home-title">Cada suelo tiene una posibilidad.</h1>
          </div>
          <div>
            <p className="hero-lede">
              Encuentra qué sembrar y prepara un plan para tu parcela. Terra conecta las condiciones de tu suelo con
              decisiones de cultivo.
            </p>
            <Link className="button cta" to="/producto/plan">
              Planear mi siembra
            </Link>
          </div>
        </div>
      </section>

      <section className="do" aria-labelledby="do-title">
        <div className="do-copy">
          <h2 id="do-title">¿Qué quieres hacer hoy?</h2>
          <ul className="actions">
            {ACTIONS.map(({ to, title, text }) => (
              <li key={to}>
                <Link to={to}>
                  <span>
                    <b>{title}</b>
                    {text}
                  </span>
                  <i aria-hidden="true">›</i>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <img className="do-photo" src={surcosLechuga} alt="Surcos de lechuga en un valle, con montañas al fondo" width="678" height="452" loading="lazy" />
      </section>

      <section className="band band-soft" aria-labelledby="how-title">
        <Wave color="#ffffff" direction="down" />
        <div className="band-inner">
          <h2 id="how-title">Cómo funciona</h2>
          <ol className="steps">
            {STEPS.map(({ n, title, text }) => (
              <li key={n}>
                <span className="step-n">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band band-green" aria-labelledby="data-title">
        <Wave color="#e8f2e3" direction="down" />
        <div className="band-inner data-grid">
          <h2 id="data-title">La recomendación empieza bajo tus pies.</h2>
          <div>
            <p>
              Terra compara tu parcela con 20.000 registros exploratorios de referencia y siete variables de suelo y clima: temperatura,
              humedad, precipitación, pH, nitrógeno, fósforo y potasio.
            </p>
            <Link className="button light" to="/analisis/resumen">
              Conocer el análisis
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
