# ═══════════════════════════════════════════════════════════════
#  AI Analytics ML Service — Dockerfile
#  Mirrors the structure of ml-service/Dockerfile exactly.
#  Runs ai_dashboard_ml.py (FastAPI) on port 8001.
#  Deploy on Railway as a separate service pointing to /ai-ml-service
# ═══════════════════════════════════════════════════════════════

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (mirrors existing ml-service security posture)
RUN useradd -m -u 1000 predictiq
RUN chown -R predictiq:predictiq /app

# Install Python dependencies (as root before switching user)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

USER predictiq

# Copy application code
COPY --chown=predictiq:predictiq . .

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD curl -f http://localhost:8001/ai-ml/health || exit 1

CMD ["python", "main.py"]
