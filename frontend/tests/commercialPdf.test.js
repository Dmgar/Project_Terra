import test from "node:test";
import assert from "node:assert/strict";
import { buildCommercialCsv } from "../src/commercialPdf.js";

test("buildCommercialCsv produces 14 columns on every row including unallocated and escapes formulas", () => {
  const result = {
    unallocated_area_ha: 2.5,
    allocation: [
      {
        crop_id: "maiz",
        hectares: 7.5,
        price_cop_per_kg: 1450,
        yield_t_per_ha: 5,
        cost_cop_per_ha: 5200000,
        water_m3_per_ha: 5000,
        suitability_score: 0.85,
        break_even_price_cop_per_kg: 1040,
        investment_cop: 39000000,
        revenue_cop: 54375000,
        profit_cop: 15375000,
        water_m3: 37500,
      },
    ],
  };
  const crops = [{ id: "maiz", name: "=SUM(A1:A2)" }];
  const csv = buildCommercialCsv(result, crops, { area_ha: 10 });
  const rows = csv.trim().split("\n");
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.split(",").length, 14, `Expected 14 columns in row: ${row}`);
  }
  assert.ok(rows[1].includes("'=SUM(A1:A2)"), "Formula prefix should be neutralized");
});
