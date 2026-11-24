# Project Terra — Multi-stage Docker build (Render / Railway / Cloud Run / VPS)
# Build: docker build -t project-terra .
# Run:   docker run -p 5000:5000 --env-file .env project-terra

# ---- Stage 1: Frontend build ----
FROM node:24-alpine AS frontend-builder
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python deps ----
FROM python:3.12-slim AS python-deps
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# ---- Stage 3: Runtime ----
FROM python:3.12-slim
WORKDIR /app

# Copy Python deps from stage 2
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy application code, models, and benchmark report
COPY api/ ./api/
COPY src/ ./src/
COPY data/ ./data/
COPY docs/real_data_benchmark.json ./docs/real_data_benchmark.json

# Create non-root user and writable data directory
RUN adduser --disabled-password --gecos "" appuser \
    && mkdir -p /var/data \
    && chown -R appuser:appuser /app /var/data
USER appuser

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PORT=5000
ENV TERRA_DB_PATH=/var/data/terra_app.db

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import os, urllib.request; p = os.getenv('PORT', '5000'); urllib.request.urlopen(f'http://127.0.0.1:{p}/api/health', timeout=3)"

CMD ["sh", "-c", "python -m uvicorn api.server:app --host 0.0.0.0 --port ${PORT:-5000}"]
