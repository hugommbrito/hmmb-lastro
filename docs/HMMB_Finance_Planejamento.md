# Lastro (HMMB Finance) — Documento de Planejamento de Projeto

> **v3 — 24/09/2026.** Consolida o planejamento v2 (07/05/2026), as Operações Previstas (29/05/2026), o handoff de 24/09/2026 (erratas E1–E20) e as decisões fechadas na sessão de planejamento do mesmo dia. O plano executável está em `docs/PLAN.md`; cada decisão está em `docs/decisions.md` (ADR-001 a ADR-026). Nome do produto: **Lastro** (nome de trabalho anterior: HMMB Finance). Idioma de trabalho: português; código, schema, enums, identificadores e commits em inglês.

## Histórico de versões

| Versão | Data | O que mudou |
|---|---|---|
| v1 | abr/2026 | Árvore de carteiras, ativos, operações, caixa por carteira-raiz, transferências entre carteiras. |
| v2 | 07/05/2026 | Instituições e contas; caixa por conta; transferências entre contas; cotações; fluxo de IA; TWR/XIRR. |
| v3 | 24/09/2026 | Erratas E1–E20 aplicadas; decisões D1–D16 fechadas; repositório único; hospedagem OCI + Coolify; multi-moeda com moeda base por usuário; renda fixa por lotes; F1 inteira em Node com worker Python na F2; migração por histórico completo; catálogo global de instituições; nome Lastro. |

---

## 1. Visão geral do produto

Web app desktop-first para acompanhar investimentos pessoais. Não é app de gastos nem de contas a pagar: o foco é saldo, rentabilidade, alocação e movimentações de carteiras de investimento. Usuários: o Hugo e amigos, em modelo multi-tenant, sem monetização. Interface em pt-BR.

O modelo tem duas dimensões ortogonais:

- **Física** — onde o dinheiro está custodiado: Instituição → Conta → Ativo. Cada conta tem exatamente um caixa (`available_balance`) na moeda da conta.
- **Lógica** — como o investidor classifica o patrimônio: árvore de carteiras aninháveis (ltree, até 8 níveis), em que cada carteira contém sub-carteiras e/ou ativos.

Todo ativo pertence a exatamente uma conta (fixa) e a exatamente uma carteira (mutável sem efeito contábil). O caixa existe só na dimensão física. Cada nó da árvore mostra valor consolidado, rentabilidade, peso na carteira-pai e alocação por classe.

**Multi-moeda.** Contas, ativos e operações guardam valores na moeda nativa (BRL, USD, CAD, EUR). O usuário escolhe a moeda base de consolidação; a conversão usa as taxas do dia guardadas no banco (PTAX do BCB). Sempre é possível ver "na moeda original".

**Tipos de ativo:** Tesouro Direto, CDB (inclui RDB e LC), LCI/LCA, debênture, ações BR, ações internacionais (EUA, Canadá, Europa), FIIs, ETFs, fundos, cripto, outro e saldo disponível.

### Conceito central — hierarquia em árvore

```
Aposentadoria/
  ├ Renda Fixa/
  │   ├ Tesouro IPCA+ 2035
  │   └ CDB Nubank 120% CDI
  └ Renda Variável/
      ├ Ações BR/
      └ FIIs/
Reserva de Emergência/
Carteira Agressiva/
  ├ Internacional/
  └ Cripto/
```

### Modelo de usuários

Multi-tenant desde o início, com cadastro só por convite. Sem monetização; sem selo "Pro"; sem planos.

---

## 2. Identidade visual

- Desktop-first, sem responsivo no MVP.
- Tema dark "ocean" (tons de azul), uma paleta no MVP. Tokens no wireframe (`docs/Finance App Wireframes.html`; versão navegável offline em `docs/HMMB Finance Wireframes (offline).html`).
- MUI v9; fonte Jost; densidade compacta; superfície "glass".
- Estética sóbria e densa, mais "terminal de operador" do que "banco".
- Nome de exibição numa constante única (`APP_NAME = "Lastro"`), fora de identificadores de banco, pacotes e rotas.

