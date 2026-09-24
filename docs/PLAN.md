# Lastro (HMMB Finance) — Plano de implementação

> Aprovado pelo Hugo em 24/09/2026. Fonte da verdade do escopo e da ordem de execução. ADRs em `docs/decisions.md`; planejamento narrativo em `docs/HMMB_Finance_Planejamento.md` (v3). Ao concluir uma tarefa (lint, typecheck e testes verdes), troque `[ ]` por `[x]` na coluna Feito e anote a data.

## Contexto

O handoff de 24/09/2026 consolidou o modelo (planejamento v2 + Operações Previstas), corrigiu 20 erratas e deixou 16 decisões em aberto. Esta sessão fechou as decisões numa única rodada com o Hugo. Três respostas mudaram premissas do handoff de propósito e foram absorvidas: um único repositório (`hmmb-lastro`, com `backend/`, `frontend/`, `docs/`); hospedagem inteira num servidor OCI em Toronto já operado por Coolify, no lugar de Hetzner + Vercel + R2; e multi-moeda (BRL, USD, CAD, EUR) com moeda base escolhida pelo usuário.

Estado do workspace: só o handoff, `docs/HMMB_Finance_Planejamento.md` (v2), `docs/Finance App Wireframes.html`, `docs/ui_proposal/` e `docs/HMMB Finance Wireframes (offline).html`. Nenhum código. O arquivo "offline" é um bundle autocontido do mesmo wireframe (script da aplicação idêntico, com React, Babel e os dois `.jsx` embutidos): abre no navegador sem rede e é a referência visual para as tarefas de front; o arquivo original continua sendo a fonte legível dos tokens, histórias e critérios.

Como ler: §1 respostas da rodada; §2 ADRs; §3 artefatos de design e regras; §4 tarefas em ordem de execução; §5 spikes; §6 caminho crítico; §7 riscos; §8 marcos. Tamanhos: P até meio dia, M até dois dias. Execução: uma tarefa por vez, na ordem listada.

---

## 1. Perguntas e premissas — respostas da rodada única

| Item | Decisão do Hugo |
|---|---|
| D1 Auth | E-mail + senha (argon2id), cadastro por convite, JWT curto + refresh em cookie. Convites por CLI **ou rota de API** até existir tela de admin. |
| D2 Infra | Servidor OCI em Toronto já com Coolify; novo projeto lá; todos os serviços no mesmo host. Domínio `lastro.hmmb.app.br`; `hmmb.api.br` disponível se precisar. Vercel, Hetzner e R2 saem. |
| D3 Redis | No mesmo host, sem porta pública. |
| D4 Versões | Confirmado (TS 5.9, Nest 11 salvo spike, React 19, MUI 9, Node 24, Python 3.12). |
| D5 Contrato | Confirmado (nestjs-zod → `openapi.json` versionado → openapi-typescript + orval; string decimal, `YYYY-MM-DD`, RFC 9457, cursor). |
| D6 Tooling | Confirmado com **npm**. |
| D7 PM | Duas visões (por conta e consolidada por instrumento). **Sem rótulo "fiscal"**; no relatório o usuário escolhe. |
| D8 Caixa | Implícito; aporte correspondente ligado por padrão; saldo negativo permitido e sinalizado. |
| D9 Migração | **(a) histórico completo**, apoiado por notas e extratos; formato JSON/CSV definido pelo app; prompt de IA (fora do app) converte planilhas. |
| D10 Edição | Editar/excluir manual e migração com `audit_log`; importadas por IA só por desfazer do lote. |
| D11 Cálculos | **(b)** F1 100% Node; worker Python só na F2 como consumidor. |
| D12 KPIs F1 | Rentabilidade simples rotulada. |
| D13 Valor manual | Aceito; PTAX já na F1. |
| D14 Instituições | Catálogo global. Em uso: Clear, Avenue, Nubank (cofrinhos), Sicredi (fundos), Trust Wallet (cripto), C6 Bank. |
| D15 / D16 | "Como está hoje"; Operações Previstas inteiras na F2; match com IA na F3. |
| C1 Repo e nome | Um repositório `hmmb-lastro` com planejamento, backend e frontend; Coolify redeploya só o serviço cuja pasta mudou. Nome de exibição: **Lastro**. |
| C2–C7 | Confirmados. |
| Premissas 9.4 | Confirmadas, exceto moeda: **multi-moeda** BRL/USD/CAD/EUR, valores originais salvos, taxas no banco, moeda base escolhida pelo usuário. |
| Insumos | Domínio disponível; demais contas irrelevantes. Planejamento v2 e wireframes em `docs/`. Data de corte não se aplica. |

Premissas assumidas nesta versão (corrigir na aprovação se estiverem erradas):

- A VM da OCI é Ampere A1 (arm64) ou equivalente; o Coolify constrói as imagens no host. Confirmado em F0-01 e F0-02.
- API na mesma origem do app, em `lastro.hmmb.app.br/api`, por roteamento de path no Traefik do Coolify. Se F0-02 mostrar problema, cai para `api.lastro.hmmb.app.br` (mesmo site) e entra a sub-tarefa de CORS credenciado. `hmmb.api.br` não é necessário.
- Backups e, na F3, PDFs vão para o OCI Object Storage pela API S3.
- `stock_us` passa a `stock_intl` com `market` (`us`, `ca`, `eu`), porque o Hugo vai investir em CAD. É a única mudança na lista de tipos de ativo do handoff; reverter é trivial se ele preferir manter `stock_us`.
- Conciliação da migração: quantidades exatas em tudo; principal exato em renda fixa na curva; valor dentro de 0,5% ou R$ 10 (o maior) por conta e carteira só para ativos com cotação ou valor manual, porque extratos mostram marcação a mercado e o app mostra curva.

---

## 2. ADRs

Formato: contexto → decisão → consequências.

**ADR-001 Um repositório.** `hmmb-lastro` com `backend/`, `frontend/`, `docs/`. Sem tooling de monorepo: cada app tem `package.json` e lockfile próprios; CI e Coolify usam filtros de path. O `openapi.json` do backend é lido pelo front por caminho relativo (resolve E13).

**ADR-002 Hospedagem na OCI com Coolify.** Projeto Coolify "lastro" com `lastro-web` (estático), `lastro-api`, `lastro-jobs` (mesma imagem da API com `HTTP_ENABLED=false`), Postgres 16 e Redis 7 como serviços; na F2 entra `lastro-worker`. Backups pelo agendador do Coolify para OCI Object Storage. Consequências: custo zero adicional; host compartilhado (R7); imagens arm64; base `node:24-slim` (glibc) por causa do argon2 nativo (R19).

**ADR-003 Mesma origem para app e API.** SPA em `lastro.hmmb.app.br`; API em `/api` (`setGlobalPrefix('api')`). Sem CORS; cookies `SameSite=Lax`; CSRF no refresh mitigado por header customizado obrigatório. Fallback: subdomínio `api.` no mesmo site com CORS credenciado (sub-tarefa condicional em F0-02).

**ADR-004 Autenticação.** E-mail + senha com argon2id; cadastro só por convite (token de uso único, 7 dias, criado por CLI ou rota admin); access JWT de 15 min em memória; refresh token opaco e rotativo em cookie httpOnly/Secure/Lax com path `/api/auth`, guardado por hash em `refresh_tokens`; reutilização de refresh revoga a família; reset de senha por link gerado por admin; `users.is_admin`. `users`, `auth_tokens` e `refresh_tokens` **não têm RLS** (o login e o refresh consultam antes de existir contexto de tenant) e recebem grants mínimos para a role da API.

**ADR-005 Redis no host.** Serviço do Coolify, `maxmemory-policy noeviction`, AOF `everysec`, `maxmemory` 256 MB, sem porta pública.

