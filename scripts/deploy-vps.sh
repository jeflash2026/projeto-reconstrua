#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AHRIOS / Projeto Reconstrua — IMPLANTADOR AUTÔNOMO (v8-context, reconstrução limpa)
#
# Execução na VPS (root, Ubuntu 24.04):
#   curl -fsSL https://raw.githubusercontent.com/jeflash2026/projeto-reconstrua/<SHA>/scripts/deploy-vps.sh | tr -d '\r' | bash
#
# Garantias invioláveis:
#   • Evolution: NUNCA cria instância, NUNCA reseta histórico, NUNCA desconecta,
#     NUNCA escolhe "a primeira". Seleção: NOME oficial → senão NÚMERO oficial.
#   • Portas: nunca desliga container/processo; escolhe faixa livre.
#   • Gates de produção intactos (ALLOW_DEGRADED=false).
#   • Nenhum comando interativo; NENHUM comando lê stdin (seguro em `curl | bash`
#     — o main é chamado com stdin redirecionado para /dev/null).
# ─────────────────────────────────────────────────────────────────────────────
set -u

SCRIPT_VERSION="v8-context (rebuild limpo 2026-07-15)"
SCRIPT_SHA="proof-e9902e86"   # build id único desta publicação (bater com o SHA do commit)
REPO_URL="https://github.com/jeflash2026/projeto-reconstrua.git"
APP_DIR="/opt/reconstrua"
OFFICIAL_INSTANCE="BB66E755DEB1-48BF-B1AA-2D845B947A87"
OFFICIAL_NUMBER="554137989737"
TAB="$(printf '\t')"

say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m[..]\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m[FALTA]\033[0m %s\n' "$*"; }

mask() { # 4 primeiros + 4 últimos caracteres de um segredo
  local s="$1"
  if [ "${#s}" -le 8 ]; then printf '••••'; else printf '%s••••••••%s' "${s:0:4}" "${s: -4}"; fi
}
norm() { printf '%s' "$1" | sed 's/@.*//; s/:.*//' | tr -cd '0-9'; }

getenvf() { grep -E "^$1=" "${APP_DIR}/.env" 2>/dev/null | head -1 | cut -d= -f2-; }
setenvf() {
  if grep -qE "^$1=" "${APP_DIR}/.env" 2>/dev/null; then
    sed -i "s|^$1=.*|$1=$2|" "${APP_DIR}/.env"
  else
    printf '%s=%s\n' "$1" "$2" >> "${APP_DIR}/.env"
  fi
}

# ── 2/8 · chave de LLM já existente na VPS (reutiliza; nunca cria) ────────────
find_llm_key() { # define LLM_PROVIDER + a variável da chave; retorna 1 se nenhuma existir
  local pat='sk-ant-[A-Za-z0-9_-]{20,}' v
  v="$(getenvf ANTHROPIC_API_KEY)"
  if [ -z "${v}" ]; then
    v="$(docker ps -aq 2>/dev/null | xargs -r -n1 docker inspect \
          --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
        | grep -oE "${pat}" | head -1)"
    [ -n "${v}" ] && ok "ANTHROPIC_API_KEY reutilizada do env de container: $(mask "${v}")"
  else
    ok "ANTHROPIC_API_KEY reutilizada do .env do app: $(mask "${v}")"
  fi
  if [ -z "${v}" ]; then
    v="$(timeout 60 grep -rIshoE "${pat}" /root /home /opt /etc /srv \
          --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache \
          --exclude-dir=letsencrypt 2>/dev/null | grep -v reconstrua/scripts | head -1)"
    [ -n "${v}" ] && ok "ANTHROPIC_API_KEY reutilizada de arquivo do filesystem: $(mask "${v}")"
  fi
  if [ -n "${v}" ]; then ANTHROPIC_API_KEY="${v}"; LLM_PROVIDER=anthropic; return 0; fi
  local var
  for var in OPENAI_API_KEY GEMINI_API_KEY; do
    v="$(getenvf "${var}")"
    if [ -n "${v}" ]; then
      case "${var}" in OPENAI_API_KEY) OPENAI_API_KEY="${v}"; LLM_PROVIDER=openai;;
                       GEMINI_API_KEY) GEMINI_API_KEY="${v}"; LLM_PROVIDER=gemini;; esac
      ok "${var} reutilizada do .env do app: $(mask "${v}")"
      return 0
    fi
  done
  fail "nenhuma chave de LLM existe na VPS (procurei: .env do app, env de todos os"
  fail "containers, /root /home /opt /etc /srv). Variável esperada:"
  fail "  echo 'ANTHROPIC_API_KEY=sk-ant-SUACHAVE' >> ${APP_DIR}/.env   # e rode de novo"
  return 1
}