---

## 3. Telas e fluxos

| Tela | Fase | Descrição |
|---|---|---|
| Login, convite, redefinição de senha | F0 | E-mail e senha; cadastro só por link de convite. |
| Dashboard | F1 | KPIs (patrimônio na moeda base, rentabilidade simples, % renda fixa, nº de ativos), cards por carteira-raiz, caixa por conta, últimas movimentações, indicador de cotação defasada com refresh, seletor de moeda base. |
| Carteira em detalhe | F1 | Breadcrumb, KPIs, tabela de ativos (investido, atual, rentab., vencimento, peso), sub-carteiras. |
| Adicionar/editar ativo | F1 | Formulário por tipo (união discriminada), seleção instituição → conta → carteira, compra inicial com aporte opcional, pré-visualização do card, reclassificar. |
| Ativo | F1 | Detalhe, metadata, lotes (renda fixa), operações, valores manuais. |
| Lançar operação / transferência | F1 | Todos os tipos, transferências de caixa e de custódia entre contas, aporte correspondente, edição e exclusão com auditoria. |
| Contas e Instituições | F1 | CRUD, catálogo global, moeda da conta, arquivar. |
| Importar arquivo | F1 | Upload JSON/CSV, relatório de validação, prévia, aplicar, desfazer por lote. |
| Configurações | F1 | Moeda base, exportação completa, excluir conta. |
| Performance | F2 | Área patrimonial, rentabilidade por carteira vs CDI, donut por classe, destaques, custo de oportunidade do caixa. |
| Operações Previstas | F2 | Eventos corporativos pendentes com confirmar/negar. |
| Importação por IA (Upload, Processando, Revisão, Confirmação) | F3 | Wireframes telas 5–8. |

Fora do MVP: "Relatórios" (F4), paletas alternativas, drag-and-drop na árvore, responsivo.

---

## 4. Stack tecnológica

### Frontend (`frontend/`)

React 19 + Vite 8 + TypeScript 5.9 (strict); MUI 9; TanStack Router (params e search params tipados com Zod) e TanStack Query; React Hook Form + Zod 4; Recharts 3. Tipos gerados com `openapi-typescript` e schemas Zod de formulário gerados com `orval` a partir de `backend/openapi.json`; nunca escritos à mão.

**Por que React + Vite e não Next.js:** o app inteiro fica atrás de autenticação; SSR não traz benefício. O backend já é a camada de dados.

### Backend (`backend/`)

NestJS 11 (12 se o spike provar nestjs-zod nele) com adapter Fastify; Drizzle ORM 0.45 (queries complexas no tagged template `sql`; ltree via `customType`); Zod 4 com nestjs-zod gerando OpenAPI 3.1; BullMQ; Passport + JWT; `@anthropic-ai/sdk` na F3; `decimal.js` para dinheiro. Os processadores BullMQ (cotações, séries, câmbio, curva) rodam no mesmo código, em processo separado (`lastro-jobs`).

**Por que NestJS:** domínio com árvore recursiva, cálculos financeiros, jobs e fluxo de IA precisa de estrutura modular imposta. **Por que Drizzle:** SQL-first, sem esconder window functions, CTEs e operadores ltree.

### Worker de cálculos (`backend/worker/`, Fase 2)

Python 3.12 sem framework web: pandas 3, scipy 1.18, psycopg 3, bullmq 3. Consumidor puro: lê `position_events`, `position_lots`, `asset_valuations`, `quotes`, `market_series` e `fx_rates`; escreve snapshots, TWR e XIRR. Itera por usuário setando o contexto de tenant (RLS continua valendo). Nenhuma regra de negócio existe em duas linguagens: posições e valorização são do NestJS; performance é do worker.

### Banco de dados

PostgreSQL 16 com `ltree`, `pgcrypto` e `pg_trgm`. Redis 7 para o BullMQ (`noeviction`, AOF). `NUMERIC` para dinheiro, devolvido como string pelo driver.

### Infra e hospedagem

