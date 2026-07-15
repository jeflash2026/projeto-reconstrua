#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AHRIOS / Projeto Reconstrua — IMPLANTADOR ONE-SHOT para a VPS (Hostinger).
# Uso (no terminal root da VPS):
#   bash <(curl -fsSL https://raw.githubusercontent.com/jeflash2026/projeto-reconstrua/master/scripts/deploy-vps.sh)
# ou, após clonar: bash scripts/deploy-vps.sh
#
# O que ele faz, na ordem, com AUTODESCOBERTA e sem inventar nada:
#   1. Garante o código em /opt/reconstrua (clone/pull do repo público).
#   2. DESCOBRE a Evolution já instalada (container) e EXTRAI a API key e a
#      instância conectada automaticamente (docker inspect + fetchInstances).
#   3. Monta o .env: preserva valores existentes; gera POSTGRES_PASSWORD se novo;
#      EXIGE apenas o que é impossível descobrir (LLM key, PUBLIC_URL https) —
#      se faltar, imprime EXATAMENTE a variável e o valor esperado e PARA.
#   4. Sobe Postgres + API (docker compose -f docker-compose.production.yml).
#   5. Aguarda o GO-LIVE (o gate REAL do produto decide; nada é mascarado).
#   6. Registra o webhook messages.upsert na Evolution automaticamente.
#   7. Emite o laudo (containers, go-live, health, URLs).
# Idempotente: pode rodar de novo com segurança.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/jeflash2026/projeto-reconstrua.git"
APP_DIR="/opt/reconstrua"
COMPOSE="docker compose -f docker-compose.production.yml"
PUBLIC_IP="$(curl -fsS -m 8 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"

say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m[OK]\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m[FALTA]\033[0m %s\n' "$*"; }

say "1/7 Código em ${APP_DIR}"
command -v docker >/dev/null || { fail "docker não instalado (curl -fsSL https://get.docker.com | sh)"; exit 1; }
command -v git >/dev/null || apt-get install -y -qq git >/dev/null 2>&1 || true
if [ -d "${APP_DIR}/.git" ]; then git -C "${APP_DIR}" pull --ff-only; else git clone --depth 1 "${REPO_URL}" "${APP_DIR}"; fi
cd "${APP_DIR}"; ok "código atualizado ($(git rev-parse --short HEAD))"

say "2/7 Autodescoberta da Evolution existente"
EVO_CONTAINER="$(docker ps --format '{{.Names}} {{.Image}}' | grep -i evolution | awk '{print $1}' | head -1 || true)"
EVOLUTION_BASE_URL="${EVOLUTION_BASE_URL:-http://${PUBLIC_IP}:8080}"
EVOLUTION_API_KEY="${EVOLUTION_API_KEY:-}"
if [ -n "${EVO_CONTAINER}" ] && [ -z "${EVOLUTION_API_KEY}" ]; then
  EVOLUTION_API_KEY="$(docker inspect "${EVO_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^AUTHENTICATION_API_KEY=' | cut -d= -f2- || true)"
fi
if [ -n "${EVOLUTION_API_KEY}" ]; then
  ok "API key extraída do container '${EVO_CONTAINER}'"
  INSTANCES_JSON="$(curl -fsS -m 10 -H "apikey: ${EVOLUTION_API_KEY}" "${EVOLUTION_BASE_URL}/instance/fetchInstances" || echo '[]')"
  EVOLUTION_INSTANCE="${EVOLUTION_INSTANCE:-$(echo "${INSTANCES_JSON}" | grep -oE '"name":"[^"]+"' | head -1 | cut -d'"' -f4)}"
  WHATSAPP_NUMBER="${WHATSAPP_NUMBER:-$(echo "${INSTANCES_JSON}" | grep -oE '"ownerJid":"[0-9]+' | head -1 | grep -oE '[0-9]+')}"
  [ -n "${EVOLUTION_INSTANCE:-}" ] && ok "instância: ${EVOLUTION_INSTANCE} | número: ${WHATSAPP_NUMBER:-?}" || fail "nenhuma instância criada na Evolution (crie em ${EVOLUTION_BASE_URL}/manager e rode de novo)"
else
  fail "Evolution não encontrada como container OU key não extraível — exporte EVOLUTION_API_KEY=<key> e rode de novo"
fi

say "3/7 Montagem do .env (sem inventar valores)"
touch .env
getenv() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
setenv() { grep -qE "^$1=" .env && sed -i "s|^$1=.*|$1=$2|" .env || echo "$1=$2" >> .env; }
POSTGRES_PASSWORD="$(getenv POSTGRES_PASSWORD)"; [ -z "${POSTGRES_PASSWORD}" ] && POSTGRES_PASSWORD="$(openssl rand -hex 24)" && ok "POSTGRES_PASSWORD gerada"
PUBLIC_URL="${PUBLIC_URL:-$(getenv PUBLIC_URL)}"
LLM_PROVIDER="${LLM_PROVIDER:-$(getenv LLM_PROVIDER)}"; LLM_PROVIDER="${LLM_PROVIDER:-anthropic}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$(getenv ANTHROPIC_API_KEY)}"
OPENAI_API_KEY="${OPENAI_API_KEY:-$(getenv OPENAI_API_KEY)}"
GEMINI_API_KEY="${GEMINI_API_KEY:-$(getenv GEMINI_API_KEY)}"

MISSING=0
[ -z "${PUBLIC_URL}" ] && fail "PUBLIC_URL — valor esperado: https://SEU-DOMINIO (aponte um domínio A→${PUBLIC_IP}; o gate exige https)" && MISSING=1
case "${LLM_PROVIDER}" in
  anthropic) [ -z "${ANTHROPIC_API_KEY}" ] && fail "ANTHROPIC_API_KEY — valor esperado: sk-ant-..." && MISSING=1 ;;
  openai)    [ -z "${OPENAI_API_KEY}" ]    && fail "OPENAI_API_KEY — valor esperado: sk-..."     && MISSING=1 ;;
  gemini)    [ -z "${GEMINI_API_KEY}" ]    && fail "GEMINI_API_KEY — valor esperado: AIza..."    && MISSING=1 ;;