# ── 3/8 · Evolution: coleta de chaves candidatas e URLs ───────────────────────
collect_evolution() { # preenche KEYF (origem\tchave), URLF (container\turl), CTXF (container\turl-contexto)
  EVO_LIST="$(docker ps -a --format '{{.Names}}\t{{.Image}}' 2>/dev/null | grep -i evolution | cut -f1 | sort -u)"
  if [ -z "${EVO_LIST}" ]; then fail "nenhum container Evolution nesta VPS"; return 1; fi
  ok "containers Evolution: $(printf '%s' "${EVO_LIST}" | tr '\n' ' ')"
  local C HP IP EXP SU
  # nomes de container docker não contêm espaços — split por linha é seguro aqui
  # shellcheck disable=SC2086
  for C in ${EVO_LIST}; do
    docker inspect "${C}" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
      | grep -E '^(AUTHENTICATION_API_KEY|AUTHENTICATION_APIKEY|APIKEY|API_KEY|GLOBAL_API_KEY|AUTH_KEY)=' \
      | while IFS='=' read -r k v; do
          [ -n "${v}" ] && printf 'env:%s:%s\t%s\n' "${C}" "${k}" "${v}"
        done >> "${KEYF}"
    [ "$(docker inspect -f '{{.State.Running}}' "${C}" 2>/dev/null)" = "true" ] || continue
    for HP in $(docker port "${C}" 2>/dev/null | grep -oE ':[0-9]+$' | tr -d ':' | sort -u); do
      printf '%s\thttp://127.0.0.1:%s\n' "${C}" "${HP}" >> "${URLF}"
      printf '%s\thttp://%s:%s\n' "${C}" "${PUBLIC_IP}" "${HP}" >> "${CTXF}"
      printf '%s\thttp://172.17.0.1:%s\n' "${C}" "${HP}" >> "${CTXF}"
    done
    IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "${C}" 2>/dev/null | awk '{print $1}')"
    EXP="$(docker inspect -f '{{range $p, $x := .Config.ExposedPorts}}{{println $p}}{{end}}' "${C}" 2>/dev/null | grep -oE '^[0-9]+' | head -1)"
    if [ -n "${IP}" ] && [ -n "${EXP}" ]; then
      printf '%s\thttp://%s:%s\n' "${C}" "${IP}" "${EXP}" >> "${URLF}"
      printf '%s\thttp://%s:%s\n' "${C}" "${IP}" "${EXP}" >> "${CTXF}"
    fi
    SU="$(docker inspect "${C}" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
          | grep -E '^SERVER_URL=' | cut -d= -f2- | sed 's|/$||')"
    if [ -n "${SU}" ]; then
      printf '%s\t%s\n' "${C}" "${SU}" >> "${URLF}"
      printf '%s\t%s\n' "${C}" "${SU}" >> "${CTXF}"
    fi
  done
  local F
  for F in $(grep -rslE 'AUTHENTICATION_API_KEY' /root /opt /home /srv \
              --include='*.env' --include='*.yml' --include='*.yaml' --include='*.json' 2>/dev/null | head -20); do
    grep -hoE 'AUTHENTICATION_API_KEY[=: ]+["'"'"']?[A-Za-z0-9_-]{16,}' "${F}" 2>/dev/null \
      | grep -oE '[A-Za-z0-9_-]{16,}$' \
      | while read -r k; do printf 'fs:%s\t%s\n' "${F}" "${k}"; done >> "${KEYF}"
  done
  local v
  v="$(getenvf EVOLUTION_API_KEY)"
  [ -n "${v}" ] && printf '.env-do-app\t%s\n' "${v}" >> "${KEYF}"
  sort -t"${TAB}" -k2 -u "${KEYF}" -o "${KEYF}"
  sort -u "${URLF}" -o "${URLF}"
  sort -u "${CTXF}" -o "${CTXF}"
  [ -s "${KEYF}" ] || { fail "nenhuma chave candidata encontrada em nenhuma fonte"; return 1; }
  return 0
}

