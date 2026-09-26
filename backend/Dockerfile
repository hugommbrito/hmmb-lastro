# syntax=docker/dockerfile:1
# Imagem do spike S1 (F0-02). Multi-stage sobre node:24-slim (glibc) por causa do
# binário nativo do argon2 (ADR-002, R19). O Coolify constrói no próprio host arm64.
# O estágio deps não instala compiladores de propósito: o objetivo é confirmar que o
# prebuild linux-arm64-glibc do argon2 é usado. Se o build cair em node-gyp, o spike
# registra isso e a F0-21 decide se adiciona python3/make/g++.

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js ./
USER node
EXPOSE 3000
# node:24-slim não tem curl nem wget; o healthcheck usa o fetch do próprio Node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