Um servidor OCI (Toronto) já operado por Coolify. Projeto "lastro" com `lastro-web` (estático), `lastro-api`, `lastro-jobs` (mesma imagem da API, `HTTP_ENABLED=false`), Postgres e Redis como serviços; `lastro-worker` na F2. App e API na mesma origem: `lastro.hmmb.app.br` e `lastro.hmmb.app.br/api` (sem CORS; cookies `SameSite=Lax`). Backups diários para OCI Object Storage (S3). Cada serviço só redeploya quando a sua pasta muda (Watch Paths). Custo fixo adicional: zero.

### Repositório

Um único repositório `hmmb-lastro` com `backend/`, `frontend/` e `docs/`, sem tooling de monorepo: cada app tem `package.json` e lockfile próprios; CI com filtros de path. Tooling: npm, Node 24, ESLint 10 + Prettier, Vitest 5 nos dois apps, uv + ruff + pyright + pytest no worker, GitHub Actions, Conventional Commits, trunk-based com PR e squash.

---

## 5. Multi-tenant e isolamento de dados

Shared database, shared schema, isolamento por RLS. Toda tabela de usuário tem `user_id NOT NULL`, `ENABLE` e `FORCE ROW LEVEL SECURITY` e a policy:

```
user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
```

Contexto ausente resulta sempre em zero linhas, em conexão nova ou reaproveitada do pool. O backend abre uma transação por request (depois do guard JWT), chama `set_config('app.current_user_id', <id>, true)` e propaga a transação por AsyncLocalStorage (nestjs-cls); nenhum service recebe a conexão à mão. Jobs por usuário usam o mesmo utilitário (`runAsUser`).

Roles: `lastro_owner` (dono das tabelas; migrations), `lastro_api` e `lastro_worker` (sem ownership, sem superusuário, sem `BYPASSRLS`). Roles são criadas por um bootstrap único fora das migrations; migrations contêm só DDL, policies e `ALTER DEFAULT PRIVILEGES`. Um teste automatizado no CI enumera as tabelas de usuário e prova leitura e escrita cruzadas bloqueadas.

Sem RLS, com grants mínimos: `users`, `auth_tokens`, `refresh_tokens` (o login e o refresh consultam antes de existir contexto), `institution_catalog`, `quotes`, `market_series`, `fx_rates`, `holidays`, `job_runs`.

---

## 6. Modelagem de dados

Fonte única do schema: Drizzle com migrations versionadas; o SQL gerado pelo `drizzle-kit generate` é o artefato revisável (`docs/design/schema.md`, DS-01). O Apêndice A do handoff é a referência de partida; as diferenças estão em `docs/PLAN.md` §3.1.

### Entidades

