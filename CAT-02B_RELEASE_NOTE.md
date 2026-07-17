# CAT-02B — RELEASE NOTE
### Vínculo definitivo blob ↔ mensagem ↔ documento

**Capacidade:** o sistema passa a saber qual blob pertence a qual mensagem e a qual documento.
**Commit:** `a96ec1b` · **Data:** 2026-07-16 · **Base:** `68a10e8` → **HEAD:** `a96ec1b`

---

## O que muda
- A captura (CAT-02A) passa a gravar **`messageId → sha256`** (`MediaReference`) — a metade que
  faltava.
- Ao reconhecer um documento, um **subscriber** do evento `document.recognized` materializa o
  **vínculo definitivo `documentId → { messageId, sha256, mime }`** (`DocumentLink`), lendo a
  referência da captura. Se o blob ainda não foi capturado (corrida assíncrona), o subscriber
  **lança** e o **retry/DLQ do dispatcher** (já existente) re-tenta.

## Reaproveitamento (nada recriado)
- `production.documents` (JsonStore) como metadata store — **exclusivo**, sem tabela nova.
- Event Dispatcher + `SubscriberRegistry` + `SerializedSubscriber` + retry/DLQ — reusados.
- `DocumentRecognized` já carrega `documentId` (stream) e `messageId` (provenance) — **observado**,
  não alterado.
- `sha256` (CAT-02A). Helpers de payload unificados em `media/raw.ts` (removida a duplicação).

## Escopo preservado (proibições respeitadas)
Sem tocar Event Store, Mission Runtime, Executive Brain, Conversation Runtime, DocumentAggregate,
RecognizeDocumentUseCase, contratos públicos, APIs ou banco (**nenhuma tabela nova**). O
reconhecimento é **observado** via evento, nunca alterado.

## Validação de produção (não apenas testes)
- **Deploy `a96ec1b`: Success (50s)** — o `migrate` **pulou** `05-media.sql` (idempotência do MIG-01
  comprovada) e a `api` subiu com o subscriber registrado.
- **Go-Live ao vivo:** `ready:true`; `postgres`/`event-store`/**`dispatcher`** passed; health ONLINE;
  landing `/` = 200.
- **Portões locais:** typecheck (infra+api) OK; lint limpo; **media 16/16** (CAT-02A 10 + CAT-02B 6,
  +1 integração pulada); **produção/REAL_FIRST_CLIENT 18/18**; **dispatcher/go-live 54/54**.

## Riscos
- **Corrida captura×reconhecimento:** **tratada** pelo retry/DLQ do dispatcher (não é bug latente);
  writers em chaves distintas (`media-message-ref` por messageId; `document-link` por documentId) →
  sem lost-update. Documento reconhecido sem blob válido → DLQ após max tentativas (sinal auditável).
- **P1/P2:** nenhum — sem endpoint/API/exposição nova; sem env/tabela nova.

## Rollback
`git revert a96ec1b` + push → o subscriber deixa de ser registrado e a captura para de gravar a
referência; `media_blobs` e `DocumentRecognized` inalterados; os registros em `production.documents`
ficam inertes. Sem migração de dados/contrato → reversão limpa. Emergência: imagem anterior via
`deploy.sh`.

## Declaração
**CAT-02B APROVADA PARA PRODUÇÃO**
