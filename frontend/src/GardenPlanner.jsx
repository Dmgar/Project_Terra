import React, { useMemo, useState } from "react";
import "./garden.css";
import { downloadGardenPdf } from "./gardenPdf";
import CropIllustration from "./CropIllustration";
import { artworkFor } from "./cropArt";
import { buildGardenPlan } from "./gardenPlanning";
import { Icon } from "./ui";
import { numberLocale, tr, useI18n } from "./i18n";

// El plan (y su PDF) guarda los nombres en español; en pantalla se muestran en el idioma activo.
const CROP_NAMES_EN = {
  lechuga: "Lettuce",
  tomate: "Cherry tomato",
  cilantro: "Cilantro",
  cebolla: "Green onion",
  zanahoria: "Carrot",
  frijol: "Bush beans",
  acelga: "Chard",
  aromaticas: "Herbs",
};
const cropName = (crop) => tr(crop.name, CROP_NAMES_EN[crop.id] ?? crop.name);
const harvestText = (text) => tr(text, text.replace("semanas", "weeks"));

const cop = (value) => new Intl.NumberFormat(numberLocale(), { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

const SelectButtons = ({ label, value, onChange, options }) => <div className="garden-choice"><span>{label}</span><div>{options.map(([id, title, note]) => <button type="button" key={id} className={value === id ? "active" : ""} onClick={() => onChange(id)}><b>{title}</b><small>{note}</small></button>)}</div></div>;

// Al pulsar una tarjeta, un círculo se expande desde el punto del clic y rellena el recuadro;
// la navegación se aplaza lo justo para que se vea (y se omite si el usuario reduce el movimiento).
const RIPPLE_MS = 420;

export function ModeChooser({ onChoose }) {
  const [ripple, setRipple] = useState(null);
  const { tx } = useI18n();

  const choose = (mode) => (event) => {
    if (ripple) return;
    const box = event.currentTarget.getBoundingClientRect();
    // Con teclado (Enter/Espacio) el evento no trae posición: se expande desde el centro.
    const x = event.detail === 0 ? box.width / 2 : event.clientX - box.left;
    const y = event.detail === 0 ? box.height / 2 : event.clientY - box.top;
    // Radio hasta la esquina más lejana: así el círculo siempre termina cubriendo toda la tarjeta.
    const radius = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onChoose(mode);
    setRipple({ mode, x, y, radius });
    setTimeout(() => onChoose(mode), RIPPLE_MS);
  };

  const rippleFor = (mode) =>
    ripple?.mode === mode && (
      <span
        className="ripple"
        aria-hidden="true"
        style={{ left: ripple.x, top: ripple.y, width: ripple.radius * 2, height: ripple.radius * 2 }}
      />
    );

  return <div className="planner-entry">
    <div className="planner-entry-copy"><h2>{tx("¿Qué quieres cultivar?", "What do you want to grow?")}</h2><p>{tx("Ambos caminos usan el espacio disponible, pero responden a necesidades distintas.", "Both paths use the space you have, but they answer different needs.")}</p></div>
    <div className="planner-modes">
      <button className="planner-mode garden-mode" onClick={choose("garden")}>
        {rippleFor("garden")}
        <span className="mode-crop-art"><CropIllustration crop={{ id: "tomate" }} /><CropIllustration crop={{ id: "lechuga" }} /></span><h3>{tx("Mi huerta", "My garden")}</h3><p>{tx("Para patios, terrazas, balcones y espacios pequeños. Prioriza alimentos para el hogar y ahorro cotidiano.", "For patios, terraces, balconies and small spaces. Focuses on food for the home and everyday savings.")}</p><ul><li>{tx("Área en metros cuadrados", "Area in square meters")}</li><li>{tx("5 preguntas sencillas", "5 simple questions")}</li><li>{tx("Plan de plantas y cosecha", "Planting and harvest plan")}</li></ul><strong>{tx("Crear mi huerta", "Create my garden")} <Icon /></strong>
      </button>
      <button className="planner-mode commercial-mode" onClick={choose("commercial")}>
        {rippleFor("commercial")}
        <i><Icon name="external" /></i><h3>{tx("Producción comercial", "Commercial production")}</h3><p>{tx("Para parcelas productivas. Maximiza ganancia con presupuesto, agua, mercado y supuestos editables.", "For productive plots. Maximizes profit with budget, water, market and editable assumptions.")}</p><ul><li>{tx("Área en hectáreas", "Area in hectares")}</li><li>{tx("Restricciones económicas", "Economic constraints")}</li><li>{tx("Escenarios y trazabilidad", "Scenarios and traceability")}</li></ul><strong>{tx("Abrir plan avanzado", "Open advanced plan")} <Icon /></strong>
      </button>
    </div>
  </div>;
}

export default function GardenPlanner({ onBack }) {
  const { tx } = useI18n();
  const [form, setForm] = useState({ area: "", people: "2", sun: "2", water: "2", budget: "medium", goal: "mixed" });
  const [result, setResult] = useState(false);
  const [variation, setVariation] = useState(0);
  const { plan, variantCount, compatibleCount } = useMemo(
    () => result ? buildGardenPlan(form, variation) : { plan: [], variantCount: 0, compatibleCount: 0 },
    [form, result, variation]
  );
  const totalSaving = plan.reduce((sum, crop) => sum + crop.monthlySaving, 0);
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setVariation(0);
    setResult(false);
  };

  return <div className="garden-planner">
    <button type="button" className="back-link" onClick={onBack}><Icon name="left" /> {tx("Cambiar tipo de plan", "Change plan type")}</button>
    {!result ? <div className="garden-layout">
      <section className="garden-form panel">
        <h2>{tx("Cuéntanos sobre tu espacio", "Tell us about your space")}</h2><p className="panel-caption">{tx("No necesitas conocer el pH, los nutrientes ni los precios por kilogramo.", "You don't need to know the pH, nutrients or prices per kilogram.")}</p>
        <div className="garden-basics"><label><span>{tx("Espacio disponible", "Available space")} <em>{tx("m² (ej. balcón 2×1 m = 2)", "m² (e.g. a 2×1 m balcony = 2)")}</em></span><input type="number" min="1" max="500" value={form.area} onChange={(e) => update("area", e.target.value)} placeholder={tx("Ej. 6", "E.g. 6")} /></label><label><span>{tx("Personas en casa", "People at home")}</span><input type="number" min="1" max="20" value={form.people} onChange={(e) => update("people", e.target.value)} /></label></div>
        <SelectButtons label={tx("Sol directo al día", "Direct sun per day")} value={form.sun} onChange={(v) => update("sun", v)} options={[["1", tx("Poco", "Little"), tx("Menos de 4 h", "Under 4 h")], ["2", tx("Medio", "Medium"), tx("4 a 6 h", "4 to 6 h")], ["3", tx("Mucho", "Plenty"), tx("Más de 6 h", "Over 6 h")]]} />
        <SelectButtons label={tx("Disponibilidad de agua", "Water availability")} value={form.water} onChange={(v) => update("water", v)} options={[["1", tx("Limitada", "Limited"), tx("Riego cuidadoso", "Careful watering")], ["2", tx("Regular", "Regular"), tx("Una vez al día", "Once a day")], ["3", tx("Amplia", "Ample"), tx("Riego frecuente", "Frequent watering")]]} />
        <SelectButtons label={tx("Qué quieres priorizar", "What to prioritize")} value={form.goal} onChange={(v) => update("goal", v)} options={[["food", tx("Alimentos", "Food"), tx("Más porciones", "More servings")], ["mixed", tx("Equilibrio", "Balance"), tx("Comida y ahorro", "Food and savings")], ["herbs", tx("Aromáticas", "Herbs"), tx("Uso frecuente", "Frequent use")]]} />
        <SelectButtons label={tx("Presupuesto inicial", "Starting budget")} value={form.budget} onChange={(v) => update("budget", v)} options={[["low", tx("Bajo (< $80 mil)", "Low (< COP 80k)"), tx("Reutilizar recipientes", "Reuse containers")], ["medium", tx("Medio ($80–$220 mil)", "Medium (COP 80k–220k)"), tx("Semillas y sustrato", "Seeds and substrate")], ["high", tx("Cómodo (> $220 mil)", "Comfortable (> COP 220k)"), tx("Camas y riego", "Beds and irrigation")]]} />
        <button className="button garden-submit" disabled={!form.area || Number(form.area) <= 0} onClick={() => { setResult(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{tx("Diseñar mi huerta", "Design my garden")} <Icon /></button>
      </section>
      <aside className="garden-aside"><div className="garden-aside-art"><CropIllustration crop={{ id: "zanahoria" }} /><CropIllustration crop={{ id: "lechuga" }} /><CropIllustration crop={{ id: "tomate" }} /></div><h3>{tx("Un punto de partida claro", "A clear starting point")}</h3><ol><li><b>{tx("Distribución", "Layout")}</b><span>{tx("Cuántos m² dedicar a cada cultivo.", "How many m² to give each crop.")}</span></li><li><b>{tx("Cantidad", "Quantity")}</b><span>{tx("Número orientativo de plantas.", "Approximate number of plants.")}</span></li><li><b>{tx("Cosecha", "Harvest")}</b><span>{tx("Cuándo podrías empezar a recoger.", "When you could start harvesting.")}</span></li><li><b>{tx("Ahorro", "Savings")}</b><span>{tx("Rango mensual aproximado.", "Approximate monthly range.")}</span></li></ol><p>{tx("No reemplaza una evaluación local de luz, suelo o plagas.", "It doesn't replace a local check of light, soil or pests.")}</p></aside>
    </div> : plan.length ? <GardenResults form={form} plan={plan} totalSaving={totalSaving} compatibleCount={compatibleCount} variantCount={variantCount} onEdit={() => setResult(false)} onVary={() => setVariation((current) => current + 1)} /> : <div className="garden-empty panel" role="status"><h2>{tx("Ajustemos las condiciones", "Let's adjust the conditions")}</h2><p>{tx("Con el sol y el agua indicados no encontramos cultivos compatibles en nuestro catálogo. No queremos recomendarte una cosecha que quizá no pueda prosperar.", "With the sun and water you entered, we found no compatible crops in our catalog. We don't want to recommend a harvest that may not thrive.")}</p><p>{tx("Revisa las horas de sol y la disponibilidad de riego antes de intentar de nuevo. Esta guía no sustituye una evaluación local.", "Check the hours of sun and the water available before trying again. This guide doesn't replace a local assessment.")}</p><button className="button" onClick={() => setResult(false)}>{tx("Editar condiciones", "Edit conditions")} <Icon /></button></div>}
  </div>;
}

function GardenResults({ form, plan, totalSaving, compatibleCount, variantCount, onEdit, onVary }) {
  const { tx } = useI18n();
  const people = Math.max(1, Number(form.people) || 1);
  const portions = Math.max(4, Math.round(Number(form.area) * 2.5));
  const householdTarget = people * 7;
  const coveragePct = Math.min(100, Math.round((portions / householdTarget) * 100));
  return <div className="garden-results">
    <div className="garden-hero"><div><h2>{tx("Pequeña en espacio,", "Small in space,")}<br /><em>{tx("útil cada semana.", "useful every week.")}</em></h2></div><div className="garden-hero-actions"><button type="button" className="button garden-download" onClick={() => downloadGardenPdf(form, plan, totalSaving)}>{tx("Descargar PDF", "Download PDF (in Spanish)")} <Icon name="down" /></button><button type="button" className="button garden-variation" onClick={onVary} disabled={variantCount < 2}>{tx("Variar cultivos", "Vary crops")} <Icon name="refresh" /></button><button type="button" className="garden-edit" onClick={onEdit}>{tx("Editar datos", "Edit details")}</button></div></div>
    <p className="garden-compatibility-note" role="status">{variantCount < 2
      ? tx(
          `Con el sol y el agua indicados, ${compatibleCount === 1 ? "solo hay un cultivo compatible" : `estos son los ${compatibleCount} cultivos compatibles`} en nuestro catálogo; no hay otra combinación que podamos recomendar.`,
          `With the sun and water you entered, ${compatibleCount === 1 ? "there is only one compatible crop" : `these are the ${compatibleCount} compatible crops`} in our catalog; there is no other combination we can recommend.`
        )
      : tx(
          `Las alternativas usan solo cultivos compatibles con el sol y el agua indicados (${compatibleCount} disponibles en nuestro catálogo).`,
          `The alternatives only use crops compatible with the sun and water you entered (${compatibleCount} available in our catalog).`
        )}</p>
    <div className="metrics garden-metrics"><div className="metric"><div className="metric-label">{tx("Espacio organizado", "Space organized")}</div><div className="metric-value">{Number(form.area).toFixed(1)} m²</div><div className="metric-note">{tx(`en ${plan.length} grupos de cultivo`, `across ${plan.length} crop groups`)}</div></div><div className="metric"><div className="metric-label">{tx("Plantas aproximadas", "Approximate plants")}</div><div className="metric-value">{plan.reduce((sum, crop) => sum + crop.count, 0)}</div><div className="metric-note">{tx("siembra escalonada recomendada", "staggered planting recommended")}</div></div><div className="metric"><div className="metric-label">{tx("Porciones semanales", "Weekly servings")}</div><div className="metric-value">{portions}–{Math.round(portions * 1.4)}</div><div className="metric-note">{tx(`≈ ${coveragePct}% de ${householdTarget} porciones/sem (${people} ${people === 1 ? "persona" : "personas"})`, `≈ ${coveragePct}% of ${householdTarget} servings/week (${people} ${people === 1 ? "person" : "people"})`)}</div></div><div className="metric"><div className="metric-label">{tx("Ahorro orientativo", "Estimated savings")}</div><div className="metric-value">{cop(totalSaving * .7)}–{cop(totalSaving * 1.2)}</div><div className="metric-note">{tx("al mes, cuando esté produciendo", "per month, once it's producing")}</div></div></div>
    <section className="result-section"><div className="section-head"><div><h2>{tx("Así puedes repartirla", "How you can split it")}</h2><p>{tx("Empieza con pocas variedades y siembra en fechas distintas.", "Start with a few varieties and plant on different dates.")}</p></div></div><div className="garden-plan-grid">{plan.map((crop, index) => <article key={crop.id}><div className="garden-card-art" style={{ background: artworkFor(crop).backdrop }}><span className="garden-card-number">0{index + 1} / {tx("TU CULTIVO", "YOUR CROP")}</span><CropIllustration crop={crop} /></div><div className="garden-card-body"><h3>{cropName(crop)}</h3><strong>{crop.squareMeters.toFixed(1)} m²</strong><p>≈ {crop.count} {tx("plantas", "plants")}</p><small>{tx("Primera cosecha", "First harvest")}: {harvestText(crop.harvest)}</small><div className="garden-bar"><i style={{ width: `${crop.squareMeters / Number(form.area) * 100}%` }} /></div></div></article>)}</div></section>
    <section className="result-section cultivation-guide"><div className="section-head"><div><h2>{tx("Qué hacer durante el cultivo", "What to do while it grows")}</h2><p>{tx("Una guía breve para revisar la huerta sin esperar hasta la cosecha.", "A short guide to check on the garden without waiting for harvest.")}</p></div></div><div className="cultivation-steps"><article><span>01 · {tx("Primera semana", "First week")}</span><h3>{tx("Observar y ajustar", "Watch and adjust")}</h3><p>{tx("Comprueba el drenaje, protege los brotes del sol extremo y mantén el sustrato húmedo, no encharcado.", "Check drainage, protect seedlings from harsh sun and keep the substrate moist, not waterlogged.")}</p></article><article><span>02 · {tx("Cada semana", "Every week")}</span><h3>{tx("Revisar señales", "Check for signs")}</h3><p>{tx("Mira el envés de las hojas, retira partes enfermas y cambia la frecuencia de riego si la tierra sigue húmeda.", "Look under the leaves, remove diseased parts and water less often if the soil stays wet.")}</p></article><article><span>03 · {tx("Cada 2–3 semanas", "Every 2–3 weeks")}</span><h3>{tx("Sembrar por tandas", "Plant in batches")}</h3><p>{tx("Repite una parte de lechugas, cilantro o aromáticas para tener cosechas continuas y no recoger todo a la vez.", "Resow some lettuce, cilantro or herbs for a continuous harvest instead of picking everything at once.")}</p></article><article><span>04 · {tx("Al cosechar", "At harvest")}</span><h3>{tx("Registrar y mejorar", "Record and improve")}</h3><p>{tx("Anota qué produjo mejor, cuánto consumió el hogar y qué cultivo conviene ampliar en el siguiente ciclo.", "Note what produced best, how much the household used and which crop to expand next cycle.")}</p></article></div></section>
    <div className="garden-notes"><section><h3>{tx("Para que funcione mejor", "To make it work better")}</h3><ul><li>{tx("Siembra una parte cada 2 o 3 semanas para no cosechar todo al mismo tiempo.", "Plant a portion every 2 or 3 weeks so you don't harvest everything at once.")}</li><li>{tx("Usa recipientes con drenaje y sustrato suelto; evita tierra compactada.", "Use containers with drainage and loose substrate; avoid compacted soil.")}</li><li>{tx("Revisa el sol real durante una semana antes de ubicar las plantas.", "Watch the actual sunlight for a week before placing the plants.")}</li></ul></section><section><h3>{tx("Cómo leer el ahorro", "How to read the savings")}</h3><p>{tx("Es una aproximación doméstica basada en el espacio y cultivos sugeridos. No incluye tu tiempo, herramientas, pérdidas, plagas ni variaciones de precio.", "It's a household estimate based on the suggested space and crops. It doesn't include your time, tools, losses, pests or price changes.")}</p></section></div>
    <div className="non-guarantee"><b>{tx("Empieza pequeño y ajusta.", "Start small and adjust.")}</b><span>{tx("La producción cambia con el clima, la variedad, el recipiente y el manejo. Observa las primeras semanas antes de ampliar la huerta.", "Yields change with climate, variety, container and care. Watch the first weeks before expanding the garden.")}</span></div>
  </div>;
}
