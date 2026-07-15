#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AHRIOS / Projeto Reconstrua — IMPLANTADOR TOTALMENTE AUTÔNOMO (v2).
# Rode na VPS (root), SEM parâmetros:
#   bash <(curl -fsSL https://raw.githubusercontent.com/jeflash2026/projeto-reconstrua/master/scripts/deploy-vps.sh)
#
# Ciclo: DIAGNÓSTICO → CORREÇÃO (só causa raiz) → NOVO DIAGNÓSTICO, até GREEN.
# Autodescoberta (nada é inventado; nada de gate é tocado):
#   • ANTHROPIC/OPENAI/GEMINI_API_KEY: reutiliza a que JÁ EXISTE na VPS
#     (.env do app, env de QUALQUER container, /root/.env*, /etc/environment, bashrc);
#   • Evolution: container local → extrai AUTHENTICATION_API_KEY + instância + número;
#   • Postgres: sobe o do compose com senha gerada (ou reutiliza a do .env);
#   • Domínio: letsencrypt/live, server_name do nginx/openresty, hostname FQDN;
#   • Portas: usa 3001..3004 livres, senão desloca automaticamente.
# PARA somente se uma credencial NÃO EXISTIR em lugar nenhum da VPS —
# e então imprime EXATAMENTE a variável/arquivo esperado.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO_URL="https://github.com/jeflash2026/projeto-reconstrua.git"
APP_DIR="/opt/reconstrua"
PUBLIC_IP="$(curl -fsS -m 8 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m[..]\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m[FALTA]\033[0m %s\n' "$*"; }

say "0/8 Pré-requisitos"
command -v docker >/dev/null 2>&1 || { warn "instalando docker"; curl -fsSL https://get.docker.com | sh >/dev/null 2>&1; }
command -v git >/dev/null 2>&1 || apt-get install -y -qq git >/dev/null 2>&1
command -v openssl >/dev/null 2>&1 || apt-get install -y -qq openssl >/dev/null 2>&1
ok "docker $(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1) · git ok"

say "1/8 Código em ${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then git -C "${APP_DIR}" pull --ff-only >/dev/null 2>&1; else git clone --depth 1 "${REPO_URL}" "${APP_DIR}" >/dev/null 2>&1; fi
cd "${APP_DIR}" || { fail "não consegui obter o código"; exit 1; }
ok "código: $(git rev-parse --short HEAD)"
touch .env; chmod 600 .env
getenv() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2-; }
setenv() { if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi }

say "2/8 Autodescoberta: chave de LLM já existente na VPS"
find_key() { # $1=VAR  — procura no .env do app, em TODOS os containers e em arquivos comuns
  local v; v="$(getenv "$1")"; [ -n "$v" ] && { echo "$v"; return; }
  v="$(docker ps -q 2>/dev/null | xargs -r -n1 docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E "^$1=" | head -1 | cut -d= -f2-)"
  [ -n "$v" ] && { echo "$v"; return; }
  v="$(grep -shE "^(export )?$1=" /root/.env /root/.env.* /opt/*/.env /root/.bashrc /etc/environment 2>/dev/null | head -1 | sed -E "s/^(export )?$1=//" | tr -d '"'"'" )"
  echo "$v"
}
ANTHROPIC_API_KEY="$(find_key ANTHROPIC_API_KEY)"
OPENAI_API_KEY="$(find_key OPENAI_API_KEY)"
GEMINI_API_KEY="$(find_key GEMINI_API_KEY)"
if   [ -n "${ANTHROPIC_API_KEY}" ]; then LLM_PROVIDER=anthropic; ok "ANTHROPIC_API_KEY reutilizada (encontrada na VPS)";
elif [ -n "${OPENAI_API_KEY}" ];   then LLM_PROVIDER=openai;   ok "OPENAI_API_KEY reutilizada";
elif [ -n "${GEMINI_API_KEY}" ];   then LLM_PROVIDER=gemini;   ok "GEMINI_API_KEY reutilizada";
else
  fail "nenhuma chave de LLM existe na VPS (procurei: containers, /root/.env*, /opt/*/.env, /etc/environment, ~/.bashrc)"
  fail "variável esperada: ANTHROPIC_API_KEY=sk-ant-...  (salve-a em /opt/reconstrua/.env e rode de novo)"
  exit 1
fi

