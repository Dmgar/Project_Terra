import React, { useEffect, useMemo, useState } from "react";
import GardenPlanner, { ModeChooser } from "./GardenPlanner";

const ENV_KEYS = [
  ["Nitrogen", "Nitrógeno", "mg/kg"],
  ["Phosphorus", "Fósforo", "mg/kg"],
  ["Potassium", "Potasio", "mg/kg"],
  ["Temperature", "Temperatura", "°C"],
  ["Humidity", "Humedad", "%"],
  ["pH_Value", "pH del suelo", "pH"],
  ["Rainfall", "Precipitación", "mm"],
];
const ENV_DEFAULTS = { Nitrogen: 70, Phosphorus: 50, Potassium: 60, Temperature: 24, Humidity: 70, pH_Value: 6.5, Rainfall: 130 };
const ENV_PRESETS = {
  "Equilibrado": ENV_DEFAULTS,
  "Trópico húmedo": { Nitrogen: 85, Phosphorus: 45, Potassium: 40, Temperature: 28.5, Humidity: 88, pH_Value: 6.2, Rainfall: 260 },
  "Secano": { Nitrogen: 40, Phosphorus: 35, Potassium: 30, Temperature: 32, Humidity: 40, pH_Value: 7.4, Rainfall: 45 },
  "Tierra alta": { Nitrogen: 50, Phosphorus: 90, Potassium: 120, Temperature: 15, Humidity: 75, pH_Value: 5.8, Rainfall: 140 },
};
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const num = (value) => Number(value || 0);
const money = (value) => value == null ? "—" : COP.format(value);
const pretty = (id) => id ? id.charAt(0).toUpperCase() + id.slice(1) : "—";

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `La solicitud no pudo completarse (${response.status}).`);
  }
  return response.json();
}