**ADR-006 Versões.** React 19, MUI 9, Vite 8, TanStack Router/Query atuais, Zod 4, RHF 7, Recharts 3; TypeScript 5.9 fixo nos dois apps até typescript-eslint e openapi-typescript declararem 6/7; NestJS 11 por padrão, 12 só se o spike S2 provar nestjs-zod nele; Drizzle 0.45 + Kit 0.31; Node 24 LTS; Python 3.12 com pandas 3, scipy 1.18, psycopg 3.3, bullmq 3.2. Conjunto do front fixado no spike S0. Lockfiles versionados; Renovate mensal agrupado.

**ADR-007 Contrato front/back.** DTOs Zod no Nest via nestjs-zod; OpenAPI 3.1 exportado por script sem subir servidor para `backend/openapi.json` (versionado; CI falha se desatualizado). Front: `openapi-typescript` gera `src/api/schema.ts`; `orval` gera schemas Zod de formulário; ambos versionados e checados no CI. Convenções: dinheiro string decimal com ponto e sem milhar; datas `YYYY-MM-DD`; timestamps ISO-8601 UTC; erros `application/problem+json` (RFC 9457) com `errors[]` `{path, message}`; listas grandes com cursor opaco e `limit` ≤ 200; coleções pequenas sem paginação; sem envelope em recurso único; UUID v4. Cada tarefa de backend começa por DTOs e controller stub exportados no `openapi.json`, para a tarefa de front correspondente ter contrato.

**ADR-008 Tooling.** npm; Node 24 via `.nvmrc`; ESLint 10 flat + typescript-eslint type-aware + Prettier 3; assertion mecanizada (`consistent-type-assertions: never`, exceção só com `eslint-disable-next-line` com descrição obrigatória); `no-restricted-syntax` proibindo `parseFloat` e `Number(...)` nos módulos de domínio; Vitest 5 no front e no Nest; Python com uv, ruff, pyright, pytest; GitHub Actions; Conventional Commits validados no CI; trunk-based, branch por tarefa, PR com squash, CI verde obrigatório.

**ADR-009 Preço médio em duas visões.** Por conta (persistida na projeção) e consolidada por instrumento somando contas `individual` (sob demanda). Custos de aquisição entram no custo. `joint` e `corporate` só por conta. Nenhuma visão leva rótulo fiscal; o relatório de IR (F4) oferece as duas.

**ADR-010 Caixa implícito.** Uma linha por evento; o saldo do `available_balance` deriva da tabela de sinais (§3.3). "Registrar aporte correspondente" ligado por padrão no lançamento manual e na compra inicial. Saldo negativo permitido e sinalizado. Transferências de caixa entre contas são par ligado por `linked_operation_id`, inclusive entre moedas; transferências de custódia de ativos entre contas (BTC da exchange para a Trust Wallet, portabilidade de ações) são par `custody_transfer_out/in` com quantidade e custo, sem caixa e sem P&L.

**ADR-011 Migração por histórico completo.** Formato de importação canônico (JSON com Zod publicado no OpenAPI; CSV equivalente por entidade). Prompt documentado em `docs/` converte planilhas, extratos e notas via Claude.ai. Importação em duas etapas (validação com relatório por linha; aplicar em transação) cria `import_batches` de `kind = file`, operações com `source = migration` e `source_ref` único, desfazer por lote. O "aplicar" insere em lote e reconstrói a projeção uma vez por ativo e por conta ao final (não por operação).

**ADR-012 Edição de operações.** `manual` e `migration` podem ser editadas por `UPDATE` (preservando `seq`) e excluídas, com `before/after` em `audit_log`. Operações de IA só saem pelo desfazer do lote. Toda escrita reconstrói a projeção do ativo e da conta na mesma transação e, a partir da F2, enfileira recomputação de snapshots desde `occurred_at`.

**ADR-013 F1 inteira em Node.** NestJS é dono do motor de posições, das projeções (`position_events`, `position_lots`), dos jobs de dados de mercado e da valorização (`asset_valuations`). O worker Python entra na F2 como consumidor puro dessas tabelas mais `quotes`, `market_series` e `fx_rates`, escrevendo snapshots, TWR e XIRR. Se o BullMQ Python falhar no spike S5, o fallback preserva o BullMQ: um shim Node consome a fila e invoca o Python.

**ADR-014 KPIs da F1.** Rentabilidade simples rotulada. Consolidado: `(valor atual − capital externo líquido) / capital externo líquido`, cada fluxo convertido à moeda base pela taxa da operação quando houver, senão pela `fx_rates` da data. Carteira: ganho não realizado (valor atual − custo aberto) mais proventos e P&L realizado dos ativos que estão hoje na carteira ("como está hoje"), dividido pelo custo total das compras; a UI mostra as duas parcelas separadas. "Variação do mês", "12 meses" e "vs CDI" precisam de posição e preço em data e entram na F2 com os snapshots.

**ADR-015 Ativos sem cotação.** Todos os tipos aceitos desde a F1 com valor manual. Cotações automáticas de EUA e cripto na F2; cotas de fundos via dados abertos da CVM na F2.

**ADR-016 Catálogo global de instituições.** `institution_catalog` sem RLS, semeado (Clear, Avenue, Nubank, Sicredi, C6, Trust Wallet como `self_custody`, XP, Rico, BTG, Inter, Toro, Itaú, Bradesco, Santander, BB, Caixa, Binance, Mercado Bitcoin). `institutions.catalog_id` opcional, "outra" livre. Blueprints da F3 ligados ao catálogo.

**ADR-017 Histórico após reclassificação.** "Como está hoje" no MVP.

**ADR-018 Operações Previstas.** Tabela, sync e tela de confirmação na F2; match com IA na F3.

**ADR-019 Multi-moeda.** Enum `currency_code` (BRL, USD, CAD, EUR). Contas, ativos e operações guardam valores na moeda nativa. **Uma conta por moeda**: `accounts.currency` é imutável depois da primeira operação e o caixa da conta tem a mesma moeda (validado no serviço e testado). Quando a moeda do ativo difere da da conta (cripto em USD numa conta BRL), a operação exige `cash_amount` na moeda da conta; o caixa usa `cash_amount`, e `fx_rate = cash_amount / total_value` fica registrado. `fx_rates(base, quote, date, rate, source)` global: `base` ∈ {USD, CAD, EUR}, `quote = BRL`, `rate` = unidades de BRL por 1 unidade da base (PTAX venda de fechamento, Olinda); cruzadas via BRL; dia sem cotação usa a última anterior. `users.base_currency` define a consolidação; na F1 a conversão é na leitura; na F2 snapshots carregam `base_currency` e trocar a base recomputa. Transferência entre contas de moedas diferentes é o par normal com valores em cada moeda; a taxa efetiva `out/in` absorve spread e IOF; um `tax` separado só quando o valor de saída for o bruto antes do IOF (nunca os dois).

**ADR-020 Ajustes de schema.** `quotes` com chave `(market, symbol, date)`; `assets.market` enum (`b3`, `us`, `ca`, `eu`, `crypto`, `fund_br`) obrigatório quando há ticker; `stock_us` → `stock_intl`; `operations.source` enum + `source_ref`, com único parcial `(user_id, source, source_ref)`; `assets` único parcial `(account_id, market, ticker)`; `operations.seq` identity preservado em edição, ordenação `(occurred_at, prioridade por tipo, seq)`; `operations.metadata jsonb` por tipo (taxa e indexador do lote, fator de split); `quantity NUMERIC(30,18)`; `asset_valuations` com `kind` (`manual`, `curve`) e `value_kind` (`unit`, `total`); `archived_at` em contas e instituições; nome único entre carteiras irmãs; `nlevel(path) ≤ 8` (o wireframe diz "ilimitado"; 8 níveis cobrem qualquer uso humano e o limite sobe por migration); arredondamento: cálculo com 8 casas, saída com 2 half-up.

**ADR-021 Jobs em processo separado desde a F1.** Processadores BullMQ no mesmo código do NestJS, ativados por `JOBS_ENABLED`; em produção rodam no serviço `lastro-jobs` (`HTTP_ENABLED=false`) com pool de conexões próprio. Transações curtas por unidade de trabalho; chamadas HTTP a provedores fora de transação.

