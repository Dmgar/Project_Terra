// Commercial plan PDF renderer for TERRA — mirrors gardenPdf.js infrastructure.
import { artworkFor } from "./cropArt.js";

const PAGE_W = 595;
const PAGE_H = 842;

const COLORS = {
  ink: "#173b35",
  soft: "#42635b",
  paper: "#f5f3ec",
  card: "#fbfaf6",
  moss: "#719b68",
  pale: "#e8eee3",
  clay: "#b96b4b",
  muted: "#71807a",
  line: "#d9dfd5",
  white: "#f7f4e9",
};

const money = (value) =>
  `COP ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ")}`;

const decimal = (value) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

const pct = (value) =>
  value == null ? "—" : `${Number(value).toFixed(1)}%`;

const rgb = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");

function pdfByte(character) {
  const code = character.charCodeAt(0);
  if (code < 256) return code;
  if (character === "–") return 150;
  if (character === "—") return 151;
  if (character === "’") return 146;
  if (character === "“") return 147;
  if (character === "”") return 148;
  if (character === "€") return 128;
  if (character === "\u202f") return 32;
  return 63;
}

function bytes(text) {
  return Uint8Array.from(text, pdfByte);
}

function escapeText(text) {
  return Array.from(text.replaceAll("\u00a0", " "), (character) => {
    const code = pdfByte(character);
    if (code === 40 || code === 41 || code === 92) return `\\${String.fromCharCode(code)}`;
    if (code < 32) return " ";
    return String.fromCharCode(code);
  }).join("");
}

class Page {
  constructor() {
    this.commands = [];
    this.rect(0, 0, PAGE_W, PAGE_H, COLORS.paper);
  }
  rect(x, top, width, height, color) {
    this.commands.push(`${rgb(color)} rg ${x} ${PAGE_H - top - height} ${width} ${height} re f`);
  }
  ellipse(cx, topCy, rx, ry, color) {
    const k = 0.55228475;
    const cy = PAGE_H - topCy;
    this.commands.push(
      `${rgb(color)} rg ${cx + rx} ${cy} m ${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry} c ${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy} c ${cx - rx} ${cy - ry * k} ${cx - rx *k} ${cy - ry} ${cx} ${cy - ry} c ${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy} c f`
    );
  }
  polygon(points, color) {
    const coords = [];
    for (let i = 0; i < points.length; i += 2) coords.push(`${points[i]} ${PAGE_H - points[i + 1]} ${i ? "l" : "m"}`);
    this.commands.push(`${rgb(color)} rg ${coords.join(" ")} h f`);
  }
  rule(x1, top1, x2, top2, color = COLORS.line, width = 1) {
    this.commands.push(`${width} w ${rgb(color)} RG ${x1} ${PAGE_H - top1} m ${x2} ${PAGE_H - top2} l S`);
  }
  text(x, baseline, value, font = "sans", size = 10, color = COLORS.ink) {
    const face = { sans: "F1", bold: "F2", serif: "F3" }[font];
    this.commands.push(`BT /${face} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${PAGE_H - baseline} Tm (${escapeText(value)}) Tj ET`);
  }
  lines(x, baseline, entries, options = {}) {
    const { font = "sans", size = 10, color = COLORS.soft, leading = 15 } = options;
    entries.forEach((entry, index) => this.text(x, baseline + index * leading, entry, font, size, color));
  }
  get stream() {
    return this.commands.join("\n") + "\n";
  }
}

function drawCropArtwork(page, crop, x, top, size, showBackdrop = true) {
  const art = artworkFor(crop);
  if (showBackdrop) page.rect(x, top, size, size, art.backdrop);
  const point = (value) => value * size / 100;
  art.shapes.forEach(([type, ...shape]) => {
    if (type === "ellipse") page.ellipse(x + point(shape[0]), top + point(shape[1]), point(shape[2]), point(shape[3]), shape[4]);
    else page.polygon(shape[0].map((value, index) => (index % 2 ? top : x) + point(value)), shape[1]);
  });
}

