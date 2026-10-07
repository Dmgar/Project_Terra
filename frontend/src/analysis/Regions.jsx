import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { labels, units, displayDatasetLabel, api, Header, State } from "../ui";

export default function Regions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    api("/api/regions")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const region = data?.regions?.[selected];

  return (
    <>
      <Header
        eyebrow="Regiones"
        title={
          <>
            Cinco formas de<br />
            <em>comportarse.</em>
          </>
        }
        description="Las ecorregiones funcionales son perfiles, no etiquetas: combinaciones recurrentes de nutrientes, clima y agua."
      />
      <State loading={!data && !error} error={error}>
        <div className="region-grid">
          {(data?.regions || []).map((r, i) => (
            <button
              className={`region-card ${selected === i ? "selected" : ""}`}
              key={r.id}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
            >
              <h3>Región {r.id}</h3>
              <strong>{Number(r.share || 0).toFixed(1)}%</strong>
              <small>{r.count?.toLocaleString()} observaciones</small>
              <div className="profile-bars">
                {Object.entries(r.normalizedProfile || {}).slice(0, 4).map(
                  ([k, v]) => (
                    <span className="profile-mini" key={k}>
                      {(labels[k] || k).slice(0, 3)}
                      <i
                        style={{ width: `${Math.max(10, Number(v) * 50)}px` }}
                      />
                    </span>
                  )
                )}
              </div>
            </button>
          ))}
        </div>

        {region && (
          <div className="detail grid-2">
            <div className="panel">
              <span className="kicker">Región {region.id} / perfil</span>
              <h2
                style={{
                  font: "34px var(--display)",
                  fontWeight: 400,
                  margin: "13px 0",
                }}
              >
                Territorio con predominio de{" "}
                {displayDatasetLabel(region.topCrop || "cultivo mixto")}
              </h2>
              <p className="intro">
                Este grupo contiene {region.count?.toLocaleString()} observaciones
                ({Number(region.share || 0).toFixed(1)}% de la muestra). Su cultivo
                más frecuente es{" "}
                <b>{displayDatasetLabel(region.topCrop || "cultivo mixto")}</b>.
              </p>
              <div style={{ marginTop: 18 }}>
                {(region.crops || []).slice(0, 6).map((x) => (
                  <span className="tag" key={x.name || x}>
                    {displayDatasetLabel(x.name || x)}
                  </span>
                ))}
              </div>
              <p style={{ marginTop: 22 }}>
                <Link
                  className="button"
                  to="/producto/recomendar"
                  state={{ values: region.profile }}
                >
                  Planear con esta región →
                </Link>
              </p>
            </div>
            <div className="panel">
              <h3>Firma ambiental</h3>
              <p className="panel-caption">
                Valores medios de esta región en unidades nativas.
              </p>
              <div className="feature-list">
                {Object.entries(region.profile || {}).map(([k, v]) => (
                  <div className="feature-line" key={k}>
                    <b>{labels[k] || k}</b>
                    <div className="spark">
                      <i
                        style={{
                          width: `${Math.min(100, Math.max(8, Number(v) / 3))}%`,
                          background: "#719b68",
                        }}
                      />
                    </div>
                    <em>{Number(v).toFixed(1)} {units[k] || ""}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </State>
    </>
  );
}

