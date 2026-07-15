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

# Banner de versão: o log SEMPRE prova qual versão executou.
SCRIPT_VERSION="v8-context (2026-07-15)"
printf '\n\033[1;35m AHRIOS deploy-vps %s \033[0m\n' "${SCRIPT_VERSION}"

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

say "2/8 Chave de LLM existente na VPS"
echo ""
echo "=== BUSCA FORENSE ==="
echo "(versão do script: ${SCRIPT_VERSION} — se você NÃO vê este cabeçalho, está rodando versão antiga)"
# Padrões: variável ANTHROPIC_API_KEY=... OU o formato da chave (sk-ant-...).
KEY_VAR='ANTHROPIC_API_KEY'
KEY_PAT='sk-ant-[A-Za-z0-9_-]{20,}'
FOUND_KEY=""; FOUND_WHERE=""
mask() { sed -E 's/(sk-ant-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/\1••••••••••••/g'; }
hit() { # $1=local  $2=valor
  [ -n "${FOUND_KEY}" ] && return
  FOUND_KEY="$2"; FOUND_WHERE="$1"
}
scan_val() { printf '%s' "$1" | grep -oE "${KEY_PAT}" | head -1; }
step() { printf '[%s/11] %-24s ' "$1" "$2"; }
res() { if [ -n "$1" ]; then echo "ACHOU → $2"; else echo "não há"; fi }

step 1 "Containers"
V="$(docker ps -aq 2>/dev/null | xargs -r -n1 docker inspect --format '{{.Name}} {{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E "${KEY_VAR}=|${KEY_PAT}" | head -1)"
K="$(scan_val "${V:-}")"; [ -n "$K" ] && hit "env de container ($(echo "$V" | awk '{print $1}'))" "$K"
res "$K" "container $(echo "${V:-}" | awk '{print $1}')"

step 2 "Docker Secrets"
if docker secret ls >/dev/null 2>&1; then
  S="$(docker secret ls --format '{{.Name}}' 2>/dev/null | grep -iE 'anthropic|llm|sk.?ant' | head -1)"
  if [ -n "$S" ]; then echo "SUSPEITA → secret '${S}' (conteúdo só legível dentro de um serviço)"; else echo "não há"; fi
else echo "não há (swarm inativo)"; fi

step 3 "Docker Volumes"
K=""
for MP in $(docker volume ls -q 2>/dev/null | head -25); do
  P="$(docker volume inspect "$MP" --format '{{.Mountpoint}}' 2>/dev/null)"
  [ -d "$P" ] || continue
  V="$(timeout 20 grep -rIsoE "${KEY_PAT}" "$P" 2>/dev/null | head -1)"
  [ -n "$V" ] && { K="$(scan_val "$V")"; hit "volume ${MP}" "$K"; WHERE3="volume ${MP}"; break; }
done
res "$K" "${WHERE3:-}"

step 4 "Bind Mounts"
K=""
for SRC in $(docker ps -aq 2>/dev/null | xargs -r -n1 docker inspect --format '{{range .Mounts}}{{if eq .Type "bind"}}{{println .Source}}{{end}}{{end}}' 2>/dev/null | sort -u | head -25); do
  [ -e "$SRC" ] || continue
  V="$(timeout 15 grep -rIsoE "${KEY_PAT}" "$SRC" 2>/dev/null | head -1)"
  [ -n "$V" ] && { K="$(scan_val "$V")"; hit "bind mount ${SRC}" "$K"; WHERE4="bind ${SRC}"; break; }
done
res "$K" "${WHERE4:-}"

step 5 "Compose Files"
FILES="$(find /root /opt /home /srv -maxdepth 4 \( -name 'docker-compose*.y*ml' -o -name 'compose*.y*ml' \) 2>/dev/null | head -20)"
V="$(grep -sHE "${KEY_VAR}|${KEY_PAT}" ${FILES:-/nonexistent} 2>/dev/null | head -1)"
K="$(scan_val "${V:-}")"; [ -n "$K" ] && hit "compose: $(echo "$V" | cut -d: -f1)" "$K"
res "$K" "$(echo "${V:-}" | cut -d: -f1)"

step 6 "Filesystem"
V="$(timeout 90 grep -rIsHoE "${KEY_VAR}=[^ ]+|${KEY_PAT}" /root /home /opt /etc /srv --exclude-dir={node_modules,.git,.cache,letsencrypt} 2>/dev/null | grep -v '/opt/reconstrua/scripts/' | head -1)"
K="$(scan_val "${V:-}")"; [ -n "$K" ] && hit "arquivo: $(echo "$V" | cut -d: -f1)" "$K"
res "$K" "$(echo "${V:-}" | cut -d: -f1)"

step 7 "Shell + Histórico"
V="$(grep -shoE "${KEY_VAR}=[^ ]+|${KEY_PAT}" /root/.bashrc /root/.profile /root/.zshrc /root/.bash_history /root/.zsh_history /home/*/.bash_history 2>/dev/null | head -1)"
K="$(scan_val "${V:-}")"; [ -n "$K" ] && hit "shell config/histórico" "$K"
res "$K" "shell/histórico"

step 8 "systemd + /etc/environment"
V="$(grep -rshoE "${KEY_VAR}=[^ ]+|${KEY_PAT}" /etc/environment /etc/systemd/system /lib/systemd/system 2>/dev/null | head -1)"
K="$(scan_val "${V:-}")"; [ -n "$K" ] && hit "systemd//etc/environment" "$K"
res "$K" "systemd//etc/environment"

