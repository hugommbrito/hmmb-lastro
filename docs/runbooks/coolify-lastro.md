# Runbook — Coolify: projeto Lastro

> Configuração do projeto Lastro no Coolify do host `hmmb-apps` (`docs/infra.md`), feita no spike S1 (F0-02) em 26/09/2026. É a fonte da verdade para recriar o projeto se o host for perdido (§8). Segredos ficam no 1Password; aqui só nomes. Decisões: ADR-002, ADR-003, ADR-005.

## 1. Estado após a F0-02

| Recurso | Tipo | Imagem / origem | UUID no Coolify | Limite de RAM | Uso em repouso (26/09) | Exposição |
|---|---|---|---|---|---|---|
| `lastro-postgres` | Database → PostgreSQL | `postgres:16` (Debian) | `jjhxinte0yucncbwclqz5rbj` | 1024 MiB | 25 MiB | só rede `coolify`, 5432 |
| `lastro-redis` | Database → Redis | `redis:7` (7.4.11) | `vmgvftlajogzkse9tagloo4a` | 384 MiB | 3 MiB | só rede `coolify`, 6379 |
| `lastro-api` | Application (GitHub App, Dockerfile) | `hugommbrito/hmmb-lastro`, `backend/` | `0qyjctnyv46ymrgahcaskdgt` | 512 MiB | 35 MiB | Traefik, `lastro.hmmb.app.br/api` |
| `lastro-web` | Application (GitHub App, Dockerfile) | `hugommbrito/hmmb-lastro`, `frontend/` | `dg8pc1k8dpvazwlieussczvs` | 64 MiB | 3 MiB | Traefik, `lastro.hmmb.app.br` |

Projeto **Lastro** no Coolify (nome de exibição com maiúscula, como o Echo; o slug `lastro` do ADR-023 fica nos nomes dos recursos e do banco), ambiente `production`, servidor `oci-hmmb-apps` (renomeado de `localhost` em 26/09; hostname `hmmb-apps` no SO). Os containers se chamam `<uuid>` (bancos) ou `<uuid>-<timestamp>` (apps); a label `coolify.name` guarda o uuid, não o nome de exibição. Todos ficam na rede Docker `coolify`, com `restart: unless-stopped`.

`lastro-jobs` (mesma imagem da API, `HTTP_ENABLED=false`) entra na F0-21; `lastro-worker` na F2.

## 2. Acesso

- **Painel:** `http://140.238.158.164:8000`, em HTTP puro até o R-I1 ser tratado (domínio + TLS, antes da F0-21).
- **Terminal:** Servers → oci-hmmb-apps → Terminal dá shell de root com `docker` disponível. Trafega pelo WebSocket 6001 sem TLS (R-I1): serve para comandos que não mostram segredos. Para o resto, SSH `ubuntu@140.238.158.164` seguido de `sudo -i`. O usuário `ubuntu` não está no grupo `docker` e deve continuar fora.
- **Origem de código:** o GitHub App do Coolify tem acesso ao repositório `hugommbrito/hmmb-lastro` (dado em 26/09). Sem isso o Coolify não lista o repositório nem recebe webhooks.
- **Destino S3:** `oci-lastro-backups`, bucket `lastro-bckp-bucket` (`docs/infra.md` §7.3 e §7.4).

## 3. Bancos

### 3.1 `lastro-postgres`

| Campo | Valor |
|---|---|
| Image | `postgres:16` (trocar o padrão `postgres:16-alpine`; ADR-002) |
| Username | `postgres` (superusuário; `db:bootstrap` da F0-09 cria `lastro_owner`, `lastro_api`, `lastro_worker`) |
| Password | gerada pelo Coolify; 1Password "Lastro, lastro-postgres superuser" |
| Initial Database | `lastro` |
| Make it publicly available | desligado; Public Port vazio |
| Resource Limits → Memory Limit | `1024m` |
| Host interno | `jjhxinte0yucncbwclqz5rbj:5432` (o uuid é o hostname na rede `coolify`) |

Variáveis geridas pelo Coolify no container: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

Custom PostgreSQL Configuration (`docs/infra.md` §5.1). O Coolify monta o texto em `/etc/postgresql/postgresql.conf` e sobe o servidor com `-c config_file=...`, o que **substitui** o `postgresql.conf` da imagem; por isso `listen_addresses` precisa estar aqui, senão o Postgres só escuta em localhost. `pg_hba.conf` continua vindo do diretório de dados.