**ADR-022 Renda fixa por lotes.** Cada `buy` é um lote com data, principal e taxa/indexador próprios (`operations.metadata`, com default do ativo). `treasury_bond` e `debenture`: quantidade de títulos + preço unitário. `cdb`, `lci_lca` (inclui RDB dos cofrinhos): `quantity` em unidades de principal na moeda (preço unitário 1,0000 na aplicação). Curva calculada por lote e somada. Resgate (`sell`) informa o valor recebido; o motor consome lotes por FIFO proporcionalmente ao valor na curva de cada lote na data e deriva o principal consumido. `maturity` fecha todos os lotes. `amortization` reduz o principal pró-rata em todos os lotes (renda fixa) ou reduz o custo médio (FII e ações). `interest` (cupom) não altera principal. Come-cotas em fundos: `tax` com `quantity` reduz cotas e custo proporcional, sem caixa. Estado corrente dos lotes persistido em `position_lots` (projeção recomputável).

**ADR-023 Nome.** "Lastro" numa constante única (`APP_NAME`) por app. Slug `lastro` só em identificadores de infra (banco, serviços do Coolify).

**ADR-024 Módulos NestJS.** Além dos do handoff (`auth`, `users`, `institutions`, `accounts`, `portfolios`, `assets`, `operations`, `quotes`, `corporate-events`, `import`, `snapshots`), entram `admin`, `positions`, `valuations`, `dashboard`, `export`, `jobs`, e a infra `database`, `tenancy`, `common`. Um por domínio, cada um com module, controller, service e dto.

**ADR-025 Migrations, roles e deploy.** `db:bootstrap` (roda uma vez, como superusuário, senhas por env) cria as roles `lastro_owner`, `lastro_api`, `lastro_worker` fora do trilho de migrations. Migrations (rodam como `lastro_owner`) contêm só DDL, policies e `ALTER DEFAULT PRIVILEGES` concedendo à API o mínimo por tabela. Duas URLs de banco: `DATABASE_URL_OWNER` (migrate/seed no pre-start) e `DATABASE_URL` (servir). Pre-start toma `pg_advisory_lock` antes de migrar; toda migration é compatível com a versão anterior do código (deploys sobrepostos do Coolify). Seeds idempotentes (`ON CONFLICT DO UPDATE`) rodam no pre-start após as migrations. O SQL revisável é o gerado pelo `drizzle-kit generate`, versionado; `docs/schema.sql` é dump informativo, sem gate.

**ADR-026 Testes de banco.** Vitest com `pool: forks`; um banco por worker criado a partir de um template já migrado; truncamento entre testes; RLS exercida pelo mesmo caminho da aplicação (`runAsUser`). CI com Postgres 16 e Redis como serviços.

---

## 3. Artefatos de design (tarefas que precedem o código dependente)

| ID | Artefato | Conteúdo obrigatório | Antes de |
|---|---|---|---|
| DS-03 | `docs/design/api-conventions.md` | ADR-007 com exemplo de cada: erro de validação, erro de domínio, lista com cursor, recurso único, dinheiro, datas; regra do stub contract-first. | F0-08 |
| DS-01 | `docs/design/schema.md` | §3.1 + Apêndice A do handoff + SQL gerado em F0-12; checklist: RLS por tabela (sim/não e por quê), chaves únicas, CHECKs, índices, enums fechados, metadata por tipo. Gate: aprovação do Hugo. | F0-13 |
| DS-02 | `docs/design/modules.md` | Módulos (ADR-024), endpoints, DTOs, dependências entre módulos, ordem de implementação. | F1-01 |
| DS-04 | `docs/design/positions-and-valuation.md` | Tabela de sinais (§3.3), PM, lotes (ADR-022), curva (E6 + `cdi_plus`/`spread`), convenções numéricas (fator CDI truncado em 8 casas e produto em 16, como a CETIP; IPCA do mês corrente pelo último índice pró-rata em dias úteis, divergência esperada documentada), conversão de moeda, arredondamento, ordem intradia, e a lista nominal dos casos dourados com valores de planilha. | F1-05 |
| DS-05 | `docs/import-format.md` | JSON canônico (instituições, contas, carteiras, ativos, operações, valores manuais), CSV equivalente, exemplo válido, prompt de conversão, perguntas que o prompt faz (tipo de cada caixinha, moeda da conta). | F1-25 |
| DS-06 | `docs/design/worker-contract.md` | Filas, payloads, idempotência, retries, ordem do job noturno, tabelas lidas/escritas, fluxos externos por nível (§4.3 do handoff), colunas dos snapshots, tratamento de `base_currency`. | F2 |

### 3.1 Schema: deltas sobre o Apêndice A do handoff

Tabelas de usuário: `user_id NOT NULL`, RLS com `FORCE`, policy `user_id = nullif(current_setting('app.current_user_id', true), '')::uuid`, dono `lastro_owner`. Sem RLS: `users`, `auth_tokens`, `refresh_tokens`, `institution_catalog`, `quotes`, `market_series`, `fx_rates`, `holidays`, `job_runs`.

| Tabela | Mudança |
|---|---|
| `users` | + `name`, `password_hash`, `is_admin`, `base_currency currency_code default 'BRL'`, `last_login_at`. |
| `auth_tokens` (nova) | `kind` (`invite`, `password_reset`), `email`, `token_hash`, `expires_at`, `used_at`, `created_by`. |
| `refresh_tokens` (nova) | `user_id`, `token_hash` único, `family_id`, `expires_at`, `revoked_at`, `user_agent`. Sem RLS (ADR-004). |
| `institution_catalog` (nova) | `slug` único, `name`, `type`, `cnpj`, `country`, `logo_url`, `blueprint jsonb` (F3). |
| `institutions` | + `catalog_id` opcional, `archived_at`. Mantém `UNIQUE (user_id, slug)`. |
| `accounts` | `currency currency_code` (imutável após a primeira operação, no serviço), + `archived_at`. Caixa na mesma transação, com a moeda da conta. |
| `portfolios` | + `UNIQUE (user_id, parent_id, name) NULLS NOT DISTINCT`, `CHECK (nlevel(path) <= 8)`; labels = uuid em hex sem hífens (E11). |
| `assets` | + `market` enum com `CHECK (ticker IS NULL OR market IS NOT NULL)`; único parcial `(account_id, market, ticker)`; `currency currency_code`; `stock_us` → `stock_intl`. Metadata por tipo (E20 fechada): `treasury_bond` {maturity_date, index_type, rate, spread?}; `cdb`/`lci_lca` {instrument: cdb\|rdb\|lc\|lci\|lca, index_type, rate, spread?, liquidity: daily\|at_maturity, maturity_date?, lockup_until?}; `debenture` {issuer, isin, index_type, rate, maturity_date, amortization_schedule?}; `stock_intl`/`stock_br` {exchange, sector}; `fii` {segment}; `etf` {index_tracked, exchange}; `fund` {cnpj, fund_class, has_come_cotas}; `crypto` {network, wallet_label}; `other` {unit_kind: shares\|total, description}; `available_balance` {}. `index_type` ∈ {prefixed, cdi_pct, cdi_plus, ipca_plus, selic}. |
| `operations` | `source` enum (`manual`, `migration`, `import`, `expected_event`) + `source_ref`; único parcial `(user_id, source, source_ref)`; `seq bigint generated always as identity`; `currency currency_code`; `cash_amount numeric(20,2)` (moeda da conta, obrigatório quando difere da do ativo); `fx_rate` derivado/informativo; `metadata jsonb` (taxa e indexador do lote, fator de split, custo atribuído); `quantity numeric(30,18)`; enum ganha `custody_transfer_out`, `custody_transfer_in`; FK `import_batch_id` já na F0. |
| `position_events` (nova, projeção, F1) | PK `operation_id`; `user_id`, `asset_id`, `account_id`, `occurred_at`, `seq`, `quantity_after`, `avg_price_after`, `cost_after`, `cash_after` (nulo se não toca caixa), `realized_pnl`, `computed_at`. Índices `(asset_id, occurred_at, seq)`, `(account_id, occurred_at, seq)`. |
| `position_lots` (nova, projeção, F1) | PK `lot_operation_id`; `user_id`, `asset_id`, `opened_at`, `principal_initial`, `principal_remaining`, `quantity_remaining`, `unit_cost`, `index_type`, `rate`, `spread`, `closed_at`. |
| `asset_valuations` (F1) | `kind` (`manual`, `curve`), `value_kind` (`unit`, `total`), `value numeric(30,10)`, PK `(asset_id, date, kind)`. Tipos com quantidade usam `unit`; curva e `other` sem cotas usam `total`. |
| `quotes` (F0) | PK `(market, symbol, date)`, `close`, `currency`, `source`. |
| `market_series` (F0) | `series` (`cdi`, `selic`, `ipca`), `date`, `value`, `source`. |
| `fx_rates` (F0) | PK `(base, quote, date)`, `rate numeric(20,10)`, `source` (ADR-019). |
| `holidays` (F0) | seed ANBIMA 2001–2099 como arquivo de dados versionado, upsert idempotente. |
| `audit_log` (F0) | `user_id`, `entity`, `entity_id`, `action`, `before jsonb`, `after jsonb`, `at`. RLS. |
| `import_batches` (F0) | Apêndice A + `kind` (`file`, `ai_notes`); `account_id` nulo permitido quando `kind = file` (CHECK). |
| `job_runs` (F0) | `name`, `started_at`, `finished_at`, `status`, `error`, `stats jsonb`. |
| F2 | `portfolio_snapshots`, `account_snapshots` com `user_id` (E1), `base_currency` e colunas do DS-06; `expected_events` conforme Apêndice A. |