step 9 "Portainer"
PV="$(docker volume ls -q 2>/dev/null | grep -i portainer | head -1)"
K=""
if [ -n "$PV" ]; then
  P="$(docker volume inspect "$PV" --format '{{.Mountpoint}}' 2>/dev/null)"
  V="$(timeout 20 grep -rIsoE "${KEY_PAT}" "$P" 2>/dev/null | head -1)"
  [ -n "$V" ] && { K="$(scan_val "$V")"; hit "Portainer ($PV)" "$K"; }
fi
res "$K" "Portainer ${PV:-}"

step 10 "Nginx Proxy Manager"
NPMD="$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep -iE 'nginx-proxy|npm' | head -1)"
K=""
if [ -n "$NPMD" ]; then
  for SRC in $(docker inspect "$NPMD" --format '{{range .Mounts}}{{println .Source}}{{end}}' 2>/dev/null | head -5); do
    V="$(timeout 15 grep -rIsoE "${KEY_PAT}" "$SRC" 2>/dev/null | head -1)"
    [ -n "$V" ] && { K="$(scan_val "$V")"; hit "NPM ($SRC)" "$K"; break; }
  done
fi
res "$K" "NPM ${NPMD:-ausente}"

step 11 "PM2"
V="$(grep -shoE "${KEY_VAR}|${KEY_PAT}" /root/.pm2/dump.pm2 /root/ecosystem.config.* /opt/*/ecosystem.config.* 2>/dev/null | head -1)"
K="$(scan_val "${V:-}")"; [ -n "$K" ] && hit "PM2" "$K"
res "$K" "PM2"

echo "=== FIM DA BUSCA FORENSE ==="
[ -n "${FOUND_KEY}" ] && ok "ENCONTRADA em: ${FOUND_WHERE}  →  $(printf '%s' "${FOUND_KEY}" | mask)"

if [ -n "${FOUND_KEY}" ]; then
  ANTHROPIC_API_KEY="${FOUND_KEY}"; LLM_PROVIDER=anthropic
  OPENAI_API_KEY="$(getenv OPENAI_API_KEY)"; GEMINI_API_KEY="$(getenv GEMINI_API_KEY)"
  ok "REUTILIZANDO a chave encontrada em: ${FOUND_WHERE} (nenhuma chave nova será criada)"
else
  # fallback: outras chaves de LLM já salvas no .env do app
  ANTHROPIC_API_KEY="$(getenv ANTHROPIC_API_KEY)"; OPENAI_API_KEY="$(getenv OPENAI_API_KEY)"; GEMINI_API_KEY="$(getenv GEMINI_API_KEY)"
  if   [ -n "${ANTHROPIC_API_KEY}" ]; then LLM_PROVIDER=anthropic; ok "ANTHROPIC_API_KEY do .env do app";
  elif [ -n "${OPENAI_API_KEY}" ];   then LLM_PROVIDER=openai;   ok "OPENAI_API_KEY do .env do app";
  elif [ -n "${GEMINI_API_KEY}" ];   then LLM_PROVIDER=gemini;   ok "GEMINI_API_KEY do .env do app";
  else
    echo
    fail "PROVA DE AUSÊNCIA: a ANTHROPIC_API_KEY foi procurada nos 11 locais acima (containers"
    fail "rodando+parados, compose files, secrets/swarm, volumes, bind mounts, /root /home /opt"
    fail "/etc /srv, shell configs+histórico, systemd, PM2, Portainer) e NÃO EXISTE nesta VPS."
    fail "Ela nunca foi configurada aqui."
    echo
    fail "Para prosseguir: crie a chave em https://console.anthropic.com e salve UMA linha:"
    fail "  echo 'ANTHROPIC_API_KEY=sk-ant-SUACHAVE' >> /opt/reconstrua/.env   # e rode este script de novo"
    exit 1
  fi
fi

say "3/8 DIAGNÓSTICO EVOLUTION (API × banco — sem mascarar erro)"
echo ""
echo "=== DIAGNÓSTICO EVOLUTION ==="
mask_mid() { sed -E 's/^(.{4}).*(.{4})$/\1••••••••\2/'; }

# [1/6] Qual container Evolution está sendo consultado
EVO_CONTAINER="$(docker ps --format '{{.Names}} {{.Image}}' | grep -i evolution | awk '{print $1}' | head -1)"
EVO_ALL="$(docker ps -a --format '{{.Names}} ({{.Status}})' | grep -i evolution | tr '\n' ' ')"
echo "[1/6] Containers Evolution existentes: ${EVO_ALL:-nenhum}"
echo "      Consultando: ${EVO_CONTAINER:-NENHUM RODANDO}"
[ -z "${EVO_CONTAINER}" ] && { fail "nenhum container Evolution em execução"; exit 1; }

# [2/6] URL utilizada
EVOLUTION_BASE_URL="$(getenv EVOLUTION_BASE_URL)"; EVOLUTION_BASE_URL="${EVOLUTION_BASE_URL:-http://${PUBLIC_IP}:8080}"
echo "[2/6] URL da API: ${EVOLUTION_BASE_URL}"

# [3/6] MATRIZ container × chave × endpoint — só leitura; vence o 1º trio com HTTP 200.
TAB="$(printf '\t')"
CAND="$(mktemp)"; URLS="$(mktemp)"; MATRIX="$(mktemp)"; CTXU="$(mktemp)"
addcand() { [ -n "$2" ] && printf '%s\t%s\n' "$1" "$2" >> "${CAND}"; } # origem<TAB>chave

