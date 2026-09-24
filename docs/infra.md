# Infra — inventário do host OCI/Coolify (F0-01)

> Coleta: 24/09/2026, via SSH no host `hmmb-apps` (comandos somente leitura). Itens do console da OCI e do painel do Coolify estão na §7 até o Hugo conferir. Decisões de hospedagem: ADR-002, ADR-003 e ADR-005 em `docs/decisions.md`.

## 1. Resumo

- Host arm64 (Ampere, Neoverse-N1) com 2 OCPU, 11,65 GiB de RAM, sem swap e 50 GB de disco, dos quais 30 GB estão livres.
- Hoje o host usa 1,5 GiB de RAM (9,7 GiB disponíveis) e tem carga média de 0,1 a 0,2. A folga comporta o Lastro inteiro, incluindo o worker da F2.
- **Decisão: arm64.** As imagens são construídas nativamente no host pelo Coolify. Não é preciso build multi-arch. Ver §5.
- Nenhum ADR é contradito. Os ADR-002, 003 e 005 ficam como estão. Há duas propostas de complemento na §6, que esperam aprovação.
- Riscos novos: o dashboard do Traefik e o painel do Coolify podem estar expostos em HTTP, e o host pode ser alvo do *idle reclaim* do Always Free. Ver §4.

## 2. Host

| Item | Valor |
|---|---|
| Hostname | `hmmb-apps` |
| SO | Ubuntu 22.04.5 LTS, kernel `6.8.0-1059-oracle` |
| Arquitetura | `aarch64` / `arm64` |
| CPU | 2 vCPU (2 cores × 1 thread), ARM Neoverse-N1 (Ampere A1) |
| RAM | 11,65 GiB (12.512.505.856 B); em uso 1,5 GiB; disponível 9,7 GiB (a maior parte é page cache) |
| Swap | **nenhum** |
| Disco | `/dev/sda1` ext4 49 GB: 19 GB usados, **30 GB livres** (40%) |
| Uptime / carga | 6 dias e 23 h; load 0,10 / 0,16 / 0,18; PSI de memória zerado |
| Docker | 29.8.1 (client/server, arm64), overlayfs, cgroup v2 |
| Docker Compose | v5.5.1 |
| Coolify | 4.3.21 (Laravel 12.65.0) |
| Proxy | Traefik 3.6.25 (`traefik:v3.6`, linux/arm64), `coolify-proxy`, saudável |

### 2.1 Docker em disco

| Tipo | Total | Tamanho | Recuperável |
|---|---|---|---|
| Imagens | 15 (10 ativas) | 10,76 GB | 5,14 GB (47%) |
| Containers | 10 | 16 MB | 0 |
| Volumes | 4 | 170 MB | 0 |
| Build cache | 79 entradas | 6,12 GB | 3,70 GB |

Há cerca de 8,8 GB recuperáveis entre imagens antigas e build cache, o que indica que a limpeza automática do Coolify está desligada ou tem um limiar alto. A §7 lista isso para conferir.

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
| 8080 | Traefik | Dashboard/API do Traefik (padrão do Coolify). Ver R-I1. |
| 8000 | Coolify | Painel em HTTP puro. Ver R-I1. |
| 6001, 6002 | coolify-realtime | WebSocket do painel. |
| 111 | rpcbind | O host escuta em 0.0.0.0, mas a chain INPUT rejeita (processo do host, sem regra de ACCEPT). |
| 53 | systemd-resolved | Só em loopback. |

Firewall local: o `ufw` está inativo. A chain INPUT do iptables aceita 22, 80, 443, 8000, 6001 e 6002 e rejeita o resto. **As portas publicadas pelo Docker não passam pela INPUT**: o Docker faz DNAT no PREROUTING e encaminha pela FORWARD. Por isso a 8080 fica acessível apesar de não constar na lista. Na prática, a única barreira para 8000, 8080, 6001 e 6002 é a Security List ou o NSG da OCI (§7).

## 4. Riscos do host

