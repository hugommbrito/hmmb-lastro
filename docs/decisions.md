# Registro de decisões (ADRs) — Lastro

Decisões arquiteturais e de produto, uma por entrada, em ordem cronológica. As decisões da seção 3 do handoff de 24/09/2026 continuam valendo, salvo onde um ADR abaixo as substitui. Toda decisão nova ou alterada entra aqui antes de virar código.

Cada entrada traz a decisão e as consequências no corpo; o contexto está nos campos Origem e Substitui. Status: `proposto`, `aceito`, `substituído por ADR-xxx`.

| ADR | Título | Data | Status |
|---|---|---|---|
| ADR-001 | Um repositório | 2026-09-24 | aceito |
| ADR-002 | Hospedagem na OCI com Coolify | 2026-09-24 | aceito |
| ADR-003 | Mesma origem para app e API | 2026-09-24 | aceito |
| ADR-004 | Autenticação | 2026-09-24 | aceito |
| ADR-005 | Redis no host | 2026-09-24 | aceito |
| ADR-006 | Versões | 2026-09-24 | aceito |
| ADR-007 | Contrato front/back | 2026-09-24 | aceito |
| ADR-008 | Tooling | 2026-09-24 | aceito |
| ADR-009 | Preço médio em duas visões | 2026-09-24 | aceito |
| ADR-010 | Caixa implícito | 2026-09-24 | aceito |
| ADR-011 | Migração por histórico completo | 2026-09-24 | aceito |
| ADR-012 | Edição de operações | 2026-09-24 | aceito |
| ADR-013 | F1 inteira em Node | 2026-09-24 | aceito |
| ADR-014 | KPIs da F1 | 2026-09-24 | aceito |
| ADR-015 | Ativos sem cotação | 2026-09-24 | aceito |
| ADR-016 | Catálogo global de instituições | 2026-09-24 | aceito |
| ADR-017 | Histórico após reclassificação | 2026-09-24 | aceito |
| ADR-018 | Operações Previstas | 2026-09-24 | aceito |
| ADR-019 | Multi-moeda | 2026-09-24 | aceito |
| ADR-020 | Ajustes de schema | 2026-09-24 | aceito |
| ADR-021 | Jobs em processo separado desde a F1 | 2026-09-24 | aceito |
| ADR-022 | Renda fixa por lotes | 2026-09-24 | aceito |
| ADR-023 | Nome | 2026-09-24 | aceito |
| ADR-024 | Módulos NestJS | 2026-09-24 | aceito |
| ADR-025 | Migrations, roles e deploy | 2026-09-24 | aceito |
| ADR-026 | Testes de banco | 2026-09-24 | aceito |

## ADR-001 — Um repositório

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff §3 "Repositórios" (dois repositórios independentes).

`hmmb-lastro` com `backend/`, `frontend/`, `docs/`. Sem tooling de monorepo: cada app tem `package.json` e lockfile próprios; CI e Coolify usam filtros de path. O `openapi.json` do backend é lido pelo front por caminho relativo (resolve E13).

## ADR-002 — Hospedagem na OCI com Coolify

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff §3 "Infra" (Hetzner + Vercel + R2) e planejamento v2 §4.

Projeto Coolify "lastro" com `lastro-web` (estático), `lastro-api`, `lastro-jobs` (mesma imagem da API com `HTTP_ENABLED=false`), Postgres 16 e Redis 7 como serviços; na F2 entra `lastro-worker`. Backups pelo agendador do Coolify para OCI Object Storage. Consequências: custo zero adicional; host compartilhado (R7); imagens arm64; base `node:24-slim` (glibc) por causa do argon2 nativo (R19).

## ADR-003 — Mesma origem para app e API

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

SPA em `lastro.hmmb.app.br`; API em `/api` (`setGlobalPrefix('api')`). Sem CORS; cookies `SameSite=Lax`; CSRF no refresh mitigado por header customizado obrigatório. Fallback: subdomínio `api.` no mesmo site com CORS credenciado (sub-tarefa condicional em F0-02).

## ADR-004 — Autenticação

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff D1 e Apêndice A (`users` só com e-mail).