### 3.2 Módulos NestJS e dependências

Ver ADR-024. Dependências: `dashboard` → `positions`, `valuations`, `quotes`; `valuations` → `positions`, `quotes`; `positions` → `operations`, `assets`, `accounts`; `import` → `institutions`, `accounts`, `portfolios`, `assets`, `operations`, `positions`; `admin` → `auth`, `jobs`.

### 3.3 Regras do motor (resumo; DS-04 detalha)

Ordem das operações: `(occurred_at, prioridade, seq)` com prioridade: entradas de caixa e custódia (`external_deposit`, `internal_transfer_in`, `custody_transfer_in`, proventos) → `buy` → ajustes (`split`, `reverse_split`, `bonus_shares`) → `sell`, `amortization`, `maturity` → saídas (`withdrawal`, `internal_transfer_out`, `custody_transfer_out`, `fee`, `tax`). Reconstrução completa do ativo e da cadeia de caixa da conta a cada escrita (uma vez por lote na importação).

| Tipo | `total_value` | `tax_withheld` | Caixa da conta | Posição |
|---|---|---|---|---|
| `external_deposit` | valor | — | + | — |
| `withdrawal` | valor | — | − | — |
| `buy` | qtd × PU (bruto) | — | −(total + fees), ou −`cash_amount` | +qtd; custo += total + fees; abre lote (RF) |
| `sell` | qtd × PU (bruto); RF: valor líquido recebido | IR/IOF retidos | +(total − fees − tax) ou +`cash_amount` | −qtd; realizado = líquido − qtd × PM; RF consome lotes FIFO por valor na curva |
| `dividend`, `interest_jcp`, `interest` | líquido creditado | IR retido | +total | — (bruto = total + tax para relatórios) |
| `amortization` | líquido creditado | IR | +total | RF: principal pró-rata em todos os lotes; FII/ações: reduz custo médio |
| `maturity` | líquido recebido | IR + IOF | +total | fecha todos os lotes |
| `internal_transfer_out/in` | valor na moeda de cada conta | — | −/+ | — |
| `custody_transfer_out/in` | custo transferido | — | 0 | −/+ qtd carregando custo; sem P&L |
| `split`, `reverse_split` | 0 | — | 0 | qtd += delta (`metadata.factor` guarda o fator); custo total mantido |
| `bonus_shares` | qtd × custo atribuído | — | 0 | +qtd; custo += total (E9) |
| `fee` | valor | — | − | — |
| `tax` | valor; em `fund` com `quantity`: come-cotas | — | − (0 no come-cotas) | come-cotas: −qtd, custo proporcional |

PM por conta: média ponderada com custos; venda não altera; split/grupamento mantêm custo total; bonificação ao custo atribuído. PM consolidado por instrumento sob demanda. Valor atual: cotação × quantidade quando há `market`; senão `asset_valuations` (`unit` × quantidade ou `total`); caixa = `cash_after` mais recente. Conversão à moeda base pela `fx_rates` da data (ou `fx_rate` da operação nos fluxos externos). Dinheiro: `decimal.js` no Nest, `Decimal` no Python; `NUMERIC` do driver como string; 8 casas internas, 2 na saída, half-up. Clock único com `America/Sao_Paulo` para "hoje" e para os crons.

### 3.4 Frontend (rotas e tema)

Rotas: `/login`, `/invite/$token`, `/reset/$token`; shell autenticado com sidebar (logo Lastro, nav Dashboard e Performance-F2, árvore, usuário sem selo "Pro"): `/dashboard`, `/portfolios/$id`, `/assets/new`, `/assets/$id`, `/operations/new`, `/accounts`, `/institutions`, `/import`, `/settings`. F2: `/performance`, `/expected-events`. F3: `/import/ai/*`.

Tema MUI dos tokens do wireframe: fundos `#060d1a` `#0a1628` `#0f1e35` `#152540` `#1b2e4e`; acento `#4080ff` `#7aaeff` `#1a3a80`; sucesso `#22c55e`; perigo `#f04747`; alerta `#f59e0b`; texto `#d0e0f5` `#6a8aaa` `#3d5a7a`; bordas `rgba(80,140,220,.12/.22)`; Jost; densidade compacta; superfície "glass". Uma paleta. Chips → `asset_type` conforme handoff §10, com `stock_intl` no lugar de `stock_us`.

---

## 4. Plano por fase → épico → tarefa (em ordem de execução)

Colunas: ID · Área · Objetivo · Depende de · Critério de aceite · Verificação · Tamanho. A ordem das linhas é a ordem de execução.

### Fase 0 — Esqueleto

Entregável: "logo por convite em `lastro.hmmb.app.br` e vejo o shell vazio em produção", com RLS testada, CI, jobs e backup.

**Épico F0-A — Host, repositório e versões**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [x] 2026-09-24 | F0-01 | infra | Inventário do host OCI/Coolify: arquitetura, RAM/disco livres, versão do Coolify, serviços existentes, limites do free tier; `docs/infra.md`. | — | Doc com números e decisão arm64/x86. | Revisão do Hugo. | P |
| [ ] | F0-02 | infra (S1) | Coolify: projeto "lastro"; Postgres 16 e Redis 7 (noeviction, AOF) como serviços; app hello-world em `lastro.hmmb.app.br/api` (validar `StripPrefix`) e estático na raiz; TLS; GitHub App + Watch Paths; destino de backup S3 no OCI Object Storage; build de imagem `node:24-slim` com argon2 no host. Se o path falhar: subdomínio + sub-tarefa CORS credenciado. | F0-01 | `curl https://lastro.hmmb.app.br/api/health` 200 com prefixo preservado; push em pasta não observada não dispara deploy; backup de teste aparece no bucket; imagem builda. | `curl`, painel do Coolify, bucket. | M |
| [ ] | F0-03 | repo | Estrutura: `backend/`, `frontend/`, `docs/`, `.github/workflows/`, `.nvmrc` (24), `.editorconfig`, READMEs, `CLAUDE.md` raiz provisório. | — | Árvore criada sem código de produto. | `tree -L 2`. | P |
| [ ] | F0-04 | ambos (S0) | Fixar o conjunto de versões (ADR-006): `package.json` dos dois apps com React 19.3, MUI 9.4, Vite 8.3, Vitest 5, TS 5.9, Nest 11, Drizzle 0.45, Zod 4.6; `npm ci` e build vazio funcionam. | F0-03 | Lockfiles versionados; `npm run build` dos dois apps passa. | Comandos. | P |

