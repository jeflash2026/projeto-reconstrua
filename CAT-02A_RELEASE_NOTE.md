# CAT-02A — RELEASE NOTE
### Captura dos bytes reais de documentos do WhatsApp

**Capacidade:** o Reconstrua passa a possuir os bytes reais enviados pelo cliente.
**Commit:** `68a10e8` · **Data:** 2026-07-16 · **Base:** `5a8b1ee` → **HEAD:** `68a10e8`

---

## O que muda
Quando o cliente envia PDF/imagem, o webhook — **após o ACK** — dispara uma captura
**assíncrona best-effort**: baixa o base64 via Evolution `getBase64`, valida (allowlist MIME +
tamanho + magic bytes), calcula **sha256**, **deduplica** e persiste o blob content-addressed em
`production.media_blobs`. **Nenhuma conversa espera; nenhuma exceção quebra o webhook; toda
falha só gera log.**

## Fluxo (exatamente o especificado)
```
webhook → ACK imediato → capture() assíncrona → download base64 → validação →
sha256 → deduplicação → persistência do blob → fim
```

## Componentes (todos os nomeados; nada além)
`MediaStorePort` · `MediaGatewayPort` · `MediaCaptureRuntime` · `EvolutionMediaClient` ·
`PgMediaStore` · `InMemoryMediaStore` · migration `05-media.sql` · wiring em `build-production` ·
chamada no `production-server` (webhook).

## Segurança
Allowlist MIME (`application/pdf`, `image/jpeg`, `image/png`) · limite de tamanho (20 MB) ·
**magic bytes** (não confia no mime declarado) · **sha256** · **deduplicação** por conteúdo.

## Banco (via MIG-01, zero DDL em TypeScript)
Apenas `infrastructure/database/init/05-media.sql` → `production.media_blobs(sha256 PK, mime,
size, bytes bytea, created_at)`. Aplicada pelo mecanismo MIG-01. Sem `ensureSchema()`.

## Escopo preservado (proibições respeitadas)
Sem tocar: Event Store, Mission Runtime, Conversation Runtime, Executive Brain, Rule
Engine/Catalog, DocumentAggregate, RecognizeDocument, ProductionIngress, EvolutionGateway
existente. Sem OCR, IA, portal, tela, read model ou API pública. O vínculo por-mensagem
(messageId→sha256) fica para o **CAT-02B**.

## Validação de produção (não apenas testes)
- **Deploy `68a10e8`: Success (48s)** — o serviço `migrate` aplicou `05-media.sql` no **Postgres
  de produção já existente** e a `api` subiu com a captura ligada.
- **Go-Live ao vivo:** `ready:true` (postgres/event-store passed). Landing `/` = 200.
- **Portões locais:** typecheck (infra+api) OK; lint limpo; media **10/10** (+1 integração pulada
  sem `DATABASE_URL`); produção **18/18** (webhook/shadow/REAL_FIRST_CLIENT intactos).

## Riscos
- **P0/P1/P2:** nenhum introduzido — captura desacoplada (nunca quebra o webhook), sem endpoint
  público novo, sem env novo.
- **P4 (a verificar em campo):** o contrato exato do endpoint `getBase64FromMediaMessage` pode
  variar por versão da Evolution; o `EvolutionMediaClient` é isolado e a falha só gera log — se o
  formato diferir na Evolution real, ajusta-se só o client (integração real = CAT-02B/uso real).

## Rollback
`git revert 68a10e8` + push → remove o módulo `media/`, o wiring e a chamada no webhook; a captura
deixa de ocorrer. A tabela `media_blobs` fica (aditiva, inerte). Sem migração de dados, sem
mudança de contrato → reversão limpa. Emergência: rollback de imagem via `deploy.sh`.

## Declaração
**CAT-02A APROVADA PARA PRODUÇÃO**
