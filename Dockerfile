# ── Build stage ──────────────────────────────────────────────────
FROM node:24-slim AS builder

WORKDIR /app

# Install server deps
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm install --omit=dev
COPY server/ server/

# Install client deps and build
COPY client/package.json client/package-lock.json* client/
RUN cd client && npm install
COPY client/ client/
RUN cd client && npm run build

# ── Runtime stage ────────────────────────────────────────────────
FROM node:24-slim

WORKDIR /app

# Only the built output, server source, and prod dependencies
COPY --from=builder /app/server/ server/
COPY --from=builder /app/client/dist/ client/dist/

# The database lives on a persistent volume mounted at /data
ENV DB_PATH=/data/app.db
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Create the data directory (the volume mount will overlay it)
RUN mkdir -p /data

CMD ["node", "server/src/index.js"]