**Épico F0-B — Backend: fundações e contrato**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F0-05 | backend | Bootstrap NestJS + Fastify, TS strict, ESLint (assertion, `parseFloat`), Prettier, Vitest, config por env validada com Zod, Pino sem payloads, `GET /api/health`, prefixo `api`, `APP_NAME`, clock `today()`/`now()` em `America/Sao_Paulo` com teste de virada de dia (21h–00h UTC). | F0-04 | `npm run lint typecheck test` verdes; health 200; teste de fuso passa. | Comandos + `curl`. | M |
| [ ] | F0-06 | infra | `docker-compose.dev.yml` só com Postgres 16 (extensões) e Redis 7, healthchecks, volumes. | F0-03 | `docker compose up` saudável em máquina limpa. | `docker compose ps`. | P |
| [ ] | DS-03 | docs | Convenções de API (ADR-007) com exemplos. | — | Checklist da §3 completo. | Revisão. | P |
| [ ] | F0-07 | ci | `backend.yml`: filtro `backend/**`, Postgres + Redis de serviço, lint, typecheck, test; `commitlint` em PR. | F0-05, F0-06 | PR de exemplo verde; mudança só em `frontend/` não roda. | Actions. | P |
| [ ] | F0-08 | backend (S2) | nestjs-zod + `@nestjs/swagger` + `cleanupOpenApiDoc` com Fastify; filtro RFC 9457; endpoint de exemplo com `z.discriminatedUnion`; `openapi:export` sem escutar porta → `backend/openapi.json`; gate de frescor em `backend.yml`; decidir Nest 11 vs 12 (atualizar ADR-006). | F0-05, F0-07, DS-03 | União discriminada aparece corretamente no JSON 3.1; erro de validação sai como problem+json; CI falha se o JSON estiver velho. | Teste do export + CI. | M |
| [ ] | F0-09 | backend (S3) | Drizzle: driver pg, `customType` ltree, `db:bootstrap` (roles por env, superusuário, fora das migrations), migrations DDL-only com `ALTER DEFAULT PRIVILEGES`, `db:migrate` com advisory lock, harness de testes (ADR-026), SQL do `drizzle-kit generate` versionado, dump informativo. | F0-05, F0-06 | Migration cria extensões; API conecta como `lastro_api` e não consegue `CREATE TABLE`; dois testes em paralelo não se contaminam. | Integração com Postgres real. | M |
| [ ] | F0-10 | backend | Tenancy: nestjs-cls + transação por request aberta **depois** do guard JWT + `set_config`; `TenantDb`; guard que rejeita contexto ausente; `runAsUser` para jobs; pool separado para jobs. | F0-09 | Requests concorrentes não vazam contexto; query sem contexto retorna zero linhas; transação só abre em rota autenticada. | Integração. | M |
| [ ] | F0-11 | backend | Schema Drizzle do núcleo (§3.1, tudo marcado F0) + `drizzle-kit generate` → SQL para revisão. Sem RLS ainda. | F0-09, F0-10 | SQL gerado revisável; migration aplica limpa. | `db:migrate` em CI. | M |
| [ ] | DS-01 | docs | Revisão do schema (checklist §3) sobre o SQL de F0-11. Gate do Hugo. | F0-11 | Aprovado por escrito no PR. | Revisão. | P |
| [ ] | F0-12 | backend | RLS `FORCE` + policies em todas as tabelas de usuário, CHECKs, índices, únicos parciais; seeds idempotentes (`institution_catalog`, `holidays` vazio até F1-15) no pre-start. | DS-01 | Dump com policies em todas as tabelas de usuário; seed rodado duas vezes não duplica. | Integração + `db:seed` duas vezes. | M |
| [ ] | F0-13 | backend | Teste de isolamento RLS: enumera tabelas de usuário automaticamente; leitura e escrita cruzadas, query sem filtro, contexto ausente, conexão reaproveitada, roles sem `BYPASSRLS`, `FORCE` presente. | F0-12 | Suite passa e falha quando uma policy é removida (teste de mutação manual documentado). | Vitest no CI. | M |
| [ ] | F0-14 | backend | Auth sessão: login, refresh rotativo com família, logout, `GET /api/me`; argon2id; header anti-CSRF no refresh; rate limit de login (429 após N tentativas). | F0-12 | Fluxo login → refresh → logout testado; refresh reutilizado revoga a família; 429 reproduzido. | Integração. | M |
| [ ] | F0-15 | backend | Convites e reset: `auth_tokens`, CLI `invite:create`, `POST /api/admin/invites` e `/admin/password-resets` (guard `is_admin`), aceitar convite, redefinir senha. | F0-14 | Convite → senha → login coberto; token expirado e reutilizado rejeitados. | Integração. | M |
| [ ] | F0-16 | backend | Infra BullMQ: conexão Redis, módulo `jobs`, job repetível `ping`, `job_runs`, `GET /api/admin/jobs`, flags `JOBS_ENABLED`/`HTTP_ENABLED`. | F0-12 | `ping` registra em `job_runs` a cada minuto em dev; com `HTTP_ENABLED=false` o processo não escuta porta. | Log + tabela. | M |

**Épico F0-C — Frontend: fundações**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F0-17 | frontend | Bootstrap Vite + React + TS, TanStack Router (file-based, search Zod) e Query, MUI com tema dos tokens (§3.4), Jost, ESLint/Prettier/Vitest + Testing Library; shell vazio; `APP_NAME`. | F0-04 | `npm run lint typecheck test build` verdes; shell renderiza com o tema. | Comandos + screenshot. | M |
| [ ] | F0-18 | frontend + ci | `sync:api` (openapi-typescript + orval zod) lendo `../backend/openapi.json`; `frontend.yml` com filtro `frontend/**`, lint, typecheck, test, build e gate de frescor dos tipos. | F0-08, F0-17 | Tipos compilam; CI falha se `openapi.json` mudou sem regerar. | Actions. | M |
| [ ] | F0-19 | frontend | Cliente HTTP tipado com refresh automático em 401 e header anti-CSRF; login, aceitar convite, redefinir senha, rota protegida, logout; access token em memória. | F0-15, F0-18 | Recarregar mantém sessão via refresh; 401 dispara um único refresh concorrente. | Teste de componente + manual. | M |

**Épico F0-D — Deploy e operação**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F0-20 | infra | Dockerfiles multi-stage (`api`: `node:24-slim`; `web`: build + nginx com headers de segurança); compose completo (Postgres, Redis, api, jobs, web). | F0-16, F0-19 | Compose sobe tudo saudável; imagem `api` builda em arm64. | `docker compose ps`. | M |
| [ ] | F0-21 | infra | Deploy no Coolify: `lastro-api`, `lastro-jobs` (mesma imagem, flags), `lastro-web`; base dirs e Watch Paths; segredos; `DATABASE_URL_OWNER` e `DATABASE_URL`; pre-start `db:migrate` (advisory lock) + `db:seed`; healthcheck público. | F0-02, F0-20 | Convite criado por CLI em produção → login → shell vazio; push só em `frontend/` não redeploya a API; dois deploys seguidos não corrompem migrations. | Manual + logs. | M |
| [ ] | F0-22 | infra | Backup diário do Postgres para bucket privado (SSE), retenção 30 dias; restauração em banco temporário; `docs/runbooks/restore.md`. | F0-21 | Backup listado; restauração reproduz schema e dados. | Executar o runbook. | P |
| [ ] | F0-23 | docs | `CLAUDE.md` da raiz, `backend/` e `frontend/`: regras das §3 e §11 do handoff, comandos reais, fluxo "uma tarefa por vez; marcar em `docs/PLAN.md`", proibições. | F0-21 | Comandos citados existem nos `package.json`. | Revisão. | P |

