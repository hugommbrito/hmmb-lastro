# Lastro

Web app desktop-first, em pt-BR, para um grupo fechado de usuários acompanhar investimentos pessoais: saldo, rentabilidade, alocação e movimentações. Multi-tenant, sem monetização. Não é app de gastos. Nome de trabalho anterior: HMMB Finance.

## Estrutura

Um único repositório (ADR-001), sem tooling de monorepo: cada app tem `package.json` e lockfile próprios; CI e Coolify usam filtros de path.

| Pasta | Conteúdo |
|---|---|
| `backend/` | API NestJS + Fastify e processo de jobs (BullMQ). Hoje só o hello-world do spike S1; ver `backend/README.md`. |
| `frontend/` | SPA React + Vite. Hoje só a página estática do spike S1; ver `frontend/README.md`. |
| `docs/` | Plano, ADRs, planejamento narrativo, infra, runbooks e wireframes. |
| `.github/workflows/` | CI do GitHub Actions; os workflows entram na F0-07, F0-18 e F1-30. |
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

`https://lastro.hmmb.app.br` (SPA) e `https://lastro.hmmb.app.br/api` (API), no host OCI com Coolify (ADR-002, ADR-003). O Coolify segue a `main` com Watch Paths `backend/**` e `frontend/**`: todo merge que toca uma dessas pastas reconstrói e redeploya a imagem correspondente, então os `Dockerfile`s precisam continuar buildando em qualquer commit da `main`.

## Como trabalhar

- Uma tarefa por vez, na ordem de `docs/PLAN.md`; ao concluir, `[x]` com a data na coluna Feito.
- Branch por tarefa (`<tipo>/<id-da-tarefa>-<slug>`), Conventional Commits, PR para a `main`. Nunca commit direto na `main`.
- Decisão nova ou alterada vira ADR em `docs/decisions.md` antes do código.
- Nenhum segredo no repositório; nenhum serviço pago sem aprovação.
- Lint, typecheck e testes entram na F0-05 (backend) e na F0-17 (frontend).

## Licença

MIT, ver `LICENSE`.