# sonda estrita no HOST: sucesso = HTTP 200 + JSON + instâncias > 0
probe() { # $1=key $2=url $3=endpoint → P_ST P_CT P_CNT P_REASON; corpo em P_BODY
  P_BODY="$(mktemp)"; P_REASON=""
  local w h
  w="$(curl -sS -m 10 -o "${P_BODY}" -w '%{http_code}|%{content_type}' \
        -H "apikey: $1" "$2$3" 2>/dev/null || echo '000|')"
  P_ST="${w%%|*}"; P_CT="${w#*|}"; P_CT="${P_CT%%;*}"; [ -n "${P_CT}" ] || P_CT="-"
  P_CNT="$(grep -oE '"(instanceName|name)":"[^"]+"' "${P_BODY}" 2>/dev/null | sort -u | wc -l | tr -d ' ')"
  h="$(head -c 40 "${P_BODY}" 2>/dev/null | tr -d ' \n\r\t')"
  if [ "${P_ST}" != "200" ]; then P_REASON="HTTP ${P_ST}"
  elif grep -qiE '<html|<!doctype' "${P_BODY}"; then P_REASON="HTML (não é API)"
  else
    case "${h}" in
      "["*|"{"*) [ "${P_CNT}" -gt 0 ] || P_REASON="sem instâncias" ;;
      *) P_REASON="corpo não é JSON" ;;
    esac
  fi
}

# runner para validar do CONTEXTO onde a API vai rodar (docker exec, sem stdin)
ctx_runner_setup() {
  API_RUNNER="$(docker ps --format '{{.Names}}' | grep -i reconstrua | grep -i api | head -1 || true)"
  WGET_RUNNER=""
  if [ -z "${API_RUNNER}" ]; then
    WGET_RUNNER="$(docker ps --format '{{.Names}}' | grep -i reconstrua | grep -iE 'postgres|db' | head -1 || true)"
    if [ -z "${WGET_RUNNER}" ]; then
      [ -n "$(getenvf POSTGRES_PASSWORD)" ] || setenvf POSTGRES_PASSWORD "$(openssl rand -hex 24)"
      (cd "${APP_DIR}" && docker compose --env-file .env -f docker-compose.production.yml up -d postgres) >/dev/null 2>&1 || true
      sleep 3
      WGET_RUNNER="$(docker ps --format '{{.Names}}' | grep -i reconstrua | grep -iE 'postgres|db' | head -1 || true)"
    fi
  fi
  ok "runner de contexto: ${API_RUNNER:-${WGET_RUNNER:-nenhum (validarei só no host)}}"
}
ctx_probe() { # $1=url-completa $2=key → CX_OK=1/0, CX_INFO
  CX_OK=0; CX_INFO=""
  local out st body cnt
  if [ -n "${API_RUNNER}" ]; then
    out="$(docker exec "${API_RUNNER}" node -e \
      'fetch(process.argv[1],{headers:{apikey:process.argv[2]}}).then(async r=>{const t=await r.text();process.stdout.write(r.status+"|"+t.slice(0,8000))}).catch(e=>process.stdout.write("000|"+e.message))' \
      "$1" "$2" 2>/dev/null || true)"
    st="${out%%|*}"; body="${out#*|}"
  elif [ -n "${WGET_RUNNER}" ]; then
    body="$(docker exec "${WGET_RUNNER}" wget -qO- -T 8 --header "apikey: $2" "$1" 2>/dev/null || true)"
    if [ -n "${body}" ]; then st="200?"; else st="000"; fi
  else
    CX_INFO="sem runner"
    return 0
  fi
  cnt="$(printf '%s' "${body}" | grep -oE '"(instanceName|name)":"[^"]+"' | sort -u | wc -l | tr -d ' ')"
  CX_INFO="HTTP ${st} · ${cnt} inst."
  case "${st}" in 200|"200?") [ "${cnt}" -gt 0 ] && CX_OK=1 ;; esac
}

