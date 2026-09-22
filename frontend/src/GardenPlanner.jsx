import React, { useMemo, useState } from "react";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const CROPS = [
  { id: "lechuga", name: "Lechuga", sun: 1, water: 2, plants: 9, harvest: "6–9 semanas", saving: 8500, food: 5, herbs: 0 },
  { id: "tomate", name: "Tomate cherry", sun: 3, water: 2, plants: 2, harvest: "10–14 semanas", saving: 15000, food: 5, herbs: 0 },
  { id: "cilantro", name: "Cilantro", sun: 1, water: 2, plants: 16, harvest: "5–8 semanas", saving: 6000, food: 2, herbs: 5 },
  { id: "cebolla", name: "Cebolla larga", sun: 2, water: 2, plants: 12, harvest: "10–14 semanas", saving: 9000, food: 4, herbs: 2 },
  { id: "zanahoria", name: "Zanahoria", sun: 2, water: 1, plants: 16, harvest: "10–13 semanas", saving: 7000, food: 5, herbs: 0 },
  { id: "frijol", name: "Fríjol arbustivo", sun: 3, water: 1, plants: 8, harvest: "9–12 semanas", saving: 10000, food: 5, herbs: 0 },
  { id: "acelga", name: "Acelga", sun: 1, water: 2, plants: 5, harvest: "8–12 semanas", saving: 7500, food: 5, herbs: 0 },
  { id: "aromaticas", name: "Aromáticas", sun: 2, water: 1, plants: 6, harvest: "6–10 semanas", saving: 6500, food: 1, herbs: 5 },
];

const SelectButtons = ({ label, value, onChange, options }) => <div className="garden-choice"><span>{label}</span><div>{options.map(([id, title, note]) => <button type="button" key={id} className={value === id ? "active" : ""} onClick={() => onChange(id)}><b>{title}</b><small>{note}</small></button>)}</div></div>;

export function ModeChooser({ onChoose }) {
  return <div className="planner-entry">
    <div className="planner-entry-copy"><span className="kicker">Elige el nivel de detalle</span><h2>¿Qué quieres cultivar?</h2><p>Ambos caminos usan el espacio disponible, pero responden a necesidades distintas.</p></div>
    <div className="planner-modes">
      <button className="planner-mode garden-mode" onClick={() => onChoose("garden")}>
        <span className="mode-number">01 / SENCILLO</span><i>✦</i><h3>Mi huerta</h3><p>Para patios, terrazas, balcones y espacios pequeños. Prioriza alimentos para el hogar y ahorro cotidiano.</p><ul><li>Área en metros cuadrados</li><li>5 preguntas sencillas</li><li>Plan de plantas y cosecha</li></ul><strong>Crear mi huerta →</strong>
      </button>
      <button className="planner-mode commercial-mode" onClick={() => onChoose("commercial")}>
        <span className="mode-number">02 / AVANZADO</span><i>↗</i><h3>Producción comercial</h3><p>Para parcelas productivas. Maximiza ganancia con presupuesto, agua, mercado y supuestos editables.</p><ul><li>Área en hectáreas</li><li>Restricciones económicas</li><li>Escenarios y trazabilidad</li></ul><strong>Abrir plan avanzado →</strong>
      </button>
    </div>
  </div>;
}

