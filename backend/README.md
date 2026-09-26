# backend

API do Lastro: NestJS 11 com Fastify, Drizzle ORM, Zod via nestjs-zod, BullMQ, Passport + JWT e decimal.js (ADR-006, ADR-024). A mesma imagem roda como `lastro-api` (HTTP) e, a partir da F0-21, como `lastro-jobs` com `HTTP_ENABLED=false` (ADR-021). O worker Python da Fase 2 é outro serviço.

## Estado

A F0-05 entregou o bootstrap: NestJS + Fastify em ESM (ADR-027), configuração por env validada com Zod, logs Pino sem payloads, clock em `America/Sao_Paulo`, `GET /api/health`, ESLint, Prettier e Vitest. Ainda não há banco, contrato OpenAPI, auth nem jobs (F0-08 em diante).

Em produção, `https://lastro.hmmb.app.br/api` **ainda roda o `server.js` do spike S1**: o `Dockerfile` do spike copia só `package.json` e `server.js` e executa `node server.js`. A F0-20 troca o Dockerfile pelo build do NestJS e a F0-21 faz o deploy; até lá `server.js`, `Dockerfile` e `.dockerignore` não mudam, e o `"type": "module"` do `package.json` também atende ao `server.js`.

## Comandos

Node 24 (`.nvmrc`), versões exatas com `save-exact` (`.npmrc`).

```sh
npm ci
npm run lint        # eslint + prettier --check
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # nest build → dist/
npm run start:dev   # nest start --watch; lê .env se existir (copie de .env.example)
npm start           # node dist/main.js; env vem do ambiente
npm run format      # prettier --write
```

Variáveis de ambiente: `src/common/config/env.ts` é a lista completa (`NODE_ENV`, `PORT`, `LOG_LEVEL`) e `.env.example` documenta os defaults de desenvolvimento. Ambiente inválido derruba o processo na subida listando as variáveis erradas, sem os valores.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/main.ts` | Bootstrap: Fastify, logger Pino, prefixo `api` (ADR-003), shutdown hooks. |
| `src/app.module.ts` | Módulo raiz. |
| `src/common/constants.ts` | `APP_NAME` (ADR-023) e `GLOBAL_PREFIX`. |
| `src/common/config/` | Schema Zod das variáveis de ambiente, `loadConfig()` e o token `APP_CONFIG`. |
| `src/common/clock/` | `Clock` (`now()` em UTC, `today()` em `America/Sao_Paulo`), `SystemClock`, `FixedClock` para testes, token `CLOCK`. |
| `src/common/logger/` | `nestjs-pino`: nível por env; por request só id, método, URL, status e duração; `pino-pretty` em desenvolvimento; healthcheck fora do log. |
| `src/health/` | `GET /api/health`. |
| `*.test.ts` ao lado do código | Vitest. `nest-di.test.ts` é o canário de decorators com metadata. |
| `server.js` | Spike S1, o que roda em produção até a F0-20. Fora do ESLint e do Prettier. |

Convenções: imports relativos levam `.js` (`moduleResolution: nodenext`); injeção por token (`CLOCK`, `APP_CONFIG`) para interfaces e por classe para serviços; `new Date()` só dentro do `Clock`; `process.env` só em `src/common/config`; regras do ADR-008 no `eslint.config.js` (assertion proibida, `parseFloat` e `Number(...)` proibidos, `eslint-disable` só com descrição).

## Deploy

O Coolify constrói `backend/Dockerfile` com Base Directory `/backend` e redeploya `lastro-api` a cada push na `main` que toque `backend/**` (Watch Paths). Qualquer mudança nesta pasta vai para produção no merge, então o build precisa passar antes:

```sh
docker build -t lastro-api:local backend/
```

Configuração completa em `docs/runbooks/coolify-lastro.md` (§4 e §6).
