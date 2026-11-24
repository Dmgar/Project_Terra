import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { labels, units, displayDatasetLabel, describeRegion, api, Header, State, Icon } from "../ui";
import { RadarChart } from "../RadarChart.jsx";
import { REGION_COLORS } from "../scene/fieldLayout";
import { focusRegion } from "../scene/sceneStore";
import { Meter, RangeBar, RegionStrip } from "./charts";
import { numberLocale, useI18n } from "../i18n";

const pct = (value) => `${Number(value || 0).toLocaleString(numberLocale(), { maximumFractionDigits: 1 })} %`;

export default function Regions() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const { tx } = useI18n();

  useEffect(() => {
    api("/api/regions")
      .then(setData)
      .catch((e) => setError(e.message));
    // Los rangos del conjunto completo sirven de regla para situar la firma de cada ecorregión.
    api("/api/overview")
      .then((overview) => setStats(Object.fromEntries(overview.featureStats.map((s) => [s.feature, s]))))
      .catch(() => setStats(null));
  }, []);

  // Al llegar, la cabecera muestra la parcela de la ecorregión elegida por defecto.
  useEffect(() => {
    if (data) focusRegion(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const region = data?.regions?.find((r) => r.id === selected);
  const color = REGION_COLORS[selected];

  return (
    <>
      <Header
        title={
          <>
            {tx("Cinco formas de", "Five ways to")}<br />
            <em>{tx("comportarse.", "behave.")}</em>
          </>
        }
        description={tx(
          "Cada ecorregión es una combinación recurrente de nutrientes, clima y agua. Elige una para ver su parcela en la finca.",
          "Each ecoregion is a recurring combination of nutrients, climate and water. Pick one to see its plot on the farm."
        )}
        action={<RegionStrip regions={data?.regions} selected={selected} onSelect={setSelected} />}
      />
      <State loading={!data && !error} error={error}>
        {region && (
          // La clave reinicia la transición de entrada al cambiar de ecorregión.
          <div key={region.id} className="region-detail" style={{ "--region": color }}>
            <div className="panel region-summary">
              <h2>
                <i className="stop-dot" aria-hidden="true" />
                {tx("Ecorregión", "Ecoregion")} {region.id}
              </h2>
              <p className="result-traits">{describeRegion(region.id, region.profile).split(" · ")[1]}</p>
              <p className="intro">
                {tx(
                  `Reúne ${region.count?.toLocaleString(numberLocale())} muestras reales (${pct(region.share)}). La define su combinación de suelo y clima —por eso un mismo cultivo puede aparecer en dos ecorregiones con distinto piso térmico o acidez.`,
                  `It holds ${region.count?.toLocaleString(numberLocale())} real samples (${pct(region.share)}). It is defined by its mix of soil and climate, which is why the same crop can appear in two ecoregions with a different altitude band or acidity.`
                )}
              </p>
              <h3>{tx("Cultivos registrados", "Recorded crops")}</h3>
              {(region.crops || []).map((crop, i) => (
                <Meter
                  key={crop.name}
                  label={displayDatasetLabel(crop.name)}
                  detail={pct(crop.share)}
                  value={crop.share / Math.max(...region.crops.map((c) => c.share))}
                  color={color}
                  delay={i * 50}
                />
              ))}
              <Link className="button cta" to="/producto/recomendar" state={{ values: region.profile }}>
                {tx("Probar este perfil en Recomendar", "Try this profile in Recommend")} <Icon />
              </Link>
            </div>
            <div className="panel">
              <h3>{tx("Firma ambiental", "Environmental signature")}</h3>
              <p className="panel-caption">
                {tx("Dónde cae la media de esta ecorregión dentro del rango de todos los registros.", "Where this ecoregion's mean falls within the range of all records.")}
              </p>
              <div className="range-legend" aria-hidden="true">
                <span><i className="swatch-band" /> {tx("media ± 1 desviación del conjunto", "overall mean ± 1 standard deviation")}</span>
                <span><i className="swatch-marker" style={{ background: color }} /> {tx("esta ecorregión", "this ecoregion")}</span>
              </div>
              {Object.entries(region.profile || {}).map(([feature, value], i) =>
                stats?.[feature] ? (
                  <RangeBar
                    key={feature}
                    stat={stats[feature]}
                    label={labels[feature] || feature}
                    unit={units[feature] || ""}
                    marker={value}
                    markerColor={color}
                    delay={i * 60}
                  />
                ) : (
                  <p className="feature-line" key={feature}>
                    <b>{labels[feature] || feature}</b> {Number(value).toFixed(1)} {units[feature] || ""}
                  </p>
                )
              )}
              <RadarChart centroidProfile={region.normalizedProfile} centroidLabel={describeRegion(region.id, region.profile)} />
            </div>
          </div>
        )}
      </State>
    </>
  );
}
