FROM python:3.11-slim
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 predictiq
RUN chown -R predictiq:predictiq /app

# Install Python dependencies (as root, before switching user)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directories for saved models with correct ownership
RUN mkdir -p saved_models && chown predictiq:predictiq saved_models

USER predictiq

# Copy application code
COPY --chown=predictiq:predictiq . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=60s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "main.py"]