E-mail + senha com argon2id; cadastro só por convite (token de uso único, 7 dias, criado por CLI ou rota admin); access JWT de 15 min em memória; refresh token opaco e rotativo em cookie httpOnly/Secure/Lax com path `/api/auth`, guardado por hash em `refresh_tokens`; reutilização de refresh revoga a família; reset de senha por link gerado por admin; `users.is_admin`. `users`, `auth_tokens` e `refresh_tokens` **não têm RLS** (o login e o refresh consultam antes de existir contexto de tenant) e recebem grants mínimos para a role da API.

## ADR-005 — Redis no host

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Serviço do Coolify, `maxmemory-policy noeviction`, AOF `everysec`, `maxmemory` 256 MB, sem porta pública.

## ADR-006 — Versões

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Planejamento v2 §4 (React 18, MUI v6).

React 19, MUI 9, Vite 8, TanStack Router/Query atuais, Zod 4, RHF 7, Recharts 3; TypeScript 5.9 fixo nos dois apps até typescript-eslint e openapi-typescript declararem 6/7; NestJS 11 por padrão, 12 só se o spike S2 provar nestjs-zod nele; Drizzle 0.45 + Kit 0.31; Node 24 LTS; Python 3.12 com pandas 3, scipy 1.18, psycopg 3.3, bullmq 3.2. Conjunto do front fixado no spike S0. Lockfiles versionados; Renovate mensal agrupado.

## ADR-007 — Contrato front/back

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

DTOs Zod no Nest via nestjs-zod; OpenAPI 3.1 exportado por script sem subir servidor para `backend/openapi.json` (versionado; CI falha se desatualizado). Front: `openapi-typescript` gera `src/api/schema.ts`; `orval` gera schemas Zod de formulário; ambos versionados e checados no CI. Convenções: dinheiro string decimal com ponto e sem milhar; datas `YYYY-MM-DD`; timestamps ISO-8601 UTC; erros `application/problem+json` (RFC 9457) com `errors[]` `{path, message}`; listas grandes com cursor opaco e `limit` ≤ 200; coleções pequenas sem paginação; sem envelope em recurso único; UUID v4. Cada tarefa de backend começa por DTOs e controller stub exportados no `openapi.json`, para a tarefa de front correspondente ter contrato.

## ADR-008 — Tooling

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

npm; Node 24 via `.nvmrc`; ESLint 10 flat + typescript-eslint type-aware + Prettier 3; assertion mecanizada (`consistent-type-assertions: never`, exceção só com `eslint-disable-next-line` com descrição obrigatória); `no-restricted-syntax` proibindo `parseFloat` e `Number(...)` nos módulos de domínio; Vitest 5 no front e no Nest; Python com uv, ruff, pyright, pytest; GitHub Actions; Conventional Commits validados no CI; trunk-based, branch por tarefa, PR com squash, CI verde obrigatório.

## ADR-009 — Preço médio em duas visões

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Planejamento v2 §9 (PM por instituição "padrão Receita").

Por conta (persistida na projeção) e consolidada por instrumento somando contas `individual` (sob demanda). Custos de aquisição entram no custo. `joint` e `corporate` só por conta. Nenhuma visão leva rótulo fiscal; o relatório de IR (F4) oferece as duas.

## ADR-010 — Caixa implícito

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Uma linha por evento; o saldo do `available_balance` deriva da tabela de sinais (§3.3). "Registrar aporte correspondente" ligado por padrão no lançamento manual e na compra inicial. Saldo negativo permitido e sinalizado. Transferências de caixa entre contas são par ligado por `linked_operation_id`, inclusive entre moedas; transferências de custódia de ativos entre contas (BTC da exchange para a Trust Wallet, portabilidade de ações) são par `custody_transfer_out/in` com quantidade e custo, sem caixa e sem P&L.

## ADR-011 — Migração por histórico completo

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Formato de importação canônico (JSON com Zod publicado no OpenAPI; CSV equivalente por entidade). Prompt documentado em `docs/` converte planilhas, extratos e notas via Claude.ai. Importação em duas etapas (validação com relatório por linha; aplicar em transação) cria `import_batches` de `kind = file`, operações com `source = migration` e `source_ref` único, desfazer por lote. O "aplicar" insere em lote e reconstrói a projeção uma vez por ativo e por conta ao final (não por operação).

