# HMMB Finance — Handoff para planejamento no Claude Code

> Documento de entrada para uma sessão de planejamento no Claude Code. Consolida o modelo vigente (planejamento v2, de 07/05/2026, mais as Operações Previstas, de 29/05/2026), corrige problemas encontrados na revisão do planejamento e lista o que precisa ser decidido antes de qualquer código.
>
> Preparado em 24/09/2026. Idioma de trabalho: português. Código, schema, enums, identificadores e commits: inglês.

---

## 0. Sua missão nesta sessão

Produzir o **plano de implementação** do HMMB Finance. Nenhum código de produto nesta sessão.

1. Leia este documento inteiro. Se `finance-hmmb-backend` e `finance-hmmb-frontend` já existirem, inspecione o conteúdo antes de planejar; este handoff assume repositórios vazios.
2. Numa única rodada, faça as perguntas das seções 9.1 e 9.2, que bloqueiam as Fases 0 e 1. Em cada uma, apresente a recomendação deste documento e peça confirmação ou alternativa. Inclua as premissas da seção 9.4 para confirmação em bloco. Não reabra nada da seção 3.
3. Com as respostas, monte o plano no formato da seção 12.
4. Depois que o Hugo aprovar: salve o plano em `finance-hmmb-backend/docs/PLAN.md`, registre cada decisão como ADR em `finance-hmmb-backend/docs/decisions.md` e, se `HMMB_Finance_Planejamento.md` estiver no workspace, atualize-o para a v3. Então pare. A implementação começa em outra sessão, uma tarefa por vez.

---

## 1. Produto

Web app desktop-first para acompanhar investimentos pessoais. Não é app de gastos nem de contas a pagar: o foco é saldo, rentabilidade, alocação e movimentações de carteiras de investimento. Usuários: o Hugo e amigos, em modelo multi-tenant, sem monetização. Custo fixo alvo de cerca de US$ 5/mês de VPS, mais centavos de API da Anthropic por nota importada. Interface em pt-BR.

O nome do produto está em discussão, e "HMMB Finance" é nome de trabalho. Mantenha o nome de exibição numa única constante de configuração e fora de identificadores de banco, pacotes e rotas.

O modelo tem duas dimensões ortogonais. A **física** diz onde o dinheiro está custodiado: Instituição → Conta → Ativo. A **lógica** diz como o investidor classifica o patrimônio: uma árvore de carteiras aninháveis em N níveis (ltree), em que cada carteira contém sub-carteiras e/ou ativos. Todo ativo pertence a exatamente uma conta, fixa, e a exatamente uma carteira, que pode mudar a qualquer momento sem efeito contábil. A exceção é o `available_balance`, o caixa de cada conta, que existe só na dimensão física. Cada nó da árvore mostra valor consolidado, rentabilidade no período e contra o CDI, peso na carteira-pai e alocação por classe.

Tipos de ativo: Tesouro Direto, CDB, LCI/LCA, debênture, ações BR, ações EUA, FIIs, ETFs, fundos, cripto, outro e saldo disponível.

---

## 2. Estado atual e fontes

Nenhum código de produto foi escrito; o projeto está saindo da fase de planejamento.

| Fonte | Situação |
|---|---|
| Este handoff | Consolida o modelo vigente e as correções. Prevalece em tudo que for modelo de dados. |
| `HMMB_Finance_Planejamento.md` **v2** (07/05/2026) | Introduziu instituições e contas. Referência para rationale, cotações, fluxo de IA e riscos. |
| `HMMB_Finance_Planejamento.md` **v1** | É a cópia ainda anexada ao projeto no Claude.ai. Desatualizada: sem instituições nem contas, `available_balance` por carteira-raiz, transferências entre carteiras. Não use para modelo de dados. |
| Instruções do projeto no Claude.ai | Parcialmente na v1 (caixa por carteira-raiz, transferências "entre carteiras"). As regras de arquitetura e de código continuam valendo e estão na seção 3. |
| `Finance_App_Wireframes.html` | 8 telas com histórias de usuário e critérios de aceite, desenhadas sobre a v1: não há Contas, Instituições nem seleção de conta no formulário de ativo. Depende de `design-canvas.jsx` e `tweaks-panel.jsx`, que não existem, então não renderiza sozinho; leia como código-fonte. O CSS imita o MUI mas não é MUI, e os dados são mock. Use para layout, densidade, tokens de cor e tipografia. |
| Página HTML de documentação (maio/2026) | DER com 7 entidades, da v1. Não use como fonte do modelo. |

Em caso de conflito: respostas do Hugo nesta sessão > este handoff > planejamento v2 > instruções do projeto > wireframes (só para UI).

---

## 3. Decisões fechadas — não reabrir

| Tema | Decisão |
|---|---|
| Frontend | SPA com React + Vite + TypeScript. TanStack Router (params e search params tipados com Zod), TanStack Query, MUI, React Hook Form + Zod, Recharts. Versões: D4. |
| Backend | NestJS com adapter Fastify; Drizzle ORM, com queries complexas no tagged template `sql`; Zod; BullMQ; Passport + JWT; `@anthropic-ai/sdk` na Fase 3. |
| Worker | Python 3.12 em `finance-hmmb-backend/worker`, sem framework web: pandas, scipy, psycopg3. Recebe jobs via BullMQ e grava resultados no Postgres. |
| Banco | PostgreSQL 16 com `ltree`, `pgcrypto` e `pg_trgm`. Redis para o BullMQ (hospedagem: D3). |
| Infra | VPS Hetzner (~US$ 5/mês) com Postgres, Redis, API e worker; frontend na Vercel Hobby; Cloudflare R2 para arquivos. Forma de deploy no VPS: D2. |
| Repositórios | Dois, independentes, sem monorepo: `finance-hmmb-frontend` e `finance-hmmb-backend`. Os nomes `hmmb-frontend`/`hmmb-backend` que aparecem no planejamento estão desatualizados. Tipos do front gerados com `openapi-typescript` a partir do OpenAPI do backend, nunca escritos à mão. |
| Módulos NestJS | Um por domínio, cada um com module, controller, service e dto: `auth`, `users`, `institutions`, `accounts`, `portfolios`, `assets`, `operations`, `quotes`, `corporate-events`, `import`, `snapshots`. |
| Multi-tenant | Shared schema com RLS; `user_id` em todas as tabelas de usuário (dados de mercado são globais). A API conecta com role sem superusuário; superusuário só para migrations e administração. |
| Arquitetura | Lógica de negócio só no NestJS; o frontend é UI e estado local. Cálculos financeiros pesados (TWR, XIRR, snapshots) só no worker. |
| Código | `strict: true`; nunca `any`; type assertion só com justificativa explícita em comentário. Validação sempre com Zod, com schemas no backend expostos via OpenAPI. Ambiguidade de requisito: perguntar antes de implementar. |
| Proibido sugerir | Next.js; serverless, BaaS ou no-code como alternativa arquitetural; ORM que não seja o Drizzle. |
| Visual | Desktop-first. Tema dark "ocean" (tons de azul), fonte Jost, estética sóbria e densa, mais "terminal de operador" do que "banco". Uma paleta no MVP. |