| Entidade | Papel | Regras principais |
|---|---|---|
| `users` | Conta de acesso. | E-mail, senha (argon2id), `is_admin`, `base_currency`. Convites e resets em `auth_tokens`; sessões em `refresh_tokens`. |
| `institution_catalog` | Catálogo global de corretoras, bancos, exchanges e custódia própria. | Semeado; só leitura para a API; chave dos blueprints da F3. |
| `institutions` | Instituição do usuário. | `catalog_id` opcional ("outra" livre), `slug` único por usuário, `archived_at`. |
| `accounts` | Conta numa instituição (PF, conjunta, PJ). | Moeda imutável após a primeira operação; um caixa por conta na mesma moeda; `archived_at`; exclusão bloqueada com histórico. |
| `portfolios` | Nó da árvore lógica. | `path` ltree com labels = uuid em hex; nome em coluna própria; nome único entre irmãos; profundidade ≤ 8; `UNIQUE (user_id, path)`. |
| `assets` | Posição num instrumento dentro de uma conta. | `account_id` imutável; `portfolio_id` obrigatório exceto no caixa (CHECK); `market` obrigatório quando há ticker; único `(account_id, market, ticker)`; `metadata` JSONB validado por união discriminada Zod. |
| `asset_reclassifications` | Auditoria de troca de carteira. | Reclassificar não é operação financeira. |
| `operations` | Fatos financeiros; fonte da verdade. | Tipos: `external_deposit`, `withdrawal`, `buy`, `sell`, `dividend`, `interest_jcp`, `interest`, `amortization`, `maturity`, `internal_transfer_out/in`, `custody_transfer_out/in`, `split`, `reverse_split`, `bonus_shares`, `fee`, `tax`. `source` enum + `source_ref` (único por usuário), `seq` para ordem intradia, `currency`, `cash_amount` quando a moeda do ativo difere da conta, `metadata` (taxa do lote, fator de split). |
| `position_events`, `position_lots` | Projeções do motor de posições (quantidade, PM, custo, caixa, P&L realizado, lotes de renda fixa). | Recomputáveis a partir de `operations`; reconstruídas a cada escrita. |
| `asset_valuations` | Valores por usuário: marcação manual e valor na curva. | `kind` (`manual`, `curve`), `value_kind` (`unit`, `total`). |
| `quotes`, `market_series`, `fx_rates`, `holidays` | Dados de mercado globais. | `quotes (market, symbol, date)`; séries `cdi`, `selic`, `ipca`; câmbio USD/CAD/EUR → BRL; feriados ANBIMA. |
| `audit_log` | Auditoria genérica (edição e exclusão de operações, contas, carteiras). | `before`/`after` JSONB. |
| `import_batches` | Lotes de importação por arquivo (F1) e por IA (F3). | `kind`; extração e revisão ficam no lote; operações só nascem no "Aplicar"; desfazer por lote. |
| `job_runs` | Execuções de jobs. | Alimenta o indicador de defasagem e o endpoint admin. |
| `portfolio_snapshots`, `account_snapshots` | Cache diário do worker (F2). | `user_id` e `base_currency`; recomputáveis. |
| `expected_events` | Operações Previstas (F2). | Viram `operations` quando aplicadas. |

### Decisões de modelagem

- **Operações como fonte da verdade; tudo o mais é derivado.** Projeções e snapshots são caches recomputáveis.
- **Caixa implícito.** Uma linha por evento; o saldo do caixa deriva da tabela de sinais (§9). Saldo negativo permitido e sinalizado.
- **Capital externo** só entra por `external_deposit` e só sai por `withdrawal`. Transferências entre contas (caixa ou custódia) não alteram o capital externo.
- **Ativos polimórficos via JSONB** validado por tipo; enums do Postgres fechados agora, porque só crescem.
- **Ltree com labels de uuid** para renomear sem reescrever paths; mover subárvore reescreve o prefixo dos descendentes num único serviço transacional.
- **Ordem intradia** por `(occurred_at, prioridade por tipo, seq)`; edição preserva `seq`.
- **Exclusão de usuário** em cascata; exportação completa desde a F1.

---

## 7. Dados de mercado e câmbio

| Dado | Fonte | Fase | Observação |
|---|---|---|---|
| Cotações B3 (ações, FIIs, ETFs) | brapi.dev | F1 | Plano gratuito: 15 mil requisições/mês, 1 simultânea, 3 meses de histórico, token por cadastro. Histórico mais longo: spike S4. |
| CDI, Selic, IPCA | BCB SGS (12, 11, 433) | F1 | Histórico carregado uma vez, atualização diária. |
| Câmbio USD, CAD, EUR → BRL | BCB PTAX (Olinda), venda de fechamento | F1 | Cruzadas via BRL; dia sem cotação usa a anterior. |
| Feriados | ANBIMA | F1 | Arquivo versionado no repositório; base 252. |
| Tesouro, CDB, LCI/LCA, debênture | Cálculo determinístico (curva por lote) | F1 | Sem marcação a mercado. |
| Fundos, cripto, ações internacionais, outro | Valor manual | F1 | `asset_valuations`. |
| Fundos | Dados abertos da CVM por CNPJ | F2 | Substitui o valor manual. |
| Cotações e eventos EUA/CA | Polygon.io | F2 | Uma integração só. |
| Cripto | CoinGecko | F2 | |
| Eventos corporativos BR | dadosdemercado.com.br (spike S7); brapi como fallback | F2 | |
| Notas de corretagem | API da Anthropic | F3 | Centavos por nota. |
| Arquivos e backups | OCI Object Storage (S3) | F0 e F3 | |

