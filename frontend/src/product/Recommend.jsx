import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FEATURES, labels, units, defaults, presets, ranges, displayDatasetLabel, api, Header } from "../ui";

export default function Recommend() {
  // Desde "Regiones" se puede llegar con el perfil de una región ya cargado.
  const incoming = useLocation().state?.values;
  const [values, setValues] = useState(() =>
    incoming
      ? Object.fromEntries(FEATURES.map((k) => [k, Number(incoming[k] ?? defaults[k])]))
      : defaults
  );
  const [preset, setPreset] = useState(incoming ? "" : "Equilibrado");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setValues((x) => ({ ...x, [k]: Number(v) }));

  const run = () => {
    setLoading(true);
    setError("");
    api("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Header
        eyebrow="Recomendación"
        title={
          <>
            Una segunda lectura<br />
            <em>para la parcela.</em>
          </>
        }
        description="Introduce las condiciones del terreno. Terra las compara con la ecorregión funcional observada más cercana y devuelve un perfil de cultivos basado en evidencia."
      />
      <div className="presets" aria-label="Escenarios de ejemplo">
        {Object.keys(presets).map((k, i) => {
          const spanish = ["Equilibrado", "Trópico húmedo", "Secano", "Tierra alta"][i];
          return (
            <button
              key={k}
              className={`preset ${preset === spanish ? "active" : ""}`}
              onClick={() => {
                setPreset(spanish);
                setValues(presets[k]);
              }}
            >
              {spanish}
            </button>
          );
        })}
      </div>
      <div className="form-layout">
        <div className="form-panel">
          <div className="kicker">Tu terreno · 7 señales</div>
          <h2
            style={{
              font: "28px var(--display)",
              fontWeight: 400,
              margin: "12px 0 26px",
            }}
          >
            Describe las condiciones
          </h2>
          <div className="field-grid">
            {FEATURES.map((k) => (
              <div className="field" key={k}>
                <label htmlFor={k}>
                  {labels[k]} <span>{values[k]} {units[k]}</span>
                </label>
                <input
                  id={k}
                  type="range"
                  className="range"
                  min={ranges[k][0]}
                  max={ranges[k][1]}
                  step={k === "pH_Value" || k === "Temperature" ? ".1" : "1"}
                  value={values[k]}
                  onChange={(e) => {
                    setPreset("Personalizado");
                    set(k, e.target.value);
                  }}
                />
                <input
                  aria-label={`${labels[k]} valor exacto`}
                  type="number"
                  min={ranges[k][0]}
                  max={ranges[k][1]}
                  step={k === "pH_Value" || k === "Temperature" ? ".1" : "1"}
                  value={values[k]}
                  onChange={(e) => {
                    setPreset("Personalizado");
                    set(k, e.target.value);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="submit-row">
            <span className="kicker">Listo para descubrir tu resultado</span>
            <button className="button" onClick={run} disabled={loading}>
              {loading ? "Buscando…" : "Ver mi recomendación →"}
            </button>
          </div>
          {error && <div className="error" style={{ marginTop: 18 }}>{error}</div>}
        </div>
        <div>
          {result ? (
            <div className="result">
              <span className="eyebrow">Ecorregión funcional coincidente</span>
              <h2>Región {result.cluster}</h2>
              <div className="confidence">
                <b>{result.confidenceLabel}</b>
                <span>
                  {result.sampleCount?.toLocaleString()} observaciones comparables ·
                  {Number(result.share || 0).toFixed(1)}% de la muestra
                </span>
              </div>
              <div className="crop-result">
                <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>
                  Afinidad de cultivos observada
                </h3>
                {(result.crops || []).map((c, i) => (
                  <div className="crop-item" key={c.name || c.crop || i}>
                    <b>{displayDatasetLabel(c.name || c.crop)}</b>
                    <span>{Number(c.share || c.value || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 18 }}>
                <Link className="hero-link-dark" to="/analisis/regiones">
                  ¿Por qué esta región? Ver cómo se formó →
                </Link>
              </p>
              {Array.isArray(result.advice) && result.advice.length > 0 && (
                <div className="note" style={{ marginTop: 22 }}>
                  <strong>Lectura de manejo</strong>
                  <ul>
                    {result.advice.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="panel result-empty">
              <div>
                <strong>Tu recomendación aparecerá aquí</strong>
                Ajusta los controles o elige un escenario. Después podrás ver la
                ecorregión más cercana.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
