import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FEATURES, units, defaults, presets, ranges, displayDatasetLabel, describeRegion, api, Header, Icon } from "../ui";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";
import { RadarChart } from "../RadarChart.jsx";
import { REGION_COLORS } from "../scene/fieldLayout";
import { focusRegion } from "../scene/sceneStore";
import { scrollToTop } from "../motion";
import { Meter } from "../analysis/charts";

export default function Recommend() {
  const { t, featureLabel } = useI18n();
  const { user, saveParcel } = useAuth();
  // Desde "Regiones" o "Mis parcelas" se puede llegar con un perfil ya cargado.
  const incoming = useLocation().state?.values;
  const [values, setValues] = useState(() =>
    incoming
      ? Object.fromEntries(FEATURES.map((k) => [k, Number(incoming[k] ?? defaults[k])]))
      : defaults
  );
  const [preset, setPreset] = useState(incoming ? "" : "Balanced");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parcelName, setParcelName] = useState("");
  const [parcelDept, setParcelDept] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const onSaveParcel = async (e) => {
    e.preventDefault();
    if (!parcelName.trim()) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await saveParcel({
        name: parcelName.trim(),
        department: parcelDept.trim(),
        ...values,
        recommended_cluster: result ? result.cluster : null,
      });
      setParcelName("");
      setParcelDept("");
      setSaveMsg(t("saveParcelSaved"));
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setValues((x) => ({ ...x, [k]: Number(v) }));

  const run = () => {
    setLoading(true);
    setError("");
    api("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then((data) => {
        setResult(data);
        // La cabecera pasa a la parcela de la ecorregión que resultó.
        focusRegion(data.cluster, `Parcela de la Ecorregión ${data.cluster}: la más parecida a la tuya`);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Header
        title={
          <>
            {t("recTitle1")}<br />
            <em>{t("recTitle2")}</em>
          </>
        }
        description={t("recDesc")}
      />
      <div className="presets" aria-label="Escenarios de ejemplo">
        {Object.keys(presets).map((k, i) => {
          const presetLabel = t("presets")[i] || k;
          return (
            <button
              key={k}
              className={`preset ${preset === k ? "active" : ""}`}
              onClick={() => {
                setPreset(k);
                setValues(presets[k]);
              }}
            >
              {presetLabel}
            </button>
          );
        })}
      </div>
      <div className="form-layout">
        <div className="form-panel">
          <h2 className="form-title">
            {t("recFormTitle")}
          </h2>
          <p className="panel-caption form-caption">
            {t("recFormCaption")}
          </p>
          <div className="field-grid">
            {FEATURES.map((k) => (
              <div className="field" key={k}>
                <label htmlFor={k}>
                  {featureLabel(k)} <span>{values[k]} {units[k]}</span>
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
                    setPreset("custom");
                    set(k, e.target.value);
                  }}
                />
                <input
                  aria-label={`${featureLabel(k)} valor exacto`}
                  type="number"
                  min={ranges[k][0]}
                  max={ranges[k][1]}
                  step={k === "pH_Value" || k === "Temperature" ? ".1" : "1"}
                  value={values[k]}
                  onChange={(e) => {
                    setPreset("custom");
                    set(k, e.target.value);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="submit-row">
            <span className="submit-hint">{t("recReadyHint")}</span>
            <button className="button" onClick={run} disabled={loading}>
              {loading ? (
                t("recSearching")
              ) : (
                <>
                  {t("recSubmit")} <Icon />
                </>
              )}
            </button>
          </div>
          {user ? (
            <form onSubmit={onSaveParcel} style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                required
                minLength={2}
                placeholder={t("saveParcelNamePlaceholder")}
                value={parcelName}
                onChange={(e) => setParcelName(e.target.value)}
                style={{ flex: "1 1 180px" }}
              />
              <input
                type="text"
                placeholder={t("saveParcelDeptPlaceholder")}
                value={parcelDept}
                onChange={(e) => setParcelDept(e.target.value)}
                style={{ flex: "0 1 160px" }}
              />
              <button type="submit" className="button secondary" disabled={saving}>
                {t("saveParcelBtn")}
              </button>
              {saveMsg && <span style={{ width: "100%", fontSize: "0.85rem" }}>{saveMsg}</span>}
            </form>
          ) : (
            <p className="panel-caption" style={{ marginTop: 14 }}>
              <Link className="hero-link-dark" to="/cuenta">
                {t("saveParcelSignIn")} <Icon />
              </Link>
            </p>
          )}
          {error && <div className="error" role="alert" style={{ marginTop: 18 }}>{error}</div>}
        </div>
        <div>
          {result ? (
            <div className="result" style={{ "--region": REGION_COLORS[result.cluster] }}>
              <h2 className="result-region" style={{ "--region": REGION_COLORS[result.cluster] }}>
                <i aria-hidden="true" />
                Ecorregión {result.cluster}
              </h2>
              {/* Rasgos de la ecorregión según su perfil medio (describeRegion: húmedo/seco, pH, lluvia). */}
              <p className="result-traits">{describeRegion(result.cluster, result.centroidProfile).split(" · ")[1]}</p>
              <div className="confidence">
                <b>{result.confidenceLabel}</b>
                <span>
                  {result.sampleCount?.toLocaleString()} observaciones comparables ·{" "}
                  {Number(result.share || 0).toFixed(1)}% de la muestra
                </span>
              </div>
              <div className="crop-result">
                <h3>Cultivos en esta ecorregión</h3>
                {(result.crops || []).map((c, i, all) => (
                  <Meter
                    key={c.name || c.crop || i}
                    label={displayDatasetLabel(c.name || c.crop)}
                    detail={`${Number(c.share || 0).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`}
                    value={(c.share || 0) / Math.max(...all.map((x) => x.share || 0), 1)}
                    color={REGION_COLORS[result.cluster]}
                    delay={i * 60}
                  />
                ))}
                <p className="result-note">
                  Distribución observada sobre muestras reales de Colombia (AGROSAVIA + NASA POWER). Usa este
                  perfil como guía inicial y combínalo con el planificador económico.
                </p>
              </div>
              <RadarChart
                centroidProfile={result.normalizedCentroid}
                userProfile={result.normalizedUser}
                centroidLabel={`Región ${result.cluster}`}
                userLabel="Tu parcela"
              />
              {Array.isArray(result.gmmProbabilities) && result.gmmProbabilities.length > 0 && (
                <div className="note">
                  <strong>Afinidad probabilística (GMM)</strong>
                  <div className="gmm-list">
                    {result.gmmProbabilities.map((g) => (
                      <span key={g.cluster}>
                        Región {g.cluster}: {(Number(g.probability) * 100).toFixed(1)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="result-scene">
                Arriba ves la parcela de la Ecorregión {result.cluster} en la finca.{" "}
                <button type="button" className="button ghost" onClick={scrollToTop}>
                  Ver la parcela
                </button>
              </p>
              <p style={{ marginTop: 18 }}>
                <Link className="hero-link-dark" to="/analisis/regiones">
                  ¿Por qué esta región? Ver cómo se formó <Icon />
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