Toda integração fica atrás de uma interface de provider. Planos gratuitos mudam: limites validados nos spikes e documentados nas tarefas. Nenhum serviço pago sem aprovação.

**Atualização.** Jobs no processo `lastro-jobs`: séries e câmbio diários; cotações às 22h (`America/Sao_Paulo`) para os tickers com posição; curva diária por usuário; refresh manual com rate limit por usuário. Falha registrada em `job_runs` e visível na UI como "cotação de DD/MM". Novas operações aparecem na hora; preços são do último fechamento.

---

## 8. Fluxo de IA — importação de notas (Fase 3)

Antes de qualquer código: validar a extração com notas reais (Clear, Avenue) direto no Claude.ai; acerto abaixo de 90% nos casos comuns exige repensar a UX.

Pipeline: upload para o OCI Object Storage → hash SHA-256 e deduplicação por conta → texto extraível ou PDF inteiro ao modelo → JSON conforme schema Zod (re-prompt automático se falhar) → matching contra ativos da conta → `import_batches.raw_extraction` e `review` (mapeamento revisado). As `operations` só nascem no "Aplicar", numa transação, com `import_batch_id`; desfazer em 24 h apaga pelo lote. Conta de origem obrigatória; blueprint por instituição do catálogo, começando pela Clear. Score de confiança por operação (extração, regex de ticker, plausibilidade numérica, match com ativo existente, consistência entre notas). Mapeamento ativo → carteira em três camadas (match exato, regras do usuário, similaridade). Match com Operações Previstas pendentes.

---

## 9. Cálculos financeiros

### Sinais por tipo de operação

| Tipo | `total_value` | `tax_withheld` | Caixa da conta | Posição |
|---|---|---|---|---|
| `external_deposit` | valor | — | + | — |
| `withdrawal` | valor | — | − | — |
| `buy` | qtd × PU (bruto) | — | −(total + fees), ou −`cash_amount` | +qtd; custo += total + fees; abre lote (RF) |
| `sell` | qtd × PU (bruto); RF: valor líquido recebido | IR/IOF | +(total − fees − tax) ou +`cash_amount` | −qtd; P&L realizado; RF consome lotes FIFO por valor na curva |
| `dividend`, `interest_jcp`, `interest` | líquido creditado | IR | +total | — |
| `amortization` | líquido creditado | IR | +total | RF: principal pró-rata nos lotes; FII/ações: reduz custo médio |
| `maturity` | líquido recebido | IR + IOF | +total | fecha todos os lotes |
| `internal_transfer_out/in` | valor na moeda de cada conta | — | −/+ | — |
| `custody_transfer_out/in` | custo transferido | — | 0 | −/+ qtd com custo; sem P&L |
| `split`, `reverse_split` | 0 | — | 0 | qtd += delta; custo total mantido |
| `bonus_shares` | qtd × custo atribuído | — | 0 | +qtd; custo += total |
| `fee` | valor | — | − | — |
| `tax` | valor; em fundo com `quantity`: come-cotas | — | − (0 no come-cotas) | come-cotas: −qtd, custo proporcional |

### Preço médio

`PM_novo = (PM × qtd + preço × qtd_comprada + custos) / (qtd + qtd_comprada)`. Venda não altera o PM; split e grupamento mantêm o custo total; bonificação soma ações ao custo atribuído pela empresa. Duas visões, sem rótulo fiscal: por conta (persistida) e consolidada por instrumento somando contas `individual` (sob demanda). Contas conjuntas e PJ só por conta. O relatório de IR (F4) oferece as duas visões e o usuário escolhe.

### Renda fixa por lotes

Cada `buy` é um lote com data, principal e taxa/indexador próprios. Tesouro e debênture: quantidade de títulos + preço unitário. CDB, RDB, LC, LCI/LCA: `quantity` em unidades de principal (cofrinhos com N aportes e resgates parciais). Curva por lote, com DU = dias úteis desde a aplicação (calendário ANBIMA, base 252):

