import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GardenPlanner, { ModeChooser } from "./GardenPlanner";
import { Header, Icon, formatApiDetail, labels } from "./ui";
import { numberLocale, tr, useI18n } from "./i18n";
import { downloadCommercialPdf, downloadCommercialCsv } from "./commercialPdf";

// Variable y unidad; el nombre sale de `labels` (ya traducido).
const ENV_KEYS = [
  ["Nitrogen", "mg/kg"],
  ["Phosphorus", "mg/kg"],
  ["Potassium", "mg/kg"],
  ["Temperature", "°C"],
  ["Humidity", "%"],
  ["pH_Value", "pH"],
  ["Rainfall", "mm"],
];
const ENV_DEFAULTS = { Nitrogen: 70, Phosphorus: 50, Potassium: 60, Temperature: 24, Humidity: 70, pH_Value: 6.5, Rainfall: 130 };
// [id, nombre en español, nombre en inglés, valores]
const ENV_PRESETS = [
  ["balanced", "Equilibrado", "Balanced", ENV_DEFAULTS],
  ["wet", "Trópico húmedo", "Wet tropical", { Nitrogen: 85, Phosphorus: 45, Potassium: 40, Temperature: 28.5, Humidity: 88, pH_Value: 6.2, Rainfall: 260 }],
  ["dry", "Secano", "Dryland", { Nitrogen: 40, Phosphorus: 35, Potassium: 30, Temperature: 32, Humidity: 40, pH_Value: 7.4, Rainfall: 45 }],
  ["highland", "Tierra alta", "Cool highland", { Nitrogen: 50, Phosphorus: 90, Potassium: 120, Temperature: 15, Humidity: 75, pH_Value: 5.8, Rainfall: 140 }],
];
// El catálogo económico llega en español desde la API: en pantalla se traduce el nombre del cultivo.
const CROP_NAMES_EN = { Arroz: "Rice", "Maíz": "Maize", Papa: "Potato", Tomate: "Tomato", "Caña de azúcar": "Sugarcane", Trigo: "Wheat", "Fríjol": "Beans", Frijol: "Beans" };
const cropLabel = (name) => tr(name, CROP_NAMES_EN[name] ?? name);
const num = (value) => Number(value || 0);
const money = (value) => value == null ? "—" : new Intl.NumberFormat(numberLocale(), { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
const pretty = (id) => id ? id.charAt(0).toUpperCase() + id.slice(1) : "—";

const API_BASE_URL = "/api";

async function request(endpoint, options) {
  const normalizedUrl = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : endpoint.startsWith("/api")
      ? endpoint
      : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await fetch(normalizedUrl, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(formatApiDetail(body.detail, tr(`La solicitud no pudo completarse (${response.status}).`, `The request could not be completed (${response.status}).`)));
  }
  return response.json();
}

function Input({ label, value, onChange, type = "number", suffix }) {
  return <label className="opt-field"><span>{label}{suffix && <em>{suffix}</em>}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function CatalogCard({ crop, onChange, manual, onManual }) {
  const { tx } = useI18n();
  const a = crop.assumptions || {};
  const source = crop.assumption_metadata?.price_cop_per_kg;
  const auditLabels = { price_cop_per_kg: tx("Precio", "Price"), yield_t_per_ha: tx("Rendimiento", "Yield"), cost_cop_per_ha: tx("Costo", "Cost"), water_m3_per_ha: tx("Agua", "Water") };
  return <article className="crop-assumption">
    <div className="crop-heading"><div><span className="crop-dot" /><h3>{crop.name ? cropLabel(crop.name) : pretty(crop.id)}</h3></div><span className="source-chip">{tx("Referencia editable", "Editable reference")}</span></div>
    <div className="crop-fields">
      <Input label={tx("Precio", "Price")} suffix="COP/kg" value={a.price_cop_per_kg} onChange={(v) => onChange("price_cop_per_kg", v)} />
      <Input label={tx("Rendimiento", "Yield")} suffix="t/ha" value={a.yield_t_per_ha} onChange={(v) => onChange("yield_t_per_ha", v)} />
      <Input label={tx("Costo", "Cost")} suffix="COP/ha" value={a.cost_cop_per_ha} onChange={(v) => onChange("cost_cop_per_ha", v)} />
      <Input label={tx("Agua", "Water")} suffix="m³/ha" value={a.water_m3_per_ha} onChange={(v) => onChange("water_m3_per_ha", v)} />
      <Input label={tx("Mínimo", "Minimum")} suffix="ha" value={a.min_ha} onChange={(v) => onChange("min_ha", v)} />
      <Input label={tx("Máximo", "Maximum")} suffix="ha" value={a.max_ha} onChange={(v) => onChange("max_ha", v)} />
    </div>
    {source && <div className="assumption-source"><b>{source.source_id}</b><span>{source.period} · {source.market}</span></div>}
    <details className="assumption-audit"><summary>{tx("Ver trazabilidad de los valores", "See where the values come from")}</summary>{Object.entries(auditLabels).map(([key, label]) => { const meta = crop.assumption_metadata?.[key]; return meta ? <div key={key}><b>{label}</b><span>{meta.source_id} · {meta.period}</span><small>{meta.market} · {tx("referencia editable", "editable reference")}</small></div> : null; })}</details>
    <div className="manual-line"><label><span>{tx("Mi plan manual", "My manual plan")}</span><input type="number" min="0" value={manual} onChange={(e) => onManual(e.target.value)} /></label><small>{tx("Opcional · se compara con el óptimo", "Optional · compared with the optimum")}</small></div>
  </article>;
}

function ErrorBox({ message }) {
  const { tx } = useI18n();
  return message ? <div className="error optimize-error" role="alert"><b>{tx("No pudimos calcular un plan.", "We couldn't calculate a plan.")}</b><br />{message}<br /><span>{tx("Revisa que el área, presupuesto, agua y límites de cultivo puedan coexistir.", "Check that the area, budget, water and crop limits can all be met together.")}</span></div> : null;
}

function Results({ result, crops, area, form }) {
  const { tx } = useI18n();
  const scenarioLabels = { conservative: tx("Conservador", "Conservative"), expected: tx("Esperado", "Expected"), favorable: tx("Favorable", "Favorable") };
  const constraintLabels = { area: tx("área disponible", "available area"), budget: tx("presupuesto", "budget"), water: tx("agua disponible", "available water") };
  return <div className="opt-results">
    <div className="result-banner"><div><h2>{tx("Una mezcla que cabe", "A mix that fits")}<br /><em>{tx("en tu realidad.", "your reality.")}</em></h2></div><div className="result-meta">{tx("Escenario", "Scenario:")} {(scenarioLabels[result.selected_risk_profile] || result.selected_risk_profile || "").toLowerCase()}<br />{result.department} · {result.market}<br /><small>{new Date().toLocaleDateString(numberLocale())}</small></div></div>
    <div className="metrics opt-metrics">
      <div className="metric"><div className="metric-label">{tx("Ganancia estimada", "Estimated profit")}</div><div className="metric-value">{money(result.total_profit_cop)}</div><div className="metric-note">{tx("escenario seleccionado", "selected scenario")}</div></div>
      <div className="metric"><div className="metric-label">{tx("Margen", "Margin")}</div><div className="metric-value">{result.margin_pct == null ? "—" : `${Number(result.margin_pct).toFixed(1)}%`}</div><div className="metric-note">{tx("sobre ingresos", "of revenue")}</div></div>
      <div className="metric"><div className="metric-label">{tx("Ganancia / ha sembrada", "Profit / planted ha")}</div><div className="metric-value">{money(result.profit_per_ha_cop)}</div><div className="metric-note">{Number(result.allocated_area_ha || 0).toFixed(2)} {tx("ha asignadas", "ha allocated")}</div></div>
      <div className="metric"><div className="metric-label">{tx("Inversión utilizada", "Investment used")}</div><div className="metric-value">{money(result.total_investment_cop)}</div><div className="metric-note">{tx("costos del plan recomendado", "costs of the recommended plan")}</div></div>
    </div>
    <section className="result-section"><div className="section-head"><div><h2>{tx("Asignación recomendada", "Recommended allocation")}</h2><p>{tx("Hectáreas y peso relativo dentro de la parcela.", "Hectares and relative share within the plot.")}</p></div></div>
      <div className="allocation-list">{result.allocation.filter((row) => row.hectares > 0.0001).map((row) => { const share = num(row.hectares) / num(area) * 100; const catalogName = crops.find((crop) => crop.id === row.crop_id)?.name; const name = catalogName ? cropLabel(catalogName) : pretty(row.crop_id.replaceAll("_", " ")); return <div className="allocation-row" key={row.crop_id}><div className="allocation-name"><b>{name}</b><span>{row.hectares.toFixed(2)} ha · {share.toFixed(1)}% · {tx("afinidad", "suitability")} {(row.suitability_score * 100).toFixed(0)}% · {tx("equilibrio", "break-even")} {money(row.break_even_price_cop_per_kg)}/kg</span></div><div className="allocation-track"><i style={{ width: `${Math.min(100, share)}%` }} /></div><strong>{money(row.profit_cop)}</strong></div>; })}{result.unallocated_area_ha > 0.0001 && <div className="allocation-row unallocated"><div className="allocation-name"><b>{tx("Área sin asignar", "Unallocated area")}</b><span>{result.unallocated_area_ha.toFixed(2)} ha</span></div><div className="allocation-track" /><strong>{tx("Sin inversión", "No investment")}</strong></div>}</div>
    </section>
    <section className="result-section"><div className="section-head"><div><h2>{tx("Tres futuros posibles", "Three possible futures")}</h2><p>{tx("La misma parcela, distinta lectura de precio, rendimiento y costo.", "The same plot, read with different prices, yields and costs.")}</p></div></div>
      <p className="table-scroll-hint">{tx("Desliza horizontalmente para ver todas las columnas", "Scroll sideways to see every column")} <Icon /></p>
      <div style={{ overflowX: "auto" }}><div className="scenario-table"><div className="scenario-head"><span>{tx("Escenario", "Scenario")}</span><span>{tx("Inversión", "Investment")}</span><span>{tx("Ingresos", "Revenue")}</span><span>{tx("Ganancia", "Profit")}</span><span>{tx("Margen", "Margin")}</span></div>{result.scenarios.map((s) => <div className={`scenario-row ${s.name === result.selected_risk_profile ? "selected" : ""}`} key={s.name}><b>{scenarioLabels[s.name]}</b><span>{money(s.total_investment_cop)}</span><span>{money(s.total_revenue_cop)}</span><strong>{money(s.total_profit_cop)}</strong><span>{s.margin_pct == null ? "—" : `${s.margin_pct.toFixed(1)}%`}</span></div>)}</div></div>
    </section>
    <div className="grid-2 result-lower"><section className="panel"><h3>{tx("Qué está limitando el plan", "What is limiting the plan")}</h3><p className="panel-caption">{tx("Restricciones que el modelo encontró activas.", "Constraints the model found binding.")}</p>{result.binding_constraints?.length ? <div className="constraint-list">{result.binding_constraints.map((item) => <span key={item}>{constraintLabels[item] || item.replace("max_ha:", tx("máximo · ", "maximum · ")).replace("min_ha:", tx("mínimo · ", "minimum · "))}</span>)}</div> : <p className="muted">{tx("Ninguna restricción quedó exactamente al límite.", "No constraint ended up exactly at its limit.")}</p>}</section>
      {result.manual_comparison && <section className="panel"><h3>{tx("Tu plan frente al óptimo", "Your plan vs. the optimum")}</h3><p className="panel-caption">{result.manual_comparison.feasible ? tx("La asignación manual es factible.", "The manual allocation is feasible.") : tx("La asignación manual necesita ajustes.", "The manual allocation needs adjustments.")}</p><div className="manual-compare"><b>{money(result.manual_comparison.total_profit_cop)}</b><span>{tx("vs. óptimo", "vs. optimum")} {money(result.total_profit_cop)}</span><strong className={result.manual_comparison.profit_delta_cop >= 0 ? "positive" : "negative"}>{result.manual_comparison.profit_delta_cop >= 0 ? "+" : ""}{money(result.manual_comparison.profit_delta_cop)}</strong></div>{result.manual_comparison.warnings?.map((w) => <small className="warning-line" key={w}>{w}</small>)}</section>}</div>
    <section className="provenance"><div><h3>{result.provenance?.snapshot_id || tx("Catálogo económico", "Economic catalog")}</h3><p>{result.provenance?.method || tx("Supuestos editables para planeación; no son una cotización en tiempo real.", "Editable planning assumptions; not a real-time quote.")}</p></div><div className="source-links">{(result.provenance?.sources || []).map((s) => <a href={s.url} target="_blank" rel="noreferrer" key={s.id}>{s.id} <Icon name="external" /></a>)}</div></section>    <div className="result-actions"><button className="button" onClick={() => downloadCommercialPdf(result, crops, form)}>{tx("Descargar PDF", "Download PDF (in Spanish)")}</button><button className="button secondary" onClick={() => downloadCommercialCsv(result, crops, form)}>{tx("Descargar CSV", "Download CSV (in Spanish)")}</button></div>    
    {result.warnings?.length > 0 && <div className="result-warnings"><b>{tx("Supuestos y límites del cálculo", "Assumptions and limits of the calculation")}</b><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    <div className="non-guarantee"><b>{tx("Decisión informada, no promesa de cosecha.", "An informed decision, not a harvest promise.")}</b><span>{tx("Los precios, costos, rendimientos y agua son supuestos. Valida cada valor con un comprador, asistencia técnica y una observación local antes de invertir.", "Prices, costs, yields and water are assumptions. Check each value with a buyer, technical advice and a local observation before investing.")}</span></div>
  </div>;
}

// `mode` llega desde la ruta: sin valor muestra el selector, "garden" la huerta y "commercial" el plan avanzado.
export default function Optimize({ mode }) {
  const navigate = useNavigate();
  const { tx } = useI18n();
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
  useEffect(() => {
    if (mode !== "commercial") {
      setLoading(false);
      return;
    }
    setLoading(true);
    request("/api/economics/catalog")
      .then((data) => {
        setCatalog(data);
        setCrops(data.crops || []);
        setSuitabilityWeight(data.optimization_policy?.suitability_tiebreak_weight ?? 0.2);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [mode]);
  const provenance = useMemo(() => catalog?.provenance, [catalog]);
  const updateCrop = (id, key, value) => setCrops((items) => items.map((crop) => crop.id === id ? { ...crop, assumptions: { ...crop.assumptions, [key]: value === "" ? "" : num(value) } } : crop));
  const stage1Valid = num(form.area_ha) > 0 && num(form.budget_cop) > 0 && num(form.water_m3) > 0 && form.department.trim().length > 0 && form.market.trim().length > 0;
  const run = () => {
    setRunning(true); setError("");
    const manualValues = Object.fromEntries(Object.entries(manual).filter(([, value]) => value !== "" && num(value) > 0));
    const numericEnv = Object.fromEntries(Object.entries(environment).map(([k, v]) => [k, num(v)]));
    const numericCrops = crops.map((c) => ({
      crop_id: c.id,
      price_cop_per_kg: num(c.assumptions.price_cop_per_kg),
      yield_t_per_ha: num(c.assumptions.yield_t_per_ha),
      cost_cop_per_ha: num(c.assumptions.cost_cop_per_ha),
      water_m3_per_ha: num(c.assumptions.water_m3_per_ha),
      min_ha: num(c.assumptions.min_ha),
      max_ha: num(c.assumptions.max_ha),
    }));
    const payload = { ...form, department: form.department.trim(), market: form.market.trim(), area_ha: num(form.area_ha), budget_cop: num(form.budget_cop), water_m3: num(form.water_m3), suitability_tiebreak_weight: num(suitabilityWeight), environmental_values: numericEnv, crops: numericCrops, ...(Object.keys(manualValues).length ? { manual_hectares: manualValues } : {}) };
    request("/api/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((data) => { setResult(data); setStage(4); window.scrollTo({ top: 0, behavior: "smooth" }); }).catch((e) => setError(e.message)).finally(() => setRunning(false));
  };
  const stageTitle = ["", tx("Tu parcela", "Your plot"), tx("Tu ambiente", "Your environment"), tx("Supuestos económicos", "Economic assumptions"), tx("Resultado", "Result")][stage];
  if (!mode) return <><Header title={<>{tx("Del balcón a la parcela,", "From balcony to plot,")}<br /><em>{tx("empieza a tu medida.", "start at your own scale.")}</em></>} description={tx("Elige una guía sencilla para tu huerta o abre el análisis completo para producción comercial. Lo avanzado sigue disponible cuando lo necesites.", "Pick a simple guide for your garden or open the full analysis for commercial production. The advanced tools stay available when you need them.")} /><div className="optimize-page"><ModeChooser onChoose={(choice) => navigate(choice === "garden" ? "/producto/plan/huerta" : "/producto/plan/comercial")} /></div></>;
  if (mode === "garden") return <><Header title={<>{tx("Cultiva cerca,", "Grow close,")}<br /><em>{tx("cosecha seguido.", "harvest often.")}</em></>} description={tx("Una guía simple para organizar espacios pequeños sin pedirte datos técnicos que quizá no tienes.", "A simple guide to organize small spaces without asking for technical data you may not have.")} /><div className="optimize-page"><GardenPlanner onBack={() => navigate("/producto/plan")} /></div></>;
  return <><Header title={<>{tx("Planifica con", "Plan with")}<br /><em>{tx("los pies en la tierra.", "your feet on the ground.")}</em></>} description={tx("Distribuye tu parcela entre cultivos, presupuesto y agua. Ajusta cada supuesto, entiende los límites y compara el plan con tu propia intuición.", "Split your plot across crops, budget and water. Adjust every assumption, understand the limits and compare the plan with your own intuition.")} /><div className="optimize-page">
    <button className="back-link" onClick={() => navigate("/producto/plan")}><Icon name="left" /> {tx("Cambiar tipo de plan", "Change plan type")}</button>
    <div className="stepper">{[tx("Tu parcela", "Your plot"), tx("Ambiente", "Environment"), tx("Supuestos", "Assumptions"), tx("Resultado", "Result")].map((label, i) => <button key={i} className={stage === i + 1 ? "active" : stage > i + 1 ? "done" : ""} onClick={() => stage > i + 1 && setStage(i + 1)}><span>0{i + 1}</span>{label}</button>)}</div>
    {loading ? <div className="panel loading opt-loading">{tx("Leyendo catálogo económico…", "Reading the economic catalog…")}</div> : error && !catalog ? <ErrorBox message={error} /> : stage === 4 && result ? <Results result={result} crops={crops} area={form.area_ha} form={form} /> : <div className="opt-workspace"><div className="opt-form">
        <div className="opt-stage-title"><h2>{stageTitle}</h2><p><b className="opt-step">{tx(`Etapa ${stage} de 3.`, `Step ${stage} of 3.`)}</b> {stage === 1 ? tx("Sin supuestos ocultos. Cuéntanos qué parcela quieres ordenar.", "No hidden assumptions. Tell us which plot you want to organize.") : stage === 2 ? tx("El ambiente orienta la afinidad; no cambia la economía.", "The environment guides suitability; it doesn't change the economics.") : tx("Todo valor viene del catálogo y puede editarse antes de calcular.", "Every value comes from the catalog and can be edited before calculating.")}</p></div>
      {stage === 1 && <><div className="opt-grid"><Input label={tx("Área disponible", "Available area")} suffix="ha" value={form.area_ha} onChange={(v) => setForm({ ...form, area_ha: v })} /><Input label={tx("Presupuesto total", "Total budget")} suffix="COP" value={form.budget_cop} onChange={(v) => setForm({ ...form, budget_cop: v })} /><Input label={tx("Agua disponible", "Available water")} suffix="m³" value={form.water_m3} onChange={(v) => setForm({ ...form, water_m3: v })} /><Input label={tx("Departamento (etiqueta del reporte)", "Department (report label)")} type="text" value={form.department} onChange={(v) => setForm({ ...form, department: v })} /><Input label={tx("Mercado / comprador (base: Bogotá)", "Market / buyer (base: Bogotá)")} type="text" value={form.market} onChange={(v) => setForm({ ...form, market: v })} /></div><div className="risk-select"><span>{tx("Perfil de riesgo", "Risk profile")}</span>{[["conservative", tx("Conservador", "Conservative"), tx("Protege margen", "Protects margin")], ["expected", tx("Esperado", "Expected"), tx("Punto de partida", "Starting point")], ["favorable", tx("Favorable", "Favorable"), tx("Mayor exposición", "More exposure")]].map(([value, label, note]) => <button type="button" key={value} className={form.risk_profile === value ? "active" : ""} onClick={() => setForm({ ...form, risk_profile: value })}><b>{label}</b><small>{note}</small></button>)}</div></>}
      {stage === 2 && <><div className="presets opt-presets">{ENV_PRESETS.map(([id, es, en, values]) => <button type="button" key={id} className="preset" onClick={() => setEnvironment(values)}>{tx(es, en)}</button>)}</div><div className="env-grid">{ENV_KEYS.map(([key, unit]) => <Input key={key} label={labels[key]} suffix={unit} value={environment[key]} onChange={(v) => setEnvironment({ ...environment, [key]: v === "" ? "" : num(v) })} />)}</div><div className="source-status">{tx("Perfil editable · 7 señales de Terra (precipitación media mensual en mm, no lluvia anual)", "Editable profile · Terra's 7 signals (mean monthly rainfall in mm, not annual rainfall)")}</div></>}
      {stage === 3 && <><div className="catalog-status"><span><i className="dot" /> {catalog?.country || "Colombia"} · {catalog?.currency || "COP"}</span><span>{tx("Versión", "Version")} {catalog?.version || "—"} · {catalog?.reference_period || tx("referencia", "reference")}</span></div><div className="policy-panel"><div><b>{tx("Objetivo económico", "Economic objective")}</b><span>{catalog?.optimization_policy?.objective}</span></div><Input label={tx("Peso de afinidad (cede hasta 20% × peso)", "Suitability weight (gives up to 20% × weight)")} suffix="0–1" value={suitabilityWeight} onChange={(v) => setSuitabilityWeight(v === "" ? "" : v)} /><details><summary>{tx("Ver supuestos de escenarios", "See scenario assumptions")}</summary>{Object.entries(catalog?.optimization_policy?.scenario_multipliers || {}).map(([name, factors]) => <p key={name}><b>{name}</b> · {tx("precio", "price")} ×{factors.price} · {tx("rendimiento", "yield")} ×{factors.yield} · {tx("costo", "cost")} ×{factors.cost}</p>)}</details></div><details open><summary style={{ cursor: "pointer", fontWeight: 700, marginBottom: 12 }}>{tx(`Supuestos editables por cultivo (${crops.length} cultivos)`, `Editable assumptions per crop (${crops.length} crops)`)}</summary><div className="crop-grid">{crops.map((crop) => <CatalogCard key={crop.id} crop={crop} manual={manual[crop.id] || ""} onManual={(v) => setManual({ ...manual, [crop.id]: v })} onChange={(key, value) => updateCrop(crop.id, key, value)} />)}</div></details></>}
      {error && <ErrorBox message={error} />}
      <div className="opt-actions">{stage > 1 && <button type="button" className="button secondary" onClick={() => setStage(stage - 1)}><Icon name="left" /> {tx("Atrás", "Back")}</button>}<span />{stage < 3 && <button type="button" className="button" onClick={() => { setStage(stage + 1); }} disabled={stage === 1 && !stage1Valid}>{tx("Continuar", "Continue")} <Icon /></button>}{stage === 3 && <button type="button" className="button" onClick={run} disabled={running}>{running ? tx("Calculando plan…", "Calculating plan…") : <>{tx("Calcular plan rentable", "Calculate profitable plan")} <Icon /></>}</button>}</div>
    </div><aside className="opt-aside"><h3>{provenance?.snapshot_id || tx("Catálogo económico", "Economic catalog")}</h3><p>{provenance?.coverage || tx("Colombia · referencia nacional para planeación.", "Colombia · national planning reference.")}</p><div className="aside-rule" /><b>{crops.length || "—"} {tx("cultivos disponibles", "crops available")}</b><small>{tx("Todos los valores quedan visibles y son editables.", "Every value stays visible and editable.")}</small>{catalog?.provenance?.sources?.slice(0, 2).map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.id} <Icon name="external" /></a>)}<div className="aside-warning">{tx("No es asesoría financiera ni agronómica. Es una herramienta para explorar escenarios.", "This is not financial or agronomic advice. It's a tool to explore scenarios.")}</div></aside></div>}
  </div></>;
}