Esforço F0: 16 M + 9 P (incluindo DS-03 e DS-01) ≈ 36,5 dias de esforço, teto.

### Fase 1 — MVP manual

Entregável: "o histórico real do Hugo está no app e o dashboard bate com as planilhas dentro da tolerância".

**Épico F1-A — Design, instituições e contas**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | DS-02 | docs | Mapa de módulos e endpoints. | DS-01 | Checklist §3. | Revisão. | P |
| [ ] | DS-04 | docs | Regras do motor e da valorização com casos dourados nominais. | DS-01 | Checklist §3; cada caso tem valor esperado de planilha. | Revisão. | M |
| [ ] | F1-01 | backend | `institutions` (CRUD, catálogo, arquivar) e `accounts` (CRUD, moeda imutável após primeira operação, `is_default`, arquivar; caixa na mesma transação com a moeda da conta; exclusão bloqueada com histórico). | DS-02 | Criar conta cria caixa na moeda certa; mudar moeda após operação falha; excluir conta com operações falha com problem+json. | Integração. | M |
| [ ] | F1-02 | frontend | Telas Instituições e Contas. | F1-01 | CRUD completo sem recarregar; erros inline. | Componente + manual. | M |

**Épico F1-B — Carteiras**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F1-03 | backend | `portfolios`: criar, renomear, mover subárvore (reescrita de prefixo), excluir (bloqueado com conteúdo); `parent_id` e `path` num único serviço transacional; profundidade ≤ 8; nome único entre irmãos; árvore. | F1-01 | Mover subárvore preserva descendentes; labels distintos não colidem (E11); nono nível recusado. | Integração com ltree. | M |
| [ ] | F1-04 | frontend | Sidebar com árvore, criar/renomear/"mover para"/excluir, breadcrumb, rota por carteira. | F1-03 | Árvore reflete o backend após cada mutação. | Componente + manual. | M |

**Épico F1-C — Ativos (cadastro)**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F1-05 | backend | `assets`: união discriminada Zod por tipo (metadata §3.1), `market`, único `(account_id, market, ticker)`, criar/editar/listar por carteira, subárvore e conta, reclassificar com auditoria, excluir só sem operações. Sem compra inicial ainda. | F1-03, DS-04 | Cada tipo salva com metadata válida; ticker duplicado na conta falha; reclassificar grava `asset_reclassifications`. | Integração. | M |
| [ ] | F1-06 | frontend | Formulário Adicionar/editar ativo: chips → campos dinâmicos, seleção instituição → conta → carteira (herdada do contexto), pré-visualização do card, "reclassificar". Sem compra inicial ainda. | F1-05 | Cada tipo salva; validação Zod do orval. | Componente + manual. | M |

**Épico F1-D — Operações e motor de posições**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F1-07 | backend | `operations` a: criar com validação por tipo (§3.3; `cash_amount` obrigatório quando moedas diferem; `metadata` do lote), listar com cursor por ativo/conta/usuário, único `(user_id, source, source_ref)`. | F1-05 | Cada tipo aceito/recusado conforme DS-04; `source_ref` duplicado falha. | Integração. | M |
| [ ] | F1-08 | backend | `operations` b: transferências de caixa entre contas (par, moedas diferentes, taxa efetiva) e de custódia de ativos; "registrar aporte correspondente". | F1-07 | Par criado atomicamente; desfazer um lado remove o outro; custódia não toca caixa. | Integração. | M |
| [ ] | F1-09 | backend | `positions` a: motor puro (quantidade, PM por conta com custos, split/grupamento/bonificação, caixa, P&L realizado, lotes FIFO de renda fixa, come-cotas, custódia, moeda nativa e `cash_amount`, ordem intradia). Casos dourados de DS-04 em JSON. | DS-04, F1-08 | Todos os casos dourados passam; função pura. | Vitest unitário. | M |
| [ ] | F1-10 | backend | `positions` b: migrations de `position_events` e `position_lots`; rebuild transacional por ativo e por conta; API interna de rebuild em lote; "posição em data"; PM consolidado sob demanda; endpoints de posições. | F1-09 | Após escrita a projeção reflete; posição em data confere com o motor puro; F0-13 continua verde com as tabelas novas. | Integração. | M |
| [ ] | F1-11 | backend | `operations` c: editar (`UPDATE` preservando `seq`) e excluir `manual`/`migration` com `audit_log` e rebuild; recusar edição de `import`/`expected_event`. Caso dourado "editar operação com outra na mesma data". | F1-10 | Editar compra antes de venda no mesmo dia mantém ordem; `audit_log` tem before/after. | Integração. | M |
| [ ] | F1-12 | backend | `assets` b: criar ativo com compra inicial e aporte opcional na mesma transação (E18, ADR-010). | F1-10 | Criar gera ativo + `buy` (+ `external_deposit`); falha em qualquer parte não deixa resíduo. | Integração. | P |
| [ ] | F1-13 | frontend | Tela Lançar operação/transferência (tipo → campos, conta/ativo, moeda, `cash_amount` quando preciso, aporte correspondente) e lista de operações do ativo com editar/excluir. | F1-11 | Compra sem saldo mostra aviso e opção de aporte; transferência entre moedas pede os dois valores. | Componente + manual. | M |
| [ ] | F1-14 | frontend | Compra inicial e aporte no formulário de ativo, com pré-visualização. | F1-12, F1-06 | Fluxo do wireframe Tela 3 completo. | Componente + manual. | P |

**Épico F1-E — Dados de mercado e valorização**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F1-15 | backend (S4) | Spike S4 (1 dia) + providers BCB SGS (cdi, selic, ipca) e feriados ANBIMA (arquivo versionado, upsert); carga histórica desde 2010; interface de provider; limites documentados. | F0-16 | Séries e feriados carregados; rodar duas vezes não duplica. | Fixtures HTTP + carga. | M |
| [ ] | F1-16 | backend | Providers brapi (b3, token) e BCB PTAX Olinda (USD, CAD, EUR → BRL, venda de fechamento); `quotes` e `fx_rates`; carga histórica de câmbio; fonte de histórico de B3 conforme S4 (R6). | F1-15 | Cotação de um ticker gravada; câmbio das três moedas desde 2010; convenção `rate` testada com valor conhecido. | Fixtures + carga. | M |
| [ ] | F1-17 | backend | Jobs: `series.daily`, `fx.daily`, `quotes.nightly` (22h São Paulo, tickers com posição > 0), `quotes.refresh` manual com rate limit por usuário (429 testado); `job_runs`; defasagem por ativo; execução em `lastro-jobs`. | F1-16, F1-10 | Idempotentes; falha registrada; refresh além do limite dá 429. | Testes + dev. | M |
| [ ] | F1-18 | backend | `valuations` a: motor puro da curva por lote (prefixado, `cdi_pct`, `cdi_plus`, `ipca_plus`, `selic`, com `spread`), dias úteis, convenções numéricas de DS-04; casos dourados. | DS-04, F1-15 | Casos dourados dos indexadores dentro da divergência documentada. | Vitest unitário. | M |
| [ ] | F1-19 | backend | `valuations` b: migration de `asset_valuations`; backfill desde a aplicação; job diário por usuário (`runAsUser`); recálculo sob demanda ao alterar ativo/operações; CRUD de valores manuais (`unit`/`total`). | F1-18, F1-10, F1-17 | Ativo de renda fixa novo tem valor na mesma request; valor manual `unit` × quantidade reflete novo aporte. | Integração. | M |