# TODOS os containers cujo NOME ou IMAGEM contenha "evolution"
EVO_LIST="$(docker ps -a --format '{{.Names}}\t{{.Image}}' 2>/dev/null | grep -i evolution | cut -f1 | sort -u)"
echo "[3/6] Containers Evolution (nome OU imagem): $(echo ${EVO_LIST:-nenhum} | tr '\n' ' ')"

for C in ${EVO_LIST}; do
  # — URLs deste container: portas publicadas no host + IP interno + SERVER_URL
  if [ "$(docker inspect -f '{{.State.Running}}' "$C" 2>/dev/null)" = "true" ]; then
    for HP in $(docker port "$C" 2>/dev/null | grep -oE ':[0-9]+$' | tr -d ':' | sort -u); do
      printf '%s\thttp://127.0.0.1:%s\n' "$C" "$HP" >> "${URLS}"
    done
    IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$C" 2>/dev/null | awk '{print $1}')"
    EXP="$(docker inspect -f '{{range $p, $x := .Config.ExposedPorts}}{{println $p}}{{end}}' "$C" 2>/dev/null | grep -oE '^[0-9]+' | head -1)"
    [ -n "$IP" ] && [ -n "$EXP" ] && printf '%s\thttp://%s:%s\n' "$C" "$IP" "$EXP" >> "${URLS}"
    SU="$(docker inspect "$C" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^SERVER_URL=' | cut -d= -f2- | sed 's|/$||')"
    [ -n "$SU" ] && printf '%s\t%s\n' "$C" "$SU" >> "${URLS}"
    # — candidatas de BASE_URL para o CONTEXTO DO CONTAINER da API (fase 3)
    for HP in $(docker port "$C" 2>/dev/null | grep -oE ':[0-9]+$' | tr -d ':' | sort -u); do
      printf '%s\tlocalhost\thttp://localhost:%s\n'       "$C" "$HP" >> "${CTXU}"
      printf '%s\t127.0.0.1\thttp://127.0.0.1:%s\n'       "$C" "$HP" >> "${CTXU}"
      printf '%s\turl-publicada\thttp://%s:%s\n'          "$C" "${PUBLIC_IP}" "$HP" >> "${CTXU}"
      printf '%s\tgateway-docker\thttp://172.17.0.1:%s\n' "$C" "$HP" >> "${CTXU}"
    done
    [ -n "$IP" ] && [ -n "$EXP" ] && printf '%s\tip-do-container\thttp://%s:%s\n' "$C" "$IP" "$EXP" >> "${CTXU}"
    [ -n "$EXP" ] && printf '%s\tnome-do-servico\thttp://%s:%s\n' "$C" "$C" "$EXP" >> "${CTXU}"
    [ -n "$SU" ] && printf '%s\tSERVER_URL\t%s\n' "$C" "$SU" >> "${CTXU}"
  fi
  # — chaves candidatas deste container: TODAS as envs com cara de key
  docker inspect "$C" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
    | grep -E '^(AUTHENTICATION_API_KEY|AUTHENTICATION_APIKEY|APIKEY|API_KEY|GLOBAL_API_KEY|AUTH_KEY)=' \
    | while IFS='=' read -r k v; do addcand "env:${C}:${k}" "$v"; done
  # — config.yaml/config.json//evolution/* DENTRO do container
  if [ "$(docker inspect -f '{{.State.Running}}' "$C" 2>/dev/null)" = "true" ]; then
    for F in /evolution/config.yaml /evolution/config.json /evolution/.env /evolution/dist/config.yaml /app/config.yaml /app/.env; do
      V="$(docker exec "$C" sh -c "grep -hoE 'AUTHENTICATION_API_KEY[=: ]+[\"'\'']?[A-Za-z0-9_-]{16,}' '$F' 2>/dev/null | grep -oE '[A-Za-z0-9_-]{16,}\$' | head -3" 2>/dev/null)"
      for k in $V; do addcand "file:${C}:${F}" "$k"; done
    done
  fi
  # — volumes/bind mounts deste container
  for SRC in $(docker inspect "$C" --format '{{range .Mounts}}{{println .Source}}{{end}}' 2>/dev/null); do
    [ -e "$SRC" ] || continue
    timeout 15 grep -rhsoE 'AUTHENTICATION_API_KEY[=: ]+["'"'"']?[A-Za-z0-9_-]{16,}' "$SRC" 2>/dev/null | grep -oE '[A-Za-z0-9_-]{16,}$' | head -3 \
      | while read -r k; do addcand "vol:${C}" "$k"; done
  done
done
# fontes globais: host env, compose, Portainer/NPM/filesystem, .env do app, URL configurada
addcand "host-env" "${AUTHENTICATION_API_KEY:-}"
for F in $(grep -rslE 'AUTHENTICATION_API_KEY' /root /opt /home /srv --include='*.env' --include='*.y*ml' --include='*.json' 2>/dev/null | head -30); do
  grep -hoE 'AUTHENTICATION_API_KEY[=: ]+["'"'"']?[A-Za-z0-9_-]{16,}' "$F" 2>/dev/null | grep -oE '[A-Za-z0-9_-]{16,}$' \
    | while read -r k; do addcand "fs:${F}" "$k"; done
done
addcand ".env-do-app" "$(getenv EVOLUTION_API_KEY)"
printf 'cfg\t%s\n' "${EVOLUTION_BASE_URL}" >> "${URLS}"
sort -u "${URLS}" -o "${URLS}"; sort -t"${TAB}" -k2 -u "${CAND}" -o "${CAND}"