| # | Risco | Evidência | Mitigação proposta | Quando |
|---|---|---|---|---|
| R-I1 | Dashboard do Traefik (8080) e painel do Coolify (8000, HTTP) expostos à internet. Um app de dados financeiros ficaria no mesmo host que uma superfície administrativa aberta. | `0.0.0.0:8080` e `0.0.0.0:8000` publicados; o Docker contorna a INPUT. | Conferir a Security List da OCI (§7). Se estiverem abertas: liberar só 22, 80 e 443 publicamente, acessar o painel por um domínio com TLS (ex.: `coolify.hmmb.app.br`) ou por túnel SSH, e restringir 8000, 6001, 6002 e 8080 ao seu IP ou fechá-las. | Antes da F0-21 (primeiro dado real). Mudança sua no console. |
| R-I2 | *Idle reclaim* do Always Free. A Oracle pode recuperar instâncias Always Free quando, numa janela de 7 dias, CPU (p95), rede e memória (no caso da A1) ficam abaixo de 20%. | Load de 0,15 em 2 vCPU e 13% de RAM usada: o host está bem abaixo dos limiares. | Se a conta for Always Free pura: fazer o upgrade para Pay As You Go, que mantém a cota gratuita e sai da política de reclaim. Com o upgrade, configurar um budget com alerta de US$ 1. Backups fora do host (F0-22) em qualquer caso. | Conferir já (§7). |
| R-I3 | Sem swap e sem limites de memória. Um pico, como um build ou uma importação grande, aciona o OOM killer, que pode matar o Postgres de qualquer projeto. | `Swap: 0B`; `mem_limit=0` em todos os containers. | Limites de memória em todos os serviços do Lastro (§5.1). Recomendação sobre o host, que é decisão sua: um swapfile de 2 a 4 GB com `vm.swappiness=10`. | F0-02 (Lastro); swap quando você decidir. |
| R-I4 | Builds no host competem com a produção: 2 vCPU, e `tsc` + Vite + Nest usam 1,5 a 2,5 GiB e 100% de CPU por alguns minutos. | 2 vCPU. | Watch Paths (ADR-001), para builds só da pasta que mudou; limite de builds concorrentes do Coolify em 1. Se incomodar, gerar as imagens no GitHub Actions com runner `ubuntu-24.04-arm` e publicar no GHCR. É uma mudança futura e exigiria ADR. | F0-02 / F0-21. |
| R-I5 | Disco consumido por imagens antigas e build cache. | 8,8 GB recuperáveis hoje. | Ligar a limpeza automática do Docker no Coolify (limiar de ~80%). O Lastro inteiro cabe em ~6 GB (§5.2). | F0-02. |
| R-I6 | Atualização automática do Coolify ou do Traefik afeta todos os projetos (R7 do PLAN). | Coolify 4.3.21, Traefik 3.6.25. | Conferir se o auto-update está ligado. Preferir atualização manual, com o runbook e o backup em dia. | §7. |
| R-I7 | Postgres Alpine (musl) tem collation de libc limitada. A ordenação de nomes em pt-BR depende de ICU ou de glibc. | O outro projeto usa `postgres:16-alpine`, que é o padrão do Coolify. | Usar `postgres:16` (Debian/glibc) no Lastro, com a mesma imagem do CI (ADR-026) para ter paridade. As extensões `ltree`, `pgcrypto` e `pg_trgm` vêm no contrib das duas imagens. | F0-02. |

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
| ADR-002 | **Confirmado** | Host arm64, Coolify 4.3.21 e base `node:24-slim` estão todos consistentes. Complementos propostos, que dependem da sua aprovação para entrar no ADR: (a) limites de memória por serviço, conforme a §5.1; (b) Postgres em imagem Debian (`postgres:16`), não Alpine. |
| ADR-003 | **Sem mudança; validação na F0-02** | Traefik 3.6 suporta `PathPrefix`. Ponto de atenção para o S1: como a API usa `setGlobalPrefix('api')`, o Coolify **não** pode aplicar `StripPrefix` na rota `/api` (a opção "Strip Prefixes" vem ligada por padrão em domínios com path). |
| ADR-005 | **Confirmado** | Redis 7 como serviço próprio, sem porta publicada. Limite do container de 384 MiB para acomodar os 256 MB de `maxmemory` mais o fork do AOF. |

## 7. Pendências de conferência (console da OCI e painel do Coolify)

Estes itens não saem do SSH. Até o Hugo conferir, os números de cota abaixo são dedução a partir do host.

| Onde | Item | Por que importa |
|---|---|---|
| OCI → Instance | Nome do shape (esperado `VM.Standard.A1.Flex`, 2 OCPU / 12 GB) | Confirmar o que o host já indica. |
| OCI → conta | Always Free ou Pay As You Go | R-I2 (idle reclaim). |
| OCI → Limits/Usage | Outras instâncias A1; uso contra o teto gratuito de 4 OCPU / 24 GB | Esta VM usa 2 OCPU / 12 GB, então há espaço para crescer até 4/24 se preciso. |
| OCI → Block Storage | Total de volumes na tenancy (teto gratuito: 200 GB) | Aumentar o boot volume de 50 GB é possível e gratuito até o teto. |
| OCI → VCN | Regras de ingress da Security List/NSG | R-I1: saber se 8000, 8080, 6001 e 6002 estão abertas. |
| OCI → Object Storage | Namespace, bucket existente, uso (gratuito: 20 GB), Customer Secret Key (S3) existente | Backup da F0-02/F0-22. |
| OCI → Billing | Custo do último mês | Confirmar custo zero. |
| Coolify → Settings | Auto-update ligado? Limpeza automática do Docker e limiar? | R-I5, R-I6. |
| Coolify → S3 Storages | Destino S3 já configurado? | F0-02. |
| Coolify → Sources | GitHub App existente e repositórios com acesso | F0-02 (Watch Paths). |
| DNS | `lastro.hmmb.app.br` ou wildcard `*.hmmb.app.br` apontando para o IP do host | F0-02 (TLS). |
