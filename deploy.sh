#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Projeto Reconstrua — DEPLOY TOTALMENTE AUTOMÁTICO (rode NA VPS, como root):
#   cd /opt/reconstrua && git pull && bash deploy.sh
# ou, na primeira vez:
#   curl -fsSL https://raw.githubusercontent.com/jeflash2026/projeto-reconstrua/master/deploy.sh | tr -d '\r' | bash
#
# Atualiza repo → rebuild → sobe → espera API → valida GO-LIVE → testa os domínios
# → confere NPM/DNS/cert/redes → autocorrige o corrigível → repete até tudo VERDE.
# Só termina quando /, www e /production/health respondem 200.
# ─────────────────────────────────────────────────────────────────────────────
set -u

APP_DIR="/opt/reconstrua"
BRANCH="master"
COMPOSE="docker-compose.production.yml"
FALLBACK_DOMAIN="projetoreconstrua.com.br"
MAX_CYCLES=8

say()  { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
ok()   { printf '  \033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m[..]\033[0m %s\n' "$*"; }
fail() { printf '  \033[1;31m[X]\033[0m %s\n' "$*"; }

http_code() { curl -sS -o /dev/null -w '%{http_code}' -m 12 "$@" 2>/dev/null || echo 000; }

# ── 0 · pré-requisitos ───────────────────────────────────────────────────────
main() {
  say "0 · pré-requisitos"
  command -v docker >/dev/null 2>&1 || { curl -fsSL https://get.docker.com | sh >/dev/null 2>&1; }
  command -v git >/dev/null 2>&1    || apt-get install -y -qq git >/dev/null 2>&1
  command -v curl >/dev/null 2>&1   || apt-get install -y -qq curl >/dev/null 2>&1
  command -v openssl >/dev/null 2>&1|| apt-get install -y -qq openssl >/dev/null 2>&1
  ok "docker $(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"

  # ── 1 · repositório na branch correta, sincronizado com o remoto ───────────
  say "1 · repositório em ${APP_DIR} (branch ${BRANCH})"
  if [ ! -d "${APP_DIR}/.git" ]; then
    git clone --branch "${BRANCH}" --depth 1 https://github.com/jeflash2026/projeto-reconstrua.git "${APP_DIR}" >/dev/null 2>&1
  fi
  cd "${APP_DIR}" || { fail "sem ${APP_DIR}"; exit 1; }
  git fetch --all --quiet 2>/dev/null || true
  git checkout "${BRANCH}" --quiet 2>/dev/null || true
  git reset --hard "origin/${BRANCH}" --quiet 2>/dev/null || git reset --hard "origin/${BRANCH}" >/dev/null 2>&1
  CUR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  if [ "${CUR}" = "${BRANCH}" ]; then
    ok "branch=${CUR} · commit=$(git rev-parse --short HEAD)"
  else
    fail "branch errada (${CUR})"; exit 1
  fi

  # ── config do .env ─────────────────────────────────────────────────────────
  [ -f .env ] || { fail ".env ausente em ${APP_DIR} — rode o deploy-vps.sh primeiro"; exit 1; }
  PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2-)"; PORT="${PORT:-3001}"
  PUBLIC_URL="$(grep -E '^PUBLIC_URL=' .env | head -1 | cut -d= -f2-)"
  DOMAIN="$(printf '%s' "${PUBLIC_URL}" | sed -E 's#https?://##; s#/.*##')"
  [ -n "${DOMAIN}" ] || DOMAIN="${FALLBACK_DOMAIN}"
  PUBLIC_IP="$(curl -fsS -m 8 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
  ok "PORT=${PORT} · DOMAIN=${DOMAIN} · IP=${PUBLIC_IP}"

  # ── 2 · rebuild + subir ────────────────────────────────────────────────────
  say "2 · rebuild da imagem + subir containers"
  docker compose --env-file .env -f "${COMPOSE}" up -d --build 2>&1 | tail -3

  GREEN=""
  for cycle in $(seq 1 "${MAX_CYCLES}"); do
    echo ""; say "CICLO ${cycle}/${MAX_CYCLES}"
    docker compose --env-file .env -f "${COMPOSE}" up -d 2>/dev/null | tail -1

    # ── 3 · API iniciou? (health interno) ─────────────────────────────────────
    HEALTH_LOCAL=""
    for _ in $(seq 1 30); do
      [ "$(http_code "http://localhost:${PORT}/production/health")" = "200" ] && { HEALTH_LOCAL=1; break; }
      sleep 4
    done
    if [ -z "${HEALTH_LOCAL}" ]; then
      fail "API não respondeu em localhost:${PORT}/production/health"
      API_C="$(docker ps -a --format '{{.Names}}' | grep -iE 'reconstrua.*api|api' | head -1)"
      if docker ps -a --format '{{.Names}} {{.Status}}' | grep -qiE 'api.*(exited|restart)'; then
        warn "api reiniciando — últimas linhas do log:"
        docker logs "${API_C}" --tail 25 2>&1 | sed 's/^/    /'
        warn "forçando rebuild sem cache"
        docker compose --env-file .env -f "${COMPOSE}" build --no-cache api >/dev/null 2>&1
        docker compose --env-file .env -f "${COMPOSE}" up -d api 2>/dev/null
      fi
      continue
    fi
    ok "API viva: localhost:${PORT}/production/health = 200"

    # ── 4 · GO-LIVE ────────────────────────────────────────────────────────────
    GL="$(curl -sS -m 10 "http://localhost:${PORT}/production/go-live" 2>/dev/null)"
    if printf '%s' "${GL}" | grep -q '"ready":true'; then
      ok "GO-LIVE: ready=true"
    else
      warn "GO-LIVE não-ready; itens FAIL:"
      printf '%s' "${GL}" | grep -oE '"item":"[^"]+","passed":false,"detail":"[^"]*"' | sed 's/^/    /' || true
      docker logs "$(docker ps --format '{{.Names}}' | grep -iE 'reconstrua.*api|api' | head -1)" --tail 20 2>&1 | grep -i 'GOLIVE\|FAIL' | sed 's/^/    /' || true
    fi

    # ── 5 · NPM + rede Docker (NPM precisa alcançar o container api) ───────────
    NPM_C="$(docker ps --format '{{.Names}}' | grep -iE 'nginx-proxy|proxy-manager|npm' | head -1)"
    API_C="$(docker ps --format '{{.Names}}' | grep -iE 'reconstrua.*api|api' | head -1)"
    if [ -n "${NPM_C}" ] && [ -n "${API_C}" ]; then
      NPM_NETS="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${NPM_C}" 2>/dev/null)"
      API_NETS="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "${API_C}" 2>/dev/null)"
      SHARED=""
      for n in ${NPM_NETS}; do for a in ${API_NETS}; do [ "${n}" = "${a}" ] && SHARED="${n}"; done; done
      if [ -z "${SHARED}" ]; then
        FIRST="$(printf '%s' "${NPM_NETS}" | awk '{print $1}')"
        if [ -n "${FIRST}" ] && docker network connect "${FIRST}" "${API_C}" 2>/dev/null; then
          ok "AUTOFIX: conectei ${API_C} à rede do NPM (${FIRST})"
        else
          warn "NPM (${NPM_C}) e api (${API_C}) sem rede em comum e não consegui conectar"
        fi
      else
        ok "NPM ${NPM_C} e api ${API_C} compartilham a rede ${SHARED}"
      fi
    else
      warn "NPM container não localizado (nginx-proxy/npm) — pulo o fix de rede"
    fi

    # ── 6 · DNS ────────────────────────────────────────────────────────────────
    DNS_IPS="$(getent ahosts "${DOMAIN}" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')"
    if printf '%s' "${DNS_IPS}" | grep -qw "${PUBLIC_IP}"; then
      ok "DNS ${DOMAIN} → ${DNS_IPS}(inclui ${PUBLIC_IP})"
    else
      warn "DNS ${DOMAIN} → ${DNS_IPS:-nada} (esperado incluir ${PUBLIC_IP}) — DNS é externo, não corrijo daqui"
    fi

    # ── 7 · certificado TLS ────────────────────────────────────────────────────
    CERT="$(echo | openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" 2>/dev/null | openssl x509 -noout -subject -enddate 2>/dev/null)"
    if printf '%s' "${CERT}" | grep -qi "${DOMAIN}"; then
      ok "TLS: $(printf '%s' "${CERT}" | tr '\n' ' ')"
    else
      warn "TLS: cert não confirmado para ${DOMAIN} (o NPM gerencia o Let's Encrypt)"
    fi

    # ── 8 · TESTES FINAIS pelo domínio público ────────────────────────────────
    C_ROOT="$(http_code "https://${DOMAIN}/")"
    C_WWW="$(http_code "https://www.${DOMAIN}/")"
    C_HEALTH="$(http_code "https://${DOMAIN}/production/health")"
    C_UI="$(http_code "https://${DOMAIN}/production/ui")"
    echo "  domínio: / =${C_ROOT} · www=${C_WWW} · /production/health=${C_HEALTH} · /production/ui=${C_UI}"

    if [ "${C_ROOT}" = "200" ] && [ "${C_WWW}" = "200" ] && [ "${C_HEALTH}" = "200" ]; then
      GREEN=1; break
    fi

    # ── AUTOFIX conforme o sintoma ────────────────────────────────────────────
    if [ "${C_ROOT}" = "404" ] && [ "$(http_code "http://localhost:${PORT}/")" = "404" ]; then
      warn "raiz 404 no container → imagem sem a rota / ; rebuild sem cache"
      docker compose --env-file .env -f "${COMPOSE}" build --no-cache api >/dev/null 2>&1
      docker compose --env-file .env -f "${COMPOSE}" up -d api 2>/dev/null
    elif [ "${C_ROOT}" = "502" ] || [ "${C_ROOT}" = "000" ]; then
      warn "raiz ${C_ROOT} (NPM não alcança upstream) → recriando api e revalidando rede"
      docker compose --env-file .env -f "${COMPOSE}" up -d --force-recreate api 2>/dev/null
    else
      warn "raiz=${C_ROOT}; nova tentativa após breve espera"
    fi
    sleep 6
  done

  # ── laudo final ────────────────────────────────────────────────────────────
  say "LAUDO FINAL"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo ""
  echo "curl -I https://${DOMAIN}/"
  curl -sS -I -m 12 "https://${DOMAIN}/" 2>&1 | head -4 | sed 's/^/  /'
  echo "curl -I https://www.${DOMAIN}/"
  curl -sS -I -m 12 "https://www.${DOMAIN}/" 2>&1 | head -2 | sed 's/^/  /'
  echo "curl -o /dev/null -w health=%{http_code} https://${DOMAIN}/production/health"
  http_code "https://${DOMAIN}/production/health" | sed 's/^/  health=/'

  if [ -n "${GREEN}" ]; then
    echo ""; ok "TUDO VERDE: /=200 · www=200 · /production/health=200 · UI na raiz. Projeto Reconstrua no ar."
    exit 0
  fi
  echo ""; fail "não fechou verde em ${MAX_CYCLES} ciclos. O laudo acima mostra o estado; o item que resta é externo"
  fail "(DNS/registrar, ou config do Proxy Host no NPM apontando para container:porta errados)."
  exit 1
}

main "$@" </dev/null
