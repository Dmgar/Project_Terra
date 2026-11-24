"""Lightweight SQLite persistence and cryptographic auth helpers for Project Terra.

Uses only Python standard library (sqlite3, hashlib.scrypt, hmac, secrets) to keep
the production container and serverless footprint minimal.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ROOT_DIR / "data" / "terra_app.db"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days

# Ephemeral dev fallback secret when TERRA_SECRET_KEY is not configured.
_DEV_FALLBACK_SECRET = secrets.token_hex(32)


def get_db_path() -> Path:
    env_path = os.getenv("TERRA_DB_PATH", "").strip()
    return Path(env_path) if env_path else DEFAULT_DB_PATH


def get_secret_key() -> bytes:
    secret = os.getenv("TERRA_SECRET_KEY", "").strip()
    return (secret or _DEV_FALLBACK_SECRET).encode("utf-8")


def _connect() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """Create users and parcels tables if they do not exist."""
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS parcels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                department TEXT DEFAULT '',
                municipality TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                nitrogen REAL NOT NULL,
                phosphorus REAL NOT NULL,
                potassium REAL NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                ph_value REAL NOT NULL,
                rainfall REAL NOT NULL,
                recommended_cluster INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
            """
        )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32
    )
    return f"scrypt${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, salt_b64, dk_b64 = stored_hash.split("$", 2)
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        # Hash mal formado o base64 inválido: se rechaza sin revelar el motivo.
        return False


def create_session_token(user_id: int, email: str) -> str:
    payload = {
        "uid": int(user_id),
        "email": email,
        "exp": int(datetime.now(UTC).timestamp()) + SESSION_TTL_SECONDS,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    sig = hmac.new(get_secret_key(), body.encode("ascii"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    return f"{body}.{sig_b64}"


def verify_session_token(token: str) -> dict[str, Any] | None:
    try:
        body, sig_b64 = token.split(".", 1)
        expected_sig = hmac.new(
            get_secret_key(), body.encode("ascii"), hashlib.sha256
        ).digest()
        expected_b64 = base64.urlsafe_b64encode(expected_sig).decode("ascii").rstrip("=")
        if not hmac.compare_digest(sig_b64, expected_b64):
            return None
        padded = body + "=" * (-len(body) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
            return None
        return payload
    except (ValueError, TypeError, AttributeError):
        # Token mal formado, base64/JSON inválido o payload que no es un objeto: sesión inválida.
        return None


def create_user(email: str, name: str, password: str) -> dict[str, Any]:
    init_db()
    now = datetime.now(UTC).isoformat()
    norm_email = email.strip().lower()
    pw_hash = hash_password(password)
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (norm_email, name.strip(), pw_hash, now),
        )
        user_id = cur.lastrowid
    return {"id": int(user_id), "email": norm_email, "name": name.strip(), "created_at": now}


def get_user_by_email(email: str) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, name, created_at FROM users WHERE id = ?",
            (int(user_id),),
        ).fetchone()
    return dict(row) if row else None


def list_parcels(user_id: int) -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, name, department, municipality, notes,
                   nitrogen, phosphorus, potassium, temperature,
                   humidity, ph_value, rainfall, recommended_cluster, created_at
            FROM parcels
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (int(user_id),),
        ).fetchall()
    return [_format_parcel(dict(r)) for r in rows]


def create_parcel(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
    init_db()
    now = datetime.now(UTC).isoformat()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO parcels (
                user_id, name, department, municipality, notes,
                nitrogen, phosphorus, potassium, temperature,
                humidity, ph_value, rainfall, recommended_cluster, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(user_id),
                data["name"].strip(),
                data.get("department", "").strip(),
                data.get("municipality", "").strip(),
                data.get("notes", "").strip(),
                float(data["Nitrogen"]),
                float(data["Phosphorus"]),
                float(data["Potassium"]),
                float(data["Temperature"]),
                float(data["Humidity"]),
                float(data["pH_Value"]),
                float(data["Rainfall"]),
                data.get("recommended_cluster"),
                now,
            ),
        )
        parcel_id = int(cur.lastrowid)
        row = conn.execute(
            """
            SELECT id, name, department, municipality, notes,
                   nitrogen, phosphorus, potassium, temperature,
                   humidity, ph_value, rainfall, recommended_cluster, created_at
            FROM parcels WHERE id = ?
            """,
            (parcel_id,),
        ).fetchone()
    return _format_parcel(dict(row))


def delete_parcel(user_id: int, parcel_id: int) -> bool:
    init_db()
    with _connect() as conn:
        cur = conn.execute(
            "DELETE FROM parcels WHERE id = ? AND user_id = ?",
            (int(parcel_id), int(user_id)),
        )
    return cur.rowcount > 0


def _format_parcel(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "department": row["department"],
        "municipality": row["municipality"],
        "notes": row["notes"],
        "values": {
            "Nitrogen": row["nitrogen"],
            "Phosphorus": row["phosphorus"],
            "Potassium": row["potassium"],
            "Temperature": row["temperature"],
            "Humidity": row["humidity"],
            "pH_Value": row["ph_value"],
            "Rainfall": row["rainfall"],
        },
        "recommendedCluster": row["recommended_cluster"],
        "createdAt": row["created_at"],
    }