## ADR-012 — Edição de operações

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

`manual` e `migration` podem ser editadas por `UPDATE` (preservando `seq`) e excluídas, com `before/after` em `audit_log`. Operações de IA só saem pelo desfazer do lote. Toda escrita reconstrói a projeção do ativo e da conta na mesma transação e, a partir da F2, enfileira recomputação de snapshots desde `occurred_at`.

## ADR-013 — F1 inteira em Node

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff D11 (worker Python já na F1).

NestJS é dono do motor de posições, das projeções (`position_events`, `position_lots`), dos jobs de dados de mercado e da valorização (`asset_valuations`). O worker Python entra na F2 como consumidor puro dessas tabelas mais `quotes`, `market_series` e `fx_rates`, escrevendo snapshots, TWR e XIRR. Se o BullMQ Python falhar no spike S5, o fallback preserva o BullMQ: um shim Node consome a fila e invoca o Python.

## ADR-014 — KPIs da F1

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Rentabilidade simples rotulada. Consolidado: `(valor atual − capital externo líquido) / capital externo líquido`, cada fluxo convertido à moeda base pela taxa da operação quando houver, senão pela `fx_rates` da data. Carteira: ganho não realizado (valor atual − custo aberto) mais proventos e P&L realizado dos ativos que estão hoje na carteira ("como está hoje"), dividido pelo custo total das compras; a UI mostra as duas parcelas separadas. "Variação do mês", "12 meses" e "vs CDI" precisam de posição e preço em data e entram na F2 com os snapshots.

## ADR-015 — Ativos sem cotação

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Todos os tipos aceitos desde a F1 com valor manual. Cotações automáticas de EUA e cripto na F2; cotas de fundos via dados abertos da CVM na F2.

## ADR-016 — Catálogo global de instituições

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

`institution_catalog` sem RLS, semeado (Clear, Avenue, Nubank, Sicredi, C6, Trust Wallet como `self_custody`, XP, Rico, BTG, Inter, Toro, Itaú, Bradesco, Santander, BB, Caixa, Binance, Mercado Bitcoin). `institutions.catalog_id` opcional, "outra" livre. Blueprints da F3 ligados ao catálogo.

## ADR-017 — Histórico após reclassificação

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

"Como está hoje" no MVP.

## ADR-018 — Operações Previstas

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Tabela, sync e tela de confirmação na F2; match com IA na F3.

## ADR-019 — Multi-moeda

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff 9.4 (BRL base, USD pela PTAX do dia) e planejamento v2 §6 "FX na operação".

Enum `currency_code` (BRL, USD, CAD, EUR). Contas, ativos e operações guardam valores na moeda nativa. **Uma conta por moeda**: `accounts.currency` é imutável depois da primeira operação e o caixa da conta tem a mesma moeda (validado no serviço e testado). Quando a moeda do ativo difere da da conta (cripto em USD numa conta BRL), a operação exige `cash_amount` na moeda da conta; o caixa usa `cash_amount`, e `fx_rate = cash_amount / total_value` fica registrado. `fx_rates(base, quote, date, rate, source)` global: `base` ∈ {USD, CAD, EUR}, `quote = BRL`, `rate` = unidades de BRL por 1 unidade da base (PTAX venda de fechamento, Olinda); cruzadas via BRL; dia sem cotação usa a última anterior. `users.base_currency` define a consolidação; na F1 a conversão é na leitura; na F2 snapshots carregam `base_currency` e trocar a base recomputa. Transferência entre contas de moedas diferentes é o par normal com valores em cada moeda; a taxa efetiva `out/in` absorve spread e IOF; um `tax` separado só quando o valor de saída for o bruto antes do IOF (nunca os dois).

## ADR-020 — Ajustes de schema

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff §1 lista de tipos (`stock_us`) e Apêndice A (`quotes (ticker, date)`, `source` texto).

