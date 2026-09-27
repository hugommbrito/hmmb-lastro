# Infra — inventário do host OCI/Coolify (F0-01)

> Coleta: 24/09/2026 via SSH no host `hmmb-apps` (comandos somente leitura) e 25/09/2026 no console da OCI e no painel do Coolify (§7). Decisões de hospedagem: ADR-002, ADR-003 e ADR-005 em `docs/decisions.md`.

## 1. Resumo

- VM `VM.Standard.A1.Flex` (Ampere, arm64) em Toronto com 2 OCPU, 12 GB de RAM (11,65 GiB úteis), swapfile de 4 GB (desde 26/09) e 50 GB de boot volume, dos quais 30 GB estão livres. Conta Pay As You Go com custo de R$ 0,00; a VM usa metade da cota gratuita de A1 (4 OCPU / 24 GB).
- Hoje o host usa 1,5 GiB de RAM (9,7 GiB disponíveis) e tem carga média de 0,1 a 0,2. A folga comporta o Lastro inteiro, incluindo o worker da F2.
- **Decisão: arm64.** As imagens são construídas nativamente no host pelo Coolify. Não é preciso build multi-arch. Ver §5.
- Nenhum ADR é contradito. O ADR-002 ganhou dois complementos aprovados em 25/09 (limites de memória por serviço e `postgres:16` Debian, §6); ADR-003 e ADR-005 ficam como estão.
- Riscos confirmados em 24–25/09 e **tratados em 26/09**: painel do Coolify (8000, HTTP) e WebSocket (6001–6002) abertos na Security List (R-I1, fechado: painel em `https://coolify.hmmb.app.br`, portas removidas da Security List); auto-update do Coolify ligado (R-I6, desligado). O dashboard do Traefik (8080) sempre esteve bloqueado pela OCI. Ver §4.
- Nada do que o Lastro precisa existia no host em 24/09: sem DNS, sem acesso do GitHub App ao repositório, sem bucket e sem destino S3 no Coolify. A lista de pré-requisitos da F0-02 está na §8; ela foi cumprida em 26/09 e a **F0-02 foi concluída no mesmo dia** (§9).

## 2. Host

| Item | Valor |
|---|---|
| Hostname | `hmmb-apps` |
| Shape | `VM.Standard.A1.Flex`, 2 OCPU, 12 GB; região Canada Southeast (Toronto), AD-1, FD-2; criada em 17/09/2026 |
| IPs | público `140.238.158.164`; privado `10.0.0.219` (VCN `vcn-20260916-1901`) |
| SO | Ubuntu 22.04.5 LTS, kernel `6.8.0-1059-oracle` |
| Arquitetura | `aarch64` / `arm64` |
| CPU | 2 vCPU (2 cores × 1 thread), ARM Neoverse-N1 (Ampere A1) |
| RAM | 11,65 GiB (12.512.505.856 B); em uso 1,5 GiB; disponível 9,7 GiB (a maior parte é page cache) |
| Swap | nenhum em 24/09; **swapfile de 4 GB** em `/swapfile` desde 26/09, `vm.swappiness=10`, persistido em `/etc/fstab` |
| Disco | `/dev/sda1` ext4 49 GB: 19 GB usados, **30 GB livres** (40%) em 24/09; 33% em 26/09 pela medição do Coolify |
| Uptime / carga | 6 dias e 23 h; load 0,10 / 0,16 / 0,18; PSI de memória zerado |
| Docker | 29.8.1 (client/server, arm64), overlayfs, cgroup v2 |
| Docker Compose | v5.5.1 |
| Coolify | 4.3.21 no SSH de 24/09; 4.3.23 no painel de 25/09 (auto-update ligado) |
| Proxy | Traefik 3.6.25 (`traefik:v3.6`, linux/arm64), `coolify-proxy`, saudável |

### 2.1 Docker em disco

| Tipo | Total | Tamanho | Recuperável |
|---|---|---|---|
| Imagens | 15 (10 ativas) | 10,76 GB | 5,14 GB (47%) |
| Containers | 10 | 16 MB | 0 |
| Volumes | 4 | 170 MB | 0 |
| Build cache | 79 entradas | 6,12 GB | 3,70 GB |

