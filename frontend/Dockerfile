# syntax=docker/dockerfile:1
# Imagem do spike S1 (F0-02): nginx servindo um index.html estático na raiz.
# A F0-17 traz o Vite; a F0-21 troca o COPY pelo build real e ajusta o nginx.conf.
FROM nginx:1.28-alpine
COPY index.html /usr/share/nginx/html/index.html
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