`quotes` com chave `(market, symbol, date)`; `assets.market` enum (`b3`, `us`, `ca`, `eu`, `crypto`, `fund_br`) obrigatório quando há ticker; `stock_us` → `stock_intl`; `operations.source` enum + `source_ref`, com único parcial `(user_id, source, source_ref)`; `assets` único parcial `(account_id, market, ticker)`; `operations.seq` identity preservado em edição, ordenação `(occurred_at, prioridade por tipo, seq)`; `operations.metadata jsonb` por tipo (taxa e indexador do lote, fator de split); `quantity NUMERIC(30,18)`; `asset_valuations` com `kind` (`manual`, `curve`) e `value_kind` (`unit`, `total`); `archived_at` em contas e instituições; nome único entre carteiras irmãs; `nlevel(path) ≤ 8` (o wireframe diz "ilimitado"; 8 níveis cobrem qualquer uso humano e o limite sobe por migration); arredondamento: cálculo com 8 casas, saída com 2 half-up.

## ADR-021 — Jobs em processo separado desde a F1

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff §3 "Worker" no que toca aos jobs de dados de mercado (agora no NestJS).

Processadores BullMQ no mesmo código do NestJS, ativados por `JOBS_ENABLED`; em produção rodam no serviço `lastro-jobs` (`HTTP_ENABLED=false`) com pool de conexões próprio. Transações curtas por unidade de trabalho; chamadas HTTP a provedores fora de transação.

## ADR-022 — Renda fixa por lotes

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Planejamento v2 §9 "Projeções para renda fixa" (fórmulas por ativo, sem lotes).

Cada `buy` é um lote com data, principal e taxa/indexador próprios (`operations.metadata`, com default do ativo). `treasury_bond` e `debenture`: quantidade de títulos + preço unitário. `cdb`, `lci_lca` (inclui RDB dos cofrinhos): `quantity` em unidades de principal na moeda (preço unitário 1,0000 na aplicação). Curva calculada por lote e somada. Resgate (`sell`) informa o valor recebido; o motor consome lotes por FIFO proporcionalmente ao valor na curva de cada lote na data e deriva o principal consumido. `maturity` fecha todos os lotes. `amortization` reduz o principal pró-rata em todos os lotes (renda fixa) ou reduz o custo médio (FII e ações). `interest` (cupom) não altera principal. Come-cotas em fundos: `tax` com `quantity` reduz cotas e custo proporcional, sem caixa. Estado corrente dos lotes persistido em `position_lots` (projeção recomputável).

## ADR-023 — Nome

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

"Lastro" numa constante única (`APP_NAME`) por app. Slug `lastro` só em identificadores de infra (banco, serviços do Coolify).

## ADR-024 — Módulos NestJS

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff §3 "Módulos NestJS" (lista ampliada).

Além dos do handoff (`auth`, `users`, `institutions`, `accounts`, `portfolios`, `assets`, `operations`, `quotes`, `corporate-events`, `import`, `snapshots`), entram `admin`, `positions`, `valuations`, `dashboard`, `export`, `jobs`, e a infra `database`, `tenancy`, `common`. Um por domínio, cada um com module, controller, service e dto.

## ADR-025 — Migrations, roles e deploy

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: Handoff E3 (detalhamento de roles e migrations).

`db:bootstrap` (roda uma vez, como superusuário, senhas por env) cria as roles `lastro_owner`, `lastro_api`, `lastro_worker` fora do trilho de migrations. Migrations (rodam como `lastro_owner`) contêm só DDL, policies e `ALTER DEFAULT PRIVILEGES` concedendo à API o mínimo por tabela. Duas URLs de banco: `DATABASE_URL_OWNER` (migrate/seed no pre-start) e `DATABASE_URL` (servir). Pre-start toma `pg_advisory_lock` antes de migrar; toda migration é compatível com a versão anterior do código (deploys sobrepostos do Coolify). Seeds idempotentes (`ON CONFLICT DO UPDATE`) rodam no pre-start após as migrations. O SQL revisável é o gerado pelo `drizzle-kit generate`, versionado; `docs/schema.sql` é dump informativo, sem gate.

## ADR-026 — Testes de banco

- Data: 2026-09-24
- Status: aceito
- Origem: sessão de planejamento com o Hugo (respostas às decisões D1–D16 do handoff e revisões do plano).
- Substitui: —

Vitest com `pool: forks`; um banco por worker criado a partir de um template já migrado; truncamento entre testes; RLS exercida pelo mesmo caminho da aplicação (`runAsUser`). CI com Postgres 16 e Redis como serviços.