---

## 4. Modelo de domínio vigente

### 4.1 Entidades

| Entidade | Papel | Regras principais |
|---|---|---|
| `institutions` | Corretora, banco, exchange ou custódia própria. | Por usuário, com `slug` único por usuário (chave dos blueprints de IA). Catálogo global: D14. |
| `accounts` | Conta numa instituição: PF individual, conjunta ou PJ. | Tem exatamente um `available_balance`. |
| `portfolios` | Nó da árvore lógica. | `path` em ltree com ids como labels e nome em coluna própria, para renomear sem reescrever paths. |
| `assets` | Posição num instrumento dentro de uma conta. | `account_id` obrigatório e imutável; `portfolio_id` obrigatório, exceto no caixa; campos por tipo em `metadata` (JSONB validado com Zod). |
| `asset_reclassifications` | Auditoria de troca de carteira. | Reclassificar é `UPDATE assets.portfolio_id` mais um registro aqui; não é operação financeira. |
| `operations` | Fatos financeiros. | Fonte da verdade: posição, preço médio, caixa e patrimônio são sempre derivados. |
| `quotes`, `market_series`, `holidays` | Dados de mercado globais. | Sem RLS. As duas últimas são novas (E6, E12). |
| `asset_valuations` | Valores por usuário: marcação manual e valor na curva. | Nova (E7). |
| `portfolio_snapshots`, `account_snapshots` | Cache diário escrito pelo worker. | Recomputável a partir de `operations`. |
| `import_batches` | Lotes de importação por IA. | `account_id` obrigatório: define o blueprint e o escopo de matching. |
| `expected_events` | Operações Previstas (seção 5). | Viram `operations` quando aplicadas. |

Ativos sem instituição formal (cold wallet, ouro físico) usam uma instituição do tipo `self_custody` com uma conta.

### 4.2 Regras financeiras

- Capital externo só entra por `external_deposit` e só sai por `withdrawal`: `capital_externo = Σ external_deposit − Σ withdrawal`. Todos os outros tipos são movimentos internos por definição; não existe booleano de reinvestimento.
- O `available_balance` é ativo `is_system`, um por conta, de valor nominal e sem cotação. Entra no patrimônio e na rentabilidade, o que torna visível o custo de oportunidade do caixa parado. Não pertence a nenhuma carteira.
- Compras debitam o caixa da conta onde o ativo está; vendas e proventos (`dividend`, `interest_jcp`, `interest`, `amortization`, `maturity`) creditam. A forma de representar isso é a D8.
- Transferências internas são entre contas (TED/PIX): par `internal_transfer_out`/`internal_transfer_in` nos caixas das duas contas, ligado por `linked_operation_id`. Não alteram o capital externo.
- Em proventos, `total_value` é o líquido creditado e `tax_withheld` guarda o IR retido. A UI sempre explicita "rentabilidade líquida de IR na fonte — comparação com CDI bruto".
- A operação guarda `currency` e `fx_rate`. A exibição é em BRL ao câmbio do dia, com opção de ver na moeda original.
- Preço médio: `PM_novo = (PM × qtd + preço × qtd_comprada) / (qtd + qtd_comprada)`. Venda não altera o PM; desdobramento e grupamento mudam a quantidade mantendo o custo total; bonificação soma as ações novas com o custo atribuído pela empresa (E9). Escopo e custos incluídos: D7.
- Renda fixa é exibida pelo valor na curva, bruto, sem marcação a mercado (fórmulas corrigidas em E6).
- Benchmarks: CDI bruto (SGS 12) e IPCA (SGS 433), com histórico carregado uma vez e atualização diária.

### 4.3 Rentabilidade

TWR serve para comparar com benchmarks; MWR/XIRR responde "o que aconteceu com o meu dinheiro". Os dois são calculados pelo worker no job noturno e persistidos. No XIRR, aportes externos são fluxos negativos, saques e o valor atual (fluxo terminal) são positivos, e movimentos internos ficam de fora.

Proposta de fluxo por nível, a formalizar no contrato do worker (E8). O princípio: fluxo externo de um nó é todo valor que cruza a fronteira desse nó.

| Nível | Fluxos externos |
|---|---|
| Consolidado do usuário (inclui caixa) | `external_deposit`, `withdrawal` |
| Conta | os anteriores + `internal_transfer_in` / `internal_transfer_out` |
| Carteira (não contém caixa) | compras entram; vendas e proventos saem para o caixa da conta; reclassificações contam como entrada e saída se o histórico seguir a classificação "como era" (D15) |

O custo de oportunidade do caixa (participação média do caixa no período e perda estimada em p.p. contra o CDI) faz sentido no consolidado e por conta, não por carteira.

---

## 5. Operações Previstas (`expected_events`)

Registro de eventos corporativos declarados e ainda não refletidos nas operações: dividendos, JCP, desdobramentos, grupamentos, bonificações e amortizações. Subscrição está prevista no enum, fora do MVP.

Fontes: dadosdemercado.com.br para ações BR e FIIs (principal), brapi.dev para histórico de proventos, Polygon.io para EUA. Nenhuma avisa por push, então é polling. Um job diário roda depois das cotações: para cada posição com quantidade maior que zero, busca eventos com `pay_date` a partir de hoje ou `ex_date` recente e faz upsert idempotente com deduplicação. A quantidade estimada é a posição na data-com, o que exige do motor de posições a consulta "posição em data".

Um evento `pending` tem três saídas: confirmação manual, que cria a operação (`source = 'expected_event:<id>'`) e marca o evento como `applied`; confirmação pela importação por IA (Fase 3), que liga o evento à operação extraída da nota; ou negação (`denied`). Sem ação depois da `pay_date`, o evento vira `expired`.

Fases registradas quando o recurso foi desenhado: tabela e sync na F1, UI de confirmação na F2, match com a IA na F3. Confirmar na D16. O item "Calendário de eventos" da Fase 4 fica praticamente coberto por aqui.

---

## 6. Integrações externas

| Dado | Fonte | Fase | Observação |
|---|---|---|---|
| Cotações de ações BR, FIIs e ETFs BR | brapi.dev | F1 | Confirmar exigência de token e limites atuais do plano gratuito. |
| CDI, Selic e IPCA | BCB SGS (séries 12, 11 e 433) | F1 | Necessário já na F1 por causa da renda fixa (E12). |
| Feriados para dias úteis | Calendário nacional (ANBIMA) | F1 | Base 252 (E6). |
| Valores de fundos, debêntures e "outro" | Sem fonte definida | F1 | Valor manual (E7, D13). |
| Eventos corporativos BR | dadosdemercado.com.br | D16 | No levantamento de maio, os preços não eram públicos: validar o plano gratuito num spike. |
| Cotações EUA | Alpha Vantage | F2 | O planejamento cita 25 requisições/dia no plano gratuito. Considerar o Polygon também para cotações e manter uma integração a menos. |
| Eventos corporativos EUA | Polygon.io | F2 | Plano gratuito. |
| Cripto | CoinGecko | F2 | |
| Câmbio USD/BRL | BCB PTAX | F2 | |
| Notas de corretagem | API da Anthropic | F3 | Centavos por nota. |
| Arquivos | Cloudflare R2 | F0 e F3 | Backups (F0) e PDFs (F3). |

