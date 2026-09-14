"""Linear-programming engine for Colombian crop allocation."""

from dataclasses import dataclass
from typing import Any

import numpy as np
from scipy.optimize import linprog

from data.economics.catalog import load_catalog

from .economics_models import (
    AllocationRow,
    CropAssumption,
    EnvironmentalValues,
    ManualComparison,
    OptimizationRequest,
    OptimizationResponse,
    ScenarioResult,
)


SCENARIOS = ("conservative", "expected", "favorable")
MULTIPLIERS = {
    "conservative": (0.85, 0.85, 1.10),
    "expected": (1.0, 1.0, 1.0),
    "favorable": (1.10, 1.10, 0.95),
}


class InfeasiblePlanError(ValueError):
    """Raised when area, budget, water, or crop bounds cannot coexist."""


@dataclass(frozen=True)
class _ScenarioNumbers:
    prices: np.ndarray
    yields: np.ndarray
    costs: np.ndarray


def _numbers(crops: list[CropAssumption], scenario: str) -> _ScenarioNumbers:
    price_factor, yield_factor, cost_factor = MULTIPLIERS[scenario]
    return _ScenarioNumbers(
        prices=np.array([crop.price_cop_per_kg for crop in crops]) * price_factor,
        yields=np.array([crop.yield_t_per_ha for crop in crops]) * yield_factor,
        costs=np.array([crop.cost_cop_per_ha for crop in crops]) * cost_factor,
    )


def _suitability(crop_id: str, environment: EnvironmentalValues) -> float:
    """Return an explicit agronomic score, independent of all money values.

    Catalog suitability bounds are expressed on Terra's environmental input
    scale (including rainfall 20-350), not annual rainfall millimetres.
    """
    crop = next(
        (item for item in load_catalog()["crops"] if item["id"] == crop_id.lower()),
        None,
    )
    if crop is None:
        return 0.5
    ranges = crop["suitability"]

    def bounds(item: dict[str, Any]) -> tuple[float, float]:
        return float(item["min"]["value"]), float(item["max"]["value"])

    checks = (
        (environment.rainfall_mm, bounds(ranges["rainfall_mm"])),
        (environment.temperature_c, bounds(ranges["temperature_c"])),
        (environment.ph, bounds(ranges["ph"])),
    )
    scores = []
    for value, (low, high) in checks:
        if low <= value <= high:
            scores.append(1.0)
        else:
            distance = min(abs(value - low), abs(value - high))
            scores.append(max(0.0, 1.0 - distance / max(high - low, 1)))
    return round(float(sum(scores) / len(scores)), 4)


def _binding_constraints(
    allocation: np.ndarray,
    request: OptimizationRequest,
    crops: list[CropAssumption],
    costs: np.ndarray,
) -> list[str]:
    area_used = float(allocation.sum())
    budget_used = float(np.dot(costs, allocation))
    water_used = float(
        np.dot(np.array([crop.water_m3_per_ha for crop in crops]), allocation)
    )
    names: list[str] = []
    if np.isclose(area_used, request.area_ha, rtol=1e-7, atol=1e-6):
        names.append("area")
    if np.isclose(budget_used, request.budget_cop, rtol=1e-7, atol=1e-2):
        names.append("budget")
    if np.isclose(water_used, request.water_m3, rtol=1e-7, atol=1e-3):
        names.append("water")
    for index, crop in enumerate(crops):
        if np.isclose(allocation[index], crop.min_ha, atol=1e-6):
            names.append(f"min_ha:{crop.crop_id}")
        if np.isclose(allocation[index], crop.max_ha, atol=1e-6):
            names.append(f"max_ha:{crop.crop_id}")
    return names


