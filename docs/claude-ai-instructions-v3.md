# Instruções do projeto no Claude.ai — resumo executivo (v3, 24/09/2026)

Cole este texto nas instruções do projeto "Lastro (HMMB Finance)" no Claude.ai, substituindo a versão baseada na v1. O que mudou em relação às instruções antigas está marcado com **[mudou]**.

## Produto

Lastro (nome de exibição; nome de trabalho anterior: HMMB Finance) é um web app desktop-first, em pt-BR, para acompanhar investimentos pessoais de um grupo fechado de usuários, multi-tenant, sem monetização. Foco: saldo, rentabilidade, alocação e movimentações. Não é app de gastos.

## Modelo

- Duas dimensões: **física** (Instituição → Conta → Ativo) e **lógica** (árvore de carteiras em ltree, até 8 níveis). Todo ativo tem uma conta fixa e uma carteira mutável.
- **[mudou]** O caixa (`available_balance`) é por **conta**, um por conta, na moeda da conta. Não existe caixa por carteira-raiz.
- **[mudou]** Transferências são **entre contas** (caixa: `internal_transfer_out/in`; custódia de ativos: `custody_transfer_out/in`), nunca "entre carteiras". Reclassificar ativo de carteira não é operação financeira.
- `operations` é a fonte da verdade; posição, PM, caixa, lotes e patrimônio são projeções recomputáveis. Capital externo só muda com `external_deposit` e `withdrawal`.
- **[mudou]** **Multi-moeda**: BRL, USD, CAD, EUR. Valores guardados na moeda nativa; `fx_rates` (PTAX) no banco; moeda base de consolidação escolhida pelo usuário.
- **[mudou]** Renda fixa por **lotes** (cada compra é um lote com taxa própria; resgates FIFO); valor na curva, bruto, sem marcação a mercado.
- **[mudou]** Preço médio em duas visões (por conta e consolidada por instrumento), sem rótulo fiscal.
- Instituições vêm de um **catálogo global**; o usuário pode cadastrar "outra".

## Stack e infra

- Frontend: React 19, Vite 8, TypeScript 5.9, MUI 9, TanStack Router e Query, React Hook Form, Zod 4, Recharts. Tipos e schemas gerados do OpenAPI do backend (openapi-typescript e orval), nunca escritos à mão.
- Backend: NestJS 11 com Fastify, Drizzle ORM, Zod com nestjs-zod, BullMQ, Passport + JWT, decimal.js. Postgres 16 (ltree, pgcrypto, pg_trgm) com RLS; Redis 7.
- **[mudou]** Worker Python 3.12 entra na **Fase 2** (snapshots, TWR, XIRR) como consumidor das projeções; na Fase 1 tudo é Node.
- **[mudou]** **Um único repositório** `hmmb-lastro` com `backend/`, `frontend/` e `docs/` (sem tooling de monorepo).
- **[mudou]** Hospedagem num servidor **OCI com Coolify** (web, api, jobs, Postgres, Redis); app e API na mesma origem (`lastro.hmmb.app.br` e `/api`). Backups no OCI Object Storage. Sem Hetzner, Vercel, R2 ou Upstash.
- npm, Node 24, ESLint + Prettier, Vitest; uv, ruff, pyright, pytest no worker; GitHub Actions; Conventional Commits.

## Regras de código

- `strict: true`; nunca `any`; type assertion só com `eslint-disable-next-line` com justificativa.
- Validação sempre com Zod; schemas no backend expostos via OpenAPI.
- Dinheiro: `NUMERIC` no banco, string no driver, decimal.js/Decimal no cálculo; nunca `number` ou float. Datas `YYYY-MM-DD`; "hoje" em `America/Sao_Paulo`.
- Lógica de negócio só no NestJS; o frontend é UI e estado local. Cálculos pesados (TWR, XIRR, snapshots) só no worker.
- Nunca desligar ou contornar RLS; nunca segredo no repositório; nenhum serviço pago sem aprovação.
- Ambiguidade de requisito: perguntar antes de implementar. Uma tarefa por vez, na ordem de `docs/PLAN.md`; decisão nova vira ADR em `docs/decisions.md`.
- Proibido sugerir: Next.js; serverless, BaaS ou no-code como alternativa; ORM que não seja o Drizzle.

## Fontes

`docs/PLAN.md` (plano executável), `docs/decisions.md` (ADRs), `docs/HMMB_Finance_Planejamento.md` v3, `HMMB_Finance_Handoff.md`, wireframes em `docs/`. Em conflito: respostas do Hugo > PLAN.md e decisions.md > planejamento v3 > handoff > wireframes (só UI).
