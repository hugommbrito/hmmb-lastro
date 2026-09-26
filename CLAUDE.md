# CLAUDE.md — Lastro

> **Provisório (F0-03).** Derivado de `docs/claude-ai-instructions-v3.md`. Os comandos reais de lint, typecheck e teste entram na F0-05 (backend) e na F0-17 (frontend); a F0-23 substitui este arquivo pela versão definitiva e cria os `CLAUDE.md` de `backend/` e `frontend/`.

## Fontes da verdade

Em conflito, vale a ordem:

1. Respostas do Hugo na sessão.
2. `docs/PLAN.md` (plano executável: tarefas, dependências, aceite, verificação) e `docs/decisions.md` (ADRs).
3. `docs/HMMB_Finance_Planejamento.md` (planejamento narrativo, v3).
4. `HMMB_Finance_Handoff.md` (handoff de 24/09/2026).
5. Wireframes em `docs/` (só UI).

Infra: `docs/infra.md` (inventário do host OCI, F0-01) e `docs/runbooks/coolify-lastro.md` (projeto no Coolify, F0-02). Instruções do projeto no Claude.ai: `docs/claude-ai-instructions-v3.md`.

## Produto e modelo

Lastro (nome de trabalho anterior: HMMB Finance) é um web app desktop-first, em pt-BR, multi-tenant, para um grupo fechado acompanhar investimentos pessoais: saldo, rentabilidade, alocação e movimentações. Não é app de gastos.

- Duas dimensões: física (Instituição → Conta → Ativo) e lógica (árvore de carteiras em ltree, até 8 níveis). Todo ativo tem conta fixa e carteira mutável.
- Caixa (`available_balance`) por conta, um por conta, na moeda da conta. Transferências são entre contas (caixa: `internal_transfer_out/in`; custódia: `custody_transfer_out/in`), nunca entre carteiras. Reclassificar de carteira não é operação financeira.
- `operations` é a fonte da verdade; posição, preço médio, caixa, lotes e patrimônio são projeções recomputáveis. Capital externo só muda com `external_deposit` e `withdrawal`.
- Multi-moeda BRL/USD/CAD/EUR: valores na moeda nativa, `fx_rates` (PTAX) no banco, moeda base por usuário (ADR-019). Renda fixa por lotes com FIFO (ADR-022). Preço médio em duas visões, sem rótulo fiscal (ADR-009). Catálogo global de instituições (ADR-016).
- Nome de exibição "Lastro" numa constante `APP_NAME` por app; o slug `lastro` só em identificadores de infra (ADR-023).

## Stack e infra

- Um repositório com `backend/`, `frontend/` e `docs/`, sem tooling de monorepo; cada app tem `package.json` e lockfile próprios (ADR-001).
- Frontend: React 19, Vite 8, TypeScript 5.9, MUI 9, TanStack Router e Query, React Hook Form, Zod 4, Recharts. Tipos e schemas gerados do OpenAPI do backend (openapi-typescript e orval), nunca escritos à mão.
- Backend: NestJS 11 com Fastify, Drizzle ORM, Zod via nestjs-zod, BullMQ, Passport + JWT, decimal.js. Postgres 16 (ltree, pgcrypto, pg_trgm) com RLS; Redis 7. Worker Python 3.12 só na Fase 2, como consumidor das projeções.
- npm, Node 24 (`.nvmrc`), ESLint + Prettier, Vitest; uv, ruff, pyright, pytest no worker; GitHub Actions; Conventional Commits (ADR-008).
- Produção no host OCI com Coolify; app e API na mesma origem (`lastro.hmmb.app.br` e `/api`); backups no OCI Object Storage (ADR-002, ADR-003).
- O Coolify segue a `main` com Watch Paths `backend/**` e `frontend/**`: merge que toca uma dessas pastas reconstrói e redeploya a imagem em produção. Os `Dockerfile`s e os arquivos que eles copiam precisam continuar buildando em todo commit. Até a F0-05, F0-17 e F0-21, `backend/` e `frontend/` contêm o spike S1; não os altere fora das tarefas que os substituem.

## Regras de trabalho

- Uma tarefa por vez, na ordem de `docs/PLAN.md`. Antes de começar, reler o ADR e o artefato de design que a tarefa cita. Não antecipar tarefas seguintes.
- Ambiguidade de requisito: perguntar antes de implementar. Se algo contradiz um ADR, parar e perguntar antes de alterar o ADR.
- ADR antes de código: decisão nova ou alterada entra em `docs/decisions.md`, ajusta `docs/PLAN.md` e o planejamento v3, e gera aviso ao Hugo se as instruções do Claude.ai precisarem mudar.
- Branch por tarefa (`<tipo>/<id-da-tarefa>-<slug>`, por exemplo `chore/f0-03-repo-structure`), criada a partir da `main` atualizada. Nunca commitar na `main`. Antes de cada commit, conferir `git branch --show-current` e abortar se não for a branch esperada: o Hugo troca de branch neste diretório entre rodadas.
- Commits em Conventional Commits, assinados via 1Password (se falhar com "Could not connect to socket", pedir para desbloquear e repetir). Push, PR e merge são do Hugo: ao terminar, entregar o comando `git push -u origin <branch>` e a URL de compare do GitHub.
- Ao concluir: lint, typecheck e testes verdes (quando existirem); `[x]` com a data na coluna Feito de `docs/PLAN.md`; se o contrato da API mudou, tipos do front regerados no mesmo PR.
- Nenhum segredo no repositório, no chat ou nos docs. Nenhum serviço pago novo sem aprovação do Hugo; dependência de plano gratuito fica atrás de uma interface.

## Regras de código (handoff §3 e §11)

- `strict: true`; nunca `any`; type assertion só com `eslint-disable-next-line` e justificativa.
- Validação sempre com Zod; schemas no backend expostos via OpenAPI (ADR-007).
- Dinheiro: `NUMERIC` no banco, string no driver, decimal.js no Node e `Decimal` no Python; nunca `number` ou float (`parseFloat` e `Number(...)` proibidos nos módulos de domínio). Uma regra de arredondamento única. Datas `YYYY-MM-DD`; timestamps ISO-8601 UTC; "hoje" e agendamentos em `America/Sao_Paulo`.
- Lógica de negócio só no NestJS; o frontend é UI e estado local. TWR, XIRR e snapshots só no worker (Fase 2).
- Drizzle ORM, com queries complexas no tagged template `sql`. Módulos NestJS um por domínio, cada um com module, controller, service e dto (ADR-024).
- Multi-tenant por RLS com `user_id` em toda tabela de usuário; a API conecta com role sem superusuário. Nunca desligar ou contornar RLS.
- Logs estruturados, sem valores financeiros nem payloads de usuário. Lockfiles versionados.
- Proibido sugerir: Next.js; serverless, BaaS ou no-code como alternativa arquitetural; ORM que não seja o Drizzle.
- Visual: desktop-first, tema dark "ocean", fonte Jost, denso e sóbrio; uma paleta no MVP (tokens em `docs/PLAN.md` §3.4).

## Comandos

Ainda não existem comandos de app: lint, typecheck e testes entram na F0-05 (backend) e na F0-17 (frontend). Hoje só há os builds do spike, que precisam passar antes de qualquer merge que toque as pastas:

```sh
docker build -t lastro-api:local backend/
docker build -t lastro-web:local frontend/
```
