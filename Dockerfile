# Project Terra — Multi-stage Docker build
# Build: docker build -t project-terra .
# Run:   docker run -p 5000:5000 project-terra

# ---- Stage 1: Frontend build ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python deps ----
FROM python:3.12-slim AS python-deps
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Stage 3: Runtime ----
FROM python:3.12-slim
WORKDIR /app

# Copy Python deps from stage 2
COPY --from=python-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy application code
COPY api/ ./api/
COPY src/ ./src/
COPY data/ ./data/

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "5000"]