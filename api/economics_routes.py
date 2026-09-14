"""FastAPI routes for catalog discovery and crop allocation optimization."""

from typing import Any

from fastapi import APIRouter, HTTPException

from data.economics.catalog import catalog_response

from .economics_engine import InfeasiblePlanError, optimize_plan
from .economics_models import OptimizationRequest, OptimizationResponse


router = APIRouter(tags=["economics"])


@router.get("/api/economics/catalog", response_model=dict[str, Any])
def economics_catalog() -> dict[str, Any]:
    return catalog_response()


@router.post("/api/optimize", response_model=OptimizationResponse)
def optimize(payload: OptimizationRequest) -> OptimizationResponse:
    try:
        return optimize_plan(payload)
    except InfeasiblePlanError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc