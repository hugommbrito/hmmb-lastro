# DS-03 — Convenções da API

> Detalha o ADR-007 (contrato front/back) para quem escreve DTOs no backend e quem consome os tipos gerados no front. Vale para toda rota em `lastro.hmmb.app.br/api` (ADR-003). Decisões novas aqui viram ADR; mudança de convenção passa pelo Hugo. Ferramentas: nestjs-zod + `@nestjs/swagger` no backend (F0-08, spike S2), `openapi-typescript` e `orval` no front (F0-18). Escrito em 26/09/2026, antes do spike S2: onde a ferramenta puder impor outra forma, o spike ajusta este documento.

## 1. Base

- **Origem e prefixo.** `https://lastro.hmmb.app.br/api`. Sem versão no path: front e back saem do mesmo repositório e mudam juntos; quando o contrato muda, os tipos do front são regerados no mesmo PR (PLAN, "Como usar"). Nenhuma rota da SPA começa com `/api` (runbook §4.1).
- **Formato.** JSON UTF-8 nos dois sentidos. Requisições com corpo enviam `Content-Type: application/json`; respostas de erro usam `application/problem+json` (§6).
- **Nomes.** Paths em inglês, plural, kebab-case: `/api/accounts`, `/api/corporate-events`, `/api/institution-catalog`. Campos JSON e parâmetros de query em camelCase: `accountId`, `occurredAt`. Valores de enum em snake_case, iguais aos do banco e do formato de importação (DS-05): `external_deposit`, `stock_intl`, `cdi_plus`. Path params em `{id}`.
- **Identificadores.** UUID v4 em texto (`gen_random_uuid()` no banco); no OpenAPI, `type: string, format: uuid`; no Zod, `z.uuid()`. Nunca ids sequenciais ou derivados de dados do usuário. O `seq` interno das operações (ADR-020) pode sair em leituras para desempate de ordenação, mas nunca entra em escritas.
- **Autenticação.** Access token JWT em `Authorization: Bearer <token>`; refresh token em cookie httpOnly restrito a `/api/auth` (ADR-004). O refresh exige o header customizado `X-Lastro-Refresh: 1`, que é a mitigação de CSRF do ADR-004 (nome proposto aqui; a F0-14 confirma). Rotas públicas: `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/refresh`, aceitar convite e redefinir senha.
- **Correlação.** Toda resposta traz `X-Request-Id`, o mesmo `req.id` do log (F0-05); erros repetem o valor em `requestId` (§6).

## 2. Tipos de dados

| Tipo | JSON | OpenAPI | Zod (backend) | Regra |
|---|---|---|---|---|
| Dinheiro e quantidades | string decimal | `string`, `format: decimal`, `pattern` | `decimalString()` (§3) | Nunca `number`. Ponto decimal, sem milhar, sem sinal `+`, sem expoente. |
| Moeda | string | `enum` | `z.enum(['BRL', 'USD', 'CAD', 'EUR'])` | ISO 4217 (ADR-019). Todo valor monetário vem acompanhado da `currency` do recurso. |
| Data civil | `"2026-09-26"` | `string`, `format: date` | `z.iso.date()` | `YYYY-MM-DD`, data de calendário sem hora nem fuso; "hoje" é o `Clock` em `America/Sao_Paulo` (F0-05). |
| Instante | `"2026-09-26T21:53:41.315Z"` | `string`, `format: date-time` | `z.iso.datetime()` | ISO-8601 sempre em UTC com `Z` e milissegundos. Offsets são rejeitados. |
| Identificador | string | `string`, `format: uuid` | `z.uuid()` | UUID v4. |
| Enum | string snake_case | `enum` | `z.enum([...])` | Lista fechada; valor fora dela é erro de validação. |
| Booleano | `true`/`false` | `boolean` | `z.boolean()` | Nunca `"true"` em texto. |
| Ausente | `null` | `nullable` | `.nullable()` | Respostas trazem todos os campos do schema; sem valor é `null`. Em requisições, campo opcional pode ser omitido; `null` em `PATCH` limpa o campo. |
| Metadata por tipo | objeto | `oneOf` por discriminador | `z.discriminatedUnion('type', [...])` | `operations.metadata` e `assets.metadata` (ADR-020); a união discriminada é o caso de teste do spike S2. |

Datas em colunas `DATE` (`occurredAt`, `date`, `maturityDate`) são sempre data civil. Colunas `TIMESTAMPTZ` (`createdAt`, `updatedAt`, `appliedAt`) são sempre instante. Um campo nunca muda de categoria entre leitura e escrita.

## 3. Dinheiro

Representação única: string decimal com o padrão `^-?(0|[1-9][0-9]*)(\.[0-9]+)?$`. Exemplos válidos: `"0"`, `"1234.56"`, `"-10"`, `"0.00000001"`. Inválidos: `"1,234.56"`, `"1.234,56"`, `"1e3"`, `"+5"`, `".5"`, `"05"`, `1234.56` (número). O driver do Postgres devolve `NUMERIC` como string e a API repassa; o cálculo usa decimal.js (ADR-008 proíbe `parseFloat` e `Number(...)`).

Escala por categoria de campo, alinhada às colunas do schema (handoff, Apêndice A, e PLAN §3.1):

| Categoria | Campos | Entrada | Saída |
|---|---|---|---|
| Valor monetário | `totalValue`, `fees`, `taxWithheld`, `cashAmount`, saldos, custos, P&L | até 2 casas; mais que isso é erro de validação, nunca arredondamento silencioso | 2 casas, half-up (ADR-020) |
| Preço unitário, taxa de câmbio, cotação | `unitPrice`, `fxRate`, `close`, `rate` | até 8 casas | como armazenado, até 8 casas |
| Quantidade | `quantity` | até 18 casas (`NUMERIC(30,18)`, cripto) | como armazenado, sem zeros à direita |
| Fração e índice | rentabilidades, pesos de alocação, `value` de séries | — (calculado) | fração decimal, não percentual: `"0.1234"` = 12,34 %; até 6 casas. O arredondamento interno é do DS-04 |

O schema Zod é um helper único no backend, com a escala como parâmetro:

```ts
// backend/src/common/api/decimal.ts (F0-08)
export const decimalString = (opts: { scale: number; nonNegative?: boolean }) =>
  z
    .string()
    .regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'Número decimal em texto, com ponto e sem milhar.')
    .refine((v) => (v.split('.')[1]?.length ?? 0) <= opts.scale, `No máximo ${opts.scale} casas decimais.`)
    .refine((v) => !opts.nonNegative || !v.startsWith('-'), 'Não pode ser negativo.')
    .meta({ format: 'decimal', examples: ['1234.56'] });
```

O front não converte para `number`: exibe com `Intl.NumberFormat` a partir da string, e os formulários enviam a string que o usuário digitou já normalizada (vírgula → ponto) pelo schema gerado.

## 4. Requisições

- **Validação.** Corpo, query e path passam por DTO Zod (nestjs-zod). Corpo com campo desconhecido é erro de validação (`.strict()`): o front é gerado do mesmo contrato, então campo extra é bug, não evolução.
- **Verbos e status.** `GET` lê. `POST` cria (201 com o recurso criado no corpo) ou executa uma ação sem forma de CRUD (`POST /api/import/batches/{id}/apply`, `POST /api/auth/refresh`; 200 com o resultado). `PATCH` atualiza parcialmente (200 com o recurso inteiro); não há `PUT`. `DELETE` remove (204 sem corpo); arquivar é `PATCH` com `archivedAt` ou uma ação `POST .../archive`, decidido por módulo no DS-02.
- **Filtros de lista.** Query params camelCase; intervalos de data como `from` e `to` inclusivos em data civil; ids como `accountId`, `portfolioId`. Sem filtro por campos livres.
- **Idempotência.** `PATCH` e `DELETE` são idempotentes. `POST` de criação não é; o cliente não repete automaticamente. Chave de idempotência fica para quando houver escrita por integração (F3).

## 5. Respostas

- **Recurso único: sem envelope.** `GET /api/accounts/{id}` devolve o objeto direto (exemplo em §7.1).
- **Listas: `{ items }`.** Toda lista, paginada ou não, devolve `{ "items": [...] }`. Coleções pequenas (instituições, contas, carteiras, catálogo) não paginam e não trazem `nextCursor`. Listas grandes (operações, eventos, cotações, `audit_log`) paginam por cursor e trazem `nextCursor`, que é `null` na última página. Um único formato evita que o front trate array e objeto.
- **Cursor.** `limit` entre 1 e 200, default 50. `cursor` é opaco: base64url de um JSON com a posição keyset (`{ v, k, f }`: versão, chave de ordenação do último item e hash dos filtros). A ordenação de cada lista é fixa e documentada na operação; operações usam `(occurredAt desc, seq desc)`. Cursor ilegível, de outra versão ou emitido com filtros diferentes dos da requisição atual é `400 invalid-cursor`. Sem contagem total: a UI mostra "carregar mais".
- **Campos calculados** (saldo, posição, valor atual) saem no mesmo recurso quando o custo é baixo, senão em sub-recurso (`GET /api/portfolios/{id}/summary`). O DS-02 define por módulo.
- **Cache.** Respostas autenticadas com `Cache-Control: no-store`. Sem ETag no MVP.

## 6. Erros (RFC 9457)

Toda resposta de erro é `application/problem+json`:

```json
{
  "type": "https://lastro.hmmb.app.br/problems/validation-failed",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "2 campos não passaram na validação.",
  "instance": "/api/operations",
  "requestId": "req-42",
  "errors": [
    { "path": "quantity", "message": "Número decimal em texto, com ponto e sem milhar." },
    { "path": "occurredAt", "message": "Data no formato YYYY-MM-DD." }
  ]
}
```

- `type` é uma URI estável por tipo de problema, no namespace `https://lastro.hmmb.app.br/problems/<slug>`; a URL não precisa resolver hoje. O front decide o tratamento por `type`, nunca por `title` ou `detail`, que são texto em pt-BR para exibição e podem mudar.
- `title` é fixo por `type`; `detail` é específico da ocorrência e nunca contém valores financeiros do usuário nem segredos (handoff §11).
- `instance` é o path da requisição; `requestId` liga o erro ao log.
- `errors[]` só aparece em `validation-failed` e `conflict`. `path` usa a notação do React Hook Form, com índices como segmentos (`items.0.quantity`), para o front chamar `setError(path, ...)` sem traduzir; `""` é a raiz.
- Um problema de domínio pode trazer campos extras no nível raiz (extensões da RFC), declarados no schema daquele `type` (§7.2).

Catálogo inicial. Os `type` de 422 crescem com os módulos; cada um entra no OpenAPI como resposta da operação que o lança.

| Status | `type` | Quando |
|---|---|---|
| 400 | `validation-failed` | corpo, query ou path não passam no schema Zod |
| 400 | `malformed-json` | corpo não é JSON |
| 400 | `invalid-cursor` | cursor ilegível ou de outros filtros |
| 401 | `unauthenticated` | sem token, token expirado ou inválido; refresh sem o header `X-Lastro-Refresh` |
| 403 | `forbidden` | usuário autenticado sem permissão (rotas `admin`) |
| 404 | `not-found` | recurso inexistente **ou de outro usuário**: com RLS, o de outro tenant é invisível, e a API não distingue os dois casos |
| 409 | `conflict` | unicidade violada (`sourceRef` repetido, nome de carteira irmã, e-mail já convidado); `errors[]` aponta o campo |
| 422 | um `type` por regra, por exemplo `account-currency-immutable`, `account-archived`, `portfolio-depth-exceeded`, `asset-quantity-insufficient` | regra de domínio, com o corpo bem formado |
| 429 | `rate-limited` | login, refresh e atualização de cotações; traz `Retry-After` |
| 500 | `internal` | erro não tratado; sem `detail`, só `requestId` |
| 501 | `not-implemented` | stub contract-first (§8) |

Implementação: um único filtro de exceções no NestJS (F0-08) converte `ZodValidationException`, exceções HTTP do Nest e uma classe `DomainProblem { type, status, title, detail, extensions }` nesse formato. Nenhum erro sai no formato padrão do Nest.

## 7. Exemplos

### 7.1 Recurso único

```http
GET /api/accounts/0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10
Authorization: Bearer <token>
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
X-Request-Id: req-40

{
  "id": "0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10",
  "institutionId": "7d0b3f0e-2c6a-4d0a-8f2b-1e9c5a3b7d21",
  "name": "Clear",
  "currency": "BRL",
  "availableBalance": "1520.75",
  "archivedAt": null,
  "createdAt": "2026-09-01T13:05:22.000Z",
  "updatedAt": "2026-09-26T21:53:41.315Z"
}
```

Dinheiro como string com 2 casas e a `currency` ao lado; instantes em UTC; ausência como `null`; sem envelope.

### 7.2 Erro de domínio

```http
PATCH /api/accounts/0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10
Content-Type: application/json

{ "currency": "USD" }
```

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
X-Request-Id: req-41

{
  "type": "https://lastro.hmmb.app.br/problems/account-currency-immutable",
  "title": "A moeda da conta não pode mudar",
  "status": 422,
  "detail": "A conta já tem operações registradas; a moeda é fixa depois da primeira (ADR-019).",
  "instance": "/api/accounts/0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10",
  "requestId": "req-41",
  "currency": "BRL",
  "firstOperationAt": "2026-09-02"
}
```

`currency` e `firstOperationAt` são extensões declaradas no schema desse `type`. O corpo era válido; o que falhou foi a regra.

### 7.3 Erro de validação

```http
POST /api/operations
Content-Type: application/json

{ "assetId": "3b1e…", "type": "buy", "occurredAt": "26/09/2026", "quantity": 10, "unitPrice": "32,10", "totalValue": "321.00", "extra": 1 }
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://lastro.hmmb.app.br/problems/validation-failed",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "4 campos não passaram na validação.",
  "instance": "/api/operations",
  "requestId": "req-42",
  "errors": [
    { "path": "occurredAt", "message": "Data no formato YYYY-MM-DD." },
    { "path": "quantity", "message": "Número decimal em texto, com ponto e sem milhar." },
    { "path": "unitPrice", "message": "Número decimal em texto, com ponto e sem milhar." },
    { "path": "extra", "message": "Campo não reconhecido." }
  ]
}
```

### 7.4 Lista com cursor

```http
GET /api/operations?accountId=0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10&from=2026-09-01&to=2026-09-26&limit=2
```

```json
{
  "items": [
    {
      "id": "9a4d1c2e-5b7f-4e3a-8c6d-0f1e2d3c4b5a",
      "assetId": "3b1e6c8d-9f2a-4b7c-a1d3-5e6f7a8b9c0d",
      "accountId": "0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10",
      "type": "buy",
      "source": "manual",
      "sourceRef": null,
      "occurredAt": "2026-09-25",
      "seq": 118,
      "quantity": "10",
      "unitPrice": "32.1",
      "totalValue": "321.00",
      "fees": "0.00",
      "taxWithheld": "0.00",
      "currency": "BRL",
      "cashAmount": null,
      "fxRate": null,
      "metadata": { "type": "buy" },
      "createdAt": "2026-09-25T14:02:11.000Z"
    },
    {
      "id": "2f7c9e1a-3d5b-4a8c-9e0f-6b7a8c9d0e1f",
      "assetId": null,
      "accountId": "0c9e2f2a-6f3e-4a1e-9d4c-2c4c2e1f9a10",
      "type": "external_deposit",
      "source": "manual",
      "sourceRef": null,
      "occurredAt": "2026-09-24",
      "seq": 117,
      "quantity": null,
      "unitPrice": null,
      "totalValue": "1000.00",
      "fees": "0.00",
      "taxWithheld": "0.00",
      "currency": "BRL",
      "cashAmount": null,
      "fxRate": null,
      "metadata": { "type": "external_deposit" },
      "createdAt": "2026-09-24T12:00:00.000Z"
    }
  ],
  "nextCursor": "eyJ2IjoxLCJrIjpbIjIwMjYtMDktMjQiLDExN10sImYiOiI4ZTNhMTBjZiJ9"
}
```

Página seguinte: a mesma query mais `&cursor=eyJ2IjoxLCJrIjpbIjIwMjYtMDktMjQiLDExN10sImYiOiI4ZTNhMTBjZiJ9`. A última página devolve `"nextCursor": null`. Coleção pequena, sem paginação: `GET /api/institutions` → `{ "items": [ ... ] }`.

### 7.5 Datas

| Campo | Exemplo | Categoria |
|---|---|---|
| `occurredAt` de uma operação | `"2026-09-26"` | data civil; a operação "de hoje" registrada às 23h em São Paulo tem `occurredAt` de hoje, embora em UTC já seja amanhã |
| `date` de cotação, `maturityDate` | `"2026-12-31"` | data civil |
| `createdAt`, `appliedAt` | `"2026-09-27T01:30:00.000Z"` | instante em UTC; o front converte para o fuso do navegador só para exibir |
| filtros `from`, `to` | `?from=2026-09-01&to=2026-09-30` | data civil, inclusivos |

## 8. Contract-first: regra do stub

1. Toda tarefa de backend começa por um commit com os DTOs Zod (`*.dto.ts`) e o controller da rota, cujo handler lança `not-implemented` (501). Nesse commit `npm run openapi:export` regenera `backend/openapi.json`, e as operações novas já aparecem com schemas, respostas de sucesso e os `type` de erro que vão lançar.
2. A tarefa de front correspondente roda `npm run sync:api` sobre esse `openapi.json` e trabalha contra os tipos gerados; nada de tipo escrito à mão (ADR-007). Enquanto o backend está no stub, o front vê 501 e pode usar o `type` para mostrar "em construção".
3. Quando o contrato muda no meio da tarefa, o mesmo PR regenera `openapi.json` e os tipos do front. O gate de frescor do CI (F0-08 no backend, F0-18 no front) falha se qualquer um estiver velho.
4. Stubs podem ir a produção: 501 é resposta legítima e não expõe nada.

## 9. OpenAPI

- Versão 3.1, gerado por `npm run openapi:export` sem subir servidor (E13), versionado em `backend/openapi.json`.
- `operationId` = `<módulo>_<ação>` em snake_case: `accounts_list`, `accounts_get`, `accounts_create`, `accounts_update`, `accounts_archive`, `operations_list`. É o nome que `openapi-typescript` e `orval` usam.
- `tags` = nome do módulo NestJS (ADR-024).
- Nomes de schema: recurso no singular (`Account`, `Operation`), entradas com sufixo `CreateInput` e `UpdateInput`, listas com `List` (`OperationList` = `{ items, nextCursor }`), erros `Problem` e `ValidationProblem`.
- `components.securitySchemes.bearer` (`http`, `bearer`, `JWT`); toda operação não pública declara `security`.
- Cada operação declara as respostas de erro que pode dar, com o `type` no `description`.

## 10. Checklist de revisão (PLAN §3)

- [x] Erro de validação com exemplo (§6, §7.3).
- [x] Erro de domínio com exemplo (§6, §7.2).
- [x] Lista com cursor com exemplo (§5, §7.4).
- [x] Recurso único sem envelope com exemplo (§5, §7.1).
- [x] Dinheiro: representação, padrão, escalas, helper Zod (§3).
- [x] Datas: data civil × instante, exemplos (§2, §7.5).
- [x] Regra do stub contract-first (§8).
- [ ] Aprovação do Hugo (revisão).