def _scenario(
    name: str,
    request: OptimizationRequest,
) -> ScenarioResult:
    crops = request.crops
    numbers = _numbers(crops, name)
    revenue_per_ha = numbers.prices * numbers.yields * 1000
    raw_profit_per_ha = revenue_per_ha - numbers.costs
    suitability = np.array(
        [_suitability(crop.crop_id, request.environmental_values) for crop in crops]
    )
    # This score is deliberately separate from prices/yields/costs.  The
    # displayed totals below always use raw_profit_per_ha.
    adjusted_objective_score = raw_profit_per_ha * (
        1 - request.suitability_tiebreak_weight * (1 - suitability)
    )
    water = np.array([crop.water_m3_per_ha for crop in crops])
    base_constraints = np.vstack((np.ones(len(crops)), numbers.costs, water))
    base_bounds = np.array([request.area_ha, request.budget_cop, request.water_m3])
    raw_result = linprog(
        c=-raw_profit_per_ha,
        A_ub=base_constraints,
        b_ub=base_bounds,
        bounds=[(crop.min_ha, crop.max_ha) for crop in crops],
        method="highs",
    )
    if not raw_result.success or raw_result.x is None:
        raise InfeasiblePlanError(
            f"No existe una asignación factible para el escenario {name}: {raw_result.message}"
        )
    # Preserve the mathematically maximum raw profit, then use environmental
    # suitability only to choose among economically equivalent allocations.
    optimal_raw_profit = float(np.dot(raw_profit_per_ha, raw_result.x))
    profit_tolerance = max(abs(optimal_raw_profit) * 1e-10, 0.01)
    result = linprog(
        c=-adjusted_objective_score,
        A_ub=np.vstack((base_constraints, -raw_profit_per_ha)),
        b_ub=np.append(base_bounds, -(optimal_raw_profit - profit_tolerance)),
        bounds=[(crop.min_ha, crop.max_ha) for crop in crops],
        method="highs",
    )
    if not result.success or result.x is None:
        result = raw_result
    hectares = np.maximum(result.x, 0)
    investment = float(np.dot(numbers.costs, hectares))
    revenue = float(np.dot(revenue_per_ha, hectares))
    profit = revenue - investment
    rows = [
        AllocationRow(
            crop_id=crop.crop_id,
            hectares=round(float(hectares[index]), 6),
            price_cop_per_kg=round(float(numbers.prices[index]), 4),
            yield_t_per_ha=round(float(numbers.yields[index]), 4),
            cost_cop_per_ha=round(float(numbers.costs[index]), 2),
            water_m3_per_ha=round(float(water[index]), 4),
            suitability_score=round(float(suitability[index]), 4),
            adjusted_objective_score=round(
                float(adjusted_objective_score[index]), 2
            ),
            raw_profit_per_ha_cop=round(float(raw_profit_per_ha[index]), 2),
            break_even_price_cop_per_kg=round(
                float(numbers.costs[index] / (numbers.yields[index] * 1000)), 4
            ) if numbers.yields[index] else None,
            investment_cop=round(float(numbers.costs[index] * hectares[index]), 2),
            revenue_cop=round(float(revenue_per_ha[index] * hectares[index]), 2),
            profit_cop=round(float(raw_profit_per_ha[index] * hectares[index]), 2),
            water_m3=round(float(water[index] * hectares[index]), 2),
        )
        for index, crop in enumerate(crops)
    ]
    return ScenarioResult(
        name=name,
        allocation=rows,
        total_investment_cop=round(investment, 2),
        total_revenue_cop=round(revenue, 2),
        total_profit_cop=round(profit, 2),
        raw_total_profit_cop=round(profit, 2),
        allocated_area_ha=round(float(hectares.sum()), 6),
        unallocated_area_ha=round(float(max(request.area_ha - hectares.sum(), 0)), 6),
        margin_pct=round(profit / revenue * 100, 4) if revenue else None,
        profit_per_ha_cop=round(profit / hectares.sum(), 2)
        if hectares.sum()
        else None,
        binding_constraints=_binding_constraints(hectares, request, crops, numbers.costs),
    )


