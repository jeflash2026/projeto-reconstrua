# Deploy CI/CD — Projeto Reconstrua

Publicação **automática** a cada push na `master`. Ninguém precisa mais abrir a VPS.
O `deploy.sh` continua sendo a fonte única da lógica de deploy seguro (build sem cache,
health checks e **rollback automático**); o pipeline apenas o dispara por SSH e reporta.

- **Arquitetura + diagrama:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Configurar a VPS (1x):** [VPS_SETUP_CHECKLIST.md](./VPS_SETUP_CHECKLIST.md)
- **Configurar o GitHub (1x):** [GITHUB_SETUP_CHECKLIST.md](./GITHUB_SETUP_CHECKLIST.md)

## Arquivos do pipeline
| Arquivo | Papel |
|---|---|
| `.github/workflows/deploy.yml` | Gatilho: push em `master` / manual. Mapeia os secrets do projeto. |
| `.github/workflows/deploy-reusable.yml` | Reutilizável: SSH seguro → `git sync` → `deploy.sh` → propaga exit code. |
| `deploy.sh` (VPS) | **Inalterado.** Build sem cache, `--force-recreate`, health checks, rollback. |

## Secrets necessários (GitHub → Settings → Secrets → Actions)
`VPS_SSH_HOST`, `VPS_SSH_USER`, `VPS_SSH_KEY` (chave privada), `VPS_SSH_KNOWN_HOSTS` (recomendado),
`VPS_SSH_PORT` (só se ≠ 22). Detalhes nos checklists. **Nada de segredo no repositório.**

## Passo a passo de configuração (resumo)
1. **VPS:** gerar par de chaves dedicado, autorizar a pública, capturar a host key → `VPS_SETUP_CHECKLIST.md`.
2. **GitHub:** cadastrar os 5 secrets, habilitar Actions → `GITHUB_SETUP_CHECKLIST.md`.
3. Fazer um push/merge na `master` — o deploy roda sozinho.

## Como testar
- **Deploy manual (sem alterar código):** aba **Actions → "Deploy — Projeto Reconstrua" → Run workflow** (`workflow_dispatch`).
- **Deploy automático:** faça um commit em `master` que toque runtime (fora de `docs/**`, `constitution/**`, `*.md`).
- **Verificar sucesso:** o job termina verde e o `deploy.sh` imprime `✅ DEPLOY VERDE · / =200 · www =200 · /production/health =200`.
- **Externamente:** `curl -I https://projetoreconstrua.com.br/` → `HTTP/2 200`.

## Como fazer rollback
- **Automático (padrão):** se qualquer health check falhar, o `deploy.sh` restaura a imagem anterior e sai com erro → o workflow fica **failed** e o site permanece na última versão saudável. Nada a fazer.
- **Manual — reverter para um commit anterior (recomendado):**
  1. `git revert <sha>` (ou `git reset` local) e push na `master` → o pipeline republica a versão boa.
  2. Ou dispare **Run workflow** após apontar a `master` para o commit desejado.
- **Manual — na VPS, restaurar a imagem anterior imediatamente (emergência):**
  ```bash
  cd /opt/reconstrua
  # descobrir imagens da api (a penúltima é a anterior)
  docker images | grep -i reconstrua
  API=$(docker compose --env-file .env -f docker-compose.production.yml ps -q api)
  docker inspect -f '{{.Config.Image}}' "$API"          # nome atual da imagem
  docker tag <IMAGE_ID_ANTERIOR> <NOME_DA_IMAGEM>        # aponta o nome para a imagem antiga
  docker compose --env-file .env -f docker-compose.production.yml up -d --force-recreate --no-build api
  ```
  (O `deploy.sh` já faz exatamente isso automaticamente ao detectar falha; este bloco é só para intervenção fora do pipeline.)

## Como acompanhar deploys
- **GitHub → aba Actions:** cada push/merge gera um run com **logs completos** (a saída do `deploy.sh` é transmitida ao vivo pelo SSH, incluindo os `[OK]`/`[X]`, health checks e mensagens de rollback).
- **Badge (opcional):** adicione ao README raiz:
  `![deploy](https://github.com/jeflash2026/projeto-reconstrua/actions/workflows/deploy.yml/badge.svg)`
- **Notificações:** o GitHub notifica falhas por e-mail/observadores; ligue Slack/Discord via app de notificações do GitHub, se desejar.

## Garantias preservadas (não foram tocadas)
- `deploy.sh` **não foi alterado**: mantém `build --no-cache`, `up --force-recreate`, os health checks internos e públicos (`/`, `www` com `-L`, `/production/health`) e o rollback automático. O pipeline **não simplifica nem remove** nenhuma validação existente.