```
# Lastro (F0-02), docs/infra.md 5.1. Substitui o postgresql.conf da imagem,
# por isso listen_addresses precisa estar aqui.
listen_addresses = '*'
max_connections = 50
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 8MB
maintenance_work_mem = 64MB
timezone = 'UTC'
log_timezone = 'UTC'
```

Confirmado em 26/09: PostgreSQL 16.15 Debian aarch64; `config_file = /etc/postgresql/postgresql.conf`; `hba_file = /var/lib/postgresql/data/pg_hba.conf`; parâmetros acima ativos; banco `lastro` em UTF8 com collation `en_US.utf8` (a imagem Debian traz ICU; a collation pt-BR é decisão da F0-09, por exemplo `pt-BR-x-icu` na criação do banco ou por coluna).

### 3.2 `lastro-redis`

| Campo | Valor |
|---|---|
| Image | `redis:7` (o padrão do Coolify é `redis:7.2`; `redis:7` resolveu para 7.4.11) |
| Password | gerada pelo Coolify; 1Password "Lastro, lastro-redis" |
| Make it publicly available | desligado |
| Resource Limits → Memory Limit | `384m` (256 MB de `maxmemory` + margem para o fork do rewrite do AOF) |
| Host interno | `vmgvftlajogzkse9tagloo4a:6379` |

Variável gerida pelo Coolify no container: `REDIS_PASSWORD`. O Coolify passa `--requirepass` na linha de comando mesmo com configuração custom; `redis-cli ping` sem senha responde `NOAUTH`.

Custom Redis Configuration (ADR-005):

```
# Lastro (F0-02), ADR-005 e docs/infra.md 5.1
maxmemory 256mb
maxmemory-policy noeviction
appendonly yes
appendfsync everysec
```

Confirmado em 26/09 com `CONFIG GET`: `maxmemory 268435456`, `noeviction`, `appendonly yes`, `appendfsync everysec`.

## 4. Aplicações

As duas nascem em Project Lastro → New Resource → Private Repository (with GitHub App) → repositório `hugommbrito/hmmb-lastro` → Build Pack `Dockerfile`.

| Campo | `lastro-api` | `lastro-web` |
|---|---|---|
| Branch | `chore/f0-02-coolify-spike` durante o spike; **`main` após o merge** (§10) | idem |
| Base Directory | `/backend` | `/frontend` |
| Dockerfile Location | `/Dockerfile` (relativo ao Base Directory; o contexto do build é a pasta) | `/Dockerfile` |
| Ports Exposes | `3000` | `80` |
| Ports Mappings | vazio (nada publicado no host) | vazio |
| Domains | `https://lastro.hmmb.app.br/api` | `https://lastro.hmmb.app.br` |
| Strip Prefixes (Advanced → Network) | **desligado** (ADR-003: a API usa `setGlobalPrefix('api')`) | indiferente, sem path |
| Force HTTPS / Auto Deploy | ligados | ligados |
| Watch Paths | `backend/**` | `frontend/**` |
| Environment Variables | `NODE_OPTIONS=--max-old-space-size=384` (runtime, não build) | nenhuma |
| Resource Limits → Memory Limit | `512m` | `64m` |
| Healthcheck | o do Dockerfile (§6) | o do Dockerfile |

Ainda não existem segredos de aplicação; `DATABASE_URL`, `DATABASE_URL_OWNER`, `REDIS_URL` e os segredos de auth entram na F0-21.

### 4.1 Roteamento e TLS

Labels geradas pelo Coolify em 26/09, conferidas com `docker inspect`:

- `lastro-api`: `Host(`lastro.hmmb.app.br`) && PathPrefix(`/api`)`, service na porta 3000, middlewares `gzip` (https) e `redirect-to-https` (http). **Nenhum `stripprefix`.**
- `lastro-web`: `Host(`lastro.hmmb.app.br`) && PathPrefix(`/`)`, service na porta 80.
- TLS: `tls.certresolver=letsencrypt` (HTTP-01 pelo Traefik). O certificado saiu no primeiro deploy, porque o registro A já existia; se o DNS não resolver, o Traefik serve o certificado padrão e o `curl` falha na verificação.
- Precedência: o Traefik v3 ordena rotas pelo tamanho da regra, então `/api` vence a raiz sem prioridade explícita.
- `PathPrefix(`/api`)` é prefixo de string: `/apix` também cai na API (confirmado, respondeu o 404 JSON da API). **Nenhuma rota da SPA pode começar com `/api`.**

