#!/bin/sh
# Site da CNH: grava no config.js o número do WhatsApp que veio do .env
# (CNH_SITE_WHATSAPP), a cada subida do contêiner. Só dígitos; vazio, os botões
# levam à seção de contato.
set -eu
numero=$(printf '%s' "${CNH_SITE_WHATSAPP:-}" | tr -cd '0-9')
sed -i "s/whatsapp: '[0-9]*'/whatsapp: '${numero}'/" /usr/share/nginx/html/assets/js/config.js
echo "site-cnh: WhatsApp ${numero:-não configurado}"
