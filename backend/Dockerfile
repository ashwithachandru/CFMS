# Multi-stage production Dockerfile for CFMS Backend
FROM node:20-bookworm-slim AS base

# Install Python3, OCR libraries, curl (for healthcheck), and graphics dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Install Python OCR dependencies (optional native OCR accelerator)
RUN pip3 install --no-cache-dir --break-system-packages opencv-python-headless rapidocr-onnxruntime || true

# Copy source code
COPY . .

# Create uploads directory and ensure correct permissions
RUN mkdir -p uploads && chown -R node:node /app

# Run as non-root user for security
USER node

EXPOSE 4000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "server.js"]