Provas do critério de aceite (26/09): `GET https://lastro.hmmb.app.br/api/health` → HTTP/2 200 com `"path":"/api/health"` e `"forwardedPrefix":null`; `GET /api/nope` → 404 da API; `GET /` → 200 `text/html`; a página estática chama `/api/health` na mesma origem, sem CORS. O fallback do ADR-003 (subdomínio + CORS credenciado) **não** foi necessário.

## 5. Backups

| Campo | Valor |
|---|---|
| Onde | lastro-postgres → Backups |
| Frequência | `0 3 * * *` no fuso da instância do Coolify, que é **UTC** (Settings → General → Instance timezone): 3h UTC = 0h em São Paulo = 23h em Toronto, uma hora antes do Docker Cleanup (`0 4 * * *`) |
| Save to S3 | ligado, storage `oci-lastro-backups` |
| Banco | `lastro` |
| Retenção (aba Retention do backup) | Local backups: Backups to keep `2`, Days to keep `0`, Maximum storage `0`. S3 backups: Backups to keep `0`, Days to keep `30`, Maximum storage `0`. Zero significa sem limite naquele critério. |
| Compressão | Servers → oci-hmmb-apps → Advanced → Backups: Backup compression CPU `Low (25%)` |
| Rede de segurança | regra de lifecycle `delete-after-35-days` no bucket (`docs/infra.md` §7.3) |

Backup manual: botão "Backup Now" na mesma tela; a aba Executions lista status, caminho local, duração, tamanho e disponibilidade local/S3.

Teste de 26/09: Success em 5 s, 865 B (banco vazio), disponível local e no S3. Objeto no bucket: `data/coolify/backups/databases/root-team-0/lastro-postgres-jjhxinte0yucncbwclqz5rbj/pg-dump-lastro-1790449799.dmp`, 19:10 UTC, tier Standard. O prefixo espelha o caminho local `/data/coolify/backups/databases/<team>/<nome>-<uuid>/`. Teste de restauração: F0-22.

## 6. Deploys, healthcheck e Watch Paths

- **Gatilho.** Push na branch configurada → webhook do GitHub App → o Coolify compara os arquivos alterados nos commits do push com os Watch Paths; sem casamento, o deploy é pulado. Deploy manual pelo painel ignora Watch Paths.
- **Teste de 26/09.** Push do commit `f8bb62e`, que só toca `docs/`: nenhum deploy, containers e imagens inalterados. Push do commit `a7f9506`, que só toca `frontend/index.html`: `lastro-web` redeployou pelo webhook para a imagem `dg8pc1…:a7f9506…` e `lastro-api` ficou na de `ec32009`. Critério de aceite dos Watch Paths atendido nos dois sentidos.
- **Healthcheck.** O Coolify reconhece o `HEALTHCHECK` do Dockerfile ("Custom healthcheck found in Dockerfile") e só remove o container antigo depois de o novo ficar `healthy`. `node:24-slim` não tem `curl` nem `wget`, então o healthcheck da API usa `fetch` do próprio Node; o do nginx usa `wget` do BusyBox.
- **Tempos observados.** Build da API 10 s e da web 3 s no host (imagens base já em cache); rolling update de 10 a 35 s, dominado pelo `start-period` e pelo intervalo do healthcheck.
- **Limites de recursos** só entram no compose no start: um recurso que sobe antes de o limite ser salvo fica sem limite até o próximo Restart (aconteceu com o Postgres em 26/09).
- **Concurrent Builds** (Servers → oci-hmmb-apps → Advanced → Builds): **2**, mantido de propósito pelo Hugo por causa dos dois apps do Echo; o R-I4 sugeria 1 e a sugestão não foi adotada. Deployment timeout 3600 s, queue limit 25. Verificação de disco `0 23 * * *` com aviso em 80%.

## 7. Verificação rápida

De qualquer máquina:

```bash
curl -sS -i https://lastro.hmmb.app.br/api/health
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://lastro.hmmb.app.br/
```

