# ─── Tales of Skara Brae — production container ─────────────────────────
# Multi-stage: build with Node, serve with lightweight Node (Nitro) on :8080
# Usage:
#   docker build -t tales-of-skara-brae .
#   docker run --rm -p 8080:8080 tales-of-skara-brae
# Then open http://localhost:8080 in your desktop browser.

# ── Build stage ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install OS deps needed by native modules / sharp-less canvas-free build
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# Production build targets the Node server preset (see vite.config.ts)
ENV DOCKER=1
ENV NODE_ENV=production
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=8080

# Nitro node-server output (when DOCKER=1) lives under .output
# Vercel preset falls back under .vercel — we only ship node-server here.
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json

# Non-root user
RUN useradd -r -u 10001 -g root appuser \
  && chown -R appuser:root /app
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Nitro node-server entry
CMD ["node", ".output/server/index.mjs"]
