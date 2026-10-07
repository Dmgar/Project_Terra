import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { labels, units, api, Header, Section, State, Metric, Bars } from "../ui";

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const m = data?.metrics || {};

  return (
    <>
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
          <Link className="button" to="/producto/recomendar">
            Ver la recomendación →
          </Link>
        </section>
      </State>
    </>
  );
}

