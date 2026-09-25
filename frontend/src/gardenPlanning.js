// Sun and water are ordered availability bands (1 = limited, 3 = ample).
// A crop is eligible only when both of its minimum requirements can be met.
export const CROPS = [
  { id: "lechuga", name: "Lechuga", sun: 1, water: 2, plants: 9, harvest: "6–9 semanas", saving: 8500, food: 5, herbs: 0 },
  { id: "tomate", name: "Tomate cherry", sun: 3, water: 2, plants: 2, harvest: "10–14 semanas", saving: 15000, food: 5, herbs: 0 },
  { id: "cilantro", name: "Cilantro", sun: 1, water: 2, plants: 16, harvest: "5–8 semanas", saving: 6000, food: 2, herbs: 5 },
  { id: "cebolla", name: "Cebolla larga", sun: 2, water: 2, plants: 12, harvest: "10–14 semanas", saving: 9000, food: 4, herbs: 2 },
  { id: "zanahoria", name: "Zanahoria", sun: 2, water: 1, plants: 16, harvest: "10–13 semanas", saving: 7000, food: 5, herbs: 0 },
  { id: "frijol", name: "Fríjol arbustivo", sun: 3, water: 1, plants: 8, harvest: "9–12 semanas", saving: 10000, food: 5, herbs: 0 },
  { id: "acelga", name: "Acelga", sun: 1, water: 2, plants: 5, harvest: "8–12 semanas", saving: 7500, food: 5, herbs: 0 },
  { id: "aromaticas", name: "Aromáticas", sun: 2, water: 1, plants: 6, harvest: "6–10 semanas", saving: 6500, food: 1, herbs: 5 },
];

export function buildGardenPlan(form, variation = 0) {
  const area = Number(form.area);
  if (!Number.isFinite(area) || area <= 0) throw new RangeError("El área debe ser mayor que cero.");
  const sun = Number(form.sun);
  const water = Number(form.water);
  const eligible = CROPS.filter((crop) => crop.sun <= sun && crop.water <= water)
    .map((crop) => {
      const climate = 6 - Math.abs(crop.sun - sun) * 1.6 - Math.abs(crop.water - water) * 1.2;
      const goal = form.goal === "food" ? crop.food : form.goal === "herbs" ? crop.herbs : (crop.food + crop.herbs) / 2;
      return { ...crop, score: climate + goal };
    })
    .sort((a, b) => b.score - a.score);

  const spaceLimit = area < 3 ? 3 : area < 8 ? 4 : 5;
  const budgetLimit = { low: 3, medium: 4, high: 5 }[form.budget];
  const target = Math.min(spaceLimit, budgetLimit);
  const selectedCount = Math.min(target, eligible.length);
  // Each contiguous window differs from the previous one, and never includes an ineligible crop.
  const variantCount = selectedCount ? eligible.length - selectedCount + 1 : 0;
  const index = variantCount ? ((variation % variantCount) + variantCount) % variantCount : 0;
  const selected = eligible.slice(index, index + selectedCount);
  const total = selected.reduce((sum, crop) => sum + crop.score, 0);
  const plan = selected.map((crop) => {
    const squareMeters = area * crop.score / total;
    return { ...crop, squareMeters, count: Math.max(1, Math.round(squareMeters * crop.plants)), monthlySaving: squareMeters * crop.saving };
  });
  return { plan, variantCount, compatibleCount: eligible.length };
}