- prefixado: `principal × (1 + taxa)^(DU/252)`;
- percentual do CDI: `principal × Π (1 + pct × CDI_d)`; CDI + spread: fator diário composto;
- IPCA+: principal corrigido pelo IPCA acumulado (mês corrente pelo último índice publicado pró-rata em dias úteis; divergência esperada documentada) × `(1 + taxa_real)^(DU/252)`;
- Tesouro Selic: acumula a Selic diária (+ spread).

Resgates consomem lotes por FIFO proporcionalmente ao valor na curva na data. Valor exibido bruto, sem IR regressivo nem IOF projetados. Marcação a mercado fora do escopo.

### Capital externo, moeda e rentabilidade

`capital_externo = Σ external_deposit − Σ withdrawal`, cada fluxo convertido à moeda base pela taxa da operação quando houver, senão pela `fx_rates` da data. Na F1: rentabilidade simples rotulada — consolidado contra o capital externo líquido; carteira com duas parcelas (ganho não realizado, e proventos mais P&L realizado dos ativos hoje na carteira) sobre o custo total das compras. Na F2: TWR (comparável ao CDI e ao IPCA) e MWR/XIRR (`scipy.optimize.brentq` sobre o XNPV, testado contra planilha), calculados pelo worker na moeda base do usuário e persistidos nos snapshots; trocar a base recomputa. Fluxo externo de um nó é tudo que cruza a fronteira do nó (consolidado: aportes e saques; conta: mais transferências; carteira: compras entram, vendas e proventos saem para o caixa). Custo de oportunidade do caixa no consolidado e por conta.

Em proventos, `total_value` é o líquido creditado e `tax_withheld` guarda o IR; a UI explicita "rentabilidade líquida de IR na fonte, comparação com CDI bruto". Dinheiro: `decimal.js` no Nest, `Decimal` no Python; `NUMERIC` do driver como string; cálculo com 8 casas, saída com 2 half-up.

---

## 10. Operações Previstas (Fase 2)

Eventos corporativos declarados e ainda não refletidos nas operações: dividendos, JCP, desdobramentos, grupamentos, bonificações, amortizações (subscrição prevista, fora do MVP). Sync diário após as cotações, por polling, com upsert idempotente (`NULLS NOT DISTINCT`). Quantidade estimada = posição na data-com, lida das projeções. Um evento pendente é confirmado manualmente (cria a operação, `source = expected_event`), confirmado pela importação por IA (F3) ou negado; sem ação após a `pay_date`, expira.

---

## 11. Roadmap

Detalhe, dependências, critérios de aceite e tamanhos em `docs/PLAN.md`.

- **Fase 0 — Esqueleto.** Host OCI/Coolify, repositório, versões fixadas, NestJS + Drizzle + RLS testada, contrato OpenAPI, auth por convite, BullMQ, front com tema, deploy, backup restaurado. Entregável: "logo por convite em produção e vejo o shell vazio".
- **Fase 1 — MVP manual.** Instituições e contas, árvore, ativos, operações, motor de posições com projeções, dados de mercado (brapi, BCB, PTAX, feriados), curva por lote, valores manuais, dashboard e carteira em moeda base, importação de arquivo, exportação, e2e, migração real conciliada. Entregável: "o histórico real está no app e bate com as planilhas".
- **Fase 2 — Performance e histórico.** Worker Python, snapshots, TWR/XIRR, benchmarks, recomputação, tela de Performance, cotações EUA/CA e cripto, fundos via CVM, Operações Previstas.
- **Fase 3 — Importação por IA.** Validação com notas reais, pipeline, telas 5–8, match com Operações Previstas.
- **Fase 4 — Backlog.** Metas de alocação, relatórios de IR, responsivo, compartilhamento em família, calendário, Google, e-mail transacional, paletas, drag-and-drop.

Se apertar, cortar nesta ordem: tela de Instituições separada; prévia de posições na importação; tela do ativo separada; tela de configurações.

---

