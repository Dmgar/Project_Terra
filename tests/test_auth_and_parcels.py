"""Tests for hardened CORS allow-list, authentication sessions, and saved parcels."""

from pathlib import Path

from fastapi.testclient import TestClient

from api.server import app, parse_allowed_origins


def test_cors_hardening_rejects_wildcards_and_enforces_explicit_origins():
    assert parse_allowed_origins("https://terra.example.com/, https://*.vercel.app, *") == [
        "https://terra.example.com"
    ]
    client = TestClient(app)

    # Disallowed arbitrary vercel subdomain should NOT receive CORS allow header
    res_bad = client.options(
        "/api/health",
        headers={
            "Origin": "https://evil-attacker.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in res_bad.headers

    # Local dev origin in explicit allow-list receives credentials-enabled CORS
    res_ok = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res_ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res_ok.headers.get("access-control-allow-credentials") == "true"


def test_auth_session_and_parcels_crud_with_user_isolation(
    tmp_path: Path, monkeypatch
):
    monkeypatch.setenv("TERRA_DB_PATH", str(tmp_path / "test_terra.db"))
    monkeypatch.setenv("TERRA_SECRET_KEY", "test-secret-key-for-unit-tests")

    client_a = TestClient(app)
    client_b = TestClient(app)

    # Unauthenticated access is blocked
    assert client_a.get("/api/auth/me").status_code == 401
    assert client_a.get("/api/parcels").status_code == 401

    # Register User A
    reg = client_a.post(
        "/api/auth/register",
        json={
            "email": "agricultor@terra.co",
            "name": "Camila Agro",
            "password": "securepassword123",
        },
    )
    assert reg.status_code == 201
    assert reg.json()["user"]["email"] == "agricultor@terra.co"
    assert "terra_session" in reg.cookies

    # Duplicate email returns 409
    dup = client_a.post(
        "/api/auth/register",
        json={
            "email": "agricultor@terra.co",
            "name": "Otra Persona",
            "password": "securepassword123",
        },
    )
    assert dup.status_code == 409

    # Session cookie authenticates /api/auth/me
    me = client_a.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["name"] == "Camila Agro"

    # Save a parcel
    created = client_a.post(
        "/api/parcels",
        json={
            "name": "Lote Alto Boyacá",
            "department": "Boyacá",
            "municipality": "Toca",
            "notes": "Suelo franco para papa y trigo",
            "Nitrogen": 115,
            "Phosphorus": 48,
            "Potassium": 160,
            "Temperature": 15.2,
            "Humidity": 82,
            "pH_Value": 5.6,
            "Rainfall": 125,
            "recommended_cluster": 2,
        },
    )
    assert created.status_code == 201
    parcel_id = created.json()["parcel"]["id"]

    # List parcels for User A
    listed = client_a.get("/api/parcels")
    assert listed.status_code == 200
    assert len(listed.json()["parcels"]) == 1
    assert listed.json()["parcels"][0]["name"] == "Lote Alto Boyacá"

    # Register User B and ensure User B cannot see or delete User A's parcel
    reg_b = client_b.post(
        "/api/auth/register",
        json={
            "email": "otro@terra.co",
            "name": "Luis Campo",
            "password": "anotherpassword99",
        },
    )
    assert reg_b.status_code == 201
    assert client_b.get("/api/parcels").json()["parcels"] == []
    assert client_b.delete(f"/api/parcels/{parcel_id}").status_code == 404

    # User A deletes own parcel and logs out
    assert client_a.delete(f"/api/parcels/{parcel_id}").status_code == 200
    assert client_a.get("/api/parcels").json()["parcels"] == []

    assert client_a.post("/api/auth/logout").status_code == 200
    assert client_a.get("/api/auth/me").status_code == 401

    # Login again with Bearer token check
    login_bad = client_a.post(
        "/api/auth/login",
        json={"email": "agricultor@terra.co", "password": "wrongpassword"},
    )
    assert login_bad.status_code == 401

    login_ok = client_a.post(
        "/api/auth/login",
        json={"email": "agricultor@terra.co", "password": "securepassword123"},
    )
    assert login_ok.status_code == 200
    token = login_ok.json()["token"]
    bearer_client = TestClient(app)
    assert (
        bearer_client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 200
    )