# matriz container × chave × endpoint; vitória = host 2× + contexto OK
find_evolution_access() {
  WIN_KEY=""; WIN_URL=""; WIN_EP=""; WIN_SRC=""; WIN_CONT=""
  echo "  matriz (container | origem | endpoint | HTTP | inst | veredito):"
  local CONT URL SRC KEY EP B1 CURL CHOSEN TRYF
  while IFS="${TAB}" read -r CONT URL; do
    [ -n "${WIN_KEY}" ] && break
    while IFS="${TAB}" read -r SRC KEY; do
      [ -n "${WIN_KEY}" ] && break
      [ -n "${KEY}" ] || continue
      for EP in /manager/fetchInstances /instance/fetchInstances; do
        probe "${KEY}" "${URL}" "${EP}"
        printf '   | %-12s | %-30s | %-24s | %-3s | %-3s | %s |\n' \
          "${CONT}" "${SRC} $(mask "${KEY}")" "${EP}" "${P_ST}" "${P_CNT}" "${P_REASON:-CANDIDATA}"
        if [ -n "${P_REASON}" ]; then rm -f "${P_BODY}"; continue; fi
        B1="${P_BODY}"
        probe "${KEY}" "${URL}" "${EP}"          # revalidação no host
        if [ -n "${P_REASON}" ]; then
          warn "não reproduzível (${P_REASON}) — descartada"
          rm -f "${B1}" "${P_BODY}"; continue
        fi
        rm -f "${B1}"
        CHOSEN=""; TRYF="$(mktemp)"
        { grep "^${CONT}${TAB}" "${CTXF}" 2>/dev/null | cut -f2; echo "${URL}"; } | sort -u > "${TRYF}"
        while IFS= read -r CURL; do
          ctx_probe "${CURL}${EP}" "${KEY}"
          if [ "${CX_OK}" = "1" ]; then
            printf '   |   ctx OK: %s (%s)\n' "${CURL}" "${CX_INFO}"
            CHOSEN="${CURL}"; break
          fi
          printf '   |   ctx x : %s (%s)\n' "${CURL}" "${CX_INFO:-falhou}"
        done < "${TRYF}"
        rm -f "${TRYF}"
        if [ -z "${CHOSEN}" ] && [ -z "${API_RUNNER}${WGET_RUNNER}" ]; then
          warn "sem runner de contexto — aceitando a URL validada no host"
          CHOSEN="${URL}"
        fi
        if [ -n "${CHOSEN}" ]; then
          WIN_KEY="${KEY}"; WIN_URL="${CHOSEN}"; WIN_EP="${EP}"; WIN_SRC="${SRC}"; WIN_CONT="${CONT}"
          cp "${P_BODY}" "${INSTF}"; rm -f "${P_BODY}"
          break
        fi
        warn "contexto do container rejeitou todas as URLs — combinação descartada"
        rm -f "${P_BODY}"
      done
    done < "${KEYF}"
  done < "${URLF}"
  if [ -z "${WIN_KEY}" ]; then
    fail "nenhuma combinação container × chave × endpoint autenticou com instâncias > 0."
    fail "Recupere a API Key Global no manager da Evolution e salve:"
    fail "  echo 'EVOLUTION_API_KEY=<key-global>' >> ${APP_DIR}/.env   # e rode de novo"
    return 1
  fi
  ok "acesso Evolution: container=${WIN_CONT} · origem=${WIN_SRC} · endpoint=${WIN_EP}"
  ok "BASE_URL (validada no contexto da aplicação): ${WIN_URL} · chave=$(mask "${WIN_KEY}")"
  return 0
}