say "3/8 Autodescoberta: Evolution"
EVO_CONTAINER="$(docker ps --format '{{.Names}} {{.Image}}' | grep -i evolution | awk '{print $1}' | head -1)"
EVOLUTION_BASE_URL="$(getenv EVOLUTION_BASE_URL)"; EVOLUTION_BASE_URL="${EVOLUTION_BASE_URL:-http://${PUBLIC_IP}:8080}"
EVOLUTION_API_KEY="$(getenv EVOLUTION_API_KEY)"
[ -z "${EVOLUTION_API_KEY}" ] && [ -n "${EVO_CONTAINER}" ] && EVOLUTION_API_KEY="$(docker inspect "${EVO_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^AUTHENTICATION_API_KEY=' | cut -d= -f2-)"
if [ -z "${EVOLUTION_API_KEY}" ]; then
  fail "Evolution: AUTHENTICATION_API_KEY não encontrada (container: ${EVO_CONTAINER:-nenhum})"
  fail "variável esperada: EVOLUTION_API_KEY=<key da sua Evolution> em /opt/reconstrua/.env"
  exit 1
fi
INSTANCES_JSON="$(curl -fsS -m 10 -H "apikey: ${EVOLUTION_API_KEY}" "${EVOLUTION_BASE_URL}/instance/fetchInstances" 2>/dev/null || echo '')"
EVOLUTION_INSTANCE="$(getenv EVOLUTION_INSTANCE)"
[ -z "${EVOLUTION_INSTANCE}" ] && EVOLUTION_INSTANCE="$(echo "${INSTANCES_JSON}" | grep -oE '"name":"[^"]+"' | head -1 | cut -d'"' -f4)"
WHATSAPP_NUMBER="$(getenv WHATSAPP_NUMBER)"
[ -z "${WHATSAPP_NUMBER}" ] && WHATSAPP_NUMBER="$(echo "${INSTANCES_JSON}" | grep -oE '"ownerJid":"[0-9]+' | head -1 | grep -oE '[0-9]+')"
if [ -z "${EVOLUTION_INSTANCE}" ]; then
  fail "Evolution sem NENHUMA instância criada. Crie uma em ${EVOLUTION_BASE_URL}/manager (conectando seu WhatsApp) e rode de novo."
  exit 1
fi
ok "Evolution: ${EVOLUTION_BASE_URL} · instância '${EVOLUTION_INSTANCE}' · número ${WHATSAPP_NUMBER:-?}"

say "4/8 Autodescoberta: domínio (PUBLIC_URL) e portas"
DOMAIN="$(getenv PUBLIC_URL | sed -E 's|https?://||')"
[ -z "${DOMAIN}" ] && DOMAIN="$(ls /etc/letsencrypt/live 2>/dev/null | grep -v README | head -1)"
[ -z "${DOMAIN}" ] && DOMAIN="$(grep -rhoE 'server_name[[:space:]]+[^;_]+' /etc/nginx /usr/local/openresty /etc/openresty 2>/dev/null | awk '{print $2}' | grep -vE '^(_|localhost|\$)' | head -1)"
[ -z "${DOMAIN}" ] && { FQDN="$(hostname -f 2>/dev/null)"; echo "${FQDN}" | grep -qE '\.[a-z]{2,}$' && ! echo "${FQDN}" | grep -qE 'localhost|\.local' && DOMAIN="${FQDN}"; }
if [ -n "${DOMAIN}" ]; then PUBLIC_URL="https://${DOMAIN}"; ok "domínio descoberto: ${DOMAIN}"; else
  fail "PUBLIC_URL: nenhum domínio existe nesta VPS (procurei letsencrypt, nginx/openresty server_name, hostname FQDN)."
  fail "valor esperado: PUBLIC_URL=https://SEU-DOMINIO em /opt/reconstrua/.env (crie um DNS A → ${PUBLIC_IP}) e rode de novo."
  exit 1
fi
PORT="$(getenv PORT)"; PORT="${PORT:-3001}"
while ss -tln 2>/dev/null | grep -qE ":${PORT}[^0-9]" ; do PORT=$((PORT+100)); done
ok "portas: ${PORT}..$((PORT+3))"

say "5/8 .env final (segredos só nesta VPS)"
POSTGRES_PASSWORD="$(getenv POSTGRES_PASSWORD)"; [ -z "${POSTGRES_PASSWORD}" ] && POSTGRES_PASSWORD="$(openssl rand -hex 24)"
setenv POSTGRES_PASSWORD "${POSTGRES_PASSWORD}"; setenv PORT "${PORT}"; setenv PUBLIC_URL "${PUBLIC_URL}"
setenv EVOLUTION_BASE_URL "${EVOLUTION_BASE_URL}"; setenv EVOLUTION_INSTANCE "${EVOLUTION_INSTANCE}"
setenv EVOLUTION_API_KEY "${EVOLUTION_API_KEY}"; setenv WHATSAPP_NUMBER "${WHATSAPP_NUMBER:-}"
setenv LLM_PROVIDER "${LLM_PROVIDER}"
[ -n "${ANTHROPIC_API_KEY}" ] && setenv ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY}"
[ -n "${OPENAI_API_KEY}" ] && setenv OPENAI_API_KEY "${OPENAI_API_KEY}"
[ -n "${GEMINI_API_KEY}" ] && setenv GEMINI_API_KEY "${GEMINI_API_KEY}"
setenv ALLOW_DEGRADED "false"; setenv SHADOW_MODE "true"
ok ".env montado (gates intactos: ALLOW_DEGRADED=false)"

say "6/8 CICLO Diagnóstico → Correção → Diagnóstico (até GREEN)"
GREEN=""
for cycle in 1 2 3 4 5; do
  echo "  ── ciclo ${cycle} ──"
  docker compose -f docker-compose.production.yml up -d --build 2>&1 | tail -2
  for i in $(seq 1 30); do
    GL="$(curl -fsS -m 5 "http://localhost:${PORT}/production/go-live" 2>/dev/null || true)"
    echo "${GL}" | grep -q '"ready":true' && GREEN=1 && break
    sleep 4
  done
  [ -n "${GREEN}" ] && break
  echo "  diagnóstico do ciclo ${cycle}:"
  echo "${GL:-sem-resposta}" | grep -oE '"item":"[^"]+","passed":false,"detail":"[^"]*"' | sed 's/^/    FAIL /' || true
  # Correções de causas transitórias conhecidas (sem tocar gate):
  if ! docker ps --format '{{.Names}}' | grep -q postgres; then warn "postgres não subiu — recriando"; docker compose -f docker-compose.production.yml up -d postgres; sleep 8; fi
  if docker ps -a --format '{{.Names}} {{.Status}}' | grep -qiE 'api.*(exited|restarting)'; then
    warn "api reiniciando — últimas linhas do log:"; docker compose -f docker-compose.production.yml logs api --tail=15
    docker compose -f docker-compose.production.yml restart api; sleep 6
  fi
done
if [ -z "${GREEN}" ]; then
  fail "GO-LIVE não ficou GREEN após 5 ciclos. Itens acima; logs:"
  docker compose -f docker-compose.production.yml logs api --tail=40
  exit 1
fi
ok "GO-LIVE: ready=true (todos os gates GREEN)"

say "7/8 Webhook Evolution → API (URL interna da própria VPS: independe de TLS)"
WEBHOOK_URL="http://${PUBLIC_IP}:${PORT}/webhook/evolution"
curl -fsS -m 10 -X POST "${EVOLUTION_BASE_URL}/webhook/set/${EVOLUTION_INSTANCE}" \
  -H "apikey: ${EVOLUTION_API_KEY}" -H "content-type: application/json" \
  -d "{\"webhook\":{\"enabled\":true,\"url\":\"${WEBHOOK_URL}\",\"byEvents\":false,\"base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}}" >/dev/null 2>&1 \
  && ok "webhook: ${WEBHOOK_URL}" \
  || { warn "API de webhook recusou — registre no manager: ${EVOLUTION_BASE_URL}/manager → ${WEBHOOK_URL} (MESSAGES_UPSERT)"; }

say "8/8 LAUDO FINAL"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo; echo "GO-LIVE:"; curl -fsS -m 5 "http://localhost:${PORT}/production/go-live" | head -c 600; echo
echo; echo "HEALTH:";  curl -fsS -m 5 "http://localhost:${PORT}/production/health" | head -c 300; echo
echo; echo "URLs:"
echo "  UI/Monitor : http://${PUBLIC_IP}:${PORT}/production/ui"
echo "  Webhook    : ${WEBHOOK_URL}"
echo "  Admin API  : http://${PUBLIC_IP}:$((PORT+1))  · Advogado: $((PORT+2)) · LX: $((PORT+3))"
echo "  Público    : ${PUBLIC_URL} (aponte o proxy/openresty para :${PORT} quando quiser expor)"
echo; echo "✅ PRONTO. Teste real: mande 'Olá' para o WhatsApp da instância '${EVOLUTION_INSTANCE}'."
echo "   Homologação: botão REAL_FIRST_CLIENT em /production/ui · Shadow Center ativo."