Em 24/09 havia cerca de 8,8 GB recuperáveis entre imagens antigas e build cache. Em 26/09 a limpeza manual pelo Coolify não recuperou nada: o build cache já tinha sido liberado (o disco caiu de 40% para 33% entre as datas) e os 5,1 GB restantes são imagens de deploys antigos do Echo, retidas de propósito para rollback (§7.4, R-I5).

## 3. O que já roda no host

| Container | Imagem | Uso de RAM | Limite | Portas publicadas |
|---|---|---|---|---|
| app A (Coolify, `po4c…`) | build próprio | 145 MiB | nenhum | — (8000 interno) |
| app B (Coolify, `fnoj…`) | build próprio | 185 MiB | nenhum | — (8000 interno) |
| Redis de outro projeto | `redis:7.2` | 4 MiB | nenhum | — |
| Postgres de outro projeto | `postgres:16-alpine` | 46 MiB | nenhum | — |
| `coolify-proxy` | `traefik:v3.6` | 42 MiB | nenhum | **80, 443 (tcp+udp), 8080** |
| `coolify` | `coollabsio/coolify:4.3.21` | 359 MiB | nenhum | **8000** |
| `coolify-realtime` | `coolify-realtime:1.0.19` | 69 MiB | nenhum | **6001, 6002** |
| `coolify-db` | `postgres:15-alpine` | 63 MiB | nenhum | — |
| `coolify-redis` | `redis:7-alpine` | 13 MiB | nenhum | — |
| `coolify-sentinel` | `sentinel:1.0.1` | 7 MiB | nenhum | — |
| **Soma** | | **≈ 933 MiB** | | |

Nenhum container tem limite de memória ou de CPU. Os apps A e B saíram do mesmo commit (`d2e017a`), provavelmente são dois serviços de um mesmo repositório. O Postgres e o Redis existentes pertencem a outro projeto e **não serão compartilhados** com o Lastro: o `db:bootstrap` do ADR-025 precisa de um superusuário próprio, e o ADR-005 fixa uma configuração de Redis (`noeviction`, AOF) que não deve valer para outros projetos.

### 3.1 Portas escutando no host

| Porta | Processo | Observação |
|---|---|---|
| 22 | sshd | Esperado. |
| 80, 443 | Traefik | Esperado. |
| 8080 | Traefik | Dashboard/API do Traefik (padrão do Coolify). Bloqueada pela Security List. |
| 8000 | Coolify | Painel em HTTP puro. Bloqueada pela Security List desde 26/09 (R-I1); o painel entra por `https://coolify.hmmb.app.br` via Traefik. |
| 6001, 6002 | coolify-realtime | WebSocket e terminal do painel. Bloqueadas pela Security List desde 26/09; o Traefik as serve em `/app` e `/terminal/ws` do domínio do painel. |
| 111 | rpcbind | O host escuta em 0.0.0.0, mas a chain INPUT rejeita (processo do host, sem regra de ACCEPT). |
| 53 | systemd-resolved | Só em loopback. |

Firewall local: o `ufw` está inativo. A chain INPUT do iptables aceita 22, 80, 443, 8000, 6001 e 6002 e rejeita o resto. **As portas publicadas pelo Docker não passam pela INPUT**: o Docker faz DNAT no PREROUTING e encaminha pela FORWARD. Por isso a única barreira efetiva para 8000, 8080, 6001 e 6002 é a Security List da OCI. Em 24/09 ela liberava 22, 80, 443, 8000 e 6001–6002 para `0.0.0.0/0` e não liberava a 8080; **desde 26/09 libera só 22, 80 e 443** (§7.2, R-I1). O Docker continua publicando 8000, 8080, 6001 e 6002 no host, mas nada chega a elas de fora; confirmado com `nc` e `curl` externos (timeout).

## 4. Riscos do host