Toda integração fica atrás de uma interface de provider, para trocar de fonte sem mexer no domínio. Planos gratuitos mudam com frequência: valide os limites reais antes de fechar o desenho.

---

## 7. Errata — corrija no plano

Problemas encontrados na revisão, em ordem de gravidade. As correções já estão aplicadas no Apêndice A, marcadas com o ID.

**E1 — A RLS dos snapshots não funciona.** `portfolio_snapshots` e `account_snapshots` não têm `user_id`, e a policy compara o `user_id` da linha-pai sem consultar o usuário corrente: ou a criação falha por coluna inexistente, ou nada é isolado. Correção: `user_id NOT NULL` nas duas tabelas e a policy padrão, o que também cumpre a regra de `user_id` em toda tabela de usuário.

**E2 — O contexto de tenant, do jeito que está escrito, não funciona.** `SET LOCAL app.current_user_id = ${userId}` vira bind parameter no `sql` do Drizzle, e o Postgres não aceita parâmetros em `SET`. Correção: em cada request, abrir uma transação e chamar `set_config(..., true)`; todas as queries do request usam essa transação, propagada por CLS/AsyncLocalStorage em vez de passada à mão entre services. Nas policies, usar `nullif(current_setting('app.current_user_id', true), '')::uuid`, para que contexto ausente resulte sempre em zero linhas, tanto em conexão nova quanto em conexão reaproveitada do pool.

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
  // todas as queries do request usam `tx`
});
```

**E3 — A RLS pode ser contornada sem ninguém perceber.** Dono da tabela, superusuário e roles com `BYPASSRLS` ignoram RLS. Correção: as tabelas pertencem à role de migration; API e worker usam roles sem ownership, sem superusuário e sem `BYPASSRLS`; `FORCE ROW LEVEL SECURITY` em todas as tabelas de usuário; teste automatizado de isolamento no CI, cobrindo leitura e escrita cruzadas, inclusive com query sem filtro de `user_id`.

**E4 — Operações pendentes da importação contaminariam os saldos.** O pipeline cria `operations` com `applied_at = NULL`, mas essa coluna existe em `import_batches`, não em `operations`. Correção recomendada: extração e revisão ficam em `import_batches` (`raw_extraction` e `review`), e as `operations` só nascem no "Aplicar", numa transação, com `import_batch_id`. Assim `operations` guarda só fatos confirmados, e desfazer continua sendo apagar pelo lote. Fase 3.

**E5 — O numpy-financial não tem XIRR**, só a IRR de períodos regulares. Correção: XIRR com `scipy.optimize` (por exemplo, `brentq` sobre o XNPV), como a seção de cálculos do planejamento já prevê; remover o numpy-financial se não sobrar uso. Testar contra resultados conhecidos, usando a função XIRR de uma planilha como oráculo.

**E6 — As fórmulas de valor na curva estão erradas ou incompletas.** A do prefixado usa o prazo até o vencimento, o que dá o valor final, não o atual. Correção, sempre com DU = dias úteis desde a aplicação:

- prefixado: `principal × (1 + taxa)^(DU/252)`;
- percentual do CDI: `principal × Π (1 + pct × CDI_d)`, com o CDI diário (SGS 12) de cada dia útil;
- IPCA+: principal corrigido pelo IPCA acumulado, com regra definida para o mês corrente ainda sem índice publicado, × `(1 + taxa_real)^(DU/252)`;
- Tesouro Selic: acumula a Selic diária (SGS 11), não o CDI.

Todas dependem do calendário de feriados. `metadata.index_type` precisa de valores fechados (por exemplo `prefixed`, `cdi_pct`, `ipca_plus`, `selic`).

**E7 — Ativos sem fonte de preço não têm onde guardar valor.** Fundos, debêntures e "outro" não têm cotação definida, e o valor na curva é específico de cada usuário (depende da data e da taxa da aplicação). Nada disso cabe em `quotes`, que é global e indexada por ticker. Correção: tabela `asset_valuations` por usuário, com RLS, para marcações manuais e valores na curva.

**E8 — Os snapshots não suportam o que o planejamento promete.** TWR e MWR "persistidos nos snapshots", fluxo externo do dia, caixa, custo de oportunidade e destaques por ativo não têm colunas. Correção: o contrato do worker define as colunas (por exemplo, fluxo líquido do dia, índice TWR acumulado e `invested_brl` definido explicitamente como capital líquido que entrou no nó), adota a tabela de fluxos da seção 4.3 e decide se os destaques por ativo vêm de snapshot por ativo ou de cálculo sob demanda. O total do usuário é a soma dos `account_snapshots`, porque todo ativo, inclusive o caixa, está em uma conta.

**E9 — Falta bonificação em `operation_type`.** O cálculo de PM cita bonificação e `expected_events` tem `bonus_shares`, mas aplicar esse evento não teria tipo de operação. Correção: adicionar `bonus_shares` ao enum, com `unit_price` igual ao custo atribuído por ação informado pela empresa (custo zero apenas dilui o PM). Enums do Postgres só crescem com facilidade (`ADD VALUE`), então vale fechar agora o que já é previsível.

**E10 — As regras do `available_balance` podem ser mais simples e mais fortes.** "Criado no primeiro `external_deposit`" falha se um provento ou uma transferência chegar antes. Correção: criar o caixa na mesma transação que cria a conta; trocar o `EXCLUDE` da v2 por índice único parcial, que dá a mesma garantia de forma mais simples e é suportado pelo Drizzle; levar a regra "`portfolio_id` nulo só no caixa" para um `CHECK` no banco.

**E11 — "UUID curto" como label do ltree pode misturar subárvores.** Dois labels truncados iguais fazem `path <@ x` devolver as duas subárvores. Correção: label igual ao id completo em hex, sem hífens; `UNIQUE (user_id, path)`; `parent_id` e `path` mantidos consistentes num único ponto (service transacional ou trigger), com teste; mover subárvore reescrevendo o prefixo dos descendentes.

**E12 — Há dependências fora de fase.** A renda fixa na curva (F1) precisa das séries do BCB e do calendário, que o roadmap só traz na F2. A exportação CSV/JSON deveria existir "desde a Fase 1" (Risco 5), mas não está no escopo da F1. Backup do banco não aparece em fase nenhuma. Correção: séries, calendário e exportação na F1; backup na F0.

**E13 — `openapi-typescript http://localhost:3000/api-json` não roda no CI do front**, onde não há backend de pé. Correção proposta: o backend exporta `openapi.json` por script, sem subir o servidor, versiona o arquivo e o CI falha se ele estiver desatualizado; o front tem um script `sync:api` que lê esse arquivo do repositório irmão e gera `src/types/api.ts`, também versionado. O CI do front só faz typecheck.

