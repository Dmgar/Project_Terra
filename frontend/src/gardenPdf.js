// A small, self-contained PDF renderer for TERRA's two-page household garden plan.
// PDF's WinAnsi encoding covers Spanish accents; byte offsets must be measured after encoding.
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

const money = (value) => `COP ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, " ")}`;
const decimal = (value) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
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
    this.commands.push(`${rgb(color)} rg ${cx + rx} ${cy} m ${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry} c ${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy} c ${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry} c ${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy} c f`);
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

function footer(page, number, date) {
  page.rule(40, 800, 555, 800);
  page.text(40, 818, "TERRA  /  PLAN DE MI HUERTA", "bold", 8, COLORS.ink);
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

export function createGardenPdf(form, plan, totalSaving, date = new Date()) {
  if (!plan.length) throw new Error("No hay cultivos para exportar.");
  const formattedDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(date);
  const plantCount = plan.reduce((sum, crop) => sum + crop.count, 0);
  const first = new Page();

  first.rect(0, 0, PAGE_W, 214, COLORS.ink);
  brand(first);
  first.text(40, 105, "TU HUERTA  /  PROPUESTA INICIAL", "bold", 9, "#a8c39c");
  first.text(40, 150, "Pequeña en espacio,", "serif", 32, COLORS.white);
  first.text(40, 185, "útil cada semana.", "serif", 32, "#c3d8b6");
  drawCropArtwork(first, plan[0], 431, 82, 98);
  if (plan[1]) drawCropArtwork(first, plan[1], 487, 134, 52);
  first.text(40, 243, "01 / UN PLAN A TU MEDIDA", "bold", 9, COLORS.moss);

  const stats = [
    { label: "ESPACIO ORGANIZADO", value: `${decimal(Number(form.area))} m²`, note: `${plan.length} cultivos` },
    { label: "PLANTAS APROX.", value: `${plantCount}`, note: "siembra escalonada" },
    { label: "AHORRO MENSUAL*", value: `${money(totalSaving * .7)}`, note: `hasta ${money(totalSaving * 1.2)}` },
  ];
  stats.forEach((stat, index) => {
    const x = 40 + index * 174;
    first.rect(x, 256, 164, 88, COLORS.card);
    first.rect(x, 256, 164, 2, index === 2 ? COLORS.clay : COLORS.moss);
    first.text(x + 12, 277, stat.label, "bold", 8, COLORS.muted);
    first.text(x + 12, 307, stat.value, "serif", index === 2 ? 19 : 24, COLORS.ink);
    first.text(x + 12, 327, stat.note, "sans", 9, COLORS.soft);
  });

  first.text(40, 382, "Así puedes repartirla", "serif", 24);
  first.text(40, 399, "Empieza con pocas variedades y siembra en fechas distintas.", "sans", 9, COLORS.muted);
  first.rect(40, 415, 515, 27, COLORS.pale);
  first.text(52, 433, "CULTIVO", "bold", 8, COLORS.soft);
  first.text(278, 433, "ÁREA", "bold", 8, COLORS.soft);
  first.text(350, 433, "PLANTAS", "bold", 8, COLORS.soft);
  first.text(444, 433, "1.ª COSECHA", "bold", 8, COLORS.soft);

  const rowHeight = Math.min(72, Math.floor(255 / plan.length));
  plan.forEach((crop, index) => {
    const y = 442 + index * rowHeight;
    const baseline = y + rowHeight / 2 + 5;
    first.rect(40, y, 515, rowHeight, index % 2 ? COLORS.paper : COLORS.card);
    first.rect(40, y, 3, rowHeight, index % 2 ? COLORS.moss : COLORS.clay);
    drawCropArtwork(first, crop, 51, y + (rowHeight - 38) / 2, 38);
    first.text(100, baseline, crop.name, "serif", 15, COLORS.ink);
    first.text(278, baseline, `${decimal(crop.squareMeters)} m²`, "bold", 10, COLORS.ink);
    first.text(350, baseline, `${crop.count}`, "sans", 10, COLORS.ink);
    first.text(444, baseline, crop.harvest, "sans", 9, COLORS.soft);
  });
  first.rect(40, 704, 515, 75, COLORS.pale);
  first.text(54, 725, "* Ahorro orientativo, no una promesa de ingresos.", "bold", 10, COLORS.ink);
  first.lines(54, 744, [
    "Estimación doméstica para cuando la huerta esté produciendo.",
    "No incluye tiempo, herramientas, pérdidas, plagas ni variaciones de precio.",
  ], { size: 9, leading: 15 });
  footer(first, 1, formattedDate);

  const second = new Page();
  second.rect(0, 0, PAGE_W, 168, COLORS.ink);
  brand(second);
  second.text(40, 109, "02 / ACOMPAÑAMIENTO", "bold", 9, "#a8c39c");
  second.text(40, 145, "Cultivar también es observar.", "serif", 27, COLORS.white);
  drawCropArtwork(second, plan[plan.length - 1], 471, 76, 76);
  second.text(40, 199, "Qué hacer durante el cultivo", "serif", 24, COLORS.ink);
  second.text(40, 217, "Pequeñas revisiones para mejorar el próximo ciclo.", "sans", 10, COLORS.muted);

  const steps = [
    ["01", "Primera semana", "Observar y ajustar", "Revisa el drenaje, protege los brotes del sol extremo y mantén el sustrato húmedo, sin encharcarlo."],
    ["02", "Cada semana", "Revisar señales", "Mira el envés de las hojas, retira partes enfermas y ajusta el riego si la tierra sigue húmeda."],
    ["03", "Cada 2 o 3 semanas", "Sembrar por tandas", "Repite una parte de los cultivos de ciclo corto para no cosechar todo al mismo tiempo."],
    ["04", "Al cosechar", "Registrar y mejorar", "Anota qué produjo mejor, cuánto consumió el hogar y qué conviene ampliar en el siguiente ciclo."],
  ];
  steps.forEach(([number, when, title, description], index) => {
    const y = 240 + index * 98;
    second.rect(40, y, 515, 88, COLORS.card);
    second.rect(40, y, 4, 88, index % 2 ? COLORS.clay : COLORS.moss);
    second.text(56, y + 34, number, "serif", 23, COLORS.moss);
    second.text(111, y + 21, when.toUpperCase(), "bold", 8, COLORS.muted);
    second.text(111, y + 43, title, "serif", 18, COLORS.ink);
    const splitAt = description.lastIndexOf(" ", 70);
    second.lines(111, y + 63, splitAt > 0 ? [description.slice(0, splitAt), description.slice(splitAt + 1)] : [description], { size: 8.5, leading: 12 });
  });
  second.rect(40, 652, 515, 120, COLORS.pale);
  second.text(54, 676, "Antes de ampliar la huerta", "serif", 19, COLORS.ink);
  second.lines(54, 699, [
    "Usa recipientes con drenaje y un sustrato suelto.",
    "Observa el sol real durante una semana antes de mover las plantas.",
    "La producción cambia con el clima, la variedad, el recipiente y el manejo.",
  ], { size: 9.5, leading: 19 });
  footer(second, 2, formattedDate);
  return makePdf([first, second]);
}

export function downloadGardenPdf(form, plan, totalSaving) {
  const url = URL.createObjectURL(createGardenPdf(form, plan, totalSaving));
  const link = document.createElement("a");
  link.href = url;
  link.download = "plan-mi-huerta.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}