# backend

API do Lastro: NestJS 11 com Fastify, Drizzle ORM, Zod via nestjs-zod, BullMQ, Passport + JWT e decimal.js (ADR-006, ADR-024). A mesma imagem roda como `lastro-api` (HTTP) e, a partir da F0-21, como `lastro-jobs` com `HTTP_ENABLED=false` (ADR-021). O worker Python da Fase 2 é outro serviço.

## O que existe hoje

Nada aqui é código de produto. O que roda em produção em `https://lastro.hmmb.app.br/api` ainda é o hello-world descartável do spike S1 (F0-02); a F0-04 só fixou o conjunto de versões.

| Arquivo | Origem | Papel | Substituído por |
|---|---|---|---|
| `server.js` | spike S1 | Servidor `node:http` sem framework. `GET /api/health` faz um self-test do argon2 e ecoa o path recebido, provando que o prefixo `/api` chega inteiro pelo Traefik (ADR-003). | F0-05 (bootstrap NestJS) |
| `Dockerfile` | spike S1 | Multi-stage sobre `node:24-slim`, `npm ci --omit=dev` e `node server.js`, healthcheck com `fetch` do próprio Node. | F0-20 (Dockerfile definitivo) |
| `.dockerignore` | spike S1 | Exclui `node_modules`, `.env*` e o próprio Dockerfile do contexto. | continua |
| `package.json`, `package-lock.json`, `.npmrc` | F0-04 | Conjunto de versões do ADR-006 fixado em versões exatas (`save-exact`): NestJS 11 com adapter Fastify, Drizzle 0.45 e Kit 0.31, Zod 4.6, TypeScript 5.9, Vitest 5, `@types/node` 24; `argon2` continua porque o `server.js` o importa. `"type": "module"` também é herança do `server.js`. | F0-05 (scripts, ESLint, Prettier, Vitest, decisão ESM × CJS) |
| `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` | F0-04 | Mínimo para `nest build` compilar: `strict`, decorators, `nodenext`. | F0-05 (config definitiva) |
| `src/main.ts` | F0-04 | Placeholder vazio para o build ter um arquivo de entrada. | F0-05 (bootstrap real) |

Comandos que já funcionam (Node 24, ver `.nvmrc`):

```sh
npm ci
npm run build   # nest build, vazio até a F0-05
```

Ainda não há lint, typecheck nem testes; entram na F0-05. Os comandos definitivos do app chegam a este README e ao `CLAUDE.md` na F0-23.

## Deploy

O Coolify constrói `backend/Dockerfile` com Base Directory `/backend` e redeploya `lastro-api` a cada push na `main` que toque `backend/**` (Watch Paths). Qualquer mudança nesta pasta vai para produção no merge, então o build precisa passar antes:

```sh
docker build -t lastro-api:local backend/
```

Configuração completa em `docs/runbooks/coolify-lastro.md` (§4 e §6).