function brand(page, dark = true) {
  const color = dark ? COLORS.white : COLORS.ink;
  const accent = dark ? "#a8c39c" : COLORS.moss;
  page.rule(47, 42, 73, 42, accent);
  page.rule(73, 42, 73, 68, accent);
  page.rule(73, 68, 47, 68, accent);
  page.rule(47, 68, 47, 42, accent);
  page.commands.push(`${rgb(accent)} RG 0.8 w 53 ${PAGE_H - 49} m 55 ${PAGE_H - 47} 65 ${PAGE_H - 57} 67 ${PAGE_H - 61} c 65 ${PAGE_H - 65} 55 ${PAGE_H - 55} 53 ${PAGE_H - 49} c S`);
  page.commands.push(`${rgb(accent)} RG 0.8 w 67 ${PAGE_H - 49} m 65 ${PAGE_H - 47} 55 ${PAGE_H - 57} 53 ${PAGE_H - 61} c 55 ${PAGE_H - 65} 65 ${PAGE_H - 55} 67 ${PAGE_H - 49} c S`);
  page.text(84, 54, "TERRA", "bold", 17, color);
  page.text(84, 67, "INTELIGENCIA AGRONÓMICA", "sans", 7.2, accent);
}

function footer(page, number, date, label) {
  page.rule(40, 800, 555, 800);
  page.text(40, 818, `TERRA  /  ${label}`, "bold", 8, COLORS.ink);
  page.text(355, 818, `Generado el ${date}  ·  v1.0  /  ${number} de 2`, "sans", 8, COLORS.muted);
}

