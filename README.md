# Lastro

Web app desktop-first, em pt-BR, para um grupo fechado de usuários acompanhar investimentos pessoais: saldo, rentabilidade, alocação e movimentações. Multi-tenant, sem monetização. Não é app de gastos. Nome de trabalho anterior: HMMB Finance.

## Estrutura

Um único repositório (ADR-001), sem tooling de monorepo: cada app tem `package.json` e lockfile próprios; CI e Coolify usam filtros de path.

| Pasta | Conteúdo |
|---|---|
| `backend/` | API NestJS + Fastify e processo de jobs (BullMQ). Bootstrap da F0-05 em `src/`; em produção ainda roda o hello-world do spike S1 até a F0-20; ver `backend/README.md`. |
| `frontend/` | SPA React + Vite. Hoje só a página estática do spike S1; ver `frontend/README.md`. |
| `docs/` | Plano, ADRs, planejamento narrativo, infra, runbooks e wireframes. |
| `.github/workflows/` | CI do GitHub Actions; os workflows entram na F0-07, F0-18 e F1-30. |
| `docker-compose.dev.yml` | Postgres 16 e Redis 7 para desenvolvimento local, com os parâmetros de produção (F0-06). |
| `CLAUDE.md` | Instruções para sessões do Claude Code neste repositório (provisório até a F0-23). |

## Documentos

- `docs/PLAN.md`: plano executável, fonte da verdade do escopo e da ordem de execução. O progresso fica na coluna Feito.
- `docs/decisions.md`: registro de decisões (ADRs).
- `docs/HMMB_Finance_Planejamento.md`: planejamento narrativo (v3).
- `HMMB_Finance_Handoff.md`: handoff de 24/09/2026.
- `docs/infra.md` e `docs/runbooks/coolify-lastro.md`: host OCI e projeto no Coolify.
- `docs/Finance App Wireframes.html` (fonte legível dos tokens e histórias) e `docs/HMMB Finance Wireframes (offline).html` (bundle autocontido, abre sem rede).

Em conflito: respostas do Hugo > `PLAN.md` e `decisions.md` > planejamento v3 > handoff > wireframes (só UI).

## Stack

React 19, Vite 8, TypeScript 5.9, MUI 9, TanStack Router e Query; NestJS 11 com Fastify, Drizzle ORM, Zod via nestjs-zod, BullMQ, decimal.js; Postgres 16 com RLS e Redis 7; worker Python 3.12 a partir da Fase 2. Versões em ADR-006, tooling em ADR-008. Node 24 (`.nvmrc`) e npm.

## Produção

`https://lastro.hmmb.app.br` (SPA) e `https://lastro.hmmb.app.br/api` (API), no host OCI com Coolify (ADR-002, ADR-003). O Coolify segue a `main` com Watch Paths `backend/**` e `frontend/**`: todo push na `main` que toca uma dessas pastas reconstrói e redeploya a imagem correspondente, então os `Dockerfile`s precisam continuar buildando em qualquer commit da `main`.

## Desenvolvimento local

Node 24 (`.nvmrc`) e Docker. Banco e Redis sobem pelo compose de desenvolvimento, presos ao loopback; a API e o front rodam fora do Docker com `npm run start:dev` em cada app.

```sh
docker compose -f docker-compose.dev.yml up -d --wait
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml down      # mantém os volumes; -v apaga os dados
```

Senhas e portas de desenvolvimento têm default no próprio compose; um `.env` na raiz sobrescreve (ver `.env.example`).

## Como trabalhar

- Uma tarefa por vez, na ordem de `docs/PLAN.md`; ao concluir, `[x]` com a data na coluna Feito.
- Conventional Commits. Modo provisório até haver uso real em produção: commits direto na `main`. Depois, branch por tarefa (`<tipo>/<id-da-tarefa>-<slug>`) e PR para a `main` (ADR-008). Detalhes em `CLAUDE.md`.
- Decisão nova ou alterada vira ADR em `docs/decisions.md` antes do código.
- Nenhum segredo no repositório; nenhum serviço pago sem aprovação.
- Backend: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` (F0-05). Frontend: `npm ci` e `npm run build` (F0-04); lint, typecheck e testes entram na F0-17.

## Licença

MIT, ver `LICENSE`.