def _manual_comparison(
    request: OptimizationRequest,
    selected: ScenarioResult,
) -> ManualComparison | None:
    if request.manual_hectares is None:
        return None
    by_id = {crop.crop_id.lower(): crop for crop in request.crops}
    hectares = {
        str(key).lower(): float(value)
        for key, value in request.manual_hectares.items()
    }
    warnings: list[str] = []
    unknown = sorted(set(hectares) - set(by_id))
    if unknown:
        warnings.append(f"Cultivos manuales no incluidos en crops: {', '.join(unknown)}")
    allocation = np.array(
        [hectares.get(crop.crop_id.lower(), 0.0) for crop in request.crops]
    )
    numbers = _numbers(request.crops, selected.name)
    feasible = not unknown
    for index, crop in enumerate(request.crops):
        if allocation[index] < crop.min_ha or allocation[index] > crop.max_ha:
            feasible = False
            warnings.append(f"{crop.crop_id} está fuera de sus límites min_ha/max_ha")
    investment = float(
        np.dot(allocation, numbers.costs)
    )
    revenue = float(
        np.dot(allocation, numbers.prices * numbers.yields * 1000)
    )
    if allocation.sum() > request.area_ha + 1e-7:
        feasible = False
        warnings.append("La asignación manual supera el área disponible")
    if investment > request.budget_cop + 1e-7:
        feasible = False
        warnings.append("La asignación manual supera el presupuesto")
    water = sum(
        allocation[i] * request.crops[i].water_m3_per_ha
        for i in range(len(allocation))
    )
    if water > request.water_m3 + 1e-7:
        feasible = False
        warnings.append("La asignación manual supera el agua disponible")
    profit = revenue - investment
    return ManualComparison(
        supplied_hectares=hectares,
        feasible=feasible,
        total_investment_cop=round(investment, 2),
        total_revenue_cop=round(revenue, 2),
        total_profit_cop=round(profit, 2),
        profit_delta_cop=round(profit - selected.total_profit_cop, 2),
        warnings=warnings,
    )


def optimize_plan(request: OptimizationRequest) -> OptimizationResponse:
    """Solve all scenarios and select the scenario matching the risk profile."""
    scenarios = [_scenario(name, request) for name in SCENARIOS]
    selected_name = {
        "conservative": "conservative",
        "expected": "expected",
        "balanced": "expected",
        "favorable": "favorable",
        "growth": "favorable",
    }[request.risk_profile]
    selected = next(item for item in scenarios if item.name == selected_name)
    manual = _manual_comparison(request, selected)
    warnings = [
        "Los precios, rendimientos, costos y agua son supuestos editables; valide datos locales antes de invertir.",
        f"La afinidad ambiental se usa solo para desempatar planes con la misma ganancia máxima (peso {request.suitability_tiebreak_weight:.0%}); no altera precios, costos, rendimientos ni la ganancia óptima.",
    ]
    if any(
        row.hectares > 1e-6 and row.suitability_score < 0.5
        for row in selected.allocation
    ):
        warnings.append("Al menos un cultivo tiene afinidad ambiental baja para los valores ingresados.")
    return OptimizationResponse(
        status="optimal",
        country="Colombia",
        currency="COP",
        department=request.department,
        market=request.market,
        selected_risk_profile=selected_name,
        allocation=selected.allocation,
        scenarios=scenarios,
        total_investment_cop=selected.total_investment_cop,
        total_revenue_cop=selected.total_revenue_cop,
        total_profit_cop=selected.total_profit_cop,
        raw_total_profit_cop=selected.raw_total_profit_cop,
        allocated_area_ha=selected.allocated_area_ha,
        unallocated_area_ha=selected.unallocated_area_ha,
        margin_pct=selected.margin_pct,
        profit_per_ha_cop=selected.profit_per_ha_cop,
        binding_constraints=selected.binding_constraints,
        manual_comparison=manual,
        provenance=load_catalog()["provenance"] | {
            "snapshot_id": load_catalog()["snapshot_id"],
            "version": load_catalog()["version"],
        },
        warnings=warnings,
    )