function Input({ label, value, onChange, type = "number", suffix }) {
  return <label className="opt-field"><span>{label}{suffix && <em>{suffix}</em>}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function CatalogCard({ crop, onChange, manual, onManual }) {
  const a = crop.assumptions || {};
  const source = crop.assumption_metadata?.price_cop_per_kg;
  const auditLabels = { price_cop_per_kg: "Precio", yield_t_per_ha: "Rendimiento", cost_cop_per_ha: "Costo", water_m3_per_ha: "Agua" };
  return <article className="crop-assumption">
    <div className="crop-heading"><div><span className="crop-dot" /><h3>{crop.name || pretty(crop.id)}</h3></div><span className="source-chip">Referencia editable</span></div>
    <div className="crop-fields">
      <Input label="Precio" suffix="COP/kg" value={a.price_cop_per_kg} onChange={(v) => onChange("price_cop_per_kg", v)} />
      <Input label="Rendimiento" suffix="t/ha" value={a.yield_t_per_ha} onChange={(v) => onChange("yield_t_per_ha", v)} />
      <Input label="Costo" suffix="COP/ha" value={a.cost_cop_per_ha} onChange={(v) => onChange("cost_cop_per_ha", v)} />
      <Input label="Agua" suffix="m³/ha" value={a.water_m3_per_ha} onChange={(v) => onChange("water_m3_per_ha", v)} />
      <Input label="Mínimo" suffix="ha" value={a.min_ha} onChange={(v) => onChange("min_ha", v)} />
      <Input label="Máximo" suffix="ha" value={a.max_ha} onChange={(v) => onChange("max_ha", v)} />
    </div>
    {source && <div className="assumption-source"><b>{source.source_id}</b><span>{source.period} · {source.market}</span></div>}
    <details className="assumption-audit"><summary>Ver trazabilidad de los valores</summary>{Object.entries(auditLabels).map(([key, label]) => { const meta = crop.assumption_metadata?.[key]; return meta ? <div key={key}><b>{label}</b><span>{meta.source_id} · {meta.period}</span><small>{meta.market} · referencia editable</small></div> : null; })}</details>
    <div className="manual-line"><label><span>Mi plan manual</span><input type="number" min="0" value={manual} onChange={(e) => onManual(e.target.value)} /></label><small>Opcional · se compara con el óptimo</small></div>
  </article>;
}

function ErrorBox({ message }) {
  return message ? <div className="error optimize-error"><b>No pudimos calcular un plan.</b><br />{message}<br /><span>Revisa que el área, presupuesto, agua y límites de cultivo puedan coexistir.</span></div> : null;
}

function Results({ result, crops, area }) {
  const scenarioLabels = { conservative: "Conservador", expected: "Esperado", favorable: "Favorable" };
  const constraintLabels = { area: "área disponible", budget: "presupuesto", water: "agua disponible" };
  return <div className="opt-results">
    <div className="result-banner"><div><span className="kicker">Plan calculado · {scenarioLabels[result.selected_risk_profile] || result.selected_risk_profile}</span><h2>Una mezcla que cabe<br /><em>en tu realidad.</em></h2></div><div className="result-meta">{result.department} · {result.market}<br /><small>{new Date().toLocaleDateString("es-CO")}</small></div></div>
    <div className="metrics opt-metrics">
      <div className="metric"><div className="metric-label">Ganancia estimada</div><div className="metric-value">{money(result.total_profit_cop)}</div><div className="metric-note">escenario seleccionado</div></div>
      <div className="metric"><div className="metric-label">Margen</div><div className="metric-value">{result.margin_pct == null ? "—" : `${Number(result.margin_pct).toFixed(1)}%`}</div><div className="metric-note">sobre ingresos</div></div>
      <div className="metric"><div className="metric-label">Ganancia / ha sembrada</div><div className="metric-value">{money(result.profit_per_ha_cop)}</div><div className="metric-note">{Number(result.allocated_area_ha || 0).toFixed(2)} ha asignadas</div></div>
      <div className="metric"><div className="metric-label">Inversión utilizada</div><div className="metric-value">{money(result.total_investment_cop)}</div><div className="metric-note">costos del plan recomendado</div></div>
    </div>
    <section className="result-section"><div className="section-head"><div><h2>Asignación recomendada</h2><p>Hectáreas y peso relativo dentro de la parcela.</p></div></div>
      <div className="allocation-list">{result.allocation.filter((row) => row.hectares > 0.0001).map((row) => { const share = num(row.hectares) / num(area) * 100; const name = crops.find((crop) => crop.id === row.crop_id)?.name || pretty(row.crop_id.replaceAll("_", " ")); return <div className="allocation-row" key={row.crop_id}><div className="allocation-name"><b>{name}</b><span>{row.hectares.toFixed(2)} ha · {share.toFixed(1)}% · afinidad {(row.suitability_score * 100).toFixed(0)}% · equilibrio {money(row.break_even_price_cop_per_kg)}/kg</span></div><div className="allocation-track"><i style={{ width: `${Math.min(100, share)}%` }} /></div><strong>{money(row.profit_cop)}</strong></div>; })}{result.unallocated_area_ha > 0.0001 && <div className="allocation-row unallocated"><div className="allocation-name"><b>Área sin asignar</b><span>{result.unallocated_area_ha.toFixed(2)} ha</span></div><div className="allocation-track" /><strong>Sin inversión</strong></div>}</div>
    </section>
    <section className="result-section"><div className="section-head"><div><h2>Tres futuros posibles</h2><p>La misma parcela, distinta lectura de precio, rendimiento y costo.</p></div></div>
      <div className="scenario-table"><div className="scenario-head"><span>Escenario</span><span>Inversión</span><span>Ingresos</span><span>Ganancia</span><span>Margen</span></div>{result.scenarios.map((s) => <div className={`scenario-row ${s.name === result.selected_risk_profile ? "selected" : ""}`} key={s.name}><b>{scenarioLabels[s.name]}</b><span>{money(s.total_investment_cop)}</span><span>{money(s.total_revenue_cop)}</span><strong>{money(s.total_profit_cop)}</strong><span>{s.margin_pct == null ? "—" : `${s.margin_pct.toFixed(1)}%`}</span></div>)}</div>
    </section>
    <div className="grid-2 result-lower"><section className="panel"><h3>Qué está limitando el plan</h3><p className="panel-caption">Restricciones que el modelo encontró activas.</p>{result.binding_constraints?.length ? <div className="constraint-list">{result.binding_constraints.map((item) => <span key={item}>{constraintLabels[item] || item.replace("max_ha:", "máximo · ").replace("min_ha:", "mínimo · ")}</span>)}</div> : <p className="muted">Ninguna restricción quedó exactamente al límite.</p>}</section>
      {result.manual_comparison && <section className="panel"><h3>Tu plan frente al óptimo</h3><p className="panel-caption">{result.manual_comparison.feasible ? "La asignación manual es factible." : "La asignación manual necesita ajustes."}</p><div className="manual-compare"><b>{money(result.manual_comparison.total_profit_cop)}</b><span>vs. óptimo {money(result.total_profit_cop)}</span><strong className={result.manual_comparison.profit_delta_cop >= 0 ? "positive" : "negative"}>{result.manual_comparison.profit_delta_cop >= 0 ? "+" : ""}{money(result.manual_comparison.profit_delta_cop)}</strong></div>{result.manual_comparison.warnings?.map((w) => <small className="warning-line" key={w}>{w}</small>)}</section>}</div>
    <section className="provenance"><div><span className="kicker">Trazabilidad del cálculo</span><h3>{result.provenance?.snapshot_id || "Catálogo económico"}</h3><p>{result.provenance?.method || "Supuestos editables para planeación; no son una cotización en tiempo real."}</p></div><div className="source-links">{(result.provenance?.sources || []).map((s) => <a href={s.url} target="_blank" rel="noreferrer" key={s.id}>{s.id} ↗</a>)}</div></section>
    {result.warnings?.length > 0 && <div className="result-warnings"><b>Supuestos y límites del cálculo</b><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    <div className="non-guarantee"><b>Decisión informada, no promesa de cosecha.</b><span>Los precios, costos, rendimientos y agua son supuestos. Valida cada valor con un comprador, asistencia técnica y una observación local antes de invertir.</span></div>
  </div>;
}

export default function Optimize({ Layout }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get("mode"));
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ area_ha: "", department: "", market: "", budget_cop: "", water_m3: "", risk_profile: "expected" });
  const [environment, setEnvironment] = useState(ENV_DEFAULTS);
  const [crops, setCrops] = useState([]);
  const [manual, setManual] = useState({});
  const [suitabilityWeight, setSuitabilityWeight] = useState(0.2);
  useEffect(() => { request("/api/economics/catalog").then((data) => { setCatalog(data); setCrops(data.crops || []); setSuitabilityWeight(data.optimization_policy?.suitability_tiebreak_weight ?? 0.2); }).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const provenance = useMemo(() => catalog?.provenance, [catalog]);
  const updateCrop = (id, key, value) => setCrops((items) => items.map((crop) => crop.id === id ? { ...crop, assumptions: { ...crop.assumptions, [key]: num(value) } } : crop));
  const run = () => {
    setRunning(true); setError("");
    const manualValues = Object.fromEntries(Object.entries(manual).filter(([, value]) => value !== "" && num(value) > 0));
    const payload = { ...form, area_ha: num(form.area_ha), budget_cop: num(form.budget_cop), water_m3: num(form.water_m3), suitability_tiebreak_weight: num(suitabilityWeight), environmental_values: environment, crops: crops.map((c) => ({ crop_id: c.id, ...c.assumptions })), ...(Object.keys(manualValues).length ? { manual_hectares: manualValues } : {}) };
    request("/api/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((data) => { setResult(data); setStage(4); window.scrollTo({ top: 0, behavior: "smooth" }); }).catch((e) => setError(e.message)).finally(() => setRunning(false));
  };
  const stageTitle = ["", "Tu parcela", "Tu ambiente", "Supuestos económicos", "Resultado"][stage];
  if (!mode) return <Layout route="/optimize"><div className="optimize-page"><div className="topline"><span className="kicker">05 / Cultiva con un plan</span><span className="top-status"><i className="dot" /> dos niveles · una mejor decisión</span></div><h1 className="page-title">Del balcón a la parcela,<br /><em>empieza a tu medida.</em></h1><p className="intro">Elige una guía sencilla para tu huerta o abre el análisis completo para producción comercial. Lo avanzado sigue disponible cuando lo necesites.</p><ModeChooser onChoose={setMode} /></div></Layout>;
  if (mode === "garden") return <Layout route="/optimize"><div className="optimize-page"><div className="topline"><span className="kicker">05 / Mi huerta</span><span className="top-status"><i className="dot" /> sencillo · hogar y ahorro</span></div><h1 className="page-title">Cultiva cerca,<br /><em>cosecha seguido.</em></h1><p className="intro">Una guía simple para organizar espacios pequeños sin pedirte datos técnicos que quizá no tienes.</p><GardenPlanner onBack={() => setMode(null)} /></div></Layout>;
  return <Layout route="/optimize"><div className="optimize-page"><div className="topline"><span className="kicker">05 / Plan rentable</span><span className="top-status"><i className="dot" /> cálculo transparente · Colombia</span></div><h1 className="page-title">Planifica con<br /><em>los pies en la tierra.</em></h1><p className="intro">Distribuye tu parcela entre cultivos, presupuesto y agua. Ajusta cada supuesto, entiende los límites y compara el plan con tu propia intuición.</p>
    <button className="back-link" onClick={() => setMode(null)}>← Cambiar tipo de plan</button>
    <div className="stepper">{["Tu parcela", "Ambiente", "Supuestos", "Resultado"].map((label, i) => <button key={label} className={stage === i + 1 ? "active" : stage > i + 1 ? "done" : ""} onClick={() => stage > i + 1 && setStage(i + 1)}><span>0{i + 1}</span>{label}</button>)}</div>
    {loading ? <div className="panel loading opt-loading">Leyendo catálogo económico…</div> : error && !catalog ? <ErrorBox message={error} /> : stage === 4 && result ? <Results result={result} crops={crops} area={form.area_ha} /> : <div className="opt-workspace"><div className="opt-form">
        <div className="opt-stage-title"><span className="kicker">Etapa 0{stage}</span><h2>{stageTitle}</h2><p>{stage === 1 ? "Sin supuestos ocultos. Cuéntanos qué parcela quieres ordenar." : stage === 2 ? "El ambiente orienta la afinidad; no cambia la economía." : "Todo valor viene del catálogo y puede editarse antes de calcular."}</p></div>
      {stage === 1 && <><div className="opt-grid"><Input label="Área disponible" suffix="ha" value={form.area_ha} onChange={(v) => setForm({ ...form, area_ha: v })} /><Input label="Presupuesto total" suffix="COP" value={form.budget_cop} onChange={(v) => setForm({ ...form, budget_cop: v })} /><Input label="Agua disponible" suffix="m³" value={form.water_m3} onChange={(v) => setForm({ ...form, water_m3: v })} /><Input label="Departamento" type="text" value={form.department} onChange={(v) => setForm({ ...form, department: v })} /><Input label="Mercado / comprador" type="text" value={form.market} onChange={(v) => setForm({ ...form, market: v })} /></div><div className="risk-select"><span>Perfil de riesgo</span>{[["conservative", "Conservador", "Protege margen"], ["expected", "Esperado", "Punto de partida"], ["favorable", "Favorable", "Mayor exposición"]].map(([value, label, note]) => <button key={value} className={form.risk_profile === value ? "active" : ""} onClick={() => setForm({ ...form, risk_profile: value })}><b>{label}</b><small>{note}</small></button>)}</div></>}
      {stage === 2 && <><div className="presets opt-presets">{Object.keys(ENV_PRESETS).map((name) => <button key={name} className="preset" onClick={() => setEnvironment(ENV_PRESETS[name])}>{name}</button>)}</div><div className="env-grid">{ENV_KEYS.map(([key, label, unit]) => <Input key={key} label={label} suffix={unit} value={environment[key]} onChange={(v) => setEnvironment({ ...environment, [key]: num(v) })} />)}</div><div className="source-status">Perfil editable · 7 señales existentes de Terra · valores ingresados por ti</div></>}
      {stage === 3 && <><div className="catalog-status"><span><i className="dot" /> {catalog?.country || "Colombia"} · {catalog?.currency || "COP"}</span><span>Versión {catalog?.version || "—"} · {catalog?.reference_period || "referencia"}</span></div><div className="policy-panel"><div><b>Objetivo económico</b><span>{catalog?.optimization_policy?.objective}</span></div><Input label="Peso de afinidad para desempates" suffix="0–1" value={suitabilityWeight} onChange={setSuitabilityWeight} /><details><summary>Ver supuestos de escenarios</summary>{Object.entries(catalog?.optimization_policy?.scenario_multipliers || {}).map(([name, factors]) => <p key={name}><b>{name}</b> · precio ×{factors.price} · rendimiento ×{factors.yield} · costo ×{factors.cost}</p>)}</details></div><div className="crop-grid">{crops.map((crop) => <CatalogCard key={crop.id} crop={crop} manual={manual[crop.id] || ""} onManual={(v) => setManual({ ...manual, [crop.id]: v })} onChange={(key, value) => updateCrop(crop.id, key, value)} />)}</div></>}
      {error && <ErrorBox message={error} />}
      <div className="opt-actions">{stage > 1 && <button className="button secondary" onClick={() => setStage(stage - 1)}>← Atrás</button>}<span />{stage < 3 && <button className="button" onClick={() => { if (stage === 1) { const diversifiedMax = Math.max(num(form.area_ha) * 0.5, 0.01); setCrops((items) => items.map((crop) => ({ ...crop, assumptions: { ...crop.assumptions, max_ha: diversifiedMax } }))); } setStage(stage + 1); }} disabled={stage === 1 && (!form.area_ha || !form.department || !form.market || !form.budget_cop || !form.water_m3)}>Continuar →</button>}{stage === 3 && <button className="button" onClick={run} disabled={running}>{running ? "Calculando plan…" : "Calcular plan rentable →"}</button>}</div>
    </div><aside className="opt-aside"><span className="kicker">Fuente y estado</span><h3>{provenance?.snapshot_id || "Catálogo económico"}</h3><p>{provenance?.coverage || "Colombia · referencia nacional para planeación."}</p><div className="aside-rule" /><b>{crops.length || "—"} cultivos disponibles</b><small>Todos los valores quedan visibles y son editables.</small>{catalog?.provenance?.sources?.slice(0, 2).map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.id} ↗</a>)}<div className="aside-warning">No es asesoría financiera ni agronómica. Es una herramienta para explorar escenarios.</div></aside></div>}
  </div></Layout>;
}