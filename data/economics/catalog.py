"""Loader for the versioned, auditable Colombia reference snapshot."""

from functools import lru_cache
import json
from pathlib import Path
from typing import Any


CATALOG_PATH = Path(__file__).with_name("catalog.json")
PROJECT_TERRA_CROPS = (
    "arroz",
    "maiz",
    "papa",
    "tomate",
    "cana_de_azucar",
    "trigo",
)


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    """Load and validate the catalog once for process-local reuse."""
    with CATALOG_PATH.open(encoding="utf-8") as handle:
        catalog = json.load(handle)
    crop_ids = tuple(item.get("id") for item in catalog.get("crops", []))
    if crop_ids != PROJECT_TERRA_CROPS:
        raise ValueError(
            "El snapshot económico debe contener exactamente los seis cultivos Terra "
            f"en orden: {', '.join(PROJECT_TERRA_CROPS)}"
        )
    return catalog


def catalog_response() -> dict[str, Any]:
    """Return editable numeric values alongside their audit metadata."""
    response = json.loads(json.dumps(load_catalog()))
    for crop in response["crops"]:
        metadata = crop["assumptions"]
        crop["assumption_metadata"] = metadata
        crop["assumptions"] = {
            name: field["value"] for name, field in metadata.items()
        }
    response["optimization_policy"] = {
        "objective": "Maximizar la ganancia neta sin modificarla con variables ambientales.",
        "suitability_role": "Desempate entre planes con la misma ganancia máxima.",
        "suitability_tiebreak_weight": 0.20,
        "scenario_multipliers": {
            "conservative": {"price": 0.85, "yield": 0.85, "cost": 1.10},
            "expected": {"price": 1.0, "yield": 1.0, "cost": 1.0},
            "favorable": {"price": 1.10, "yield": 1.10, "cost": 0.95},
        },
    }
    return response