**E14 — O "suporte nativo a ltree" do Drizzle precisa ser verificado.** Se a versão escolhida não tiver tipo `ltree`, o caminho é `customType`, com migrations SQL para extensões, índice GiST, policies e roles. A fonte única do schema é o Drizzle com migrations versionadas; `docs/schema.sql` passa a ser gerado por dump, nunca editado à mão.

**E15 — A chave de `quotes` pode colidir entre mercados.** `(ticker, date)` não distingue B3, EUA e ids de cripto. Correção: chave com mercado ou fonte (por exemplo, `(market, symbol, date)`) ou uma tabela de instrumentos. É barato decidir agora e caro migrar depois.

**E16 — Fuso horário e dias úteis não estão definidos.** O job "às 22h" precisa de fuso explícito, `America/Sao_Paulo`, porque servidores costumam rodar em UTC. "Hoje", para campos `DATE`, é sempre no fuso de São Paulo, e dias úteis vêm do calendário de feriados.

**E17 — Um critério do wireframe conflita com a estratégia de cotações.** "Patrimônio total atualizado em tempo real" contra cotações D-1 com refresh manual. Interpretação proposta: novas operações aparecem na hora; preços são do último fechamento, com indicador de defasagem.

**E18 — O formulário "Adicionar ativo" mistura cadastro com compra.** Ele pede valor investido e data de compra, que no modelo são dados de operação. Correção: salvar cria o ativo e uma operação `buy` na mesma transação, com o efeito no caixa definido na D8.

**E19 — Falta o cliente BullMQ do lado Python.** O worker consome jobs do BullMQ, mas as dependências não incluem o pacote `bullmq` para Python. Correção: spike na F0 para validar a compatibilidade com a versão do BullMQ no Node, retries e jobs repetíveis. Se não servir, definir outro mecanismo de disparo antes de seguir.

**E20 — Ajustes menores de integridade**, já aplicados no Apêndice A:

- deduplicação de `expected_events` com `NULLS NOT DISTINCT`, porque com `ex_date` nula a constraint atual não deduplica;
- `ON DELETE SET NULL` nas FKs de carteira de `asset_reclassifications`, senão o histórico impede excluir carteiras, e em `expected_events.operation_id`, para que desfazer uma importação não trave;
- `ON DELETE CASCADE` em `expected_events.asset_id`;
- FK em `operations.import_batch_id`;
- no máximo uma conta padrão por usuário;
- `metadata` de `debenture`, `etf`, `fund` e `other` ainda por definir;
- `users` sem RLS, porque o login consulta por e-mail antes de existir contexto, e com grants mínimos para a role da API.

---

## 8. Fora do escopo do MVP (Fases 0 e 1)

- Gastos, orçamento e contas a pagar.
- Marcação a mercado de renda fixa; só valor na curva.
- Cotações em tempo real.
- Layout responsivo e app nativo.
- Apuração de IR, DARF e relatórios fiscais (Fase 4).
- Importação por IA (Fase 3); cotação automática de ativos EUA e cripto (Fase 2).
- Múltiplas paletas e drag-and-drop na árvore.
- Compartilhamento de carteiras entre usuários (Fase 4).
- Planos, monetização e o selo "Pro" do wireframe.

---

## 9. Decisões em aberto

Cada item traz a pergunta, as opções e a recomendação. "Bloqueia F0" quer dizer que o plano da Fase 0 não fecha sem a resposta.

### 9.1 Bloqueiam a Fase 0

**D1 — Autenticação e sessão.** A tabela `users` só tem e-mail, e o método não foi definido. Opções: e-mail e senha (hash forte, como argon2) com cadastro por convite; magic link, que exige provedor de e-mail transacional; OAuth do Google via Passport. Para a sessão: access token curto em memória com refresh token rotativo em cookie `httpOnly`, ou cookie de sessão simples. Recomendação: e-mail e senha com convite, porque o público é fechado, e refresh em cookie `httpOnly`. A recuperação de senha pode começar manual e ganhar e-mail depois; Google fica como segundo provedor opcional.

**D2 — Domínio, deploy e dimensionamento.** App e API no mesmo site (`app.<domínio>` na Vercel e `api.<domínio>` no VPS) permitem cookies `SameSite=Lax` e CORS restrito. Com `*.vercel.app`, a API fica cross-site, exige `SameSite=None` e fica sujeita ao bloqueio de cookies de terceiros. O wireframe usa `app.hmmb.finance`. Para o deploy no VPS: Docker Compose com proxy reverso e TLS (Caddy ou Traefik), ou Coolify, que já foi cogitado e traz TLS, deploy por git e backup agendado para storage compatível com S3, ao custo de RAM. O planejamento cita o plano CX11; confirmar o plano e o preço atuais da Hetzner, a região (latência para o Brasil) e a RAM, já que Postgres, Redis, Node e Python com pandas, mais o Coolify se for usado, tendem a não caber com folga em 2 GB. Recomendação: subdomínios de um domínio próprio; Coolify se a prioridade for operar pouco, Compose puro se for controle e RAM.

**D3 — Redis no VPS ou no Upstash.** O planejamento põe o Redis no Docker Compose do VPS; as instruções do projeto dizem Upstash. O BullMQ mantém conexões bloqueantes e executa comandos periódicos mesmo ocioso, o que tende a consumir planos cobrados por comando, além de somar latência de rede. Recomendação: Redis no próprio VPS, a custo zero, com `maxmemory-policy noeviction` (exigência do BullMQ) e persistência AOF.

**D4 — Versões.** O planejamento fixa React 18 e MUI v6, que já não são as versões major mais recentes; num projeto novo, confirmar se é intencional. O mesmo vale para NestJS, Vite, TanStack e Zod, cuja v4 mudou APIs e precisa ser suportada pelas integrações NestJS ↔ Zod ↔ OpenAPI. Recomendação: majors estáveis atuais, conferidas no npm no dia do setup e fixadas no lockfile, desde que o spike da D5 passe.

**D5 — Contrato entre front e back.** Três partes. Primeira: a biblioteca que gera OpenAPI a partir de DTOs Zod no NestJS com Fastify (por exemplo, `nestjs-zod`), a validar num spike. Segunda: a validação dos formulários do front. "Zod compartilhado com o backend" não é possível com dois repositórios sem pacote comum; as opções são gerar schemas Zod a partir do OpenAPI (orval, ou `@hey-api/openapi-ts` com plugin Zod) ou manter schemas locais só para regras de UI. Terceira: a representação de dinheiro e datas na API. Recomendação: gerar os schemas Zod do OpenAPI, para não duplicar regra; dinheiro como string decimal; datas em `YYYY-MM-DD`; erros num formato único.

