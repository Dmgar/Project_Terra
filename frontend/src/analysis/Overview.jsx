import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { labels, units, api, Header, Section, State, Icon, displayDatasetLabel } from "../ui";
import { useSceneValue } from "../scene/sceneStore";
import { CountUp, Meter, RangeBar, RegionStrip } from "./charts";

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const regions = useSceneValue((state) => state.regions);

  useEffect(() => {
    api("/api/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const m = data?.metrics || {};
  const maxShare = (items = []) => Math.max(...items.map((x) => x.share || 0), 1);

  return (
    <>
      <Header
        title={
          <>
            Lee el terreno<br />
            <em>tal como es.</em>
          </>
        }
        description="Siete señales de suelo y clima agrupadas en cinco ecorregiones. Pasa por cada una para ver su parcela en la finca."
        action={<RegionStrip regions={regions} caption="Ancho de cada franja = su peso en las 12.784 muestras reales de Colombia." />}
      />
      <State loading={!data && !error} error={error}>
        <dl className="stat-row">
          <div>
            <dt>Muestras de campo</dt>
            <dd>
              <CountUp value={m.samples} />
            </dd>
          </div>
          <div>
            <dt>Cultivos registrados</dt>
            <dd>
              <CountUp value={m.crops} />
            </dd>
          </div>
          <div>
            <dt>Ecorregiones</dt>
            <dd>
              <CountUp value={m.regions} />
            </dd>
          </div>
          <div>
            <dt>Señales por muestra</dt>
            <dd>
              <CountUp value={m.features} />
            </dd>
          </div>
        </dl>

        <Section title="Qué hay en los datos" sub="Cultivos y suelos de las observaciones de campo">
          <div className="grid-2">
            <div className="panel">
              <h3>Cultivos</h3>
              <p className="panel-caption">Casi el mismo peso para los seis: el modelo no se apoya en el cultivo para agrupar.</p>
              {(data?.cropDistribution || []).map((x, i) => (
                <Meter
                  key={x.name}
                  label={displayDatasetLabel(x.name)}
                  detail={`${Number(x.share).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
                  value={x.share / maxShare(data.cropDistribution)}
                  color="var(--field-forest)"
                  delay={i * 60}
                />
              ))}
            </div>
            <div className="panel">
              <h3>Suelos</h3>
              <p className="panel-caption">Seis tipos de suelo, también repartidos casi por igual.</p>
              {(data?.soilDistribution || []).map((x, i) => (
                <Meter
                  key={x.name}
                  label={displayDatasetLabel(x.name)}
                  detail={`${Number(x.share).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
                  value={x.share / maxShare(data.soilDistribution)}
                  color="#9a6b45"
                  delay={i * 60}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Qué mide Terra" sub="Rango real de cada señal: de mínimo a máximo, con la media y su dispersión habitual">
          <div className="panel">
            <div className="range-legend" aria-hidden="true">
              <span><i className="swatch-band" /> media ± 1 desviación</span>
              <span><i className="swatch-mean" /> media</span>
            </div>
            {(data?.featureStats || []).map((stat, i) => (
              <RangeBar key={stat.feature} stat={stat} label={labels[stat.feature] || stat.feature} unit={units[stat.feature] || ""} delay={i * 70} />
            ))}
            <p className="note">
              El modelo agrupa observaciones por similitud ambiental, no por fronteras políticas. Usa el análisis para
              ver dónde se sostienen esas similitudes y dónde no.
            </p>
          </div>
        </Section>

        <section className="callout">
          <h3>¿Quieres leer tu parcela?</h3>
          <p>Introduce tu suelo y tu clima. Terra la ubicará en la ecorregión más parecida y te mostrará la evidencia.</p>
          <Link className="button cta" to="/producto/recomendar">
            Describir mi parcela <Icon />
          </Link>
        </section>
      </State>
    </>
  );
}