No host (`sudo -i` ou terminal do painel):

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
docker inspect --format '{{.Name}} mem={{.HostConfig.Memory}}' jjhxinte0yucncbwclqz5rbj vmgvftlajogzkse9tagloo4a
docker exec jjhxinte0yucncbwclqz5rbj psql -U postgres -d lastro -At -c "show shared_buffers" -c "show max_connections"
docker exec vmgvftlajogzkse9tagloo4a sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning CONFIG GET maxmemory-policy'
```

## 8. Se o host for recriado

Na ordem. Os passos 1 a 4 são do `docs/infra.md` (§4, §7 e §8).

1. VM `VM.Standard.A1.Flex` arm64 em Toronto, Ubuntu 22.04, Coolify instalado; Security List com 22, 80 e 443 (o painel entra pelo domínio, R-I1). Swapfile de 4 GB com `vm.swappiness=10`; auto-update do Coolify desligado; Docker Cleanup `0 4 * * *` com limiar 80%.
2. Registro A `lastro.hmmb.app.br` (e o do painel) apontando para o novo IP no Registro.br; esperar a propagação antes de deployar.
3. GitHub App do Coolify com acesso a `hugommbrito/hmmb-lastro`.
4. Object Storage: bucket `lastro-bckp-bucket`, usuário `svc-coolify-backups` com policy restrita ao bucket, Customer Secret Key; S3 Storage `oci-lastro-backups` validado no Coolify.
5. Projeto `Lastro`; Postgres e Redis conforme §3 (imagem, configuração custom, limites, sem porta pública). Novas senhas geradas vão para o 1Password.
6. Restaurar o último dump do bucket no Postgres (`pg_restore` para o banco `lastro`; procedimento detalhado na F0-22).
7. Aplicações conforme §4, branch `main`; variáveis de ambiente e segredos da F0-21 a partir do 1Password.
8. Backups conforme §5; rodar um "Backup Now" e conferir o objeto no bucket.
9. Verificação da §7.

## 9. Achados do spike S1 (26/09/2026)

1. **Path routing preservado.** Com Strip Prefixes desligado, o Traefik entrega `/api/...` inteiro. ADR-003 confirmado; fallback não acionado (R9 fechado).
2. **argon2 em arm64.** `argon2@0.45.1` traz prebuild `linux-arm64` (glibc) no pacote; `npm ci` em `node:24-slim` não compila nada e o `argon2.verify` funciona em runtime. R19 fechado para a base `node:24-slim`; não é preciso instalar `python3`, `make` ou `g++` na imagem.
3. **npm 11.19 bloqueia install scripts.** O npm da imagem (`11.19.0`) só roda scripts de instalação de pacotes aprovados (`npm install-scripts approve`, campo `allowScripts` no `package.json`). O script do argon2 (`node-gyp-build`) foi pulado com aviso, sem efeito porque o prebuild carrega no `require`. A F0-04 decide a lista de aprovações e confere as dependências que dependem de `postinstall`.
4. **Healthcheck do Dockerfile.** O Coolify usa o `HEALTHCHECK` da imagem quando existe; sem ele, o healthcheck padrão do Coolify usa `curl`/`wget`, que `node:24-slim` não tem.
5. **Limite de memória só no start.** Ver §6.
6. **`PathPrefix` casa `/apix`.** Ver §4.1.
7. **Nomes de container.** `<uuid>` para bancos, `<uuid>-<timestamp>` para apps; a label `coolify.name` é o uuid.
8. **Swap por container.** Com só o limite de memória definido, o Docker permite swap até o mesmo valor (`memswap = 2 × mem`). Fica assim; o host tem 4 GB de swap e `swappiness=10`.
9. **Collation.** O banco nasceu com `en_US.utf8`; a ordenação pt-BR fica para a F0-09 (ICU disponível na imagem Debian).

## 10. Pendências

- Trocar a branch de `lastro-api` e `lastro-web` para `main` depois do merge do PR da F0-02 e redeployar.
- R-I1: domínio e TLS para o painel; fechar 8000 e 6001–6002 na Security List. Antes da F0-21.
- F0-21: `lastro-jobs`, segredos, `DATABASE_URL`/`DATABASE_URL_OWNER`, pre-start com migrations.
- F0-22: restauração do backup testada.
