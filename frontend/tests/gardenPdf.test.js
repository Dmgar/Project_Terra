import test from "node:test";
import assert from "node:assert/strict";
import { createGardenPdf } from "../src/gardenPdf.js";

test("exports two branded PDF pages with Spanish text and stable byte offsets", async () => {
  const crops = [
    { name: "Fríjol arbustivo", squareMeters: 0.4, count: 3, harvest: "9–12 semanas" },
    { name: "Aromáticas", squareMeters: 0.4, count: 4, harvest: "6–10 semanas" },
    { name: "Lechuga", squareMeters: 0.4, count: 4, harvest: "6–9 semanas" },
    { name: "Acelga", squareMeters: 0.4, count: 2, harvest: "8–12 semanas" },
    { name: "Cebolla larga", squareMeters: 0.4, count: 5, harvest: "10–14 semanas" },
  ];
  const pdf = createGardenPdf({ area: "2", people: "2" }, crops, 16553, new Date("2026-09-25T12:00:00Z"));
  assert.equal(pdf.type, "application/pdf");
  const data = new Uint8Array(await pdf.arrayBuffer());
  const source = Buffer.from(data).toString("latin1");
  assert.match(source, /^%PDF-1\.4/);
  assert.match(source, /\/Count 2/);
  assert.match(source, /COP 11\.587/);
  assert.match(source, /TERRA/);
  assert.match(source, /Fríjol arbustivo/);
  assert.match(source, /Estimación doméstica/);
  assert.doesNotMatch(source, /\$\xB411\.587/);
  const xref = Number(source.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(source.slice(xref, xref + 4), "xref");
});