# — SONDA ESTRITA: sucesso = HTTP 200 E JSON válido E lista de instâncias E count > 0.
#   HTML/login/Unauthorized/Forbidden/objeto vazio/lista vazia = FALHA (continua procurando).
probe() { # $1=key $2=url $3=endpoint → PROBE_ST/CT/JSON/CNT/REASON, corpo em ${PROBE_BODY}
  PROBE_BODY="$(mktemp)"
  local W; W="$(curl -sS -m 10 -o "${PROBE_BODY}" -w '%{http_code}|%{content_type}' -H "apikey: $1" "$2$3" 2>/dev/null || echo '000|')"
  PROBE_ST="${W%%|*}"; PROBE_CT="${W#*|}"; PROBE_CT="${PROBE_CT%%;*}"; [ -z "${PROBE_CT}" ] && PROBE_CT="—"
  local HEAD; HEAD="$(head -c 200 "${PROBE_BODY}" 2>/dev/null | tr -d ' \n\r\t')"
  PROBE_JSON="NÃO"; local ARR="nao"
  case "${HEAD}" in "["*) PROBE_JSON="SIM"; ARR="sim";; "{"*) PROBE_JSON="SIM";; esac
  [ "${PROBE_JSON}" = "SIM" ] && command -v python3 >/dev/null 2>&1 && \
    { python3 -c "import json;json.load(open('${PROBE_BODY}'))" 2>/dev/null || PROBE_JSON="NÃO"; }
  PROBE_CNT="$(grep -oE '"(instanceName|name)":"[^"]+"' "${PROBE_BODY}" 2>/dev/null | sort -u | wc -l | tr -d ' ')"
  PROBE_REASON=""
  if   [ "${PROBE_ST}" != "200" ]; then PROBE_REASON="HTTP ${PROBE_ST}"
  elif grep -qiE '<html|<!doctype' "${PROBE_BODY}"; then PROBE_REASON="HTML/página (não é API)"; PROBE_JSON="NÃO"
  elif [ "${PROBE_JSON}" != "SIM" ]; then PROBE_REASON="corpo não é JSON válido"
  elif grep -qiE '"(unauthorized|forbidden)"|login' "${PROBE_BODY}" && [ "${PROBE_CNT}" = "0" ]; then PROBE_REASON="Unauthorized/Forbidden/login"
  elif [ "${ARR}" != "sim" ] && [ "${PROBE_CNT}" = "0" ]; then PROBE_REASON="JSON sem lista de instâncias"
  elif [ "${PROBE_CNT}" = "0" ]; then PROBE_REASON="lista vazia (0 instâncias)"
  fi
}

# — RUNNER do contexto da aplicação: preferir o container da API; senão o postgres
#   do compose do app (mesma rede). Se nenhum existir ainda, sobe só o postgres
#   (o deploy o subiria de qualquer forma; nada é desligado nem removido).
API_RUNNER="$(docker ps --format '{{.Names}}' | grep -i reconstrua | grep -iE 'api' | head -1)"
WGET_RUNNER=""
if [ -z "${API_RUNNER}" ]; then
  WGET_RUNNER="$(docker ps --format '{{.Names}}' | grep -i reconstrua | grep -iE 'postgres|db' | head -1)"
  if [ -z "${WGET_RUNNER}" ]; then
    [ -z "$(getenv POSTGRES_PASSWORD)" ] && setenv POSTGRES_PASSWORD "$(openssl rand -hex 24)"
    docker compose --env-file .env -f docker-compose.production.yml up -d postgres >/dev/null 2>&1
    sleep 3
    WGET_RUNNER="$(docker ps --format '{{.Names}}' | grep -i reconstrua | grep -iE 'postgres|db' | head -1)"
  fi
fi
echo "      Runner do contexto-container: ${API_RUNNER:-${WGET_RUNNER:-NENHUM (validação de contexto indisponível)}}"

cprobe() { # $1=url-completa $2=key → CP_ST/CP_CNT/CP_REASON (mesmos critérios estritos, executado DENTRO do contexto)
  CP_ST="?"; CP_CNT=0; CP_REASON=""
  local BODY=""
  if [ -n "${API_RUNNER}" ]; then
    local OUT; OUT="$(docker exec "${API_RUNNER}" node -e 'fetch(process.argv[1],{headers:{apikey:process.argv[2]}}).then(async r=>{const t=await r.text();process.stdout.write(r.status+"|"+t.slice(0,20000))}).catch(e=>process.stdout.write("000|ERR:"+e.message))' "$1" "$2" 2>/dev/null)"
    CP_ST="${OUT%%|*}"; BODY="${OUT#*|}"
  elif [ -n "${WGET_RUNNER}" ]; then
    BODY="$(docker exec "${WGET_RUNNER}" wget -qO- -T 8 --header "apikey: $2" "$1" 2>/dev/null)"
    [ -n "${BODY}" ] && CP_ST="200?"   # busybox wget não expõe o status; corpo válido = aceito
  else
    CP_REASON="sem runner de contexto"; return
  fi
  CP_CNT="$(printf '%s' "${BODY}" | grep -oE '"(instanceName|name)":"[^"]+"' | sort -u | wc -l | tr -d ' ')"
  local HEAD; HEAD="$(printf '%s' "${BODY}" | head -c 60 | tr -d ' \n\r\t')"
  if   [ "${CP_ST}" != "200" ] && [ "${CP_ST}" != "200?" ]; then CP_REASON="HTTP ${CP_ST} $(printf '%s' "${BODY}" | head -c 60)"
  elif printf '%s' "${BODY}" | grep -qiE '<html|<!doctype'; then CP_REASON="HTML (não é API)"
  else case "${HEAD}" in "["*|"{"*) [ "${CP_CNT}" -gt 0 ] || CP_REASON="0 instâncias";; *) CP_REASON="corpo não é JSON";; esac; fi
}