**Épico F1-F — Dashboard e leitura consolidada**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | F1-20 | backend | `dashboard` a: valor atual por ativo (cotação, valuation, caixa), conversão à moeda base por data, defasagem, `PATCH /api/me` para `base_currency`. | F1-19 | Ativo em USD aparece em BRL e em CAD com as taxas certas; ativo sem cotação recente vem marcado. | Integração. | M |
| [ ] | F1-21 | backend | `dashboard` b: consolidado, por conta (com caixa e "moeda original"), por carteira/subárvore, peso no pai, alocação por classe, rentabilidade simples (ADR-014, duas parcelas), últimas movimentações. | F1-20 | Soma das contas = consolidado; carteira soma subárvore; caso dourado multi-moeda de rentabilidade passa. | Integração. | M |
| [ ] | F1-22 | frontend | Dashboard: KPIs da F1, cards por carteira-raiz, caixa por conta, últimas movimentações, defasagem + refresh, seletor de moeda base. | F1-21 | Operação nova aparece na hora; preço mostra data do fechamento (E17). | Componente + manual. | M |
| [ ] | F1-23 | frontend | Carteira em detalhe: breadcrumb, KPIs, tabela de ativos, sub-carteiras. | F1-21 | Peso relativo ao pai; navegação por sub-carteiras. | Componente + manual. | M |
| [ ] | F1-24 | frontend | Tela do ativo: detalhe, metadata, lotes (RF), operações, valores manuais, reclassificar. | F1-13, F1-19 | Valor manual salvo reflete no dashboard. | Componente + manual. | M |

**Épico F1-G — Migração, exportação e fechamento**

| Feito | ID | Área | Objetivo | Dep. | Aceite | Verificação | Tam. |
|---|---|---|---|---|---|---|---|
| [ ] | DS-05 | docs | Formato de importação e prompt de conversão. | DS-04 | Exemplo valida no schema; prompt testado numa planilha do Hugo. | Revisão. | P |
| [ ] | F1-25 | backend | `import` arquivo: `validate` (relatório por linha: schema, referências, moedas, saldo negativo, duplicatas por `source_ref`), `apply` (transação, `kind = file`, inserção em lote, rebuild uma vez por ativo/conta, criação opcional de entidades faltantes), `undo` por lote; schema no OpenAPI. | DS-05, F1-11, F1-19 | Exemplo importa e desfaz sem resíduo; erro numa linha não aplica nada; 5 mil operações aplicam em menos de 60 s. | Integração + medição. | M |
| [ ] | F1-26 | frontend | Tela Importar arquivo: upload, relatório, prévia de posições por conta/carteira, aplicar, histórico de lotes com desfazer. | F1-25 | Fluxo completo com o exemplo. | Componente + manual. | M |
| [ ] | F1-27 | backend | `export` completo (JSON e CSV por entidade, zip) e exclusão da própria conta com cascata. | F1-11 | Export contém todas as tabelas de usuário (teste enumera); excluir conta zera linhas do usuário em todas. | Integração. | M |
| [ ] | F1-28 | frontend | Configurações: moeda base, exportar, excluir conta. | F1-27, F1-22 | Ações com confirmação funcionam. | Componente + manual. | P |
| [ ] | F1-29 | backend | Endurecimento testável: teste que loga uma operação e afirma ausência de valores no log; `curl -I` do web mostra headers de segurança; revisão de grants por tabela com teste. | F1-27 | Três testes automatizados verdes. | CI. | P |
| [ ] | F1-30 | ambos | E2E Playwright do caminho feliz (login → conta → carteira → ativo com compra → dashboard) e `e2e.yml` acionado por qualquer pasta, contra o compose. | F1-02, F1-04, F1-14, F1-22 | Roda verde no CI. | Actions. | M |
| [ ] | F1-31 | todos | Migração real: converter planilhas/extratos com o prompt, importar, conciliar (premissa §1), corrigir divergências, `docs/migration-report.md`. | F1-26, F1-30 | Quantidades e principais exatos; valores dentro da tolerância onde aplicável; relatório assinado pelo Hugo. | Relatório. | M |

Esforço F1: 28 M + 6 P (incluindo DS-02, DS-04 e DS-05) ≈ 59 dias de esforço, teto.

Critérios de aceite da F1 (handoff): migração real bate; casos dourados de PM, caixa e curva; exportação completa; nenhum KPI depende de dado da F2.

Se apertar, cortar nesta ordem: tela de Instituições separada (vira aba em Contas); prévia de posições na importação (fica o relatório); tela do ativo separada (fica dentro da carteira); tela de configurações (moeda base via `PATCH /api/me` e exportação por endpoint).

### Fase 2 — Performance e histórico (épicos)

| Épico | Conteúdo | Dependências | Riscos |
|---|---|---|---|
| F2-A Worker Python | Spike S5; `backend/worker/` com uv, ruff, pyright, pytest; role `lastro_worker`; iteração por usuário com contexto RLS; serviço `lastro-worker`. Fallback: shim Node consumindo a fila BullMQ e invocando o Python. | F0-16 | S5. |
| F2-B Contrato e snapshots | DS-06; `portfolio_snapshots`/`account_snapshots` com `user_id`, `base_currency`, valor, capital investido no nó, fluxo líquido do dia, índice TWR acumulado, XIRR; total do usuário = soma das contas; destaques por ativo sob demanda; valor em data para "variação do mês". | F2-A, F1-10, F1-19 | Fluxos por nível; carga inicial. |
| F2-C TWR e XIRR | XIRR com `scipy.optimize.brentq` sobre XNPV testado contra planilha (E5); TWR por subperíodos; CDI e IPCA; custo de oportunidade do caixa; performance em moeda base com recomputação ao trocar a base. | F2-B | Histórico de cotações B3 (R6). |
| F2-D Recomputação | Escrita retroativa e troca de base enfileiram recomputação por usuário desde a data, coalescida; `job_runs` e indicador na UI. | F2-B | Tempestade de jobs em importações. |
| F2-E Tela Performance | Recharts: área patrimonial (1M…Tudo), rentabilidade por carteira vs CDI, donut por classe, destaques, custo de oportunidade; variação do mês no dashboard. | F2-C | — |
| F2-F Cotações EUA/CA e cripto | Polygon (cotações e eventos, uma integração) e CoinGecko atrás de providers; `market` `us`/`ca`/`crypto`; TSX via Polygon ou alternativa avaliada. | F1-16 | Limites dos planos gratuitos. |
| F2-G Operações Previstas | `expected_events`; sync diário (dadosdemercado após S7; proventos da brapi como fallback; Polygon); posição na data-com via projeção; tela de confirmação/negação; expiração. | F2-A, F1-10 | S7. |
| F2-H Fundos | Cotas diárias via dados abertos da CVM por CNPJ (`market = fund_br`). | F1-19 | Formato dos arquivos. |
| F2-I Reclassificação | Reavaliar D15 com dados reais. | F2-B | — |

### Fase 3 — Importação por IA (épicos)

| Épico | Conteúdo | Dependências | Riscos |
|---|---|---|---|
| F3-A Validação | Spike S6: notas reais da Clear e da Avenue no Claude.ai; meta ≥ 90% nos casos comuns; senão repensar UX. | — | Risco 1 do v2. |
| F3-B Pipeline | Upload para OCI Object Storage; hash e dedupe por conta; extração com `@anthropic-ai/sdk` e Zod; blueprint por instituição do catálogo (Clear primeiro); extração e revisão em `import_batches` (`kind = ai_notes`), operações só no "Aplicar" (E4); score de confiança; desfazer em 24 h. | F1-25, F2-G | Layouts; custo por nota. |
| F3-C Telas 5–8 | Upload, processando, revisão inline com mapeamento em três camadas, confirmação agrupada. | F3-B | — |
| F3-D Match | Ligar operações extraídas a `expected_events` pendentes. | F2-G, F3-B | — |

### Fase 4 — Backlog

Metas de alocação com alerta; relatórios de IR (bens e direitos, rendimentos, escolha da visão de PM); layout responsivo; compartilhamento em família; calendário de eventos residual; Google como login; e-mail transacional; segunda paleta; drag-and-drop; IOF/IR projetados na curva; tela de admin para convites.

---

## 5. Spikes com timebox