**D6 — Tooling e convenções**: CI (GitHub Actions?), gerenciador de pacotes, ferramenta de projeto Python, lint e format, runner de testes no front, no Nest e no worker, convenção de commits e de branches. Recomendação: o padrão de cada ecossistema (por exemplo pnpm, ESLint + Prettier, Vitest no front, Jest ou Vitest no Nest, pytest, uv), Conventional Commits e PRs pequenos, salvo preferência do Hugo.

### 9.2 Bloqueiam a Fase 1

**D7 — Escopo fiscal do preço médio.** A v2 calcula o PM por `(user_id, ticker, institution_id)` e afirma que é exigência da Receita. O entendimento que predomina em fontes de mercado é outro: preço médio único por ativo no CPF, somando as compras de todas as corretoras (há quem cite o art. 58 da IN RFB 1.585/2015), com corretagem e emolumentos incluídos no custo de aquisição. Confirmar com fonte oficial ou contador antes de implementar. Recomendação: PM fiscal consolidado por titular e instrumento, com custos incluídos; PM por conta ou instituição apenas como visão de custódia e conciliação. Contas PJ (`corporate`) e conjuntas têm regras próprias e não entram no PM da pessoa física. A tabela `institutions` continua justificada pelos blueprints e pela custódia.

**D8 — Como o caixa aparece nas operações.** (a) Implícito: uma linha por evento (a `buy` fica no ativo), com o saldo do `available_balance` derivado por regra de sinal de cada tipo. (b) Explícito: cada evento gera também uma linha espelho no caixa, como já acontece nas transferências. Junto vem o caso da compra sem saldo: bloquear, permitir saldo negativo ou oferecer "registrar aporte junto", que gera o `external_deposit`. Recomendação: (a), para não existirem duas linhas que possam divergir. No lançamento manual, a opção "registrar aporte correspondente" vem ligada por padrão. Saldo negativo é permitido, mas sinalizado, porque importações podem chegar fora de ordem.

**D9 — Migração das planilhas.** (a) Lançar o histórico completo. (b) Data de corte com posição de abertura: `external_deposit` mais `buy` pelo preço médio, com `source = 'migration'` e rentabilidade medida a partir do corte. (c) Importador CSV simples na F1, aplicando (a) ou (b). Recomendação: (b) com (c). Um CSV de posições e operações é o que torna "migrar as planilhas" viável na F1.

**D10 — Edição e exclusão de operações.** `operations` é "imutável", mas lançamento manual precisa de correção. Opções: permitir editar e excluir as manuais (delete + insert na mesma transação, com auditoria) ou aceitar só estorno por operação inversa. Em qualquer caso, escrita retroativa invalida os snapshots a partir de `occurred_at` e precisa enfileirar recomputação (F2). Recomendação: editar e excluir permitidos para `source = 'manual'`, com auditoria; operações importadas só saem pelo desfazer do lote.

**D11 — Onde vive cada cálculo**, para que a mesma regra não exista em TypeScript e em Python. Recomendação: o NestJS é dono do motor de posições (quantidade, PM, caixa por conta e posição em data, que o job de Operações Previstas já pressupõe); o worker é dono da valorização (curva de renda fixa, snapshots, TWR, XIRR). A única sobreposição é a quantidade por data no worker, coberta por fixtures compartilhadas: os mesmos casos em JSON rodando nos testes dos dois lados. Consequência: o worker entra na F1, com a curva e as séries, e não só na F2. Para processar todos os usuários, o worker itera por usuário setando o contexto, o que mantém o RLS como rede de segurança, em vez de usar role com `BYPASSRLS`. Jobs globais (cotações, séries) escrevem em tabelas sem RLS.

**D12 — KPIs da F1 sem TWR.** O dashboard do wireframe mostra "Rentab. 12 meses" e "vs CDI", que dependem da F2. Recomendação: na F1, rentabilidade simples com rótulo explícito (valor atual contra capital externo líquido no consolidado; valor atual contra custo nas carteiras); TWR e comparação com o CDI entram na F2.

**D13 — Ativos sem cotação automática na F1**: ações EUA, cripto, fundos, debêntures e "outro". Bloquear esses tipos até a fase deles ou aceitá-los com valor manual (E7). Recomendação: aceitar com valor manual, porque a migração das planilhas precisa de todos os ativos desde a F1.

**D14 — Instituições por usuário (v2) ou catálogo global.** Hoje cada usuário cadastraria a sua "XP" e digitaria o `slug`, mas os blueprints da F3 são indexados pelo slug, que então precisa bater exatamente. Alternativa: catálogo global semeado (XP, Clear, Rico, BTG, Nubank, Inter, Toro, Avenue e os bancos principais), só leitura para a API, com as instituições do usuário apontando para ele quando houver e "outra" livre. Recomendação: catálogo global, com os blueprints vinculados a ele.

### 9.3 Podem esperar (Fase 2 em diante)

**D15 — Performance histórica depois de uma reclassificação.** Recalcular os snapshots pela classificação atual ("como está hoje") ou pela classificação vigente em cada data ("como era"), usando `asset_reclassifications`, o que exige auditar também a movimentação de subárvores e tratar a reclassificação como fluxo (seção 4.3). Recomendação: "como está hoje" no MVP, porque é idempotente e simples; a auditoria já guarda o necessário para evoluir.

**D16 — Em que fase entram as Operações Previstas.** O registro atual é tabela e sync na F1, UI na F2 e match com IA na F3. Sync sem tela de confirmação não entrega nada ao usuário. Recomendação: sync e confirmação manual juntos na F2; match com IA na F3.

### 9.4 Premissas para confirmar em bloco

- `occurred_at` é a data da negociação ou do evento; a liquidação (D+1, D+2) é ignorada.
- Moeda base BRL; USD convertido pela PTAX do dia na exibição.
- Valor na curva bruto, sem IR regressivo nem IOF projetados; IR detalhado só nos relatórios da Fase 4.
- UI só em pt-BR, sem biblioteca de i18n.
- Desktop-only no MVP.
- Excluir carteira com conteúdo fica bloqueado até o conteúdo ser movido ou excluído.
- O menu "Relatórios", o selo "Pro" e o painel de paletas do wireframe ficam fora do MVP.

---

## 10. Escopo por fase

### Fase 0 — Esqueleto

Entregável: "consigo logar e ver uma página vazia em produção", com as fundações de que o resto depende.