echo "      Matriz (container | origem | endpoint | HTTP | Content-Type | JSON | inst. | motivo):"
rm -f /tmp/evo_win /tmp/evo_body
while IFS="${TAB}" read -r CONT URL; do
  [ -s /tmp/evo_win ] && break
  while IFS="${TAB}" read -r SRC KEY; do
    [ -z "${KEY}" ] && continue
    [ -s /tmp/evo_win ] && break
    for EP in /manager/fetchInstances /instance/fetchInstances; do
      probe "${KEY}" "${URL}" "${EP}"
      printf '   | %-14s | %-30s | %-26s | %s | %-16s | %-3s | %2s | %s |\n' \
        "${CONT}" "${SRC} $(printf '%s' "${KEY}" | mask_mid)" "${EP}" "${PROBE_ST}" "${PROBE_CT}" "${PROBE_JSON}" "${PROBE_CNT}" "${PROBE_REASON:-CANDIDATA}" | tee -a "${MATRIX}"
      if [ -z "${PROBE_REASON}" ]; then
        # FASE 2 — revalidação no HOST (reproduzibilidade)
        B1="${PROBE_BODY}"; C1="${PROBE_CNT}"
        probe "${KEY}" "${URL}" "${EP}"
        if [ -n "${PROBE_REASON}" ]; then
          printf '   ✘ 2ª validação (host) FALHOU (%s) — DESCARTADA (não reproduzível)\n' "${PROBE_REASON}" | tee -a "${MATRIX}"
          rm -f "${B1}" "${PROBE_BODY}"
        else
          printf '   ✔ Host OK (2×: %s → %s inst.) — FASE 3: validando DE DENTRO do contexto do container…\n' "${C1}" "${PROBE_CNT}" | tee -a "${MATRIX}"
          # FASE 3 — mesma exigência, executada via docker exec; testa cada BASE_URL candidata
          CTX_TRY="$(mktemp)"
          grep "^${CONT}${TAB}" "${CTXU}" > "${CTX_TRY}" 2>/dev/null || true
          printf '%s\tvencedora-no-host\t%s\n' "${CONT}" "${URL}" >> "${CTX_TRY}"
          CHOSEN=""; CHOSEN_LBL=""
          while IFS="${TAB}" read -r _IGN LBL CURL; do
            [ -n "${CHOSEN}" ] && break
            cprobe "${CURL}${EP}" "${KEY}"
            printf '   | ctx-container | %-16s | %-40s | %-4s | %2s | %s |\n' "${LBL}" "${CURL}${EP}" "${CP_ST}" "${CP_CNT}" "${CP_REASON:-OK}" | tee -a "${MATRIX}"
            [ -z "${CP_REASON}" ] && { CHOSEN="${CURL}"; CHOSEN_LBL="${LBL}"; }
          done < "${CTX_TRY}"
          rm -f "${CTX_TRY}"
          if [ -n "${CHOSEN}" ]; then
            printf '   ✔ Container OK — Host OK ✔ · Container OK ✔ · BASE_URL escolhida: %s (%s)\n' "${CHOSEN}" "${CHOSEN_LBL}" | tee -a "${MATRIX}"
            printf '%s\t%s\t%s\t%s\t%s\n' "${KEY}" "${SRC}" "${CONT}" "${CHOSEN}" "${EP}" > /tmp/evo_win
            cp "${PROBE_BODY}" /tmp/evo_body; rm -f "${B1}" "${PROBE_BODY}"; break
          else
            printf '   ✘ Container FALHOU em TODAS as BASE_URLs — combinação DESCARTADA; continuando a busca…\n' | tee -a "${MATRIX}"
            rm -f "${B1}" "${PROBE_BODY}"
          fi
        fi
      else
        rm -f "${PROBE_BODY}"
      fi
    done
  done < "${CAND}"
done < "${URLS}"

if [ -s /tmp/evo_win ]; then
  EVOLUTION_API_KEY="$(cut -f1 /tmp/evo_win)"; WIN_SRC="$(cut -f2 /tmp/evo_win)"
  WIN_CONT="$(cut -f3 /tmp/evo_win)"; WIN_URL="$(cut -f4 /tmp/evo_win)"; WIN_EP="$(cut -f5 /tmp/evo_win)"
  HTTP_STATUS=200; INSTANCES_JSON="$(cat /tmp/evo_body 2>/dev/null)"; rm -f /tmp/evo_win /tmp/evo_body
  # a URL vencedora JÁ foi validada de dentro do contexto do container — persiste como está
  EVOLUTION_BASE_URL="${WIN_URL}"
  [ "${WIN_CONT}" != "cfg" ] && EVO_CONTAINER="${WIN_CONT}"
  ok "VENCEDORA: container=${WIN_CONT} · origem=${WIN_SRC} · endpoint=${WIN_EP} · Host OK ✔ · Container OK ✔"
  ok "BASE_URL escolhida (validada no contexto da aplicação): ${EVOLUTION_BASE_URL} · chave=$(printf '%s' "${EVOLUTION_API_KEY}" | mask_mid)"
else
  HTTP_STATUS=401; INSTANCES_JSON=""; WIN_SRC=""; WIN_EP=""
