"""Typed request and response contracts for the farm economics API."""

from typing import Annotated, Any, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


Positive = Annotated[float, Field(gt=0, allow_inf_nan=False)]
NonNegative = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class EnvironmentalValues(BaseModel):
    """The seven environmental inputs; they are never economic variables."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True, allow_inf_nan=False)

    nitrogen: Annotated[float, Field(ge=0, le=180, alias="Nitrogen")] = Field(
        validation_alias=AliasChoices("nitrogen", "Nitrogen", "n", "N")
    )
    phosphorus: Annotated[float, Field(ge=5, le=150, alias="Phosphorus")] = Field(
        validation_alias=AliasChoices("phosphorus", "Phosphorus", "p", "P")
    )
    potassium: Annotated[float, Field(ge=5, le=210, alias="Potassium")] = Field(
        validation_alias=AliasChoices("potassium", "Potassium", "k", "K")
    )
    temperature_c: Annotated[float, Field(ge=5, le=50, alias="Temperature")] = Field(
        validation_alias=AliasChoices("temperature_c", "temperature", "Temperature")
    )
    humidity_pct: Annotated[float, Field(ge=0, le=100, alias="Humidity")] = Field(
        validation_alias=AliasChoices("humidity_pct", "humidity", "Humidity")
    )
    ph: Annotated[float, Field(ge=0, le=14, alias="pH_Value")] = Field(
        validation_alias=AliasChoices("ph", "pH", "pH_Value")
    )
    rainfall_mm: Annotated[float, Field(ge=20, le=350, alias="Rainfall")] = Field(
        validation_alias=AliasChoices("rainfall_mm", "rainfall", "Rainfall")
    )


class CropAssumption(BaseModel):
    """User-editable agronomic and economic assumptions for one crop."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True, allow_inf_nan=False)

    crop_id: str = Field(
        min_length=1,
        validation_alias=AliasChoices("crop_id", "crop", "id", "name", "crop_name"),
    )
    price_cop_per_kg: Positive = Field(
        validation_alias=AliasChoices(
            "price_cop_per_kg", "price_cop_kg", "priceCOPPerKg", "priceCOPKg", "price"
        )
    )
    yield_t_per_ha: Positive = Field(
        validation_alias=AliasChoices(
            "yield_t_per_ha",
            "yield_t_ha",
            "yield_tons_per_ha",
            "yieldTPerHa",
            "yield",
        )
    )
    cost_cop_per_ha: NonNegative = Field(
        validation_alias=AliasChoices(
            "cost_cop_per_ha", "cost_cop_ha", "costCOPPerHa", "cost"
        )
    )
    water_m3_per_ha: NonNegative = Field(
        validation_alias=AliasChoices(
            "water_m3_per_ha", "water_m3_ha", "waterM3PerHa", "water"
        )
    )
    min_ha: NonNegative = Field(
        validation_alias=AliasChoices("min_ha", "minHa"),
    )
    max_ha: Positive = Field(
        validation_alias=AliasChoices("max_ha", "maxHa")
    )

    @model_validator(mode="after")
    def valid_bounds(self) -> "CropAssumption":
        if self.max_ha < self.min_ha:
            raise ValueError("max_ha debe ser mayor o igual que min_ha")
        return self


