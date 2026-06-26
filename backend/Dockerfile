# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production ───────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Render sets PORT at runtime; this is only the default for local docker runs
EXPOSE 3001

CMD ["node", "dist/server.js"]
