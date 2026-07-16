#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Projeto Reconstrua — DEPLOY OFICIAL (rode NA VPS, como root):
#   bash /opt/reconstrua/deploy.sh
# Idempotente. Atualiza repo → rebuild sem cache → sobe só a api → espera health
# → valida o domínio POR COMPORTAMENTO (/, www, /production/health = 200).
# Em qualquer falha após o deploy: ROLLBACK automático para a imagem anterior.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

APP_DIR="/opt/reconstrua"
BRANCH="master"
COMPOSE="docker-compose.production.yml"
FALLBACK_DOMAIN="projetoreconstrua.com.br"

STEP="início"
PREV_IMG=""; IMG_NAME=""; DEPLOYED=""

say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m[..]\033[0m %s\n' "$*"; }

dc()   { docker compose --env-file "${APP_DIR}/.env" -f "${APP_DIR}/${COMPOSE}" "$@"; }
http() { curl -s -o /dev/null -w '%{http_code}' -m 15 "$@" 2>/dev/null || echo 000; }
httpL(){ curl -sL -o /dev/null -w '%{http_code}' -m 20 "$@" 2>/dev/null || echo 000; }

rollback() {
  if [ -z "${DEPLOYED}" ] || [ -z "${PREV_IMG}" ] || [ -z "${IMG_NAME}" ]; then
    warn "sem imagem anterior para rollback"; return 0
  fi
  warn "ROLLBACK: restaurando a imagem anterior (${PREV_IMG})"
  docker tag "${PREV_IMG}" "${IMG_NAME}" 2>/dev/null || true
  dc up -d --force-recreate --no-build api >/dev/null 2>&1 || true
  warn "rollback aplicado — o container voltou ao estado anterior ao deploy"
}

# ─────────────────────────────────────────────────────────────────────────────
# evidence — CAPTURA FORENSE (somente leitura) executada ANTES de qualquer
# rollback. Grava no log do GitHub Actions o estado completo do sistema no
# instante da falha (HTTP público/interno, Docker, processo, portas, proxy, DNS e
# logs), para que a causa raiz seja identificável SEM precisar reproduzir o erro.
# NÃO altera estado: só inspeciona. Nunca aborta (tudo protegido com || true) e é
# seguro em qualquer etapa — todas as expansões têm fallback, mesmo se DOMAIN/
# PORT/API_C/NPM_C ainda não existirem (falha antes de serem definidos).
# ─────────────────────────────────────────────────────────────────────────────
evidence() {
  local dom port api npm
  dom="${DOMAIN:-${FALLBACK_DOMAIN}}"
  port="${PORT:-3001}"
  api="${API_C:-}"; [ -z "${api}" ] && api="$(dc ps -q api 2>/dev/null | head -1)"
  npm="${NPM_C:-}"; [ -z "${npm}" ] && npm="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'nginx-proxy|proxy-manager|npm' | head -1)"

  printf '\n\033[1;35m════════ FORENSIC CAPTURE START · %s · etapa [%s] ════════\033[0m\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "${STEP}"

  echo "── [0] GitHub Actions ──────────────────────────────────────────"
  echo "   GITHUB_RUN_ID=${GITHUB_RUN_ID:-n/a} · GITHUB_RUN_NUMBER=${GITHUB_RUN_NUMBER:-n/a} · GITHUB_RUN_ATTEMPT=${GITHUB_RUN_ATTEMPT:-n/a}"
  echo "   GITHUB_SHA=${GITHUB_SHA:-n/a} · GITHUB_REF=${GITHUB_REF:-n/a}"

  echo "── [1] contexto ────────────────────────────────────────────────"
  echo "   data=$(date -u '+%Y-%m-%dT%H:%M:%SZ') · commit=${SHA:-?} · DOMAIN=${dom} · PORT=${port}"
  echo "   última medida: / = ${R:-?} · /production/health = ${H:-?} · www = ${W:-?}"

  echo "── [2] HTTP público (status + cabeçalhos) ──────────────────────"
  for p in "/" "/production/health"; do
    echo "   » GET https://${dom}${p}"
    curl -sS -m 15 -D - -o /dev/null "https://${dom}${p}" 2>&1 | sed 's/^/     /' || true
  done
  echo "   » GET -L https://www.${dom}/"
  curl -sSL -m 20 -D - -o /dev/null "https://www.${dom}/" 2>&1 | sed 's/^/     /' || true
  curl -sS -m 15 -o /dev/null -w '   conexão: remote_ip=%{remote_ip} · http=%{http_code} · tls_verify=%{ssl_verify_result} · t=%{time_total}s\n' "https://${dom}/" 2>&1 || true

  echo "── [2b] handshake TLS + TODOS os headers (curl -sv /production/health) ─"
  curl -sv -m 15 "https://${dom}/production/health" -o /dev/null 2>&1 | sed 's/^/     /' || true

  echo "── [3] HTTP interno (localhost:${port}, sem passar pelo proxy) ──"
  curl -sS -m 10 -D - -o /dev/null "http://localhost:${port}/production/health" 2>&1 | sed 's/^/     /' || true

  echo "── [4] Docker — containers e imagem da api ─────────────────────"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1 | sed 's/^/     /' || true
  if [ -n "${api}" ]; then
    echo "   api=${api}"
    docker inspect -f 'imagem={{.Config.Image}} · imageID={{.Image}} · estado={{.State.Status}} · exit={{.State.ExitCode}} · restarts={{.RestartCount}} · OOMKilled={{.State.OOMKilled}}' "${api}" 2>&1 | sed 's/^/     /' || true
  else
    echo "     (nenhum container api encontrado)"
  fi

  echo "── [5] processo dentro do container (PID 1) ────────────────────"
  if [ -n "${api}" ]; then
    printf '     cmdline PID1: '; docker exec "${api}" cat /proc/1/cmdline 2>/dev/null | tr '\0' ' '; echo ""
    docker top "${api}" 2>&1 | sed 's/^/     /' || true
  fi

  echo "── [6] portas em escuta no host + mapeamento do container ──────"
  { ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null; } | grep -E ":(${port}|80|443)([^0-9]|$)" | sed 's/^/     /' || true
  [ -n "${api}" ] && { echo "     docker port api:"; docker port "${api}" 2>&1 | sed 's/^/       /' || true; }

  echo "── [7] proxy (Nginx Proxy Manager) — redes e upstream ──────────"
  if [ -n "${npm}" ]; then
    echo "     NPM=${npm}"
    echo "     redes NPM: $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${npm}" 2>/dev/null)"
    [ -n "${api}" ] && echo "     redes api: $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${api}" 2>/dev/null)"
    echo "     upstream configurado (proxy_pass/host/porta):"
    docker exec "${npm}" sh -c 'grep -RhoE "proxy_pass[^;]+|set \$server[^;]+|set \$port[^;]+" /data/nginx/proxy_host/ 2>/dev/null' 2>/dev/null | sort -u | sed 's/^/       /' || true
  else
    echo "     (container NPM não encontrado por nome)"
  fi

  echo "── [8] DNS de ${dom} ───────────────────────────────────────────"
  { getent hosts "${dom}" 2>/dev/null || nslookup "${dom}" 2>/dev/null; } | sed 's/^/     /' || true

  echo "── [9] últimas 80 linhas de log da api ─────────────────────────"
  dc logs api --tail 80 2>&1 | sed 's/^/     /' || true

  printf '\033[1;35m════════ FORENSIC CAPTURE END · %s ════════\033[0m\n\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}