## 12. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Notas reais quebram a extração por IA. | Spike com notas reais antes da F3; meta de 90%. |
| R2 | Tesouro Direto sem API. | Curva por lote. |
| R3 | Conversão de moeda enganosa. | Valores nativos, `fx_rates` por data, moeda base explícita, "moeda original". |
| R4 | Eventos corporativos. | Enum fechado agora; lógica conforme aparecer; casos dourados. |
| R5 | Lock-in. | Exportação na F1; backup na F0 com restauração testada. |
| R6 | brapi gratuita dá 3 meses de histórico. | Spike S4: backfill de fonte gratuita, plano Pro (com aprovação) ou performance a partir da coleta. |
| R7 | Host OCI compartilhado. | Folga medida; limites por serviço; backups fora do host; runbook. |
| R8 | Ecossistema em transição (TS 7, Nest 12). | TS 5.9 e Nest 11 fixos; spikes; Renovate mensal. |
| R9 | Roteamento por path no Coolify. | Spike; fallback subdomínio no mesmo site. |
| R10 | RLS contornada. | Roles separadas, `FORCE`, `nullif`, teste que enumera tabelas. |
| R11 | Float ou arredondamento. | Decimal em tudo; lint anti-`parseFloat`; regra única documentada. |
| R12 | Dados da migração. | Formato canônico, validação por linha, prévia, desfazer, conciliação por tipo. |
| R13 | Renda fixa com N aportes. | Lotes FIFO com casos dourados do extrato. |
| R14 | Fuso e dias úteis. | Clock `America/Sao_Paulo` com teste de virada; feriados versionados. |
| R15 | Fontes gratuitas mudam. | Providers por interface; nada pago sem aprovação. |
| R16 | Deploy sobreposto e migrations. | Advisory lock; migrations compatíveis com a versão anterior; duas URLs de banco. |
| R17 | Importação O(N²). | Rebuild uma vez por ativo/conta no "Aplicar". |
| R18 | Testes de banco flaky. | Banco por worker a partir de template; truncamento. |
| R19 | argon2 nativo em arm64. | `node:24-slim`; build validado no spike. |
| R20 | Pool esgotado por jobs. | Processo `lastro-jobs` separado com pool próprio. |
| R21 | Convenções numéricas divergem de extratos. | Convenção documentada; conciliação por principal em renda fixa. |

---

## 13. Estrutura do repositório

```
/hmmb-lastro
  /backend
    /src
      /modules        auth, users, admin, institutions, accounts, portfolios, assets,
                      operations, positions, quotes, valuations, dashboard, import,
                      export, jobs, corporate-events (F2), snapshots (F2)
      /database       schema Drizzle, migrations (DDL, policies, grants), seeds
      /tenancy        CLS, transação por request, runAsUser
      /common         problem-details, pipes, decorators, decimal, clock
      main.ts
    /worker           Python (F2): calculators, jobs, pyproject
    /scripts          export-openapi, db-bootstrap, invite-create
    openapi.json      versionado; CI falha se desatualizado
    Dockerfile
  /frontend
    /src
      /api            schema.ts (openapi-typescript) e zod/ (orval), gerados
      /routes         TanStack Router (file-based)
      /components, /features, /theme
    Dockerfile
  /docs
    PLAN.md · decisions.md · HMMB_Finance_Planejamento.md (este) · claude-ai-instructions-v3.md
    /design           schema.md, modules.md, api-conventions.md,
                      positions-and-valuation.md, worker-contract.md
    import-format.md · infra.md · runbooks/
  /.github/workflows  backend.yml, frontend.yml, e2e.yml
  docker-compose.dev.yml
  HMMB_Finance_Handoff.md
```

---

## 14. Próximos artefatos a produzir

Na ordem em que o plano os exige: DS-03 convenções de API; DS-01 schema final com SQL gerado; DS-02 mapa de módulos; DS-04 regras do motor e da valorização com casos dourados; DS-05 formato de importação e prompt de conversão; DS-06 contrato do worker (F2). Também o resumo para as instruções do projeto no Claude.ai (`docs/claude-ai-instructions-v3.md`).

---

*Atualizar este documento sempre que um ADR novo alterar o modelo, o escopo ou a infra.*