| ID | Spike | Timebox | Decide | Quando |
|---|---|---|---|---|
| S0 | Conjunto de versões do front (Vite 8 + TS 5.9 + Vitest 5 + MUI 9 + React 19) e do back instala e builda. | 0,5 dia | ADR-006 fixado. | F0-04 |
| S1 | Coolify na OCI: path routing com prefixo preservado, GitHub App + Watch Paths, Postgres/Redis como serviços, backup S3, build arm64 com argon2. | 1 dia | ADR-002/003 ou fallback subdomínio + CORS. | F0-02 |
| S2 | nestjs-zod 5 + Fastify + export sem servidor; `discriminatedUnion` ponta a ponta até o orval; Nest 11 vs 12. | 1 dia | ADR-006/007. Fallback: pipe Zod próprio + `zod-openapi`. | F0-08 |
| S3 | Drizzle `customType` ltree; bootstrap de roles fora das migrations; transação aberta após o guard; harness de testes de banco. | 1 dia | E2, E3, E14, ADR-025/026. | F0-09 |
| S4 | brapi com token (limites reais), BCB SGS, PTAX Olinda (CAD, EUR), arquivo ANBIMA, fonte de histórico B3 além de 3 meses. | 1 dia | Providers da F1; mitigação de R6. | F1-15 |
| S5 | BullMQ Python 3.2 consumindo fila do Node 6.3, retries e repetíveis. | 0,5 dia | F2-A ou shim Node. | Início da F2 |
| S6 | Extração de nota real (Clear, Avenue) no Claude.ai. | 0,5 dia | Ir ou não para a F3 como desenhada. | Antes da F3 |
| S7 | dadosdemercado: plano gratuito e endpoints de eventos. | 0,5 dia | Fonte de eventos BR ou fallback brapi. | Início de F2-G |

---

## 6. Caminho crítico e ordem de execução

Com uma tarefa por vez, a ordem de execução é a ordem das tabelas da §4. O caminho crítico da F0 é F0-01 → F0-02 → F0-04 → F0-05 → F0-08 → F0-09 → F0-10 → F0-11 → DS-01 → F0-12 → F0-13 → F0-14 → F0-15 → F0-19 → F0-21; F0-16 (jobs) e F0-17 (front) podem ser antecipados quando uma tarefa do caminho crítico estiver bloqueada esperando revisão. Na F1 o caminho crítico passa por F1-01 → F1-03 → F1-05 → F1-07 → F1-08 → F1-09 → F1-10 → F1-11 → F1-15 → F1-16 → F1-17 → F1-18 → F1-19 → F1-20 → F1-21 → F1-22 → F1-25 → F1-31; as tarefas de front seguem cada contrato com um passo de atraso e servem de "tarefa alternativa" quando o back espera revisão.

Contract-first: cada tarefa de backend começa por DTOs Zod e controller stub exportados no `openapi.json` e commitados; a tarefa de front correspondente só depende desse commit, não da implementação completa.

Regras: contrato mudou → tipos regerados no mesmo PR; tarefa concluída → lint, typecheck e testes verdes, caixa marcada em `docs/PLAN.md`; ambiguidade → perguntar antes.

---

## 7. Riscos com mitigação

| # | Risco | Mitigação |
|---|---|---|
| R1 (v2) | Notas reais quebram a extração por IA. | S6 antes de código da F3; meta de 90%. |
| R2 (v2) | Tesouro Direto sem API. | Curva por lote (ADR-022); marcação a mercado fora. |
| R3 (v2) | Conversão de moeda enganosa. | ADR-019: valores nativos, `fx_rates` por data, moeda base explícita, "moeda original" sempre disponível. |
| R4 (v2) | Eventos corporativos são um pântano. | Enum fechado agora (E9 + custódia); lógica conforme aparecer; casos dourados. |
| R5 (v2) | Lock-in sem exportação/backup. | Exportação F1-27; backup F0-22 com restauração testada. |
| R6 | brapi gratuita dá 3 meses de histórico; snapshots da F2 precisam de fechamentos antigos. | S4 avalia backfill único de fonte gratuita ou plano Pro (R$ 117/mês, requer aprovação); alternativa: histórico de performance começa na coleta, com aviso. |
| R7 | Host OCI compartilhado; upgrades do Coolify afetam tudo. | F0-01 mede folga; limites de memória por serviço; backups fora do host; runbook; `job_runs`. |
| R8 | Ecossistema em transição (TS 7, Nest 12, nestjs-zod sem peer para 12, `discriminatedUnion` pela cadeia). | ADR-006; S0 e S2; Renovate mensal. |
| R9 | Path routing no Coolify não preservar `/api`. | S1 valida; fallback subdomínio + CORS credenciado. |
| R10 | RLS contornada (owner, BYPASSRLS, contexto ausente). | Roles separadas, `FORCE`, `nullif`, F0-13 enumerando tabelas. |
| R11 | Dinheiro em float ou arredondamento inconsistente. | `decimal.js`/`Decimal`, NUMERIC string, DS-04, lint anti-`parseFloat`. |
| R12 | Qualidade dos dados da migração. | Formato canônico, validação por linha, prévia, desfazer, conciliação com tolerância por tipo. |
| R13 | Renda fixa com N aportes e resgates parciais. | Lotes FIFO por valor na curva (ADR-022) com casos dourados do extrato do Nubank. |
| R14 | Fuso e dias úteis. | Clock SP com teste de virada (F0-05); feriados versionados. |
| R15 | Fontes gratuitas mudam. | Providers por interface; limites documentados; nada pago sem aprovação. |
| R16 | Deploy sobreposto do Coolify e migrations concorrentes. | ADR-025: advisory lock, migrations compatíveis com a versão anterior, duas URLs. |
| R17 | Importação de histórico completo reconstruindo projeção por operação (O(N²)). | ADR-011: rebuild uma vez por ativo/conta no `apply`; medição em F1-25. |
| R18 | Testes de banco flaky no CI. | ADR-026 harness; F0-09 valida em paralelo. |
| R19 | argon2 nativo em arm64/musl. | `node:24-slim`; build validado em S1. |
| R20 | Pool esgotado por jobs no processo da API. | ADR-021: processo `lastro-jobs` separado, pool próprio, transações curtas. |
| R21 | Convenções numéricas divergem de extratos (CETIP, VNA do Tesouro). | DS-04 documenta a convenção e a divergência aceita; conciliação por principal em RF. |

---

## 8. Marcos

| Marco | Entregável demonstrável |
|---|---|
| M0 — fim da F0 | Login por convite em `lastro.hmmb.app.br`, shell vazio, RLS testada no CI, jobs rodando em `lastro-jobs`, backup restaurado uma vez. |
| M1 — fim da F1 | Histórico real importado; dashboard, contas e carteiras conciliados; exportação completa; curva de renda fixa por lote e cotações B3 diárias; moeda base trocável. |
| M2 — fim da F2 | Tela de Performance com TWR e XIRR vs CDI, snapshots pelo worker Python, cotações EUA/CA e cripto, Operações Previstas confirmáveis, cotas de fundos da CVM. |
| M3 — fim da F3 | Primeira nota real da Clear importada por IA, revisada e aplicada com desfazer. |

---
## Como usar este arquivo

1. Execute as tarefas na ordem das tabelas da §4, uma por sessão. Antes de começar, releia o ADR e o artefato de design que a tarefa cita.
2. Ao concluir: lint, typecheck e testes verdes; `[x]` na coluna Feito com a data; se o contrato da API mudou, tipos do front regerados no mesmo PR.
3. Decisão nova ou alterada: ADR em `docs/decisions.md`, ajuste aqui e no planejamento v3, e aviso ao Hugo se as instruções do projeto no Claude.ai precisarem mudar.
4. Ambiguidade de requisito: perguntar antes de implementar.
5. Nunca: `any`, type assertion sem justificativa, `number` ou float para dinheiro, desligar ou contornar RLS, segredo no repositório, serviço pago sem aprovação.