class OptimizationRequest(BaseModel):
    """Colombian/COP optimization request.

    Required values intentionally have no defaults: omission must be visible to
    the caller instead of being silently replaced by a catalog value.
    """

    model_config = ConfigDict(extra="forbid", populate_by_name=True, allow_inf_nan=False)

    country: Literal["Colombia"] = "Colombia"
    currency: Literal["COP"] = "COP"
    area_ha: Positive = Field(
        validation_alias=AliasChoices("area_ha", "parcel_area_ha", "parcelAreaHa")
    )
    department: str = Field(min_length=1)
    market: str = Field(min_length=1)
    budget_cop: NonNegative = Field(
        validation_alias=AliasChoices("budget_cop", "budgetCOP", "budget")
    )
    water_m3: NonNegative = Field(
        validation_alias=AliasChoices(
            "water_m3",
            "water_availability_m3",
            "water_m3_available",
            "waterAvailableM3",
            "waterAvailabilityM3",
        )
    )
    risk_profile: str = Field(
        min_length=1,
        validation_alias=AliasChoices("risk_profile", "riskProfile"),
    )
    environmental_values: EnvironmentalValues = Field(
        validation_alias=AliasChoices(
            "environmental_values", "environmentalValues", "environment"
        )
    )
    crops: list[CropAssumption] = Field(
        min_length=1,
        validation_alias=AliasChoices("crops", "crop_assumptions", "cropAssumptions"),
    )
    manual_hectares: dict[str, NonNegative] | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "manual_hectares", "manualHectares", "manual_allocation"
        ),
    )
    suitability_tiebreak_weight: Annotated[
        float, Field(ge=0, le=1, allow_inf_nan=False)
    ] = 0.20

    @model_validator(mode="before")
    @classmethod
    def accept_flat_environment(cls, values: object) -> object:
        """Accept the seven values at the top level without filling any in."""
        if not isinstance(values, dict) or any(
            key in values
            for key in ("environment", "environmental_values", "environmentalValues")
        ):
            return values
        source_keys = {
            "nitrogen",
            "Nitrogen",
            "n",
            "N",
            "phosphorus",
            "Phosphorus",
            "p",
            "P",
            "potassium",
            "Potassium",
            "k",
            "K",
            "temperature",
            "temperature_c",
            "Temperature",
            "humidity",
            "humidity_pct",
            "Humidity",
            "ph",
            "pH",
            "pH_Value",
            "rainfall",
            "rainfall_mm",
            "Rainfall",
        }
        environment = {key: value for key, value in values.items() if key in source_keys}
        if not environment:
            return values
        remaining = {key: value for key, value in values.items() if key not in source_keys}
        remaining["environmental_values"] = environment
        return remaining

    @field_validator("risk_profile")
    @classmethod
    def normalized_risk_profile(cls, value: str) -> str:
        value = value.strip().lower()
        accepted = {"conservative", "expected", "balanced", "favorable", "growth"}
        if value not in accepted:
            raise ValueError(
                "risk_profile debe ser conservative, expected/balanced o favorable/growth"
            )
        return value

    @model_validator(mode="after")
    def unique_crops(self) -> "OptimizationRequest":
        identifiers = [crop.crop_id.strip().lower() for crop in self.crops]
        if any(not identifier for identifier in identifiers):
            raise ValueError("Cada cultivo necesita un identificador no vacío")
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("No se permiten cultivos repetidos en crops")
        return self


class AllocationRow(BaseModel):
    crop_id: str
    hectares: float
    price_cop_per_kg: float
    yield_t_per_ha: float
    cost_cop_per_ha: float
    water_m3_per_ha: float
    suitability_score: float
    adjusted_objective_score: float
    raw_profit_per_ha_cop: float
    break_even_price_cop_per_kg: float | None
    investment_cop: float
    revenue_cop: float
    profit_cop: float
    water_m3: float


class ScenarioResult(BaseModel):
    name: Literal["conservative", "expected", "favorable"]
    allocation: list[AllocationRow]
    total_investment_cop: float
    total_revenue_cop: float
    total_profit_cop: float
    raw_total_profit_cop: float
    allocated_area_ha: float
    unallocated_area_ha: float
    margin_pct: float | None
    profit_per_ha_cop: float | None
    binding_constraints: list[str]


class ManualComparison(BaseModel):
    supplied_hectares: dict[str, float]
    feasible: bool
    total_investment_cop: float
    total_revenue_cop: float
    total_profit_cop: float
    profit_delta_cop: float | None
    warnings: list[str]


class OptimizationResponse(BaseModel):
    status: Literal["optimal"]
    country: Literal["Colombia"]
    currency: Literal["COP"]
    department: str
    market: str
    selected_risk_profile: str
    allocation: list[AllocationRow]
    scenarios: list[ScenarioResult]
    total_investment_cop: float
    total_revenue_cop: float
    total_profit_cop: float
    raw_total_profit_cop: float
    allocated_area_ha: float
    unallocated_area_ha: float
    margin_pct: float | None
    profit_per_ha_cop: float | None
    binding_constraints: list[str]
    manual_comparison: ManualComparison | None
    provenance: dict[str, Any]
    warnings: list[str]