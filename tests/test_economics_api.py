"""Deterministic tests for the Colombia/COP allocation foundation."""

import pytest
from fastapi.testclient import TestClient

from api.economics_engine import InfeasiblePlanError, optimize_plan
from api.economics_models import OptimizationRequest
from api.server import app


ENVIRONMENT = {
    "nitrogen": 50,
    "phosphorus": 30,
    "potassium": 30,
    "temperature": 20,
    "humidity": 70,
    "ph": 6,
    "rainfall": 200,
}


def request(**overrides):
    value = {
        "area_ha": 10,
        "department": "Cundinamarca",
        "market": "Bogotá",
        "budget_cop": 100_000_000,
        "water_m3": 100_000,
        "risk_profile": "expected",
        "environmental_values": ENVIRONMENT,
        "crops": [
            {
                "crop": "maiz",
                "price_cop_per_kg": 1450,
                "yield_t_per_ha": 5,
                "cost_cop_per_ha": 5_200_000,
                "water_m3_per_ha": 5000,
                "min_ha": 0,
                "max_ha": 10,
            },
            {
                "crop": "frijol",
                "price_cop_per_kg": 4200,
                "yield_t_per_ha": 1.8,
                "cost_cop_per_ha": 6_200_000,
                "water_m3_per_ha": 3500,
                "min_ha": 0,
                "max_ha": 10,
            },
        ],
    }
    value.update(overrides)
    return OptimizationRequest.model_validate(value)


def test_known_optimum_and_all_resource_constraints():
    result = optimize_plan(request())
    assert result.total_profit_cop == pytest.approx(20_500_000)
    assert result.allocation[0].hectares == pytest.approx(10)
    assert sum(row.hectares for row in result.allocation) <= 10
    assert result.total_investment_cop <= 100_000_000
    assert sum(row.water_m3 for row in result.allocation) <= 100_000
    assert "area" in result.binding_constraints


def test_scenarios_order_and_environment_is_not_economic_data():
    baseline = optimize_plan(request())
    changed_environment = optimize_plan(
        request(
            environmental_values={
                "nitrogen": 180,
                "phosphorus": 150,
                "potassium": 210,
                "temperature": 49,
                "humidity": 10,
                "ph": 9.4,
                "rainfall": 350,
            }
        )
    )
    profits = [item.total_profit_cop for item in baseline.scenarios]
    assert profits[0] <= profits[1] <= profits[2]
    assert baseline.total_profit_cop == changed_environment.total_profit_cop
    assert baseline.warnings
    assert all(
        sum(row.hectares for row in scenario.allocation) <= 10 + 1e-6
        for scenario in baseline.scenarios
    )
    assert baseline.allocation[0].break_even_price_cop_per_kg == pytest.approx(1040)


def test_missing_values_and_infeasible_bounds_are_explicit():
    with pytest.raises(ValueError):
        request(crops=[{"crop": "maiz"}])
    crops = [
        {
            "crop": "maiz",
            "price_cop_per_kg": 1450,
            "yield_t_per_ha": 5,
            "cost_cop_per_ha": 5_200_000,
            "water_m3_per_ha": 5000,
            "min_ha": 1,
            "max_ha": 10,
        }
    ]
    with pytest.raises(InfeasiblePlanError):
        optimize_plan(
            request(
                area_ha=1,
                budget_cop=1,
                water_m3=1,
                crops=crops,
            )
        )


def test_manual_comparison_and_catalog_provenance():
    result = optimize_plan(request(manual_hectares={"maiz": 5, "frijol": 5}))
    assert result.manual_comparison is not None
    assert result.manual_comparison.feasible
    client = TestClient(app)
    catalog = client.get("/api/economics/catalog")
    assert catalog.status_code == 200
    body = catalog.json()
    assert body["country"] == "Colombia"
    assert body["currency"] == "COP"
    assert {source["id"] for source in body["provenance"]["sources"]} >= {
        "DANE-SIPSA-MAIN",
        "DANE-SIPSA-MONTHLY",
        "UPRA-EVA",
        "UPRA-PRODUCTION-COST",
        "FAO56-CROPWAT",
        "FAO-CROPWAT",
    }
    assert [crop["id"] for crop in body["crops"]] == [
        "arroz",
        "maiz",
        "papa",
        "tomate",
        "cana_de_azucar",
        "trigo",
    ]
    for crop in body["crops"]:
        assert all(
            isinstance(value, (int, float))
            for value in crop["assumptions"].values()
        )
        for field in crop["assumption_metadata"].values():
            assert field["status"] == "reference_adjustable"
            assert field["source_id"] and field["period"]
            assert field["geography"] and field["market"] and field["basis"]
        for bounds in crop["suitability"].values():
            for field in bounds.values():
                assert field["status"] == "reference_adjustable"
                assert field["source_id"] and field["period"]
    assert body["optimization_policy"]["suitability_role"]


def test_manual_comparison_uses_selected_scenario_and_non_finite_is_rejected():
    favorable = optimize_plan(
        request(
            risk_profile="favorable",
            manual_hectares={"maiz": 10},
        )
    )
    assert favorable.manual_comparison is not None
    assert favorable.manual_comparison.profit_delta_cop == pytest.approx(0)
    with pytest.raises(ValueError):
        request(area_ha=float("inf"))


def test_suitability_penalty_changes_ranking_without_changing_raw_economics():
    crops = [
        {
            "crop": "maiz",
            "price_cop_per_kg": 2000,
            "yield_t_per_ha": 1,
            "cost_cop_per_ha": 1_000_000,
            "water_m3_per_ha": 100,
            "min_ha": 0,
            "max_ha": 10,
        },
        {
            "crop": "trigo",
            "price_cop_per_kg": 2000,
            "yield_t_per_ha": 1,
            "cost_cop_per_ha": 1_000_000,
            "water_m3_per_ha": 100,
            "min_ha": 0,
            "max_ha": 10,
        },
    ]
    warm = optimize_plan(request(crops=crops, environmental_values=ENVIRONMENT))
    cool = optimize_plan(
        request(
            crops=crops,
            environmental_values={
                **ENVIRONMENT,
                "temperature": 10,
                "rainfall": 40,
                "ph": 5.5,
            },
        )
    )
    assert warm.allocation[0].hectares > warm.allocation[1].hectares
    assert cool.allocation[1].hectares > cool.allocation[0].hectares
    assert warm.total_profit_cop == cool.total_profit_cop
    assert (
        warm.allocation[0].raw_profit_per_ha_cop
        == cool.allocation[0].raw_profit_per_ha_cop
    )
