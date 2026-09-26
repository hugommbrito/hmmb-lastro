# frontend

SPA do Lastro: React 19, Vite 8, TypeScript 5.9, MUI 9 com o tema dos wireframes, TanStack Router (file-based) e Query, React Hook Form, Zod 4 e Recharts (ADR-006). Tipos e schemas vêm do `backend/openapi.json` via openapi-typescript e orval, nunca escritos à mão (ADR-007). Só UI e estado local: a lógica de negócio fica no backend.

## O que existe hoje

Nada aqui é código de produto. O que roda em produção em `https://lastro.hmmb.app.br` ainda é o estático descartável do spike S1 (F0-02); a F0-04 só fixou o conjunto de versões.

| Arquivo | Origem | Papel | Substituído por |
|---|---|---|---|
| `index.html` | spike S1 | Página que chama `/api/health` na mesma origem, sem CORS (ADR-003). | F0-17 (bootstrap Vite + React) |
| `Dockerfile` | spike S1 | `nginx:1.28-alpine` servindo o `index.html` na raiz, healthcheck com `wget`. Não usa o `package.json`. | F0-20 (build Vite + nginx com headers de segurança) |
| `.dockerignore` | spike S1 | Exclui `node_modules` e o próprio Dockerfile do contexto. | continua |
| `package.json`, `package-lock.json`, `.npmrc` | F0-04 | Conjunto de versões do ADR-006 fixado em versões exatas (`save-exact`): React 19.3, MUI 9.4 com Emotion, TanStack Router (com o plugin do Vite) e Query, React Hook Form com `@hookform/resolvers`, Zod 4.6, Recharts 3, Vite 8.3, `@vitejs/plugin-react`, TypeScript 5.9, Vitest 5. | F0-17 (scripts de lint, typecheck e teste; Testing Library) |

Comandos que já funcionam (Node 24, ver `.nvmrc`):

```sh
npm ci
npm run build   # vite build do index.html do spike, sem vite.config até a F0-17
```

Ainda não há lint, typecheck nem testes; entram na F0-17. Os comandos definitivos do app chegam a este README e ao `CLAUDE.md` na F0-23.

## Deploy

O Coolify constrói `frontend/Dockerfile` com Base Directory `/frontend` e redeploya `lastro-web` a cada push na `main` que toque `frontend/**` (Watch Paths). Qualquer mudança nesta pasta vai para produção no merge, então o build precisa passar antes:

```sh
docker build -t lastro-web:local frontend/
```

Nenhuma rota da SPA pode começar com `/api`: o Traefik roteia `PathPrefix(/api)` para a API. Configuração completa em `docs/runbooks/coolify-lastro.md` (§4 e §6).