| # | Risco | Evidência | Mitigação | Quando |
|---|---|---|---|---|
| R-I1 | **Confirmado em 25/09 e tratado em 26/09.** Painel do Coolify em HTTP puro (8000) e WebSocket do painel (6001–6002) estavam abertos à internet: login e sessão sem TLS, e quem controla o painel controla todos os containers, inclusive o Postgres do Lastro. | Security List de 24/09: `0.0.0.0/0` → 8000 e 6001–6002. | **Implementado em 26/09 pelo Hugo:** registro A `coolify.hmmb.app.br → 140.238.158.164`; Settings → General → URL `https://coolify.hmmb.app.br` (o Coolify gera `/data/coolify/proxy/dynamic/coolify.yaml` roteando painel, WebSocket `/app` e terminal `/terminal/ws` pelo Traefik com Let's Encrypt); painel, realtime e terminal conferidos pelo domínio; então as regras de 8000 e 6001–6002 foram removidas da Default Security List. Verificação externa: `curl` e `nc` em 8000 e 6001 dão timeout, 443 responde, `/login` do painel 200 com TLS válido, Lastro intacto. A 8080 segue fora da lista. **Efeito colateral, corrigido em 26/09:** a Webhook URL do GitHub App continuava em `http://140.238.158.164:8000`, o GitHub passou a registrar "failed to connect to host" e os deploys automáticos pararam até a URL ser trocada para `https://coolify.hmmb.app.br/webhooks/source/github/events` (runbook §2). | Feito. |
| R-I2 | ~~*Idle reclaim* do Always Free.~~ **Descartado.** A conta é Pay As You Go, que não está sujeita à recuperação por ociosidade. O custo do último mês é R$ 0,00. | Billing → plan type PAYG. | Como PAYG cobra o que passar da cota gratuita, criar um Budget na OCI com alerta em US$ 1 para pegar qualquer cobrança acidental (Object Storage acima de 20 GB, tráfego de saída acima de 10 TB, VM fora da cota). | Quando puder; não bloqueia. |
| R-I3 | Sem swap e sem limites de memória. Um pico, como um build ou uma importação grande, aciona o OOM killer, que pode matar o Postgres de qualquer projeto. | `Swap: 0B` em 24/09; `mem_limit=0` em todos os containers. | **Swap implementado em 26/09:** `/swapfile` de 4 GB, `vm.swappiness=10` em `/etc/sysctl.d/99-swappiness.conf`, linha em `/etc/fstab` (verificado com `swapon --show` e `sysctl`). Limites de memória em todos os serviços do Lastro (§5.1): **implementados na F0-02 em 26/09** e conferidos com `docker inspect`. | Feito. |
| R-I4 | Builds no host competem com a produção: 2 vCPU, e `tsc` + Vite + Nest usam 1,5 a 2,5 GiB e 100% de CPU por alguns minutos. | 2 vCPU. | Watch Paths (ADR-001), para builds só da pasta que mudou: **implementados e testados na F0-02**. Limite de builds concorrentes em 1: **não adotado**; o Hugo manteve 2 em 26/09 por causa dos dois apps do Echo. Se incomodar, gerar as imagens no GitHub Actions com runner `ubuntu-24.04-arm` e publicar no GHCR. É uma mudança futura e exigiria ADR. | Watch Paths feitos; reavaliar na F0-21 com o build real. |
| R-I5 | Disco consumido por imagens antigas e build cache. | 8,8 GB recuperáveis em 24/09; 33% de uso em 26/09. | **Implementado em 26/09.** Servers → Docker Cleanup: frequência `0 4 * * *`, limiar 80%, gatilho "only above disk threshold", manter volumes não usados, redes não usadas e imagens retidas. Limpeza manual rodada uma vez: 0 B recuperado, porque o que sobra são imagens de rollback do Echo, preservadas de propósito. O Lastro inteiro cabe em ~6 GB (§5.2). | Feito. |
| R-I6 | **Confirmado.** Auto-update do Coolify ligado: entre o SSH de 24/09 (4.3.21) e o painel de 25/09 (4.3.23) o Coolify se atualizou sozinho, sem janela nem backup prévio. O Traefik não atualiza sozinho (o painel avisa que a 3.7 está disponível e pede revisão do changelog). Uma atualização com regressão derruba todos os projetos ao mesmo tempo (R7 do PLAN). | Settings → auto-update ligado; versões divergentes entre as coletas. | **Implementado em 26/09:** auto-update desligado em Settings → Updates; a checagem de versão continua ligada e só avisa. Regra: atualização manual uma vez por mês, junto com o Renovate (ADR-006), sempre com o backup do dia anterior confirmado no bucket. Traefik: manter em 3.6 até a F0-02 fechar o roteamento; atualizar depois, manualmente. | Feito. |
| R-I7 | Postgres Alpine (musl) tem collation de libc limitada. A ordenação de nomes em pt-BR depende de ICU ou de glibc. | O outro projeto usa `postgres:16-alpine`, que é o padrão do Coolify. | Usar `postgres:16` (Debian/glibc) no Lastro, com a mesma imagem do CI (ADR-026) para ter paridade. As extensões `ltree`, `pgcrypto` e `pg_trgm` vêm no contrib das duas imagens. | F0-02. |

**Decisões de 25/09/2026 (Hugo):** aprovadas as mitigações de R-I3 (swapfile), R-I5 (limpeza automática do Docker) e R-I6 (auto-update do Coolify desligado, atualização manual mensal). Registradas no ADR-002 e **implementadas pelo Hugo em 26/09/2026**, com verificação colada na sessão. Ficam abertos R-I1 (portas do painel) e R-I4 (builds no host), tratados na F0-02 e antes da F0-21.

## 5. Decisão arm64 × x86

**arm64.** O host é Ampere A1. A alternativa x86 gratuita da OCI (`VM.Standard.E2.1.Micro`, 1 OCPU e 1 GB) não comporta nem o Coolify. Consequências:

- O Coolify constrói as imagens no próprio host, então elas já saem nativas em arm64, sem buildx, QEMU ou manifest multi-arch.
- O CI (GitHub Actions x86) só roda lint, typecheck e testes, sem gerar a imagem de produção. As diferenças de arquitetura aparecem só no build do host, validado na F0-02.
- `node:24-slim` (glibc) fica como base, conforme o ADR-002. O argon2 tem binário pré-compilado para linux-arm64-glibc; o build será validado no S1 (R19).
- Worker da F2: pandas 3 e scipy 1.18 publicam wheels `manylinux aarch64`, então não há compilação no build. Base `python:3.12-slim`.
- As imagens oficiais de Postgres 16, Redis 7, nginx e Traefik são multi-arch.

### 5.1 Orçamento de memória do Lastro

Limites propostos, configurados no Coolify por serviço (hoje, nenhum container tem limite):

| Serviço | Limite | Configuração que sustenta o limite | Fase |
|---|---|---|---|
| `lastro-postgres` (`postgres:16`) | 1024 MiB | `shared_buffers=256MB`, `effective_cache_size=768MB`, `work_mem=8MB`, `max_connections=50` | F0 |
| `lastro-redis` (`redis:7`) | 384 MiB | `maxmemory 256mb` (ADR-005) + margem para o fork do rewrite do AOF | F0 |
| `lastro-api` | 512 MiB | `NODE_OPTIONS=--max-old-space-size=384` | F0 |
| `lastro-jobs` | 512 MiB | idem; pool de conexões próprio (ADR-021) | F0 |
| `lastro-web` (nginx estático) | 64 MiB | — | F0 |
| **Subtotal F0/F1** | **2,44 GiB** | | |
| `lastro-worker` (Python) | 1024 MiB | pandas/scipy por usuário, em lotes | F2 |
| **Total F2** | **3,44 GiB** | | |

Folga, a partir dos 9,7 GiB disponíveis hoje:

- Em regime, com o Lastro da F2 completo: ≈ 6,3 GiB livres (54% da RAM).
- No pior caso, com um build de ~2,5 GiB em curso: ≈ 3,8 GiB livres.
- Os limites são tetos, não consumo. Com um usuário, o consumo real deve ficar abaixo de 1,5 GiB.

### 5.2 Orçamento de disco do Lastro

| Item | Estimativa |
|---|---|
| Imagem `api`/`jobs` (a mesma), com 2 versões anteriores retidas para rollback | ~1,2 GB |
| `web` (nginx + estáticos) | ~0,1 GB |
| `postgres:16` + `redis:7` | ~0,6 GB |
| Worker Python (F2) | ~0,8 GB |
| Build cache do Lastro | 2 a 3 GB |
| Dados: Postgres (anos de histórico de um usuário, mais cotações e séries desde 2010) e AOF do Redis | < 1 GB |
| **Total** | **~6 GB** dos 30 GB livres |

Backups e PDFs (F3) vão para o OCI Object Storage, não para o disco local (ADR-002).

### 5.3 CPU

Com 2 vCPU e carga atual de 0,15, a folga de runtime sobra: a API atende um usuário, e os jobs noturnos são curtos. O gargalo real são os builds (R-I4).

## 6. Impacto nos ADRs

| ADR | Situação | Observação |
|---|---|---|
| ADR-002 | **Confirmado e complementado** | Host arm64, Coolify e base `node:24-slim` estão todos consistentes. Complementos aprovados pelo Hugo em 25/09/2026 e registrados no ADR: (a) limites de memória por serviço, conforme a §5.1; (b) Postgres em imagem Debian (`postgres:16`), não Alpine. As decisões de operação do host (R-I3, R-I5, R-I6) também entraram no ADR. |
| ADR-003 | **Confirmado na F0-02** | Traefik 3.6 suporta `PathPrefix`. Com "Strip Prefixes" desligado no `lastro-api`, `GET https://lastro.hmmb.app.br/api/health` chegou com o path inteiro e sem middleware `stripprefix` nas labels; o fallback de subdomínio + CORS não foi acionado. Restrição derivada: `PathPrefix(`/api`)` casa qualquer path que comece com `/api`, então nenhuma rota da SPA pode começar assim. Detalhes em `docs/runbooks/coolify-lastro.md` §4.1. |
| ADR-005 | **Confirmado** | Redis 7 como serviço próprio, sem porta publicada. Limite do container de 384 MiB para acomodar os 256 MB de `maxmemory` mais o fork do AOF. |

## 7. Conferências no console da OCI e no painel do Coolify (25/09/2026)

### 7.1 Conta, VM e cotas

| Item | Resultado | Consequência |
|---|---|---|
| Plano da conta | **Pay As You Go**; custo do último mês R$ 0,00; sem avisos da Oracle. | R-I2 descartado. Criar um Budget com alerta em US$ 1. |
| Instância | `hmmb-apps`, `VM.Standard.A1.Flex`, 2 OCPU / 12 GB, AD-1, FD-2, criada em 17/09/2026. IP público `140.238.158.164`. | Confirma o que o SSH indicou. |
| Cota de A1 | A página Limits, quotas and usage não mostra dados sem filtro de serviço (print sem itens). Dedução: esta é a única VM, então o uso é 2 dos 4 OCPU e 12 dos 24 GB gratuitos. | Dá para dobrar a VM (4 OCPU / 24 GB) sem custo, com um resize e reboot, se o worker da F2 precisar. Não é necessário hoje. |
| Block storage | Boot volume de 50 GB, sem volumes adicionais. Teto gratuito: 200 GB na tenancy. | Aumentar o boot volume é possível e gratuito. Não é necessário hoje (§5.2). |

### 7.2 Rede

Security List padrão da `vcn-20260916-1901` (sem NSG). Ingress:

| Origem | Protocolo | Porta | Uso |
|---|---|---|---|
| `0.0.0.0/0` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80, 443 | Traefik |
| ~~`0.0.0.0/0`~~ | ~~TCP~~ | ~~**8000**~~ | Painel do Coolify em HTTP puro. **Removida em 26/09 (R-I1).** |
| ~~`0.0.0.0/0`~~ | ~~TCP~~ | ~~**6001–6002**~~ | WebSocket e terminal do painel. **Removida em 26/09 (R-I1).** |
| `0.0.0.0/0` | ICMP | tipo 3 código 4 | Path MTU |
| `10.0.0.0/16` | ICMP | tipo 3 | Interno da VCN |

A 8080 (dashboard do Traefik) não consta e fica bloqueada. As duas linhas riscadas eram o R-I1 e saíram em 26/09; desde então a lista libera só 22, 80, 443 e ICMP. O Lastro não precisa de nenhuma porta nova: entra pelo 443 do Traefik, assim como o painel.

### 7.3 Object Storage

| Item | Resultado |
|---|---|
| Namespace | `yzh83dfbyylc` |
| Região | `ca-toronto-1` |
| Endpoint compatível com S3 | `https://yzh83dfbyylc.compat.objectstorage.ca-toronto-1.oraclecloud.com` |
| Buckets | Um só: `echo-bucket` (compartimento `hmmb (root)`, privado, chave gerenciada pela Oracle, auto-tiering ligado, 16 objetos, 10,39 MiB). É do projeto Echo. |
| Uso contra a cota gratuita | 10 MiB de 20 GB. |
| Customer Secret Key (credencial S3) | **Não conferido.** Fica em Identity → Users → seu usuário → Customer Secret Keys. Se não houver, criar uma; a chave secreta só aparece na criação. |

**Bucket do Lastro, criado em 26/09/2026:** `lastro-bckp-bucket`, compartimento `hmmb (root)`, privado, sem auto-tiering, sem versionamento, chave gerenciada pela Oracle (SSE em repouso, atende ao F0-22). Acesso pela API S3 com credencial de um usuário dedicado: `svc-coolify-backups`, no grupo `coolify-backups`, com policy `coolify-backups-lastro` no root limitada a esse bucket (`read buckets` e `manage objects` com `where target.bucket.name = 'lastro-bckp-bucket'`); a Customer Secret Key está no 1Password. Ponto de atenção registrado: a primeira validação falhou com `NoSuchBucket` porque a policy citava outro nome; a OCI devolve 404 tanto para bucket inexistente quanto para falta de permissão. Regra de lifecycle de 35 dias (`delete-after-35-days`) ativa como rede de segurança para a retenção de 30 dias do Coolify, confirmada em 26/09. Os PDFs da F3 ficam em outro bucket, criado na hora.

### 7.4 Painel do Coolify

| Item | Resultado | Consequência |
|---|---|---|
| Versão e auto-update | 4.3.23; auto-update estava **ligado** em 25/09 e foi **desligado em 26/09**. | R-I6 tratado. |
| Proxy | Traefik 3.6, sem erro de validação; o painel avisa que a 3.7 está disponível e pede revisão do changelog ("Attention required" no servidor). Compose do proxy publica 80, 443 (tcp e udp) e 8080. | Roteamento validado na F0-02; a atualização para 3.7 pode entrar na janela mensal (R-I6). |
| Projetos | Um (Echo) em 25/09: dois serviços de app, um Postgres 16 Alpine e um Redis 7.2. Sem backup agendado. Em 26/09 entrou o segundo, `Lastro` (§9). | Os bancos não são compartilhados (§3). O servidor foi renomeado de `localhost` para `oci-hmmb-apps` no painel em 26/09. |
| S3 Storages | Nenhum em 25/09. Em 26/09: destino `oci-lastro-backups` criado e validado (protocolo https, host `yzh83dfbyylc.compat.objectstorage.ca-toronto-1.oraclecloud.com` sem esquema, porta e path vazios, bucket `lastro-bckp-bucket`, região `ca-toronto-1`). O Coolify usa path-style fixo, que é o que a OCI exige com TLS. | Pronto para o agendamento de backup na F0-02. |
| Sources | Um GitHub App, com acesso só ao repositório do Echo. | Dar acesso a `hugommbrito/hmmb-lastro` na instalação do App (GitHub → Settings → Applications → Configure → Repository access). Sem isso, o Coolify não vê o repositório nem recebe webhooks. |
| Docker Cleanup | Configurado em 26/09 (R-I5): `0 4 * * *`, limiar 80%, só acima do limiar, volumes, redes e imagens retidas preservados. | Feito. |

### 7.5 DNS

`hmmb.app.br` é administrado no Registro.br e tem subdomínios apontando para outros servidores, então **não** cabe wildcard. Hoje só `echo.hmmb.app.br` tem registro A para `140.238.158.164`. Registros A criados em 26/09: `lastro.hmmb.app.br → 140.238.158.164` (F0-02) e `coolify.hmmb.app.br → 140.238.158.164` (R-I1). O TTL do Registro.br é fixo; contar até uma hora de propagação antes de emitir o certificado.

## 8. Pré-requisitos da F0-02

Tudo que a F0-02 precisa e que só o Hugo pode fazer, em ordem. Nenhum item altera o projeto Echo.

| # | Onde | Ação | Bloqueia |
|---|---|---|---|
| 1 | Registro.br | Registro A `lastro.hmmb.app.br → 140.238.158.164`. **Feito em 26/09.** | TLS e o `curl` do critério de aceite. |
| 2 | GitHub | Dar ao GitHub App do Coolify acesso ao repositório `hmmb-lastro`. **Feito em 26/09.** | Criar os recursos `lastro-api`, `lastro-jobs` e `lastro-web` a partir do repositório; Watch Paths. |
| 3 | OCI → Object Storage | Bucket `lastro-bckp-bucket` (privado, sem auto-tiering) no compartimento root. **Feito em 26/09** (§7.3). | Destino de backup. |
| 4 | OCI → Identity | Usuário `svc-coolify-backups`, grupo e policy restritos ao bucket, Customer Secret Key no 1Password. **Feito em 26/09** (§7.3). | Destino S3 no Coolify. |
| 5 | Coolify → S3 Storages | Destino `oci-lastro-backups` validado. **Feito em 26/09** (§7.4). | Backup de teste do critério de aceite. |
| 6 | OCI → Billing | Budget com alerta em US$ 1. **Feito em 26/09.** | Nada; proteção contra cobrança acidental. |

Os itens 1 a 5 estavam prontos em 26/09 e a F0-02 foi executada no mesmo dia. O R-I1 (domínio para o painel e fechamento de 8000 e 6001–6002 na Security List), previsto para antes da F0-21, também foi tratado em 26/09, logo depois da F0-02.

## 9. Resultado da F0-02 (26/09/2026)

Configuração completa em `docs/runbooks/coolify-lastro.md`. O que mudou nos números deste inventário:

| Item | Antes (24–25/09) | Depois (26/09) |
|---|---|---|
| Containers no host | 10, nenhum com limite de memória | 14; os quatro do Lastro com limite (`lastro-postgres` 1024 MiB, `lastro-redis` 384 MiB, `lastro-api` 512 MiB, `lastro-web` 64 MiB) |
| RAM em repouso | ≈ 933 MiB somados nos containers | + ≈ 66 MiB do Lastro (25 + 3 + 35 + 3); host com 1,56 GiB em uso e 9,8 GiB disponíveis |
| Projetos no Coolify | Echo | Echo e Lastro (nome de exibição; recursos com o slug `lastro`) |
| Backups agendados | nenhum | `lastro-postgres` diário às 3h UTC para `oci-lastro-backups`, retenção 30 dias; primeiro objeto confirmado no bucket |
| Build arm64 | hipótese (§5) | confirmado: `node:24-slim` + argon2 0.45.1 via prebuild `linux-arm64`, build de 10 s, sem compilador |
| Roteamento `/api` | hipótese (ADR-003) | confirmado com Strip Prefixes desligado; fallback não acionado |
| Concurrent builds | 2 | 2, mantido de propósito (R-I4) |
| Portas do painel (R-I1) | 8000 e 6001–6002 abertas a `0.0.0.0/0`, painel em HTTP | painel em `https://coolify.hmmb.app.br` pelo Traefik; Security List só com 22, 80 e 443 |

Achados novos, detalhados no runbook §9: o npm 11.19 da imagem bloqueia install scripts não aprovados (a F0-04 define a lista); o Coolify usa o `HEALTHCHECK` do Dockerfile, necessário porque `node:24-slim` não tem `curl`; limites de recurso só entram no compose no start do recurso; `PathPrefix(`/api`)` casa `/apix`; o banco nasceu com collation `en_US.utf8` (collation pt-BR na F0-09).
