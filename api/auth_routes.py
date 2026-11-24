"""Authentication, session management, and saved parcels routes for Project Terra."""

from __future__ import annotations

import os
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from . import storage

COOKIE_NAME = "terra_session"

router = APIRouter(tags=["auth & parcels"])


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: Annotated[str, Field(min_length=5, max_length=160)]
    name: Annotated[str, Field(min_length=2, max_length=80)]
    password: Annotated[str, Field(min_length=8, max_length=128)]


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: Annotated[str, Field(min_length=5, max_length=160)]
    password: Annotated[str, Field(min_length=1, max_length=128)]


class ParcelCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: Annotated[str, Field(min_length=2, max_length=100)]
    department: Annotated[str, Field(max_length=80)] = ""
    municipality: Annotated[str, Field(max_length=80)] = ""
    notes: Annotated[str, Field(max_length=400)] = ""
    Nitrogen: Annotated[float, Field(ge=0, le=180)]
    Phosphorus: Annotated[float, Field(ge=5, le=150)]
    Potassium: Annotated[float, Field(ge=5, le=210)]
    Temperature: Annotated[float, Field(ge=5, le=50)]
    Humidity: Annotated[float, Field(ge=10, le=100)]
    pH_Value: Annotated[float, Field(ge=3.5, le=9.5)]
    Rainfall: Annotated[float, Field(ge=20, le=350)]
    recommended_cluster: Annotated[int | None, Field(ge=0, le=4)] = None


def _cookie_secure() -> bool:
    return os.getenv("TERRA_COOKIE_SECURE", "").strip().lower() in {"1", "true", "yes"}


def _cookie_samesite() -> str:
    raw = os.getenv("TERRA_COOKIE_SAMESITE", "lax").strip().lower()
    if raw == "none" and _cookie_secure():
        return "none"
    if raw in {"lax", "strict"}:
        return raw
    return "lax"


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=storage.SESSION_TTL_SECONDS,
        httponly=True,
        samesite=_cookie_samesite(),
        secure=_cookie_secure(),
        path="/",
    )


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(COOKIE_NAME)


def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no iniciada.",
        )
    payload = storage.verify_session_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada.",
        )
    user = storage.get_user_by_id(payload["uid"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        )
    return user


@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response):
    if "@" not in payload.email or "." not in payload.email.split("@")[-1]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Ingresa un correo electrónico válido.",
        )
    try:
        user = storage.create_user(payload.email, payload.name, payload.password)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta registrada con ese correo.",
        ) from exc

    token = storage.create_session_token(user["id"], user["email"])
    _set_session_cookie(response, token)
    return {"user": user, "token": token}


@router.post("/api/auth/login")
@router.post("/auth/login")
def login(payload: LoginRequest, response: Response):
    record = storage.get_user_by_email(payload.email)
    if not record or not storage.verify_password(payload.password, record["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos.",
        )
    user = {
        "id": record["id"],
        "email": record["email"],
        "name": record["name"],
        "created_at": record["created_at"],
    }
    token = storage.create_session_token(user["id"], user["email"])
    _set_session_cookie(response, token)
    return {"user": user, "token": token}


@router.post("/api/auth/logout")
@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "ok"}


# Usuario autenticado inyectado por FastAPI (evita llamadas en valores por defecto, ruff B008).
CurrentUser = Annotated[dict, Depends(get_current_user)]


@router.get("/api/auth/me")
@router.get("/auth/me")
def me(user: CurrentUser):
    return {"user": user}


@router.get("/api/parcels")
@router.get("/parcels")
def get_parcels(user: CurrentUser):
    return {"parcels": storage.list_parcels(user["id"])}


@router.post("/api/parcels", status_code=status.HTTP_201_CREATED)
@router.post("/parcels", status_code=status.HTTP_201_CREATED)
def save_parcel(payload: ParcelCreateRequest, user: CurrentUser):
    parcel = storage.create_parcel(user["id"], payload.model_dump())
    return {"parcel": parcel}


@router.delete("/api/parcels/{parcel_id}")
@router.delete("/parcels/{parcel_id}")
def remove_parcel(parcel_id: int, user: CurrentUser):
    deleted = storage.delete_parcel(user["id"], parcel_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Parcela no encontrada.",
        )
    return {"status": "deleted", "id": parcel_id}
