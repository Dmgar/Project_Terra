# Guía de Despliegue Productivo — Project Terra

Project Terra está diseñado para desplegarse como un **contenedor Docker unificado** (FastAPI + SPA React compilado + modelos 7D + SQLite persistente) o en **topología dividida** (Frontend en Vercel/Netlify + Backend en Docker/Cloud Run/Render).

---

## 1. Variables de entorno (`.env.example`)

| Variable | Ejemplo | Descripción |
| :--- | :--- | :--- |
| `PORT` | `5000` (o inyectado por Cloud Run / Render) | Puerto HTTP de Uvicorn. |
| `ALLOWED_ORIGINS` | `https://terra.ejemplo.com` | Lista explícita separada por comas (rechaza wildcards `*`). |
| `TERRA_SECRET_KEY` | `<64 hex chars>` | Clave HMAC-SHA256 para firmar sesiones (`python -c "import secrets; print(secrets.token_hex(32))"`). |
| `TERRA_DB_PATH` | `/var/data/terra_app.db` | Ruta persistente de SQLite para cuentas y parcelas guardadas. |
| `TERRA_COOKIE_SECURE` | `true` | Obligatorio en producción HTTPS. |
| `TERRA_COOKIE_SAMESITE` | `lax` (`none` si frontend y backend tienen distinto dominio HTTPS) | Política `SameSite` de cookies `HttpOnly`. |
| `VITE_API_BASE_URL` | *(vacío en despliegue unificado)* | URL del backend solo si el frontend se publica aparte en CDN/Vercel. |

---

## 2. Despliegue en Google Cloud Run (`terra-515715`)

> **Nota:** Cloud Run escala a cero y es sin estado por defecto; si necesitas persistencia duradera de `/api/parcels` entre reinicios de contenedor, monta un volumen GCS FUSE / Cloud SQL o usa Render Disk.

```bash
# 1. Habilitar APIs (una sola vez)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=terra-515715

# 2. Construir y desplegar desde el Dockerfile (sin afectar otros despliegues)
gcloud run deploy project-terra \
  --project=terra-515715 \
  --region=us-central1 \
  --source=. \
  --allow-unauthenticated \
  --memory=1Gi \
  --set-env-vars="TERRA_COOKIE_SECURE=true,TERRA_COOKIE_SAMESITE=lax,TERRA_DB_PATH=/var/data/terra_app.db"
```

---

## 3. Despliegue en Render (1 clic con `render.yaml`)

1. Conecta el repositorio de GitHub en **Render → New → Blueprint**.
2. Render detecta automáticamente [render.yaml](../render.yaml):
   - Construye el [Dockerfile](../Dockerfile) multi-etapa.
   - Monta disco persistente de 1 GB en `/var/data` para SQLite (`TERRA_DB_PATH`).
   - Autogenera `TERRA_SECRET_KEY` y verifica `/api/health`.
3. Define `ALLOWED_ORIGINS` con la URL asignada (ej. `https://project-terra.onrender.com`).

---

## 4. Despliegue local / VPS con Docker Compose

```bash
cp .env.example .env
# Edita TERRA_SECRET_KEY y ALLOWED_ORIGINS en .env
docker compose up -d --build
# Verifica: http://localhost:5000/api/health
```
