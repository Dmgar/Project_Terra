import React from "react";
import { Link } from "react-router-dom";

import tractorAtardecer from "../assets/tractor-atardecer.webp";

export default function Home() {
  return (
    <section className="carousel hero-image" aria-label="Portada">
      <img
        className="carousel-slide active"
        src={tractorAtardecer}
        alt="Tractor verde al atardecer junto a un cultivo"
      />
      <div className="carousel-shade" />

      <div className="carousel-copy">
        <h1>Siembra lo que tu tierra sí quiere dar.</h1>
        <p>
          Dinos cuánto espacio tienes y armamos un plan de siembra con costos y
          cosecha estimada. Si ya conoces tu suelo, también podemos decirte a
          qué zonas se parece.
        </p>
        <div className="hero-actions">
          <Link className="button cta" to="/producto/plan">
            Planear mi siembra
          </Link>
        </div>
      </div>
    </section>
  );
}
