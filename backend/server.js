// Hello-world descartável do spike S1 (F0-02).
//
// Prova três coisas no host arm64 do Coolify:
//   1. a imagem node:24-slim (glibc) carrega e executa o binário nativo do argon2 (R19);
//   2. GET /api/health responde 200 com o path recebido, para mostrar que o prefixo
//      /api chegou inteiro pelo Traefik (ADR-003: a API usa setGlobalPrefix('api'));
//   3. qualquer outro path responde 404 ecoando o que chegou. Se o Coolify aplicar
//      Strip Prefix, o Traefik entrega /health e a resposta é 404, que denuncia o problema.
//
// Sem NestJS, sem framework: a F0-05 substitui este arquivo.

import { createServer } from "node:http";
import argon2 from "argon2";

const APP_NAME = "Lastro";
const PORT = Number(process.env.PORT ?? 3000);

// Parâmetros baixos de propósito: o objetivo é carregar o binário nativo, não medir custo.
async function argon2SelfTest() {
  const hash = await argon2.hash("spike", {
    type: argon2.argon2id,
    memoryCost: 2 ** 12,
    timeCost: 2,
    parallelism: 1,
  });
  return argon2.verify(hash, "spike");
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
  return status;
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const echo = {
    path: pathname,
    receivedUrl: req.url,
    // O middleware StripPrefix do Traefik preenche este header quando remove o prefixo.
    forwardedPrefix: req.headers["x-forwarded-prefix"] ?? null,
    forwardedHost: req.headers["x-forwarded-host"] ?? null,
  };

  let status;
  if (req.method === "GET" && pathname === "/api/health") {
    try {
      const ok = await argon2SelfTest();
      status = send(res, ok ? 200 : 500, {
        status: ok ? "ok" : "argon2-verify-failed",
        app: APP_NAME,
        ...echo,
        argon2: ok,
        node: process.version,
        arch: process.arch,
        platform: process.platform,
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch (error) {
      status = send(res, 500, {
        status: "argon2-error",
        app: APP_NAME,
        ...echo,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (req.method === "GET" && pathname === "/") {
    status = send(res, 200, { app: APP_NAME, message: "lastro-api spike; use /api/health", ...echo });
  } else {
    status = send(res, 404, {
      status: "not-found",
      app: APP_NAME,
      ...echo,
      hint: "Se você esperava /api/health e chegou /health, o Strip Prefix está ligado no Coolify.",
    });
  }
  console.log(`${req.method} ${req.url} -> ${status}`);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`${APP_NAME} api spike listening on :${PORT} (${process.platform}/${process.arch}, node ${process.version})`);
});

// docker stop envia SIGTERM; fechar o servidor evita esperar o timeout de 10 s.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