esac
[ -z "${EVOLUTION_API_KEY:-}" ] && MISSING=1
[ -z "${EVOLUTION_INSTANCE:-}" ] && MISSING=1
if [ "${MISSING}" = "1" ]; then
  echo; echo "Preencha SOMENTE o que faltou acima e rode de novo, ex.:"
  echo "  PUBLIC_URL=https://seudominio.com ANTHROPIC_API_KEY=sk-ant-xxx bash scripts/deploy-vps.sh"
  exit 1
fi
setenv POSTGRES_PASSWORD "${POSTGRES_PASSWORD}"
setenv PUBLIC_URL "${PUBLIC_URL}"
setenv EVOLUTION_BASE_URL "${EVOLUTION_BASE_URL}"
setenv EVOLUTION_INSTANCE "${EVOLUTION_INSTANCE}"
setenv EVOLUTION_API_KEY "${EVOLUTION_API_KEY}"
setenv WHATSAPP_NUMBER "${WHATSAPP_NUMBER:-}"
setenv LLM_PROVIDER "${LLM_PROVIDER}"
[ -n "${ANTHROPIC_API_KEY}" ] && setenv ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY}"
[ -n "${OPENAI_API_KEY}" ] && setenv OPENAI_API_KEY "${OPENAI_API_KEY}"
[ -n "${GEMINI_API_KEY}" ] && setenv GEMINI_API_KEY "${GEMINI_API_KEY}"
setenv ALLOW_DEGRADED "false"
chmod 600 .env; ok ".env pronto (segredos só na VPS)"

say "4/7 Build + subida (Postgres + API)"
${COMPOSE} up -d --build
ok "containers: $(docker ps --format '{{.Names}}' | tr '\n' ' ')"

say "5/7 GO-LIVE (o gate do produto decide — sem mascarar)"
for i in $(seq 1 30); do
  READY="$(curl -fsS -m 5 http://localhost:3001/production/go-live 2>/dev/null | grep -o '"ready":true' || true)"
  [ -n "${READY}" ] && break; sleep 4
done
curl -fsS -m 8 http://localhost:3001/production/go-live | sed 's/},{/},\n{/g' | head -30 || docker compose -f docker-compose.production.yml logs api --tail=30
[ -z "${READY:-}" ] && { fail "go-live NÃO ready — veja os itens FAIL acima (o deploy parou aqui, como projetado)"; exit 1; }
ok "GO-LIVE: ready=true"

say "6/7 Webhook messages.upsert na Evolution → API"
curl -fsS -m 10 -X POST "${EVOLUTION_BASE_URL}/webhook/set/${EVOLUTION_INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" -H "content-type: application/json" \
  -d "{\"webhook\":{\"enabled\":true,\"url\":\"${PUBLIC_URL}/webhook/evolution\",\"byEvents\":false,\"base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}}" \
  >/dev/null && ok "webhook registrado: ${PUBLIC_URL}/webhook/evolution" \
  || fail "webhook: registre manualmente no manager (${EVOLUTION_BASE_URL}/manager) → URL ${PUBLIC_URL}/webhook/evolution, evento MESSAGES_UPSERT"

say "7/7 LAUDO"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo; echo "Health:";   curl -fsS -m 5 http://localhost:3001/production/health | head -c 300; echo
echo "URLs: main/UI http://localhost:3001/production/ui · admin :3002 · advogado :3003 · lx :3004"
echo "Público (via proxy/domínio): ${PUBLIC_URL}"
echo; echo "PRONTO. Homologue com o botão REAL_FIRST_CLIENT em /production/ui e monitore o Shadow Center."
