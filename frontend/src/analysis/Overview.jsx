import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { labels, units, api, Header, Section, State, Icon, displayDatasetLabel } from "../ui";
import { useSceneValue } from "../scene/sceneStore";
import { CountUp, Meter, RangeBar, RegionStrip } from "./charts";
import { numberLocale, useI18n } from "../i18n";

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const regions = useSceneValue((state) => state.regions);
  const { tx } = useI18n();

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
            {tx("Lee el terreno", "Read the land")}<br />
            <em>{tx("tal como es.", "as it is.")}</em>
          </>
        }
        description={tx(
          "Siete señales de suelo y clima agrupadas en cinco ecorregiones. Pasa por cada una para ver su parcela en la finca.",
          "Seven soil and climate signals grouped into five ecoregions. Hover over each one to see its plot on the farm."
        )}
        action={<RegionStrip regions={regions} caption={tx("Ancho de cada franja = su peso en las 12.784 muestras reales de Colombia.", "Width of each band = its share of the 12,784 real samples from Colombia.")} />}
      />
      <State loading={!data && !error} error={error}>
        <dl className="stat-row">
          <div>
            <dt>{tx("Muestras de campo", "Field samples")}</dt>
            <dd>
              <CountUp value={m.samples} />
            </dd>
          </div>
          <div>
            <dt>{tx("Cultivos registrados", "Recorded crops")}</dt>
            <dd>
              <CountUp value={m.crops} />
            </dd>
          </div>
          <div>
            <dt>{tx("Ecorregiones", "Ecoregions")}</dt>
            <dd>
              <CountUp value={m.regions} />
            </dd>
          </div>
          <div>
            <dt>{tx("Señales por muestra", "Signals per sample")}</dt>
            <dd>
              <CountUp value={m.features} />
            </dd>
          </div>
        </dl>

        <Section title={tx("Qué hay en los datos", "What's in the data")} sub={tx("Cultivos y suelos de las observaciones de campo", "Crops and soils in the field observations")}>
          <div className="grid-2">
            <div className="panel">
              <h3>{tx("Cultivos", "Crops")}</h3>
              <p className="panel-caption">
                {tx(
                  "Pesos muy distintos: la caña de azúcar domina la muestra real. El modelo no usa el cultivo para agrupar; solo para validar.",
                  "Very uneven weights: sugarcane dominates the real sample. The model doesn't use the crop to group; only to validate."
                )}
              </p>
              {(data?.cropDistribution || []).map((x, i) => (
                <Meter
                  key={x.name}
                  label={displayDatasetLabel(x.name)}
                  detail={`${Number(x.share).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })} %`}
                  value={x.share / maxShare(data.cropDistribution)}
                  color="var(--field-forest)"
                  delay={i * 60}
                />
              ))}
            </div>
            <div className="panel">
              <h3>{tx("Suelos", "Soils")}</h3>
              <p className="panel-caption">{tx("Seis tipos de suelo; el franco reúne más de la mitad de las muestras.", "Six soil types; loamy soil accounts for more than half of the samples.")}</p>
              {(data?.soilDistribution || []).map((x, i) => (
                <Meter
                  key={x.name}
                  label={displayDatasetLabel(x.name)}
                  detail={`${Number(x.share).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })} %`}
                  value={x.share / maxShare(data.soilDistribution)}
                  color="#9a6b45"
                  delay={i * 60}
                />
              ))}
            </div>
          </div>
        </Section>

        <Section
          title={tx("Qué mide Terra", "What Terra measures")}
          sub={tx("Rango real de cada señal: de mínimo a máximo, con la media y su dispersión habitual", "Real range of each signal: from minimum to maximum, with the mean and its usual spread")}
        >
          <div className="panel">
            <div className="range-legend" aria-hidden="true">
              <span><i className="swatch-band" /> {tx("media ± 1 desviación", "mean ± 1 standard deviation")}</span>
              <span><i className="swatch-mean" /> {tx("media", "mean")}</span>
            </div>
            {(data?.featureStats || []).map((stat, i) => (
              <RangeBar key={stat.feature} stat={stat} label={labels[stat.feature] || stat.feature} unit={units[stat.feature] || ""} delay={i * 70} />
            ))}
            <p className="note">
              {tx(
                "El modelo agrupa observaciones por similitud ambiental, no por fronteras políticas. Usa el análisis para ver dónde se sostienen esas similitudes y dónde no.",
                "The model groups observations by environmental similarity, not political borders. Use the analysis to see where those similarities hold and where they don't."
              )}
            </p>
          </div>
        </Section>

        <section className="callout">
          <h3>{tx("¿Quieres leer tu parcela?", "Want to read your plot?")}</h3>
          <p>{tx("Introduce tu suelo y tu clima. Terra la ubicará en la ecorregión más parecida y te mostrará la evidencia.", "Enter your soil and climate. Terra will place it in the closest ecoregion and show you the evidence.")}</p>
          <Link className="button cta" to="/producto/recomendar">
            {tx("Describir mi parcela", "Describe my plot")} <Icon />
          </Link>
        </section>
      </State>
    </>
  );
}
