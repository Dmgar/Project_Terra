import test from "node:test";
import assert from "node:assert/strict";
import { buildGardenPlan, CROPS } from "../src/gardenPlanning.js";
import { createGardenPdf } from "../src/gardenPdf.js";

const form = (overrides = {}) => ({ area: "6", people: "2", sun: "2", water: "2", budget: "medium", goal: "mixed", ...overrides });

test("all recommended crops stay within explicit sun and water thresholds across profiles", () => {
  for (const area of ["2", "6", "12"]) {
    for (const budget of ["low", "medium", "high"]) {
      for (const goal of ["food", "mixed", "herbs"]) {
        for (const sun of ["1", "2", "3"]) {
          for (const water of ["1", "2", "3"]) {
            const input = form({ area, budget, goal, sun, water });
            const { variantCount, compatibleCount } = buildGardenPlan(input);
            assert.equal(compatibleCount, CROPS.filter((crop) => crop.sun <= Number(sun) && crop.water <= Number(water)).length);
            for (let variant = 0; variant < variantCount; variant++) {
              const { plan } = buildGardenPlan(input, variant);
              assert.ok(plan.length > 0);
              assert.ok(plan.every((crop) => crop.sun <= Number(sun) && crop.water <= Number(water)));
              assert.ok(Math.abs(plan.reduce((total, crop) => total + crop.squareMeters, 0) - Number(area)) < 0.0001);
              assert.equal(new Set(plan.map((crop) => crop.id)).size, plan.length);
            }
          }
        }
      }
    }
  }
});

test("reports no plan instead of inventing one when light and water do not suffice", () => {
  const input = form({ sun: "1", water: "1" });
  assert.deepEqual(buildGardenPlan(input), { plan: [], variantCount: 0, compatibleCount: 0 });
  assert.throws(() => createGardenPdf(input, [], 0), /No hay cultivos/);
});

test("offers no variation when the entire compatible catalog is already selected", () => {
  const input = form({ area: "2", sun: "1", water: "2" });
  const initial = buildGardenPlan(input);
  assert.equal(initial.compatibleCount, 3);
  assert.equal(initial.variantCount, 1);
  assert.deepEqual(buildGardenPlan(input, 1).plan.map((crop) => crop.id), initial.plan.map((crop) => crop.id));
});

test("variation changes the compatible selection and the PDF reflects only that selection", async () => {
  const input = form({ sun: "3", water: "2", area: "6" });
  const first = buildGardenPlan(input, 0);
  const second = buildGardenPlan(input, 1);
  assert.ok(first.variantCount > 1);
  assert.notDeepEqual(first.plan.map((crop) => crop.id), second.plan.map((crop) => crop.id));
  assert.deepEqual(buildGardenPlan(input, first.variantCount).plan.map((crop) => crop.id), first.plan.map((crop) => crop.id));

  const savings = second.plan.reduce((total, crop) => total + crop.monthlySaving, 0);
  const pdf = createGardenPdf(input, second.plan, savings, new Date("2026-09-25T12:00:00Z"));
  const source = Buffer.from(await pdf.arrayBuffer()).toString("latin1");
  for (const crop of second.plan) assert.ok(source.includes(crop.name), crop.id);
  for (const crop of first.plan.filter((crop) => !second.plan.some((other) => other.id === crop.id))) {
    assert.ok(!source.includes(crop.name), `${crop.id} must not appear in the PDF`);
  }
});