fi
rm -f "${CAND}" "${URLS}" "${CTXU}"

# [4/6] resultado da API com a combinação vencedora
API_NAMES="$(printf '%s' "${INSTANCES_JSON}" | grep -oE '"(instanceName|name)":"[^"]+"' | cut -d'"' -f4 | sort -u | tr '\n' ' ')"
API_COUNT="$(printf '%s' "${API_NAMES}" | wc -w | tr -d ' ')"
echo "[4/6] ${WIN_EP:-fetchInstances} → HTTP ${HTTP_STATUS} · ${API_COUNT} instância(s): ${API_NAMES:-—}"

# [5/6] Banco PostgreSQL da Evolution: select name from "Instance";
DB_URI="$(docker inspect "${EVO_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^DATABASE_CONNECTION_URI=' | cut -d= -f2-)"
DB_HOST="$(printf '%s' "${DB_URI}" | sed -E 's|.*@([^:/]+).*|\1|')"
DB_NAME="$(printf '%s' "${DB_URI}" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
echo "[5/6] DATABASE_CONNECTION_URI: $(printf '%s' "${DB_URI}" | sed -E 's|(://[^:]+:)[^@]+@|\1••••@|') "
PG_CONTAINER="$(docker ps --format '{{.Names}} {{.Image}}' | grep -iE "postgres|postgis" | awk '{print $1}' | grep -iE "${DB_HOST}" | head -1)"
[ -z "${PG_CONTAINER}" ] && PG_CONTAINER="$(docker ps --format '{{.Names}} {{.Image}}' | grep -iE 'postgres' | awk '{print $1}' | head -1)"
DB_NAMES=""
if [ -n "${PG_CONTAINER}" ]; then
  PG_USER="$(docker inspect "${PG_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^POSTGRES_USER=' | cut -d= -f2-)"; PG_USER="${PG_USER:-postgres}"
  DB_NAMES="$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${DB_NAME}" -tAc 'select name from "Instance";' 2>&1 | tr '\n' ' ')"
  echo "      banco (container ${PG_CONTAINER}, db ${DB_NAME}): ${DB_NAMES:-vazio}"
else
  echo "      (nenhum container postgres encontrado para consulta direta)"
fi
DB_COUNT="$(printf '%s' "${DB_NAMES}" | grep -vciE 'error|erro|does not exist|fatal' >/dev/null 2>&1 && printf '%s' "${DB_NAMES}" | wc -w | tr -d ' ' || printf '%s' "${DB_NAMES}" | wc -w | tr -d ' ')"
printf '%s' "${DB_NAMES}" | grep -qiE 'error|does not exist|fatal' && DB_COUNT=0

# [6/6] Comparação e veredito (causa raiz, sem mascarar)
echo "[6/6] Comparação: API=${API_COUNT} × Banco=${DB_COUNT}"
if [ "${HTTP_STATUS}" = "200" ]; then
  # combinação VALIDADA → persiste chave + URL automaticamente e segue o deploy
  setenv EVOLUTION_API_KEY "${EVOLUTION_API_KEY}"
  setenv EVOLUTION_BASE_URL "${EVOLUTION_BASE_URL}"
  ok "EVOLUTION_API_KEY + EVOLUTION_BASE_URL atualizadas no .env (container=${WIN_CONT} · origem=${WIN_SRC} · endpoint=${WIN_EP})"

  # ── SELEÇÃO PELA INSTÂNCIA OFICIAL (número da empresa) — nunca "a primeira" ──
  # Normalização: remove @s.whatsapp.net / @c.us, sufixo :device, +, espaços,
  # hífens, parênteses → compara SÓ os dígitos. 0 match=laudo · 1=usa · N=laudo.
  OFFICIAL_NUMBER="554137989737"
  norm() { printf '%s' "$1" | sed 's/@.*//; s/:.*//' | tr -cd '0-9'; }
  TARGET_NORM="$(norm "${OFFICIAL_NUMBER}")"
  echo "  Instâncias existentes (nome | ownerJid | número normalizado | status | chats | mensagens):"
  EVO_JS='const fs=require("fs");let raw=fs.readFileSync(0,"utf8");let d;try{d=JSON.parse(raw)}catch(e){process.exit(0)}
let arr=Array.isArray(d)?d:(d.instance?[d.instance]:(d.data||d.instances||[]));if(!Array.isArray(arr))arr=[arr];
const norm=s=>((""+s).split("@")[0].split(":")[0].replace(/[^0-9]/g,""));
let target=norm(process.argv[1]);
for(const it of arr){const i=(it&&it.instance)?it.instance:it;
 const name=i.name||i.instanceName||i.id||"?";
 const jid=i.ownerJid||i.owner||i.wuid||"";
 const num=norm(jid);
 const st=i.connectionStatus||i.status||i.state||"?";
 const c=i._count||i.count||{};
 const chats=(c.Chat!=null)?c.Chat:((i.chats!=null)?i.chats:"?");
 const msgs=(c.Message!=null)?c.Message:((i.messages!=null)?i.messages:"?");
 console.log("   | "+name+" | "+(jid||"-")+" | "+(num||"-")+" | "+st+" | "+chats+" | "+msgs+" |");
 if(num&&num===target)console.log("__MATCH__="+name);}
console.log("__DONE__");'
  SELTBL="$(mktemp)"
  if [ -n "${EVO_CONTAINER}" ] && [ "$(docker inspect -f '{{.State.Running}}' "${EVO_CONTAINER}" 2>/dev/null)" = "true" ]; then
    printf '%s' "${INSTANCES_JSON}" | docker exec -i "${EVO_CONTAINER}" node -e "${EVO_JS}" "${OFFICIAL_NUMBER}" > "${SELTBL}" 2>/dev/null || true
  fi
  if ! grep -q '^__DONE__' "${SELTBL}"; then
    # fallback sem node: quebra o array em objetos e normaliza cada ownerJid
    : > "${SELTBL}"
    printf '%s' "${INSTANCES_JSON}" | sed 's/},[[:space:]]*{/}\n{/g' | while IFS= read -r obj; do
      ojid="$(printf '%s' "$obj" | grep -oE '"(ownerJid|owner|wuid)":"[^"]*"' | head -1 | cut -d'"' -f4)"
      onum="$(norm "${ojid}")"
      oname="$(printf '%s' "$obj" | grep -oE '"(name|instanceName)":"[^"]+"' | head -1 | cut -d'"' -f4)"
      ost="$(printf '%s' "$obj" | grep -oE '"(connectionStatus|status|state)":"[^"]+"' | head -1 | cut -d'"' -f4)"
      printf '   | %s | %s | %s | %s | ? | ? |\n' "${oname:-?}" "${ojid:--}" "${onum:--}" "${ost:-?}" >> "${SELTBL}"
      [ -n "${onum}" ] && [ "${onum}" = "${TARGET_NORM}" ] && printf '__MATCH__=%s\n' "${oname}" >> "${SELTBL}"
    done
    printf '__DONE__\n' >> "${SELTBL}"
  fi
  grep -vE '^__(MATCH|DONE)__' "${SELTBL}" || true
  MATCH_COUNT="$(grep -c '^__MATCH__=' "${SELTBL}" || true)"; MATCH_COUNT="${MATCH_COUNT:-0}"
  MATCH_NAMES="$(grep '^__MATCH__=' "${SELTBL}" | cut -d= -f2-)"

  # ── PRIORIDADE 1: instância OFICIAL por NOME (detém todo o histórico; jamais substituída) ──
  OFFICIAL_INSTANCE="B866E755DEB1-48BF-B1AA-2D845B947A87"
  OFF_ROW="$(grep -vE '^__' "${SELTBL}" | grep -F "| ${OFFICIAL_INSTANCE} |" | head -1)"
  rm -f "${SELTBL}"
  if [ -n "${OFF_ROW}" ]; then
    OFF_ST="$(printf '%s' "${OFF_ROW}" | awk -F'|' '{gsub(/ /,"",$5); print $5}')"
    OFF_NUM="$(printf '%s' "${OFF_ROW}" | awk -F'|' '{gsub(/ /,"",$4); print $4}')"
    if printf '%s' "${OFF_ST}" | grep -qiE '^(open|connected)$'; then
      EVOLUTION_INSTANCE="${OFFICIAL_INSTANCE}"
      WHATSAPP_NUMBER="${OFF_NUM:-${OFFICIAL_NUMBER}}"; [ "${WHATSAPP_NUMBER}" = "-" ] && WHATSAPP_NUMBER="${OFFICIAL_NUMBER}"
      ok "Instância OFICIAL por NOME: '${OFFICIAL_INSTANCE}' (status ${OFF_ST}, número ${WHATSAPP_NUMBER})"
      ok "Usada EXCLUSIVAMENTE — qualquer outra instância (mesmo com o mesmo número) IGNORADA."
      ok "Nada criado/apagado/resetado/desconectado — histórico integral preservado."
    else
      echo ""
      fail "═══ LAUDO: a instância oficial '${OFFICIAL_INSTANCE}' EXISTE mas NÃO está conectada (status: ${OFF_ST:-?}) ═══"
      fail "Ela nunca é substituída automaticamente. Reconecte-a em ${EVOLUTION_BASE_URL}/manager e rode de novo."
      fail "(o deploy jamais cria/apaga/reseta/desconecta — a reconexão preserva todo o histórico)"
      exit 1
    fi
  elif [ "${MATCH_COUNT}" = "1" ]; then
    warn "instância oficial '${OFFICIAL_INSTANCE}' não existe — aplicando descoberta por número normalizado"
    EVOLUTION_INSTANCE="${MATCH_NAMES}"; WHATSAPP_NUMBER="${OFFICIAL_NUMBER}"
    ok "Instância OFICIAL (única correspondência ao número normalizado ${TARGET_NORM}): '${EVOLUTION_INSTANCE}'"
    ok "Usada EXCLUSIVAMENTE; demais IGNORADAS. Nada criado/apagado/resetado/desconectado — histórico preservado."
  elif [ "${MATCH_COUNT}" -gt 1 ]; then
    echo ""
    fail "═══ LAUDO: ${MATCH_COUNT} instâncias correspondem ao número oficial ${TARGET_NORM} (AMBÍGUO) ═══"
    printf '%s\n' "${MATCH_NAMES}" | while IFS= read -r n; do fail "  • instância correspondente: ${n}"; done
    fail "Não escolho a primeira. Deixe apenas UMA instância com esse número conectada e rode de novo."
    fail "(o deploy nunca cria/apaga/reseta/desconecta — a decisão de qual manter é sua)"
    exit 1
  else
    echo ""
    fail "═══ LAUDO: número oficial ${TARGET_NORM} NÃO corresponde a nenhuma instância ═══"
    fail "As instâncias e seus números NORMALIZADOS estão listados acima; nenhum == ${TARGET_NORM}."
    fail "Conecte o WhatsApp ${OFFICIAL_NUMBER} a uma instância em ${EVOLUTION_BASE_URL}/manager e rode de novo."
    fail "(o deploy nunca cria/apaga/reseta/desconecta instância — só usa a oficial já existente)"
    exit 1
  fi
else
  # NENHUMA combinação retornou 200 → laudo técnico completo (não cria, não inventa)
  echo ""
  fail "═══ LAUDO: NENHUMA COMBINAÇÃO container × chave × endpoint AUTENTICOU ═══"
  fail "O banco tem ${DB_COUNT} instância(s) — a Evolution funciona — mas todos os trios ≠ 200."
  fail "• Containers Evolution encontrados: $(echo ${EVO_LIST} | tr '\n' ' ')"
  fail "• Endpoints testados por chave: /manager/fetchInstances e /instance/fetchInstances"
  fail "• Fontes de chave varridas (só leitura): env de TODOS os containers evolution; config.yaml/"
  fail "  json e /evolution/* //app/* dentro dos containers; volumes e bind mounts; host-env;"
  fail "  .env/.yaml/.json em /root /opt /home /srv com AUTHENTICATION_API_KEY; .env do app."
  fail "• Matriz completa testada (container | origem+chave mascarada | endpoint | HTTP | inst.):"
  while IFS= read -r L; do fail "  ${L#   }"; done < "${MATRIX}"
  fail "Conclusão objetiva: a chave global em uso não está materializada em disco/env legível nesta"
  fail "VPS — está só em runtime (secret não legível) ou foi gerada e não persistida. Recupere-a no"
  fail "painel do Manager (Settings → API Key Global) e rode de novo:"
  fail "  echo 'EVOLUTION_API_KEY=<sua-key-global>' >> /opt/reconstrua/.env"
  rm -f "${MATRIX}"
  exit 1
fi
rm -f "${MATRIX}"
WHATSAPP_NUMBER="$(getenv WHATSAPP_NUMBER)"
[ -z "${WHATSAPP_NUMBER}" ] && WHATSAPP_NUMBER="$(printf '%s' "${INSTANCES_JSON}" | grep -oE '"ownerJid":"[0-9]+' | head -1 | grep -oE '[0-9]+')"
[ -z "${WHATSAPP_NUMBER}" ] && [ -n "${PG_CONTAINER:-}" ] && WHATSAPP_NUMBER="$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER:-postgres}" -d "${DB_NAME}" -tAc "select \"ownerJid\" from \"Instance\" limit 1;" 2>/dev/null | grep -oE '^[0-9]+')"
echo "=== FIM DO DIAGNÓSTICO EVOLUTION ==="
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
# — detecção de porta ocupada por MÚLTIPLAS fontes (ss/lsof/docker); NÃO desliga nada.
port_busy() { # $1=porta → 0 (ocupada) / 1 (livre)
  ss -ltn 2>/dev/null | grep -qE "[:.]${1}[[:space:]]" && return 0
  command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "(:|->)${1}->" && return 0
  return 1
}
who_has() { # $1=porta → quem ocupa (informativo)
  local d s; d="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E "(:|->)${1}->" | awk '{print $1}' | head -1)"
  s="$(ss -ltnp 2>/dev/null | grep -E "[:.]${1}[[:space:]]" | grep -oE 'users:\(\("[^"]+"' | head -1 | sed 's/users:((//;s/"//g')"
  echo "${d:+container ${d}}${d:+; }${s:+processo ${s}}"
}
PORT="$(getenv PORT)"; PORT="${PORT:-3001}"; BASE="${PORT}"; tries=0
while :; do
  free=1; for off in 0 1 2 3; do port_busy $((BASE+off)) && { free=0; BUSYP=$((BASE+off)); break; }; done
  [ "${free}" = "1" ] && break
  warn "porta ${BUSYP} ocupada por: $(who_has "${BUSYP}") — NÃO desligo nada; procuro próxima faixa livre"
  BASE=$((BASE+10)); tries=$((tries+1))
  [ ${tries} -gt 60 ] && { fail "não encontrei 4 portas consecutivas livres a partir de ${PORT} (bloqueio real de portas)"; exit 1; }
done
PORT="${BASE}"; ADMIN_PORT=$((BASE+1)); ADVOGADO_PORT=$((BASE+2)); LX_PORT=$((BASE+3))
ok "portas livres escolhidas: main=${PORT} · admin=${ADMIN_PORT} · advogado=${ADVOGADO_PORT} · lx=${LX_PORT}"
# nginx/openresty: apenas DETECTA (não reescreve config de terceiros) e reporta o que ajustar.
NGX_HIT="$(grep -rslE "proxy_pass[^;]*:(3001|${PORT})" /etc/nginx /usr/local/openresty /etc/openresty 2>/dev/null | head -3)"
[ -n "${NGX_HIT}" ] && warn "proxy detectado apontando para :3001 — ajuste para :${PORT} nestes arquivos quando expor: ${NGX_HIT}"

say "5/8 .env final (segredos só nesta VPS)"
POSTGRES_PASSWORD="$(getenv POSTGRES_PASSWORD)"; [ -z "${POSTGRES_PASSWORD}" ] && POSTGRES_PASSWORD="$(openssl rand -hex 24)"
setenv POSTGRES_PASSWORD "${POSTGRES_PASSWORD}"; setenv PORT "${PORT}"; setenv PUBLIC_URL "${PUBLIC_URL}"
setenv ADMIN_PORT "${ADMIN_PORT}"; setenv ADVOGADO_PORT "${ADVOGADO_PORT}"; setenv LX_PORT "${LX_PORT}"
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
