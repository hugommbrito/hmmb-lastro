# backend

API do Lastro: NestJS 11 com Fastify, Drizzle ORM, Zod via nestjs-zod, BullMQ, Passport + JWT e decimal.js (ADR-006, ADR-024). A mesma imagem roda como `lastro-api` (HTTP) e, a partir da F0-21, como `lastro-jobs` com `HTTP_ENABLED=false` (ADR-021). O worker Python da Fase 2 é outro serviço.

## O que existe hoje: só o spike S1

Tudo nesta pasta é o hello-world descartável do spike S1 (F0-02), em produção em `https://lastro.hmmb.app.br/api`. Nada aqui é código de produto.

| Arquivo | Papel no spike | Substituído por |
|---|---|---|
| `server.js` | Servidor `node:http` sem framework. `GET /api/health` faz um self-test do argon2 e ecoa o path recebido, provando que o prefixo `/api` chega inteiro pelo Traefik (ADR-003). | F0-05 (bootstrap NestJS) |
| `package.json` e `package-lock.json` | Só a dependência `argon2`, para provar o prebuild glibc em arm64. | F0-04 (versões, ADR-006) e F0-05 |
| `Dockerfile` | Multi-stage sobre `node:24-slim`, healthcheck com `fetch` do próprio Node. | F0-20 (Dockerfile definitivo) |
| `.dockerignore` | Exclui `node_modules`, `.env*` e o próprio Dockerfile do contexto. | continua |

Ainda não há lint, typecheck nem testes; entram na F0-05. Os comandos definitivos do app chegam a este README e ao `CLAUDE.md` na F0-23.

## Deploy

O Coolify constrói `backend/Dockerfile` com Base Directory `/backend` e redeploya `lastro-api` a cada push na `main` que toque `backend/**` (Watch Paths). Qualquer mudança nesta pasta vai para produção no merge, então o build precisa passar antes:

```sh
docker build -t lastro-api:local backend/
```

Configuração completa em `docs/runbooks/coolify-lastro.md` (§4 e §6).