- [ ] Dois repositórios com TS strict, lint, format, typecheck e testes rodando no CI; `CLAUDE.md` em cada um, com as regras das seções 3 e 11 e os comandos do projeto.
- [ ] Docker Compose de desenvolvimento sobe Postgres 16 com as extensões, Redis, API e worker, com healthchecks.
- [ ] Schema do núcleo em Drizzle, com migrations versionadas e a errata aplicada: `users`, `institutions`, `accounts`, `portfolios`, `assets`, `asset_reclassifications`, `operations`, `quotes`. As outras tabelas nascem na fase que as usa.
- [ ] Roles de migration (owner), API e worker; RLS com `FORCE`; teste de isolamento passando no CI contra Postgres real (E3).
- [ ] Contexto de tenant por request implementado como infraestrutura, e não repetido em cada service (E2).
- [ ] Autenticação ponta a ponta conforme a D1.
- [ ] OpenAPI exportado; tipos do front gerados e compilando (E13, D5).
- [ ] Front com Vite, React, TanStack Router e Query e MUI, com tema derivado dos tokens do wireframe; shell (sidebar e topbar) vazio; tela de login.
- [ ] Spike do BullMQ: a API enfileira, o worker Python consome e grava no Postgres (E19).
- [ ] Deploy conforme a D2: API, worker, Postgres e Redis no VPS com TLS; front na Vercel; healthcheck público.
- [ ] Backup diário do Postgres no R2, criptografado e com retenção; restauração testada uma vez.

### Fase 1 — MVP manual

Entregável: "migrar as planilhas para o app — o sistema já é útil".

Escopo:

- Instituições (conforme a D14) e contas, com o caixa criado junto com a conta (E10).
- Árvore de carteiras: criar, renomear, mover subárvore ("mover para", sem drag-and-drop) e excluir (premissa da 9.4).
- Ativos com formulário polimórfico (união discriminada de Zod por tipo), seleção instituição → conta → carteira, compra inicial na mesma transação (E18) e reclassificação com auditoria.
- Operações manuais e transferências entre contas; edição conforme a D10.
- Motor de posições no NestJS (D11): quantidade, PM (D7), caixa por conta e posição em data.
- Dados de mercado: cotações BR via brapi num job noturno, mais refresh manual com rate limit por usuário; séries de CDI, Selic e IPCA e o calendário de feriados; valor na curva (E6) calculado conforme a D11; valores manuais (E7, D13); indicador de cotação desatualizada.
- Telas: Dashboard (KPIs conforme a D12, cards por carteira-raiz, caixa por conta, últimas movimentações), Carteira em detalhe, Adicionar/editar ativo, Contas, Instituições, Lançar operação ou transferência.
- Migração conforme a D9 e exportação completa em CSV/JSON.
- Operações Previstas, se a D16 as mantiver na F1.

Critérios de aceite:

- [ ] O Hugo migra as planilhas reais, e o patrimônio por conta e por carteira bate com as planilhas dentro de uma tolerância definida no plano.
- [ ] Testes de domínio com casos dourados: PM com desdobramento, grupamento e bonificação; caixa com compras, vendas, proventos e transferências; valor na curva nos quatro indexadores.
- [ ] A exportação contém todos os dados do usuário.
- [ ] Nenhum KPI exibido depende de dado que só existe na F2.

Telas sem wireframe: Contas, Instituições, Lançar operação ou transferência, Login e a seleção de conta no formulário de ativo; mais adiante, Operações Previstas. Siga a linguagem visual das telas existentes.

Correspondência entre os chips do wireframe e `asset_type`: Renda Fixa + subcategoria → `treasury_bond`, `cdb`, `lci_lca` ou `debenture`; Ação → `stock_br` ou `stock_us`, conforme o mercado; FII → `fii`; ETF → `etf`; Cripto → `crypto`; Fundo → `fund`; Outro → `other`.

### Fase 2 — Performance e histórico (nível de épico)

Contrato do worker (E8); snapshots noturnos por carteira e por conta; TWR e XIRR; comparação com CDI e IPCA; custo de oportunidade do caixa; recomputação depois de escrita retroativa (D10); tela de Performance; D15. Ativos EUA (cotações e PTAX) e cripto. Contas em dólar (Avenue, por exemplo), com transferência BRL → USD registrando `fx_rate` e tratamento de spread e IOF a definir. Operações Previstas conforme a D16.

### Fase 3 — Importação por IA (nível de épico)

Antes de construir, validar a extração com notas reais direto no Claude.ai (Risco 1): acerto abaixo de 90% nos casos comuns exige repensar a UX. Pipeline da v2, com conta de origem obrigatória, blueprint por instituição (D14), deduplicação por hash, a correção E4, score de confiança, revisão inline, aplicar e desfazer em 24 horas e match com Operações Previstas. Começar pelas uma ou duas corretoras do Hugo.

### Fase 4 — Backlog

Metas de alocação com alerta de desvio; relatórios de IR (bens e direitos, rendimentos); layout responsivo; compartilhamento de carteiras em família; o que sobrar de calendário de eventos.

### Se o prazo apertar, cortar nesta ordem

Drag-and-drop na árvore (fica o "mover para"); múltiplas paletas; tela de Instituições elaborada (fica um CRUD simples); a importação por IA inteira, que não é MVP.

---

## 11. Requisitos transversais

**Dinheiro.** `NUMERIC` no banco. O driver devolve `NUMERIC` como string: nunca converter para `number`. Biblioteca decimal no TypeScript e `Decimal` no Python para contabilidade; float só dentro do solver do XIRR. Uma regra de arredondamento única, documentada e testada.

**Datas.** `America/Sao_Paulo` para "hoje" e para agendamentos; dias úteis pelo calendário de feriados (E16).

**Testes.** Casos dourados de domínio conferidos contra planilha; fixtures compartilhadas entre TypeScript e Python para as regras sobrepostas (D11); testes de integração contra Postgres real para RLS, ltree e migrations; um teste ponta a ponta do caminho feliz (login → conta → carteira → compra → dashboard).

**Segurança.** Segredos fora do repositório; CORS restrito ao domínio do app; rate limit na autenticação e no refresh de cotações; logs sem valores financeiros nem payloads de usuário; lockfiles versionados.

**Operação.** Logs estruturados; healthchecks; falha do job noturno visível, com dado defasado sinalizado na UI e registrado em log; migrations aplicadas no deploy de forma controlada.

**Dados do usuário.** Exportação completa (F1), exclusão da própria conta com cascata, backups criptografados.

**Custo.** Nenhum serviço pago novo sem aprovação do Hugo; toda dependência de plano gratuito fica atrás de uma interface.

---

## 12. Formato esperado do plano

1. **Perguntas e premissas**, numa rodada só (seção 0).
2. **ADRs curtos** (contexto, decisão, consequências) para cada decisão tomada.
3. **Artefatos de design**, como tarefas explícitas que vêm antes do código que depende deles:
   - schema final em Drizzle, com o SQL gerado para revisão;
   - mapa de módulos NestJS: endpoints principais, DTOs e dependências entre módulos;
   - contrato do worker: filas, payloads, idempotência, retries, ordem do job noturno, tabelas lidas e escritas e fluxos por nível (E8);
   - convenções de API: erros, paginação, dinheiro e datas.
