# Manual de Deploy — AHRIOS (Produção Real)

## Pré-requisitos
- Servidor Linux com Docker + Docker Compose, domínio com HTTPS (proxy reverso
  Caddy/Nginx apontando para a porta 3001) e uma instância **Evolution API**
  conectada ao número de WhatsApp da operação.
- Chave de UM provedor de LLM (Anthropic recomendado; OpenAI/Gemini suportados).

## Passo a passo
1. **Clonar o repositório** no servidor e criar o arquivo `.env` na raiz:
   ```env
   POSTGRES_PASSWORD=<forte>
   PUBLIC_URL=https://seu-dominio.com.br
   EVOLUTION_BASE_URL=https://evolution.seu-dominio.com.br
   EVOLUTION_INSTANCE=ahri
   EVOLUTION_API_KEY=<chave da Evolution>
   WHATSAPP_NUMBER=5511999999999
   LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=<sua chave>
   ```
2. **Subir**: `docker compose -f docker-compose.production.yml up -d --build`
   - O container executa o **GO-LIVE CHECKLIST** no boot. **Qualquer item vermelho
     ⇒ o processo NÃO sobe** (logs mostram cada item). `ALLOW_DEGRADED=true` só
     para homologação.
3. **Webhook**: na Evolution, configurar o webhook de `messages.upsert` para
   `https://seu-dominio.com.br/webhook/evolution`.
4. **Landing**: publicar `apps/landing/index.html` (qualquer estático/CDN),
   editando `WHATSAPP_NUMBER` no script e colando o Meta Pixel. O link do anúncio
   deve apontar para a landing com `?utm_campaign=<nome>` — a campanha viaja no
   texto da primeira mensagem (atribuição).
5. **Portais** (opcional em VM/PaaS): `pnpm --filter @reconstrua/portal-administracao build && next start`
   com `NEXT_PUBLIC_API_URL=https://seu-dominio.com.br:3002` (admin) e o portal do
   advogado com a API 3003. O monitor/config imediato está em
   `https://seu-dominio.com.br/production/ui`.
6. **Verificar**: `GET /production/go-live` → `ready: true`; `GET /production/monitor`.

## Portas
| 3001 | webhook + /production/* (+UI) | 3002 | Admin API | 3003 | Advogado API | 3004 | Lawyer Experience |

## Atualização
`git pull && docker compose -f docker-compose.production.yml up -d --build` — o
Event Store é append-only; migrações são forward-only (`infrastructure/database/init`).