function makePdf(pages) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${6 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
  ];
  pages.forEach((page, index) => {
    const pageId = 6 + index * 2;
    const stream = page.stream;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    objects.push(`<< /Length ${bytes(stream).length} >>\nstream\n${stream}endstream`);
  });

  const parts = [bytes("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [0];
  let position = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const chunk = bytes(`${index + 1} 0 obj\n${object}\nendobj\n`);
    parts.push(chunk);
    position += chunk.length;
  });
  const xrefPosition = position;
  parts.push(bytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`));
  return new Blob(parts, { type: "application/pdf" });
}

function cropLabel(cropId, crops) {
  const match = crops.find((c) => c.id === cropId);
  if (match && match.name) return match.name;
  return cropId.charAt(0).toUpperCase() + cropId.slice(1).replaceAll("_", " ");
}

export function createCommercialPdf(result, crops, form, date = new Date()) {
  if (!result || !result.allocation?.length) throw new Error("No hay asignación para exportar.");
  const formattedDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(date);
  const allocated = result.allocated_area_ha || 0;
  const totalArea = Number(form.area_ha || 0);
  const pctAllocated = totalArea > 0 ? (allocated / totalArea * 100).toFixed(1) : "0";

  // PÁGINA 1: Resumen ejecutivo
  const first = new Page();
  first.rect(0, 0, PAGE_W, 168, COLORS.ink);
  brand(first);
  first.text(40, 105, "PLAN COMERCIAL  /  ASIGNACIÓN ÓPTIMA", "bold", 9, "#a8c39c");
  first.text(40, 138, `${form.department || "—"} · ${form.market || "—"}`, "serif", 24, COLORS.white);
  first.text(40, 165, "Ganancia máxima bajo restricciones reales.", "serif", 15, "#c3d8b6");

  const metrics = [
    { label: "ÁREA TOTAL", value: `${decimal(totalArea)} ha`, note: `${pctAllocated}% asignada` },
    { label: "GANANCIA ESTIMADA", value: money(result.total_profit_cop), note: `escenario ${result.selected_risk_profile}` },
    { label: "MARGEN", value: pct(result.margin_pct), note: "sobre ingresos" },
    { label: "INVERSIÓN", value: money(result.total_investment_cop), note: `de ${money(form.budget_cop)} presupuestado` },
  ];
  metrics.forEach((stat, index) => {
    const x = 40 + index * 136;
    first.rect(x, 200, 126, 80, COLORS.card);
    first.rect(x, 200, 126, 2, index === 1 ? COLORS.clay : COLORS.moss);
    first.text(x + 10, 221, stat.label, "bold", 7.5, COLORS.muted);
    first.text(x + 10, 250, stat.value, "serif", index === 1 ? 16 : 19, COLORS.ink);
    first.text(x + 10, 268, stat.note, "sans", 8, COLORS.soft);
  });

  // Tabla de asignación
  first.text(40, 315, "Asignación recomendada", "serif", 20, COLORS.ink);
  first.text(40, 330, `Hectáreas por cultivo — ${allocated.toFixed(2)} ha de ${decimal(totalArea)} ha`, "sans", 9, COLORS.muted);

  const headers = ["CULTIVO", "HECTÁREAS", "% PARCELA", "AFINIDAD", "PUNTO EQ.", "GANANCIA"];
  const colX = [40, 160, 260, 340, 430, 500];
  const rowHeight = 22;
  const startY = 350;

  headers.forEach((h, i) => first.text(colX[i], startY, h, "bold", 8, COLORS.soft));

  const rows = result.allocation.filter((r) => r.hectares > 0.0001);
  rows.forEach((row, index) => {
    const y = startY + 18 + index * rowHeight;
    const share = totalArea > 0 ? (row.hectares / totalArea * 100).toFixed(1) : "0";
    const label = cropLabel(row.crop_id, crops);
    const bg = index % 2 ? COLORS.paper : COLORS.card;
    first.rect(40, y, 515, rowHeight, bg);
    first.rect(40, y, 3, rowHeight, index % 2 ? COLORS.moss : COLORS.clay);
    drawCropArtwork(first, row.crop_id, 48, y + (rowHeight - 16) / 2, 16);
    first.text(72, y + 10, label, "serif", 10, COLORS.ink);
    first.text(colX[1] + 4, y + 10, `${row.hectares.toFixed(2)} ha`, "bold", 9, COLORS.ink);
    first.text(colX[2] + 4, y + 10, `${share}%`, "sans", 9, COLORS.soft);
    first.text(colX[3] + 4, y + 10, `${Math.round((row.suitability_score || 0) * 100)}%`, "sans", 9, COLORS.soft);
    first.text(colX[4] + 4, y + 10, money(row.break_even_price_cop_per_kg), "sans", 8, COLORS.muted);
    first.text(colX[5] + 4, y + 10, money(row.profit_cop), "bold", 9, COLORS.ink);
  });

  if (result.unallocated_area_ha > 0.0001) {
    const y = startY + 18 + rows.length * rowHeight;
    first.rect(40, y, 515, rowHeight, COLORS.pale);
    first.text(72, y + 10, "Área sin asignar", "sans", 10, COLORS.muted);
    first.text(colX[1] + 4, y + 10, `${result.unallocated_area_ha.toFixed(2)} ha`, "sans", 9, COLORS.muted);
  }

  // Restricciones vinculantes
  const constraintY = startY + 18 + rows.length * rowHeight + 30;
  first.text(40, constraintY, "Restricciones activas", "serif", 16, COLORS.ink);
  const binding = result.binding_constraints?.length ? result.binding_constraints : ["Ninguna"];
  binding.forEach((item, i) => {
    const y = constraintY + 22 + i * 18;
    first.rect(40, y, 515, 16, COLORS.card);
    const label = item.replace("max_ha:", "Máx. ha · ").replace("min_ha:", "Mín. ha · ");
    first.text(50, y + 11, label, "sans", 9, COLORS.ink);
  });

  footer(first, 1, formattedDate, "PLAN COMERCIAL");

  // PÁGINA 2: Escenarios y trazabilidad
  const second = new Page();
  second.rect(0, 0, PAGE_W, 150, COLORS.ink);
  brand(second);
  second.text(40, 105, "TRES FUTUROS POSIBLES", "bold", 9, "#a8c39c");
  second.text(40, 135, "Mismo plan, distinta lectura de precio, rendimiento y costo.", "serif", 16, COLORS.white);

  const scenarioLabels = { conservative: "Conservador", expected: "Esperado", favorable: "Favorable" };
  const scenarioY = 190;
  const scenHeaders = ["ESCENARIO", "INVERSIÓN", "INGRESOS", "GANANCIA", "MARGEN"];
  const scenColX = [40, 150, 260, 380, 490];
  scenHeaders.forEach((h, i) => second.text(scenColX[i], scenarioY, h, "bold", 8, COLORS.soft));

  result.scenarios?.forEach((s, index) => {
    const y = scenarioY + 22 + index * 30;
    const isSelected = s.name === result.selected_risk_profile;
    second.rect(40, y, 515, 26, isSelected ? COLORS.pale : (index % 2 ? COLORS.paper : COLORS.card));
    if (isSelected) second.rect(40, y, 3, 26, COLORS.clay);
    second.text(scenColX[0] + 4, y + 15, scenarioLabels[s.name] + (isSelected ? " ← seleccionado" : ""), isSelected ? "bold" : "serif", 10, COLORS.ink);
    second.text(scenColX[1] + 4, y + 15, money(s.total_investment_cop), "sans", 9, COLORS.soft);
    second.text(scenColX[2] + 4, y + 15, money(s.total_revenue_cop), "sans", 9, COLORS.soft);
    second.text(scenColX[3] + 4, y + 15, money(s.total_profit_cop), "bold", 10, COLORS.ink);
    second.text(scenColX[4] + 4, y + 15, pct(s.margin_pct), "sans", 9, COLORS.muted);
  });

  // Comparación manual si existe
  if (result.manual_comparison) {
    const mc = result.manual_comparison;
    const mcY = scenarioY + 22 + (result.scenarios?.length || 0) * 30 + 30;
    second.text(40, mcY, "Tu plan frente al óptimo", "serif", 16, COLORS.ink);
    second.rect(40, mcY + 20, 515, 55, COLORS.card);
    second.text(50, mcY + 35, `Manual: ${money(mc.total_profit_cop)}`, "sans", 10, COLORS.soft);
    second.text(50, mcY + 55, `Óptimo: ${money(result.total_profit_cop)}`, "sans", 10, COLORS.soft);
    const deltaColor = mc.profit_delta_cop >= 0 ? COLORS.moss : COLORS.clay;
    second.text(300, mcY + 35, `Diferencia: ${mc.profit_delta_cop >= 0 ? "+" : ""}${money(mc.profit_delta_cop)}`, "bold", 11, deltaColor);
    mc.warnings?.forEach((w, i) => second.text(50, mcY + 75 + i * 14, `⚠ ${w}`, "sans", 8, COLORS.clay));
  }

  // Trazabilidad
  const provY = (result.manual_comparison ? scenarioY + 22 + (result.scenarios?.length || 0) * 30 + 110 : scenarioY + 22 + (result.scenarios?.length || 0) * 30 + 40);
  second.text(40, provY, "Trazabilidad del cálculo", "serif", 16, COLORS.ink);
  second.rect(40, provY + 20, 515, 70, COLORS.pale);
  const prov = result.provenance || {};
  second.text(50, provY + 38, `Catálogo: ${prov.snapshot_id || "—"}`, "sans", 9, COLORS.ink);
  second.text(50, provY + 52, `Versión: ${prov.version || "—"} · ${prov.reference_period || "—"}`, "sans", 9, COLORS.soft);
  second.text(50, provY + 66, `Método: ${prov.method || "Supuestos editables para planeación"}`, "sans", 9, COLORS.muted);
  (prov.sources || []).slice(0, 4).forEach((src, i) => {
    second.text(300, provY + 38 + i * 14, `${src.id}: ${src.url || "—"}`, "sans", 7.5, COLORS.muted);
  });

  // Aviso legal
  second.rect(40, 720, 515, 70, COLORS.pale);
  second.text(54, 740, "Decisión informada, no promesa de cosecha.", "bold", 10, COLORS.ink);
  second.lines(54, 758, [
    "Los precios, costos, rendimientos y agua son supuestos editables.",
    "Valida cada valor con un comprador, asistencia técnica y una observación local antes de invertir.",
  ], { size: 8.5, leading: 14 });

  footer(second, 2, formattedDate, "PLAN COMERCIAL");

  return makePdf([first, second]);
}

export function downloadCommercialPdf(result, crops, form) {
  const url = URL.createObjectURL(createCommercialPdf(result, crops, form));
  const link = document.createElement("a");
  link.href = url;
  link.download = "plan-comercial.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadCommercialCsv(result, crops, form) {
  const lines = [];
  lines.push("crop_id,crop_name,hectares,share_pct,price_cop_per_kg,yield_t_per_ha,cost_cop_per_ha,water_m3_per_ha,suitability_score,break_even_price_cop_per_kg,investment_cop,revenue_cop,profit_cop,water_m3");
  (result.allocation || []).filter((r) => r.hectares > 0.0001).forEach((row) => {
    const label = cropLabel(row.crop_id, crops);
    const share = form.area_ha ? (row.hectares / form.area_ha * 100).toFixed(1) : "0";
    lines.push([
      row.crop_id,
      `"${label}"`,
      row.hectares.toFixed(2),
      share,
      row.price_cop_per_kg.toFixed(2),
      row.yield_t_per_ha.toFixed(2),
      row.cost_cop_per_ha.toFixed(2),
      row.water_m3_per_ha.toFixed(2),
      (row.suitability_score || 0).toFixed(4),
      (row.break_even_price_cop_per_kg || 0).toFixed(2),
      row.investment_cop.toFixed(2),
      row.revenue_cop.toFixed(2),
      row.profit_cop.toFixed(2),
      row.water_m3.toFixed(2),
    ].join(","));
  });
  if (result.unallocated_area_ha > 0.0001) {
    lines.push(`unallocated,"Área sin asignar",${result.unallocated_area_ha.toFixed(2)},${(result.unallocated_area_ha / form.area_ha * 100).toFixed(1)},,,,,,,,,`);
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plan-comercial.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}