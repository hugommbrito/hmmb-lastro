# frontend

SPA do Lastro: React 19, Vite 8, TypeScript 5.9, MUI 9 com o tema dos wireframes, TanStack Router (file-based) e Query, React Hook Form, Zod 4 e Recharts (ADR-006). Tipos e schemas vêm do `backend/openapi.json` via openapi-typescript e orval, nunca escritos à mão (ADR-007). Só UI e estado local: a lógica de negócio fica no backend.

## O que existe hoje: só o spike S1

Tudo nesta pasta é o estático descartável do spike S1 (F0-02), em produção em `https://lastro.hmmb.app.br`. Nada aqui é código de produto.

| Arquivo | Papel no spike | Substituído por |
|---|---|---|
| `index.html` | Página que chama `/api/health` na mesma origem, sem CORS (ADR-003). | F0-17 (bootstrap Vite + React) |
| `Dockerfile` | `nginx:1.28-alpine` servindo o `index.html` na raiz, healthcheck com `wget`. | F0-20 (build Vite + nginx com headers de segurança) |
| `.dockerignore` | Exclui `node_modules` e o próprio Dockerfile do contexto. | continua |

Ainda não há lint, typecheck, testes nem build; entram na F0-17. Os comandos definitivos do app chegam a este README e ao `CLAUDE.md` na F0-23.

## Deploy

O Coolify constrói `frontend/Dockerfile` com Base Directory `/frontend` e redeploya `lastro-web` a cada push na `main` que toque `frontend/**` (Watch Paths). Qualquer mudança nesta pasta vai para produção no merge, então o build precisa passar antes:

```sh
docker build -t lastro-web:local frontend/
```

Nenhuma rota da SPA pode começar com `/api`: o Traefik roteia `PathPrefix(/api)` para a API. Configuração completa em `docs/runbooks/coolify-lastro.md` (§4 e §6).