4. **Plano por fase → épico → tarefa.** F0 e F1 no nível de tarefa; F2 e F3 no nível de épico, com dependências e riscos; F4 como lista. Cada tarefa tem ID (como `F1-07`), repositório, objetivo, dependências, critério de aceite verificável, forma de verificar (comando ou teste) e tamanho: P até meio dia, M até dois dias; acima disso, quebre.
5. **Spikes com timebox**, antes das tarefas que dependem deles: cliente BullMQ em Python; Zod → OpenAPI no NestJS com Fastify; Drizzle com ltree, RLS e contexto por transação; limites reais da brapi e do dadosdemercado; extração de uma nota real (antes da F3).
6. **Caminho crítico** e o que front e back podem fazer em paralelo depois que o contrato de API fechar.
7. **Riscos com mitigação**, incluindo os do planejamento v2.
8. **Marcos** com um entregável demonstrável por fase.

---

## 13. Regras de trabalho na execução

- Uma tarefa por vez. Ao concluir: typecheck, lint e testes verdes, e a tarefa marcada no `PLAN.md`.
- Diante de ambiguidade, perguntar antes de implementar.
- Decisão nova ou alterada vira ADR em `decisions.md`, atualiza o planejamento e gera um aviso ao Hugo quando as instruções do projeto no Claude.ai precisarem mudar.
- Mudou o contrato da API, os tipos do front são regerados no mesmo ciclo.
- Nunca: `any`, type assertion sem justificativa, `number` ou float para dinheiro, desligar ou contornar RLS, segredo no repositório, serviço pago sem aprovação.

---

## Apêndice A — Schema de referência consolidado

Base: planejamento v2 + Operações Previstas, com as correções deste handoff marcadas `[E#]` e os pontos que dependem de decisão marcados `[D#]`. É referência para o plano, não a migration final: a fonte da verdade será o schema Drizzle (E14).