# seleção da instância: NOME oficial → senão NÚMERO oficial. Nunca "a primeira".
# A DECISÃO usa comparação bash `=` (mesmo operador do dump que deu IGUAL);
# NENHUM awk no caminho de decisão (mawk do Ubuntu diverge de bash em -F/-v).
select_instance() { # lê ${INSTF}; define EVOLUTION_INSTANCE e WHATSAPP_NUMBER, ou retorna 1
  local tbl raw chunk name jid num st chats msgs LINE
  local off_found="" off_st="" off_num="" tgt matches mcount
  tbl="$(mktemp)"; raw="$(mktemp)"
  echo "===== BEGIN INSTF ====="
  cat "${INSTF}"
  echo "===== END INSTF ====="
  sed 's/},[[:space:]]*{/}\n{/g' "${INSTF}" > "${raw}"
  echo "===== BEGIN RAW ====="
  cat "${raw}"
  echo "===== END RAW ====="
  # `|| [ -n "$chunk" ]` garante processar a ÚLTIMA linha mesmo SEM \n final
  # (sed/API podem não terminar com newline → o read perderia a última instância)
  while IFS= read -r chunk || [ -n "${chunk}" ]; do
    name="$(printf '%s' "${chunk}" | grep -oE '"(name|instanceName)":"[^"]+"' | head -1 | cut -d'"' -f4)"
    [ -n "${name}" ] || continue
    jid="$(printf '%s' "${chunk}" | grep -oE '"(ownerJid|owner|wuid)":"[^"]*"' | head -1 | cut -d'"' -f4)"
    num="$(norm "${jid}")"
    st="$(printf '%s' "${chunk}" | grep -oE '"(connectionStatus|status|state)":"[^"]+"' | head -1 | cut -d'"' -f4)"
    chats="$(printf '%s' "${chunk}" | grep -oE '"Chat":[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"
    msgs="$(printf '%s' "${chunk}" | grep -oE '"Message":[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "${name}" "${jid:--}" "${num:--}" "${st:-?}" "${chats:-?}" "${msgs:-?}" >> "${tbl}"
  done < "${raw}"
  rm -f "${raw}"

  # [PROVA] a decisão lê EXATAMENTE ${tbl}: metadados + conteúdo numerado do arquivo
  printf '[TBL] ls  : '
  # shellcheck disable=SC2012
  ls -l "${tbl}"
  printf '[TBL] wc  : '; wc -l "${tbl}"
  echo   '[TBL] cat -n:'; cat -n "${tbl}"
  printf '[TGT] OFFICIAL_INSTANCE=<%s> len=%d\n' "${OFFICIAL_INSTANCE}" "${#OFFICIAL_INSTANCE}"
  # listagem + detecção do NOME oficial no MESMO laço, lendo linha a linha de ${tbl}
  echo "  instâncias (nome | ownerJid | número | status | chats | msgs):"
  while IFS= read -r LINE || [ -n "${LINE}" ]; do
    name="$(printf '%s' "${LINE}" | cut -f1)"
    declare -p LINE
    declare -p name
    printf 'LINE_BYTES='
    printf '%s' "$LINE" | od -An -tx1
    printf 'NAME_BYTES='
    printf '%s' "$name" | od -An -tx1
    jid="$(printf '%s' "${LINE}" | cut -f2)"
    num="$(printf '%s' "${LINE}" | cut -f3)"
    st="$(printf '%s' "${LINE}" | cut -f4)"
    chats="$(printf '%s' "${LINE}" | cut -f5)"
    msgs="$(printf '%s' "${LINE}" | cut -f6)"
    printf 'LINE=<%s>\n' "${LINE}"
    printf 'NAME=<%s>\n' "${name}"
    printf 'LEN_NAME=%d\n' "${#name}"
    printf '   | %s | %s | %s | %s | %s | %s |\n' "${name}" "${jid}" "${num}" "${st}" "${chats}" "${msgs}"
    printf 'NAME_ESC=%q\n' "$name"
    printf 'OFF_ESC=%q\n' "$OFFICIAL_INSTANCE"
    printf '%s' "$name" | od -An -tx1
    printf '%s' "$OFFICIAL_INSTANCE" | od -An -tx1
    if [ "${name}" = "${OFFICIAL_INSTANCE}" ]; then
      off_found=1; off_st="${st}"; off_num="${num}"
      printf '[MATCH]\n'
    fi
  done < "${tbl}"

  # 1) NOME oficial exato — encontrado+conectado ⇒ RETURN (sem busca por número)
  if [ -n "${off_found}" ]; then
    if printf '%s' "${off_st}" | grep -qiE '^(open|connected)$'; then
      EVOLUTION_INSTANCE="${OFFICIAL_INSTANCE}"
      WHATSAPP_NUMBER="${off_num}"
      { [ -z "${WHATSAPP_NUMBER}" ] || [ "${WHATSAPP_NUMBER}" = "-" ]; } && WHATSAPP_NUMBER="${OFFICIAL_NUMBER}"
      ok "instância OFICIAL por NOME: '${EVOLUTION_INSTANCE}' (status ${off_st}, número ${WHATSAPP_NUMBER})"
      ok "usada EXCLUSIVAMENTE — sem busca por número; histórico preservado"
      rm -f "${tbl}"; return 0
    fi
    fail "a instância oficial '${OFFICIAL_INSTANCE}' existe mas NÃO está conectada (status: ${off_st:-?})."
    fail "Nunca a substituo automaticamente. Reconecte-a no manager (preserva o histórico) e rode de novo."
    rm -f "${tbl}"; return 1
  fi

  # 2) NÚMERO oficial normalizado (comparação bash) — 0=laudo · 1=usa · N=ambíguo
  tgt="$(norm "${OFFICIAL_NUMBER}")"; matches=""
  while IFS="${TAB}" read -r name jid num st chats msgs; do
    [ "${num}" = "${tgt}" ] && matches="${matches}${name}
"
  done < "${tbl}"
  rm -f "${tbl}"
  mcount="$(printf '%s' "${matches}" | grep -c . || true)"
  if [ "${mcount}" = "1" ]; then
    EVOLUTION_INSTANCE="$(printf '%s' "${matches}" | head -1)"
    WHATSAPP_NUMBER="${OFFICIAL_NUMBER}"
    ok "instância pelo NÚMERO oficial (${tgt}): '${EVOLUTION_INSTANCE}' — usada exclusivamente; histórico preservado"
    return 0
  fi
  if [ "${mcount}" -gt 1 ]; then
    fail "AMBÍGUO: ${mcount} instâncias com o número ${tgt}:"
    printf '%s' "${matches}" | while IFS= read -r name; do [ -n "${name}" ] && fail "  • ${name}"; done
    fail "Não escolho a primeira. Deixe apenas UMA conectada com esse número e rode de novo."
    return 1
  fi
  fail "nem o NOME oficial '${OFFICIAL_INSTANCE}' nem o NÚMERO ${tgt} constam nas instâncias acima."
  fail "Conecte o WhatsApp ${OFFICIAL_NUMBER} no manager (o deploy nunca cria/reseta/desconecta) e rode de novo."
  return 1
}

# ── 4/8 · domínio e portas (nunca desliga nada) ───────────────────────────────
port_busy() {
  ss -ltn 2>/dev/null | grep -qE "[:.]${1}[[:space:]]" && return 0
  command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE "(:|->)${1}->" && return 0
  return 1
}
pick_ports() {
  local base tries off busy
  base="$(getenvf PORT)"; base="${base:-3001}"; tries=0
  while :; do
    busy=""
    for off in 0 1 2 3; do
      if port_busy "$((base + off))"; then busy="$((base + off))"; break; fi
    done
    [ -z "${busy}" ] && break
    warn "porta ${busy} ocupada — NÃO desligo nada; tentando próxima faixa"
    base=$((base + 10)); tries=$((tries + 1))
    if [ "${tries}" -gt 60 ]; then fail "não há 4 portas consecutivas livres"; return 1; fi
  done
  PORT="${base}"; ADMIN_PORT=$((base + 1)); ADVOGADO_PORT=$((base + 2)); LX_PORT=$((base + 3))
  ok "portas livres: main=${PORT} admin=${ADMIN_PORT} advogado=${ADVOGADO_PORT} lx=${LX_PORT}"
  return 0
}
find_domain() {
  DOMAIN="$(getenvf PUBLIC_URL | sed -E 's|https?://||')"
  if [ -z "${DOMAIN}" ]; then
    local d
    for d in /etc/letsencrypt/live/*/; do
      d="$(basename "${d}")"
      [ "${d}" = "*" ] || [ "${d}" = "README" ] || { DOMAIN="${d}"; break; }
    done
  fi
  [ -n "${DOMAIN}" ] || DOMAIN="$(grep -rhoE 'server_name[[:space:]]+[^;_]+' /etc/nginx /usr/local/openresty /etc/openresty 2>/dev/null \
                                  | awk '{print $2}' | grep -vE '^(_|localhost|\$)' | head -1)"
  if [ -z "${DOMAIN}" ]; then
    local fqdn
    fqdn="$(hostname -f 2>/dev/null || true)"
    if printf '%s' "${fqdn}" | grep -qE '\.[a-z]{2,}$' && ! printf '%s' "${fqdn}" | grep -qE 'localhost|\.local'; then
      DOMAIN="${fqdn}"
    fi
  fi
  if [ -z "${DOMAIN}" ]; then
    fail "nenhum domínio nesta VPS (letsencrypt, nginx server_name, hostname FQDN)."
    fail "Crie um DNS A → ${PUBLIC_IP} e salve: PUBLIC_URL=https://SEU-DOMINIO em ${APP_DIR}/.env"
    return 1
  fi
  PUBLIC_URL="https://${DOMAIN}"
  ok "domínio: ${DOMAIN}"
  return 0
}

# ── 6/8 · ciclo compose até GO-LIVE GREEN ─────────────────────────────────────
deploy_until_green() {
  local cycle gl
  GREEN=""
  for cycle in 1 2 3 4 5; do
    echo "  ── ciclo ${cycle} ──"
    (cd "${APP_DIR}" && docker compose --env-file .env -f docker-compose.production.yml up -d --build 2>&1 | tail -2)
    for _ in $(seq 1 30); do
      gl="$(curl -fsS -m 5 "http://localhost:${PORT}/production/go-live" 2>/dev/null || true)"
      if printf '%s' "${gl}" | grep -q '"ready":true'; then GREEN=1; break; fi
      sleep 4
    done
    [ -n "${GREEN}" ] && break
    echo "  diagnóstico do ciclo ${cycle}:"
    printf '%s' "${gl:-sem-resposta}" \
      | grep -oE '"item":"[^"]+","passed":false,"detail":"[^"]*"' | sed 's/^/    FAIL /' || true
    if ! docker ps --format '{{.Names}}' | grep -qi postgres; then
      warn "postgres não subiu — recriando"
      (cd "${APP_DIR}" && docker compose --env-file .env -f docker-compose.production.yml up -d postgres)
      sleep 8
    fi
    if docker ps -a --format '{{.Names}} {{.Status}}' | grep -qiE 'api.*(exited|restarting)'; then
      warn "api reiniciando — últimas linhas do log:"
      (cd "${APP_DIR}" && docker compose --env-file .env -f docker-compose.production.yml logs api --tail=15)
      (cd "${APP_DIR}" && docker compose --env-file .env -f docker-compose.production.yml restart api)
      sleep 6
    fi
  done
  if [ -z "${GREEN}" ]; then
    fail "GO-LIVE não ficou GREEN após 5 ciclos. Logs da api:"
    (cd "${APP_DIR}" && docker compose --env-file .env -f docker-compose.production.yml logs api --tail=40)
    return 1
  fi
  ok "GO-LIVE: ready=true (todos os gates GREEN)"
  return 0
}

SELF_DST="/tmp/deploy-debug.sh"
# Persiste em disco o script EXATO que está executando e roda a partir dele, para
# permitir `less /tmp/deploy-debug.sh` e conferir que o executado == o publicado.
save_self_and_reexec() {
  [ "${DEPLOY_SELF_SAVED:-}" = "1" ] && return 0
  export DEPLOY_SELF_SAVED=1
  # (a) rodando de um ARQUIVO real (ex.: bash arquivo.sh): copia esse arquivo exato
  if [ -f "$0" ] && [ "$0" != "${SELF_DST}" ] \
     && [ "$(basename -- "$0")" != "bash" ] && [ "$(basename -- "$0")" != "sh" ]; then
    cp "$0" "${SELF_DST}" && chmod +x "${SELF_DST}" && exec bash "${SELF_DST}" "$@"
  fi
  # (b) rodando via pipe (curl|bash): não há arquivo-fonte no disco — rebaixa a
  #     própria fonte publicada (master, com cache-bust) para o disco e re-executa
  if [ "$0" != "${SELF_DST}" ] && command -v curl >/dev/null 2>&1; then
    curl -fsSL "${REPO_URL%.git}/raw/master/scripts/deploy-vps.sh?cb=$(date +%s)" \
      | tr -d '\r' > "${SELF_DST}" 2>/dev/null || true
    if [ -s "${SELF_DST}" ]; then chmod +x "${SELF_DST}"; exec bash "${SELF_DST}" "$@"; fi
  fi
  return 0
}

main() {
  save_self_and_reexec "$@"
  printf '\n\033[1;35m AHRIOS deploy-vps %s \033[0m\n' "${SCRIPT_VERSION}"
  # ── IDENTIDADE OBRIGATÓRIA do script em execução ──
  printf 'SELF_DST=%s (abra com: less %s)\n' "${SELF_DST}" "${SELF_DST}"
  printf 'SCRIPT_SHA=%s\n' "${SCRIPT_SHA}"
  printf 'SCRIPT_VERSION=%s\n' "${SCRIPT_VERSION}"
  echo "SCRIPT_PATH=$0"
  sha256sum "$0"
  echo "BASH_VERSION=$BASH_VERSION"
  echo "AWK=$(awk -W version 2>/dev/null | head -1 || true)"

  say "0/8 Pré-requisitos"
  command -v docker >/dev/null 2>&1 || { warn "instalando docker"; curl -fsSL https://get.docker.com | sh >/dev/null 2>&1; }
  command -v git >/dev/null 2>&1 || apt-get install -y -qq git >/dev/null 2>&1
  command -v openssl >/dev/null 2>&1 || apt-get install -y -qq openssl >/dev/null 2>&1
  PUBLIC_IP="$(curl -fsS -m 8 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
  ok "docker $(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1) · IP público ${PUBLIC_IP}"

  say "1/8 Código em ${APP_DIR}"
  if [ -d "${APP_DIR}/.git" ]; then
    git -C "${APP_DIR}" pull --ff-only >/dev/null 2>&1 || true
  else
    git clone --depth 1 "${REPO_URL}" "${APP_DIR}" >/dev/null 2>&1
  fi
  cd "${APP_DIR}" || { fail "não consegui obter o código"; exit 1; }
  touch .env; chmod 600 .env
  ok "código: $(git rev-parse --short HEAD)"

  say "2/8 Chave de LLM existente na VPS (reutilizar; nunca criar)"
  ANTHROPIC_API_KEY=""; OPENAI_API_KEY=""; GEMINI_API_KEY=""; LLM_PROVIDER=""
  find_llm_key || exit 1

  say "3/8 Evolution: chave global + instância OFICIAL"
  KEYF="$(mktemp)"; URLF="$(mktemp)"; CTXF="$(mktemp)"; INSTF="$(mktemp)"
  collect_evolution || exit 1
  ctx_runner_setup
  find_evolution_access || exit 1
  EVOLUTION_API_KEY="${WIN_KEY}"; EVOLUTION_BASE_URL="${WIN_URL}"
  select_instance || exit 1
  rm -f "${KEYF}" "${URLF}" "${CTXF}" "${INSTF}"

  say "4/8 Domínio e portas"
  find_domain || exit 1
  pick_ports || exit 1

  say "5/8 .env final (segredos só nesta VPS)"
  POSTGRES_PASSWORD="$(getenvf POSTGRES_PASSWORD)"
  [ -n "${POSTGRES_PASSWORD}" ] || POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  setenvf POSTGRES_PASSWORD "${POSTGRES_PASSWORD}"
  setenvf PORT "${PORT}"; setenvf ADMIN_PORT "${ADMIN_PORT}"
  setenvf ADVOGADO_PORT "${ADVOGADO_PORT}"; setenvf LX_PORT "${LX_PORT}"
  setenvf PUBLIC_URL "${PUBLIC_URL}"
  setenvf EVOLUTION_BASE_URL "${EVOLUTION_BASE_URL}"
  setenvf EVOLUTION_INSTANCE "${EVOLUTION_INSTANCE}"
  setenvf EVOLUTION_API_KEY "${EVOLUTION_API_KEY}"
  setenvf WHATSAPP_NUMBER "${WHATSAPP_NUMBER}"
  setenvf LLM_PROVIDER "${LLM_PROVIDER}"
  [ -n "${ANTHROPIC_API_KEY}" ] && setenvf ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY}"
  [ -n "${OPENAI_API_KEY}" ] && setenvf OPENAI_API_KEY "${OPENAI_API_KEY}"
  [ -n "${GEMINI_API_KEY}" ] && setenvf GEMINI_API_KEY "${GEMINI_API_KEY}"
  setenvf ALLOW_DEGRADED "false"
  setenvf SHADOW_MODE "true"
  ok ".env montado (gates intactos: ALLOW_DEGRADED=false)"

  say "6/8 Ciclo Diagnóstico → Correção → Diagnóstico (até GREEN)"
  deploy_until_green || exit 1

  say "7/8 Webhook Evolution → API"
  WEBHOOK_URL="http://${PUBLIC_IP}:${PORT}/webhook/evolution"
  if curl -fsS -m 10 -X POST "${EVOLUTION_BASE_URL}/webhook/set/${EVOLUTION_INSTANCE}" \
      -H "apikey: ${EVOLUTION_API_KEY}" -H "content-type: application/json" \
      -d "{\"webhook\":{\"enabled\":true,\"url\":\"${WEBHOOK_URL}\",\"byEvents\":false,\"base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}}" >/dev/null 2>&1; then
    ok "webhook: ${WEBHOOK_URL}"
  else
    warn "API de webhook recusou — registre no manager: ${WEBHOOK_URL} (MESSAGES_UPSERT)"
  fi

  say "8/8 LAUDO FINAL"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo; echo "GO-LIVE:"; curl -fsS -m 5 "http://localhost:${PORT}/production/go-live" | head -c 600; echo
  echo; echo "HEALTH:";  curl -fsS -m 5 "http://localhost:${PORT}/production/health" | head -c 300; echo
  echo; echo "URLs:"
  echo "  UI/Monitor : http://${PUBLIC_IP}:${PORT}/production/ui"
  echo "  Webhook    : ${WEBHOOK_URL}"
  echo "  Admin API  : http://${PUBLIC_IP}:${ADMIN_PORT} · Advogado: ${ADVOGADO_PORT} · LX: ${LX_PORT}"
  echo "  Público    : ${PUBLIC_URL} (aponte o proxy para :${PORT} quando quiser expor)"
  echo
  echo "✅ PRONTO. Teste real: mande 'Olá' para o WhatsApp da instância '${EVOLUTION_INSTANCE}'."
}

# stdin → /dev/null: NENHUM comando interno consegue consumir o stream do script
# quando executado via `curl | bash` (causa raiz do estado inconsistente anterior).
main "$@" </dev/null