export default function GardenPlanner({ onBack }) {
  const [form, setForm] = useState({ area: "", people: "2", sun: "2", water: "2", budget: "medium", goal: "mixed" });
  const [result, setResult] = useState(false);
  const [variation, setVariation] = useState(0);
  const plan = useMemo(() => {
    if (!result) return [];
    const area = Math.max(Number(form.area), 1);
    const sun = Number(form.sun);
    const water = Number(form.water);
    const scored = CROPS.map((crop) => {
      const climate = 6 - Math.abs(crop.sun - sun) * 1.6 - Math.abs(crop.water - water) * 1.2;
      const goal = form.goal === "food" ? crop.food : form.goal === "herbs" ? crop.herbs : (crop.food + crop.herbs) / 2;
      return { ...crop, score: climate + goal };
    }).sort((a, b) => b.score - a.score);
    const spaceLimit = area < 3 ? 3 : area < 8 ? 4 : 5;
    const budgetLimit = { low: 3, medium: 4, high: 5 }[form.budget];
    const selectionSize = Math.min(spaceLimit, budgetLimit);
    const offset = variation % Math.max(1, scored.length - selectionSize + 1);
    const selected = scored.slice(offset, offset + selectionSize);
    const total = selected.reduce((sum, crop) => sum + crop.score, 0);
    return selected.map((crop) => {
      const squareMeters = area * crop.score / total;
      return { ...crop, squareMeters, count: Math.max(1, Math.round(squareMeters * crop.plants)), monthlySaving: squareMeters * crop.saving };
    });
  }, [form, result, variation]);
  const totalSaving = plan.reduce((sum, crop) => sum + crop.monthlySaving, 0);
  const update = (key, value) => { setForm({ ...form, [key]: value }); setResult(false); };

  return <div className="garden-planner">
    <button className="back-link" onClick={onBack}>← Cambiar tipo de plan</button>
    {!result ? <div className="garden-layout">
      <section className="garden-form panel">
        <span className="kicker">Huerta sencilla · datos básicos</span><h2>Cuéntanos sobre tu espacio</h2><p className="panel-caption">No necesitas conocer el pH, los nutrientes ni los precios por kilogramo.</p>
        <div className="garden-basics"><label><span>Espacio disponible <em>m²</em></span><input type="number" min="1" max="500" value={form.area} onChange={(e) => update("area", e.target.value)} placeholder="Ej. 6" /></label><label><span>Personas en casa</span><input type="number" min="1" max="20" value={form.people} onChange={(e) => update("people", e.target.value)} /></label></div>
        <SelectButtons label="Sol directo al día" value={form.sun} onChange={(v) => update("sun", v)} options={[["1", "Poco", "Menos de 4 h"], ["2", "Medio", "4 a 6 h"], ["3", "Mucho", "Más de 6 h"]]} />
        <SelectButtons label="Disponibilidad de agua" value={form.water} onChange={(v) => update("water", v)} options={[["1", "Limitada", "Riego cuidadoso"], ["2", "Regular", "Una vez al día"], ["3", "Amplia", "Riego frecuente"]]} />
        <SelectButtons label="Qué quieres priorizar" value={form.goal} onChange={(v) => update("goal", v)} options={[["food", "Alimentos", "Más porciones"], ["mixed", "Equilibrio", "Comida y ahorro"], ["herbs", "Aromáticas", "Uso frecuente"]]} />
        <SelectButtons label="Presupuesto inicial" value={form.budget} onChange={(v) => update("budget", v)} options={[["low", "Bajo", "Reutilizar recipientes"], ["medium", "Medio", "Semillas y sustrato"], ["high", "Cómodo", "Camas y riego"]]} />
        <button className="button garden-submit" disabled={!form.area || Number(form.area) <= 0} onClick={() => { setResult(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Diseñar mi huerta →</button>
      </section>
      <aside className="garden-aside"><span className="kicker">Qué recibirás</span><h3>Un punto de partida claro</h3><ol><li><b>Distribución</b><span>Cuántos m² dedicar a cada cultivo.</span></li><li><b>Cantidad</b><span>Número orientativo de plantas.</span></li><li><b>Cosecha</b><span>Cuándo podrías empezar a recoger.</span></li><li><b>Ahorro</b><span>Rango mensual aproximado.</span></li></ol><p>No reemplaza una evaluación local de luz, suelo o plagas.</p></aside>
    </div> : <GardenResults form={form} plan={plan} totalSaving={totalSaving} onEdit={() => setResult(false)} onVary={() => setVariation((current) => current + 1)} />}
  </div>;
}

function GardenResults({ form, plan, totalSaving, onEdit, onVary }) {
  const people = Number(form.people);
  const portions = Math.max(4, Math.round(Number(form.area) * 2.5));
  return <div className="garden-results">
    <div className="garden-hero"><div><span className="kicker">Tu huerta · propuesta inicial</span><h2>Pequeña en espacio,<br /><em>útil cada semana.</em></h2></div><div className="garden-hero-actions"><button className="button garden-download" onClick={() => downloadGardenPdf(form, plan, totalSaving)}>Descargar PDF ↓</button><button className="button garden-variation" onClick={onVary}>Variar cultivos ↻</button><button className="garden-edit" onClick={onEdit}>Editar datos</button></div></div>
    <div className="metrics garden-metrics"><div className="metric"><div className="metric-label">Espacio organizado</div><div className="metric-value">{Number(form.area).toFixed(1)} m²</div><div className="metric-note">en {plan.length} grupos de cultivo</div></div><div className="metric"><div className="metric-label">Plantas aproximadas</div><div className="metric-value">{plan.reduce((sum, crop) => sum + crop.count, 0)}</div><div className="metric-note">siembra escalonada recomendada</div></div><div className="metric"><div className="metric-label">Porciones semanales</div><div className="metric-value">{portions}–{Math.round(portions * 1.4)}</div><div className="metric-note">para un hogar de {people}</div></div><div className="metric"><div className="metric-label">Ahorro orientativo</div><div className="metric-value">{COP.format(totalSaving * .7)}–{COP.format(totalSaving * 1.2)}</div><div className="metric-note">al mes, cuando esté produciendo</div></div></div>
    <section className="result-section"><div className="section-head"><div><h2>Así puedes repartirla</h2><p>Empieza con pocas variedades y siembra en fechas distintas.</p></div></div><div className="garden-plan-grid">{plan.map((crop, index) => <article key={crop.id}><span>0{index + 1}</span><h3>{crop.name}</h3><strong>{crop.squareMeters.toFixed(1)} m²</strong><p>≈ {crop.count} plantas</p><small>Primera cosecha: {crop.harvest}</small><div className="garden-bar"><i style={{ width: `${crop.squareMeters / Number(form.area) * 100}%` }} /></div></article>)}</div></section>
    <section className="result-section cultivation-guide"><div className="section-head"><div><span className="kicker">Acompañamiento</span><h2>Qué hacer durante el cultivo</h2><p>Una guía breve para revisar la huerta sin esperar hasta la cosecha.</p></div></div><div className="cultivation-steps"><article><span>01 · Primera semana</span><h3>Observar y ajustar</h3><p>Comprueba el drenaje, protege los brotes del sol extremo y mantén el sustrato húmedo, no encharcado.</p></article><article><span>02 · Cada semana</span><h3>Revisar señales</h3><p>Mira el envés de las hojas, retira partes enfermas y cambia la frecuencia de riego si la tierra sigue húmeda.</p></article><article><span>03 · Cada 2–3 semanas</span><h3>Sembrar por tandas</h3><p>Repite una parte de lechugas, cilantro o aromáticas para tener cosechas continuas y no recoger todo a la vez.</p></article><article><span>04 · Al cosechar</span><h3>Registrar y mejorar</h3><p>Anota qué produjo mejor, cuánto consumió el hogar y qué cultivo conviene ampliar en el siguiente ciclo.</p></article></div></section>
    <div className="garden-notes"><section><h3>Para que funcione mejor</h3><ul><li>Siembra una parte cada 2 o 3 semanas para no cosechar todo al mismo tiempo.</li><li>Usa recipientes con drenaje y sustrato suelto; evita tierra compactada.</li><li>Revisa el sol real durante una semana antes de ubicar las plantas.</li></ul></section><section><h3>Cómo leer el ahorro</h3><p>Es una aproximación doméstica basada en el espacio y cultivos sugeridos. No incluye tu tiempo, herramientas, pérdidas, plagas ni variaciones de precio.</p></section></div>
    <div className="non-guarantee"><b>Empieza pequeño y ajusta.</b><span>La producción cambia con el clima, la variedad, el recipiente y el manejo. Observa las primeras semanas antes de ampliar la huerta.</span></div>
  </div>;
}

function downloadGardenPdf(form, plan, totalSaving) {
  const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-");
  const wrap = (text, width = 88) => {
    const words = normalize(text).split(/\s+/);
    return words.reduce((lines, word) => {
      const current = lines[lines.length - 1];
      if (!current || `${current} ${word}`.length > width) lines.push(word);
      else lines[lines.length - 1] = `${current} ${word}`;
      return lines;
    }, []);
  };
  const rows = [
    "PLAN DE MI HUERTA",
    `${Number(form.area).toFixed(1)} m2 | hogar de ${form.people} personas | ${plan.length} grupos de cultivo`,
    `Ahorro domestico orientativo: ${COP.format(totalSaving * .7)} - ${COP.format(totalSaving * 1.2)} al mes`,
    "",
    "DISTRIBUCION RECOMENDADA",
    ...plan.flatMap((crop) => wrap(`${crop.name}: ${crop.squareMeters.toFixed(1)} m2, aproximadamente ${crop.count} plantas. Primera cosecha: ${crop.harvest}.`)),
    "",
    "SEGUIMIENTO DURANTE EL CULTIVO",
    ...["Primera semana: revisa drenaje, humedad y exposicion real al sol.", "Cada semana: inspecciona hojas, retira partes enfermas y ajusta el riego.", "Cada 2 o 3 semanas: siembra una nueva tanda de cultivos de ciclo corto.", "Al cosechar: registra que funciono y ajusta el siguiente ciclo."].flatMap((item) => wrap(item)),
    "",
    ...wrap("Estas cifras son orientativas. La produccion cambia con el clima, el recipiente, el sustrato, las plagas y el manejo."),
  ];
  const escaped = rows.map((row) => row.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"));
  const stream = `BT\n/F1 11 Tf\n50 790 Td\n${escaped.map((row, index) => `${index ? "0 -19 Td\n" : ""}(${row}) Tj`).join("\n")}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  link.download = "plan-mi-huerta.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}