```sql
CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Usuários ─────────────────────────────────────────────────────────────
-- Sem RLS: o login consulta por e-mail antes de existir contexto de tenant.
-- A role da API recebe só os grants necessários. [E20]
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  -- [D1] credenciais ou identidades externas, conforme o método de autenticação
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Dimensão física: instituições e contas ───────────────────────────────
CREATE TYPE institution_type AS ENUM (
  'brokerage', 'bank', 'crypto_exchange', 'self_custody', 'other'
);

-- [D14] se houver catálogo global: institution_catalog (sem RLS, com os blueprints)
--       e institutions.catalog_id opcional
CREATE TABLE institutions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- "Clear Corretora"
  slug        TEXT NOT NULL,                 -- 'clear', 'xp': chave do blueprint de IA
  type        institution_type NOT NULL,
  cnpj        TEXT,
  logo_url    TEXT,                          -- opcional, no R2
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, slug)
);
CREATE INDEX institutions_user ON institutions (user_id);

CREATE TYPE account_type AS ENUM ('individual', 'joint', 'corporate');

CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id  UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,             -- "Clear — PF"
  type            account_type NOT NULL DEFAULT 'individual',
  currency        CHAR(3) DEFAULT 'BRL',
  is_default      BOOLEAN DEFAULT FALSE,     -- conta padrão para importações
  metadata        JSONB DEFAULT '{}',        -- número da conta, código do agente etc.
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX accounts_user        ON accounts (user_id);
CREATE INDEX accounts_institution ON accounts (institution_id);
CREATE UNIQUE INDEX accounts_one_default_per_user
  ON accounts (user_id) WHERE is_default;                                 -- [E20]
-- [E10] o available_balance da conta é criado na mesma transação que cria a conta

-- ─── Dimensão lógica: carteiras ───────────────────────────────────────────
CREATE TABLE portfolios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  path               LTREE NOT NULL,         -- [E11] labels = id completo em hex, sem hífens
  parent_id          UUID REFERENCES portfolios(id),
  color              TEXT,
  target_allocation  JSONB,
  created_at         TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT portfolios_user_path_unique UNIQUE (user_id, path)          -- [E11]
);
CREATE INDEX portfolios_path_gist ON portfolios USING GIST (path);
-- o UNIQUE acima substitui o índice portfolios_user_path da v2

-- ─── Ativos ───────────────────────────────────────────────────────────────
CREATE TYPE asset_type AS ENUM (
  'treasury_bond', 'cdb', 'lci_lca', 'debenture', 'stock_br', 'stock_us',
  'fii', 'etf', 'fund', 'crypto', 'available_balance', 'other'
);

CREATE TABLE assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, -- imutável após criação
  portfolio_id  UUID REFERENCES portfolios(id),                           -- muda na reclassificação
  type          asset_type NOT NULL,
  ticker        TEXT,
  name          TEXT NOT NULL,
  currency      CHAR(3) DEFAULT 'BRL',
  is_system     BOOLEAN DEFAULT FALSE,       -- TRUE só no available_balance
  metadata      JSONB DEFAULT '{}',          -- validado com Zod, união discriminada por type
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- [E10] "portfolio_id nulo só no caixa", garantido no banco
  CONSTRAINT assets_cash_has_no_portfolio
    CHECK ((type = 'available_balance') = (portfolio_id IS NULL))
);
-- [E10] substitui o EXCLUDE da v2: no máximo um available_balance por conta
CREATE UNIQUE INDEX assets_one_cash_per_account
  ON assets (account_id) WHERE type = 'available_balance';
CREATE INDEX assets_user      ON assets (user_id);
CREATE INDEX assets_account   ON assets (account_id);
CREATE INDEX assets_portfolio ON assets (portfolio_id) WHERE portfolio_id IS NOT NULL;
CREATE INDEX assets_ticker    ON assets (user_id, ticker) WHERE ticker IS NOT NULL;
-- metadata por tipo (v2):
--   treasury_bond      { maturity_date, index_type, rate }
--   cdb / lci_lca      { maturity_date, index_type, rate, lockup_until }
--   stock_br / us      { exchange, sector }
--   fii                { segment, dividend_yield_target }
--   crypto             { network, wallet_label }
--   available_balance  {}
--   [E20] debenture, etf, fund e other: a definir no plano
--   [E6]  index_type com valores fechados: prefixed | cdi_pct | ipca_plus | selic

-- Reclassificações: auditoria, sem efeito contábil
CREATE TABLE asset_reclassifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id           UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_portfolio_id  UUID REFERENCES portfolios(id) ON DELETE SET NULL,  -- [E20]
  to_portfolio_id    UUID REFERENCES portfolios(id) ON DELETE SET NULL,  -- [E20]
  occurred_at        TIMESTAMPTZ DEFAULT now(),
  notes              TEXT
);
CREATE INDEX asset_reclassifications_asset ON asset_reclassifications (asset_id);
-- [D15] histórico "como era" exige auditar também a movimentação de subárvores

-- ─── Importação (Fase 3) ──────────────────────────────────────────────────
-- Se nascer só na F3, a FK de operations.import_batch_id entra na mesma migration.
CREATE TABLE import_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, -- blueprint e escopo
  files           JSONB NOT NULL,            -- inclui o sha256 de cada arquivo (dedupe por conta)
  raw_extraction  JSONB,
  review          JSONB,                     -- [E4] mapeamento revisado, até o "Aplicar"
  applied_at      TIMESTAMPTZ,
  reverted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── Operações ────────────────────────────────────────────────────────────
CREATE TYPE operation_type AS ENUM (
  -- externos: os únicos que alteram o capital externo
  'external_deposit', 'withdrawal',
  -- internos
  'buy', 'sell', 'dividend', 'interest_jcp', 'interest', 'amortization', 'maturity',
  'internal_transfer_out', 'internal_transfer_in',   -- entre CONTAS do mesmo usuário
  -- ajustes
  'split', 'reverse_split',
  'bonus_shares',                                     -- [E9]
  'fee', 'tax'
);

CREATE TABLE operations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id             UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type                 operation_type NOT NULL,
  quantity             NUMERIC(20, 8),
  unit_price           NUMERIC(20, 8),       -- bonus_shares: custo atribuído por ação [E9]
  total_value          NUMERIC(20, 2) NOT NULL,
  fees                 NUMERIC(20, 2) DEFAULT 0,
  tax_withheld         NUMERIC(20, 2) DEFAULT 0,
  currency             CHAR(3) DEFAULT 'BRL',
  fx_rate              NUMERIC(20, 8),
  occurred_at          DATE NOT NULL,        -- data da negociação ou do evento (premissa 9.4)
  linked_operation_id  UUID REFERENCES operations(id),                   -- par de transferência
  source               TEXT,  -- 'manual' | 'import:<slug>:<arquivo>' | 'expected_event:<id>' | 'migration'
  import_batch_id      UUID REFERENCES import_batches(id),               -- [E20]; [E4] só ao aplicar
  created_at           TIMESTAMPTZ DEFAULT now()
);
-- [D8]  efeito no caixa: implícito (derivado por tipo) ou linha espelho no available_balance
-- [D10] edição e exclusão de operações manuais, com auditoria
CREATE INDEX operations_asset_date ON operations (asset_id, occurred_at);
CREATE INDEX operations_batch      ON operations (import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX operations_linked     ON operations (linked_operation_id) WHERE linked_operation_id IS NOT NULL;

-- ─── Dados de mercado (globais, sem RLS) ──────────────────────────────────
CREATE TABLE quotes (
  ticker    TEXT NOT NULL,
  date      DATE NOT NULL,
  close     NUMERIC(20, 8) NOT NULL,
  currency  CHAR(3) DEFAULT 'BRL',
  source    TEXT,
  PRIMARY KEY (ticker, date)                 -- [E15] avaliar (market, symbol, date)
);

-- [E6][E12] indexadores, benchmarks e câmbio
CREATE TABLE market_series (
  series  TEXT NOT NULL,     -- 'cdi' (SGS 12) | 'selic' (SGS 11) | 'ipca' (SGS 433) | 'ptax_usd'
  date    DATE NOT NULL,     -- IPCA: primeiro dia do mês de referência
  value   NUMERIC(20, 10) NOT NULL,
  source  TEXT,
  PRIMARY KEY (series, date)
);

-- [E6][E16] feriados nacionais, para dias úteis (base 252)
CREATE TABLE holidays (
  date  DATE PRIMARY KEY,
  name  TEXT
);

-- ─── Valores por usuário ──────────────────────────────────────────────────
-- [E7] marcação manual e valor na curva
CREATE TABLE asset_valuations (
  asset_id  UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  value     NUMERIC(20, 2) NOT NULL,         -- na moeda do ativo; definir: posição ou unitário
  kind      TEXT NOT NULL,                   -- 'manual' | 'curve'
  PRIMARY KEY (asset_id, date)
);

-- ─── Snapshots: cache recomputável, escrito pelo worker ───────────────────
CREATE TABLE portfolio_snapshots (
  portfolio_id     UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,       -- [E1]
  date             DATE NOT NULL,
  total_value_brl  NUMERIC(20, 2) NOT NULL,
  invested_brl     NUMERIC(20, 2) NOT NULL,  -- [E8] capital líquido que entrou no nó
  -- [E8] demais colunas no contrato do worker: fluxo do dia, índice TWR acumulado etc.
  PRIMARY KEY (portfolio_id, date)
);

CREATE TABLE account_snapshots (
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,       -- [E1]
  date             DATE NOT NULL,
  available_brl    NUMERIC(20, 2) NOT NULL,
  total_value_brl  NUMERIC(20, 2) NOT NULL,
  PRIMARY KEY (account_id, date)
);

-- ─── Operações Previstas ──────────────────────────────────────────────────
CREATE TYPE corporate_event_type AS ENUM (
  'dividend', 'interest_jcp', 'split', 'reverse_split', 'bonus_shares',
  'amortization', 'rights_offer'             -- rights_offer: previsto, fora do MVP
);
CREATE TYPE expected_event_status AS ENUM (
  'pending', 'confirmed', 'applied', 'denied', 'expired'
);

CREATE TABLE expected_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id               UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,      -- [E20]
  event_type             corporate_event_type NOT NULL,
  ex_date                DATE,               -- data-com
  record_date            DATE,
  pay_date               DATE,
  cash_amount_per_share  NUMERIC(20, 8),     -- dividendo / JCP
  quantity_factor        NUMERIC(20, 8),     -- desdobramento: novo total / total anterior
  bonus_ratio            NUMERIC(20, 8),     -- bonificação: ações novas / total
  estimated_quantity     NUMERIC(20, 8),     -- posição estimada na data-com
  estimated_total_brl    NUMERIC(20, 2),
  source                 TEXT NOT NULL,      -- 'dadosdemercado' | 'polygon' | 'brapi' | 'manual'
  external_id            TEXT,
  operation_id           UUID REFERENCES operations(id) ON DELETE SET NULL,          -- [E20]
  status                 expected_event_status NOT NULL DEFAULT 'pending',
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT expected_events_dedupe
    UNIQUE NULLS NOT DISTINCT (asset_id, event_type, ex_date, source)               -- [E20]
);
CREATE INDEX expected_events_user_status ON expected_events (user_id, status);
CREATE INDEX expected_events_pay_date    ON expected_events (pay_date);

-- ─── RLS [E2][E3] ─────────────────────────────────────────────────────────
-- Pseudocódigo: repetir para cada tabela de usuário
--   institutions, accounts, portfolios, assets, asset_reclassifications, operations,
--   asset_valuations, portfolio_snapshots, account_snapshots, import_batches, expected_events
-- (users, quotes, market_series e holidays ficam de fora)
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON <tabela>
  USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
-- Policy sem comando específico vale para leitura e escrita; sem WITH CHECK,
-- o USING também é aplicado às linhas inseridas e atualizadas.
-- Tabelas pertencem à role de migration; API e worker: sem ownership, sem BYPASSRLS.
```