die() {
  echo ""; printf '  \033[1;31m[X] ABORTADO na etapa [%s]\033[0m\n' "${STEP}"
  echo "   motivo: $1"
  evidence
  rollback
  exit 1
}

main() {
  say "0 · pré-requisitos"
  command -v docker >/dev/null 2>&1 || die "docker ausente"
  command -v git    >/dev/null 2>&1 || apt-get install -y -qq git >/dev/null 2>&1
  command -v curl   >/dev/null 2>&1 || apt-get install -y -qq curl >/dev/null 2>&1
  [ -d "${APP_DIR}/.git" ] || die "${APP_DIR} não é um repositório git (rode o deploy-vps.sh primeiro)"
  cd "${APP_DIR}" || die "não consegui entrar em ${APP_DIR}"
  [ -f .env ] || die ".env ausente em ${APP_DIR}"
  ok "docker $(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"

  STEP="1/8 · atualizar repositório (${BRANCH}) preservando mudanças locais"
  git fetch --all -q || die "git fetch falhou"
  if [ -n "$(git status --porcelain -uno 2>/dev/null)" ]; then
    git stash push -u -m "deploy-$(date +%s)" >/dev/null 2>&1 \
      && warn "mudanças locais RASTREADAS foram guardadas em 'git stash' (recuperáveis com 'git stash list/pop')"
  fi
  git checkout "${BRANCH}" -q 2>/dev/null || die "não consegui checar a branch ${BRANCH}"
  git reset --hard "origin/${BRANCH}" >/dev/null 2>&1 || die "git reset --hard falhou"
  SHA="$(git rev-parse --short HEAD)"
  [ "$(git rev-parse --abbrev-ref HEAD)" = "${BRANCH}" ] || die "branch resultante não é ${BRANCH}"
  ok "branch=${BRANCH} · commit=${SHA}"

  STEP="2/8 · garantir a rota / no fonte do commit implantado"
  git show "origin/${BRANCH}:apps/api/src/production/production-server.ts" | grep -qF "app.get('/'" \
    || die "o commit ${SHA} NÃO contém app.get('/') — commit errado; não faço deploy de build sem a raiz"
  ok "fonte do commit contém app.get('/')"

  STEP="3/8 · ler PORT/DOMAIN do .env"
  PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2-)"; PORT="${PORT:-3001}"
  DOMAIN="$(grep -E '^PUBLIC_URL=' .env | head -1 | cut -d= -f2- | sed -E 's#https?://##; s#/.*##')"
  DOMAIN="${DOMAIN:-${FALLBACK_DOMAIN}}"
  ok "PORT=${PORT} · DOMAIN=${DOMAIN}"

  STEP="4/8 · capturar ponto de rollback (imagem atual em execução)"
  API_C="$(dc ps -q api 2>/dev/null | head -1)"
  if [ -n "${API_C}" ]; then
    PREV_IMG="$(docker inspect -f '{{.Image}}' "${API_C}" 2>/dev/null)"
    IMG_NAME="$(docker inspect -f '{{.Config.Image}}' "${API_C}" 2>/dev/null)"
    ok "rollback armado · imagem atual=${PREV_IMG:0:19}… · nome=${IMG_NAME}"
  else
    warn "nenhum container api em execução — primeiro deploy (sem rollback disponível)"
  fi

  STEP="5/8 · rebuild SEM cache (elimina cache incorreto no COPY do fonte)"
  dc build --no-cache api || die "docker compose build falhou"
  ok "imagem reconstruída"

  STEP="6/8 · subir apenas a api (força recriar do novo build)"
  dc up -d --force-recreate api || die "docker compose up falhou"
  DEPLOYED=1
  API_C="$(dc ps -q api 2>/dev/null | head -1)"
  [ -n "${API_C}" ] || die "container api não encontrado após o up"
  ok "container api recriado: ${API_C:0:19}…"

  STEP="7/8 · aguardar a API (health interno em localhost:${PORT})"
  OKH=""
  for _ in $(seq 1 45); do
    [ "$(http "http://localhost:${PORT}/production/health")" = "200" ] && { OKH=1; break; }
    sleep 4
  done
  [ -n "${OKH}" ] || { dc logs api --tail 25 2>&1 | sed 's/^/    /'; die "API não respondeu 200 em localhost:${PORT}/production/health"; }
  ok "API viva internamente"

  # autofix não-fatal: garante que NPM e api compartilham rede (NPM alcança o upstream)
  NPM_C="$(docker ps --format '{{.Names}}' | grep -iE 'nginx-proxy|proxy-manager|npm' | head -1 || true)"
  if [ -n "${NPM_C}" ]; then
    NPM_NETS="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${NPM_C}" 2>/dev/null)"
    API_NETS="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${API_C}" 2>/dev/null)"
    SHARED=""
    for n in ${NPM_NETS}; do for a in ${API_NETS}; do [ "${n}" = "${a}" ] && SHARED="${n}"; done; done
    if [ -z "${SHARED}" ]; then
      FIRST="$(printf '%s' "${NPM_NETS}" | awk '{print $1}')"
      [ -n "${FIRST}" ] && docker network connect "${FIRST}" "${API_C}" 2>/dev/null \
        && warn "autofix: conectei a api à rede do NPM (${FIRST})"
    fi
  fi

  STEP="8/8 · validar o domínio POR COMPORTAMENTO (com retentativas)"
  R=000; H=000; W=000
  for _ in $(seq 1 8); do
    R="$(http  "https://${DOMAIN}/")"
    H="$(http  "https://${DOMAIN}/production/health")"
    W="$(httpL "https://www.${DOMAIN}/")"
    [ "${R}" = "200" ] && [ "${H}" = "200" ] && [ "${W}" = "200" ] && break
    sleep 5
  done
  # Remedição FINAL: mede o estado ATUAL após o último sleep, evitando rollback por
  # medida obsoleta (ex.: www vira 200 durante a última espera do laço).
  R="$(http  "https://${DOMAIN}/")"
  H="$(http  "https://${DOMAIN}/production/health")"
  W="$(httpL "https://www.${DOMAIN}/")"
  echo "   / = ${R} · /production/health = ${H} · www(-L) = ${W}"
  [ "${R}" = "200" ] || die "GET / retornou ${R} (esperado 200 — a interface deve abrir na raiz)"
  [ "${H}" = "200" ] || die "/production/health retornou ${H} (esperado 200)"
  [ "${W}" = "200" ] || die "www retornou ${W} após seguir redirecionamentos (esperado 200)"

  say "✅ DEPLOY VERDE"
  echo "   commit=${SHA} · / =200 · www =200 (via -L) · /production/health =200"
  echo "   Projeto Reconstrua em produção: https://${DOMAIN}/"
  exit 0
}

main "$@" </dev/null
