# CAT-02C — RELEASE NOTE
### Servir o documento real por documentId (uso interno)

**Capacidade:** o sistema consegue servir o documento real através do `documentId` para consumo interno.
**Commit:** `0baa931` · **Data:** 2026-07-16 · **Base:** `a96ec1b` → **HEAD:** `0baa931`

---

## O que muda
- `MediaStorePort` ganha **`read(sha256)`** (lê os bytes).
- `DocumentContentService` resolve **`documentId → DocumentLink (CAT-02B) → sha256 → media_blobs (CAT-02A)`**.
- **Uma rota nova no servidor ADMIN INTERNO** (porta não publicada):
  `GET /admin/documents/:documentId/content` → conteúdo real com `content-type`; **404** se não houver
  vínculo/blob.

## Isolamento (regra da sprint)
A rota vive **exclusivamente** no servidor admin interno. **Nada foi publicado na internet, nenhuma
autenticação provisória foi criada.** A topologia interna (porta admin não publicada) é o mecanismo
de isolamento — **comprovado**: `GET /admin/documents/x/content` no domínio público responde **404**
(a rota não existe no servidor público).

## Reaproveitamento (nada recriado)
`DocumentLink` (CAT-02B), `media_blobs`/`MediaStore` (CAT-02A), `production.documents`, os read models
de documento e o **servidor admin interno** existente. **Nenhuma tabela, read model, UI, portal,
preview, auth ou rota pública nova.**

## Escopo preservado (proibições respeitadas)
Sem tocar Event Store, Mission Runtime, Executive Brain, Conversation Runtime, DocumentAggregate,
RecognizeDocumentUseCase, APIs públicas ou produção pública. Sem OCR, IA, leitura automática.

## Validação de produção (não apenas testes)
- **Deploy `0baa931`: Success (49s)** — `migrate` idempotente; `api` (com o servidor admin + rota) subiu.
- **Go-Live ao vivo:** `ready:true`; health **ONLINE**; read-models passed; landing `/` = 200.
- **Isolamento provado:** rota de conteúdo **404 no público** (só alcançável internamente).
- **Portões locais:** typecheck (infra+api) OK; lint limpo; **media 19/19** (02A 10 + 02B 6 + 02C 3, +1
  integração pulada); **admin/produção/REAL_FIRST_CLIENT 36/36**; **go-live/dispatcher 42/42**.

## Riscos
- **P1 (o principal) — mitigado:** documentos de clientes servidos **só** no servidor interno; nunca no
  público (comprovado). Auth real (DF-12) permanece capacidade futura, fora de escopo.
- **P0/P2:** nenhum — `read` é aditivo (CAT-02A/B intactos); rota nova (não altera existentes); sem
  env/porta/tabela nova.
- **P4:** streaming de arquivos grandes fica como evolução (limite de 20 MB do CAT-02A já protege).

## Rollback
`git revert 0baa931` + push → a rota e `read()` somem; `media_blobs`, `DocumentLink` e os portais
inalterados. Sem migração/contrato → reversão limpa. Emergência: imagem anterior via `deploy.sh`.

## Declaração
**CAT-02C APROVADA PARA PRODUÇÃO**
