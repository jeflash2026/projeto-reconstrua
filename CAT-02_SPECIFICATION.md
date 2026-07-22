# CAT-02 — ESPECIFICAÇÃO EXECUTÁVEL

### Capacidade: documentos reais do WhatsApp (do envio ao uso em toda a plataforma)

**Data:** 2026-07-16 · **Natureza:** especificação (proibido código nesta sprint).
**Regra-mestra:** reaproveitar o máximo da arquitetura existente; criar só o inexistente.

**Diagnóstico de partida (fato do código):** o sistema já _percebe_ o documento e já _reconhece_ a
entidade Documento — mas **nunca possui os bytes**. O `contentReference` atual é um texto
(`fileName ?? mediaRef ?? text`), não o conteúdo probatório. CAT-02 fecha exatamente essa lacuna.

---

## 1. FLUXO COMPLETO (envio → disponível para a plataforma)

```
1. Cliente envia PDF/imagem no WhatsApp
2. Evolution recebe e dispara webhook messages.upsert (documentMessage/imageMessage)
3. Webhook /webhook/evolution → mapEvolutionUpsert → percept {kind:pdf|image|document,
   mediaUrl(.enc), mediaMimeType, fileName, messageId, chatId}
4. [NOVO] Capture: baixa os BYTES reais via Evolution getBase64 (mídia descriptografada)
5. [NOVO] Valida (mime allowlist, tamanho, magic bytes) e calcula sha256 do conteúdo
6. [NOVO] Dedup por sha256; se novo, grava o blob no MediaStore (content-addressed)
7. RecognizeDocument (R3) persiste DocumentRecognized com {storageKey, sha256, mime, fileName, size}
8. Event Store (append-only, hash-chain) registra o evento; Outbox/Dispatcher drena
9. Read Model projeta o Documento; [NOVO] rota GET /documents/:id/content serve o blob (autenticado)
10. Portais (admin/advogado/perito) abrem/baixam o documento; a AHRI pode processá-lo (OCR/LLM)
```

## 2. ONDE CADA ETAPA ACONTECE

| Camada                  | Papel na CAT-02                                                                                 | Estado                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Evolution**           | fonte dos bytes via `POST /chat/getBase64FromMediaMessage/{instance}` (com a `key` da mensagem) | endpoint existe na Evolution; **gateway ainda não o chama**      |
| **Webhook**             | já recebe `messages.upsert`, ACK imediato                                                       | ✅ existe                                                        |
| **Perception (mapper)** | já extrai `mediaUrl`, `mediaMimeType`, `fileName`, `messageId`                                  | ✅ existe                                                        |
| **MediaStore**          | baixar + validar + hash + dedup + guardar o blob                                                | ❌ **inexistente**                                               |
| **Mission Runtime**     | `RecognizeDocumentUseCase` cria/reconhece o Documento                                           | ✅ existe (adaptar metadados)                                    |
| **Event Store**         | persiste `DocumentRecognized` (append-only, hash-chain)                                         | ✅ existe                                                        |
| **Storage (blob)**      | guardar os bytes (imutáveis)                                                                    | ❌ **inexistente** (nasce 1 tabela)                              |
| **Read Models**         | projetar o Documento p/ os portais + servir o conteúdo                                          | 🟡 projeta metadado; **falta servir o conteúdo**                 |
| **Portais**             | exibir/baixar o documento                                                                       | 🟡 telas existem; falta o visualizador ligado à rota de conteúdo |
| **Executive Brain**     | já decide `use_case IngestDocument/RecognizeDocument` (regras 2D)                               | ✅ existe                                                        |

## 3. O QUE JÁ EXISTE (reaproveitável — não reinventar)

- **Cliente HTTP + auth Evolution:** `evolution/http-client.ts` + header `apikey` (`evolution-gateway.ts`) → reusar para o `getBase64`.
- **Extração de mídia:** `mapEvolutionUpsert` já entrega `mediaUrl/mediaMimeType/fileName` no percept.
- **Domínio do Documento:** `DocumentAggregate.recognize` + `ContentReference` (INV-D10 "conteúdo probatório preservado") + evento `DocumentRecognized`.
- **Use case R3:** `RecognizeDocumentUseCase` já persiste o evento com metadados `{missionId, contentReference, mimeType}`.
- **Event Store:** append-only + `previous_hash/hash` (R9) + Outbox + idempotência `(subscriber,event_id)` → auditoria e dedup **de graça**.
- **Store genérico:** `production.documents` (namespace×key→JSONB) + `PgJsonStore` → reusar para METADADO de mídia e cache de OCR.
- **Pipeline:** `production-ingress` + `FullLoopBrainAdapter` (ponto natural do passo de captura).
- **Regras:** `RO-2D-INGEST-DOC` / `RO-DOC-RECOGNIZE-001` já disparam em percept de mídia.
- **Portais admin/advogado:** telas de Documentos já existem (falta só o visualizador ligado à nova rota).

## 4. O QUE FALTA (só o realmente inexistente)

| Item                                                                                                  | Classe                                              |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Chamar `getBase64` na Evolution (método no gateway)                                                   | **Adaptação** (reusa http-client+config)            |
| Passar `mediaUrl/mime/fileName` do percept até o use case (hoje o `contentReference` ignora os bytes) | **Conexão**                                         |
| `MediaStorePort` + adapter de blob (bytes imutáveis, content-addressed por sha256)                    | **Implementação nova**                              |
| Tabela de blobs `production.media_blobs` (bytea)                                                      | **Implementação nova** (1 tabela)                   |
| Passo de captura+validação+hash+dedup no ingress                                                      | **Implementação nova** (orquestra existentes)       |
| Estender `ContentReference`/metadados de `DocumentRecognized` com `{storageKey, sha256, size}`        | **Adaptação**                                       |
| Read model + rota autenticada `GET /documents/:id/content`                                            | **Implementação nova**                              |
| Visualizador nos portais apontando para a rota                                                        | **Conexão** (telas já existem)                      |
| Cache de OCR/extração por sha256 (não reprocessar)                                                    | **Implementação nova** (usa `production.documents`) |

## 5. SEQUÊNCIA TÉCNICA MÍNIMA (sem pular etapas)

1. `EvolutionGateway.getMediaBase64(key)` — reusa `http-client` + `apikey`; retorna `{base64, mime, fileName, size}`.
2. `MediaStorePort` (interface) + adapter Postgres `PgMediaStore` sobre `production.media_blobs`.
3. Migração `05-media.sql`: `production.media_blobs(sha256 pk, mime, size, bytes bytea, created_at)`.
4. Passo de **captura** no ingress (mídia percebida → `getMediaBase64` → validar → sha256 → dedup → `MediaStore.put`).
5. Propagar a referência (`storageKey=sha256`, `mime`, `fileName`, `size`) até `RecognizeDocumentUseCase` (via `facts`/`intent`).
6. `DocumentRecognized` passa a carregar a referência real (metadado + `ContentReference` estendida).
7. Read model de documentos + rota **`GET /documents/:id/content`** (autenticada) servindo do `MediaStore`.
8. Visualizador nos portais admin/advogado/perito apontando para a rota.
9. (opcional, CAT-02D) cache de OCR/LLM por sha256 em `production.documents`.

## 6. BANCO

- **Já suporta:**
  - `event_store.events` → `DocumentRecognized` (append-only, hash-chain, `is_relevant`, `fact_ref`).
  - `event_store.outbox` / `deliveries` / `idempotency` → entrega e **dedup** por `(subscriber,event_id)`.
  - `production.documents (namespace,key→jsonb)` → **metadado** do documento e **cache** de OCR/extração.
- **Colunas já existentes úteis:** em `documents`, `value jsonb` guarda `{storageKey, sha256, mime, fileName, size, missionId}` sem alteração de schema.
- **Eventos já existentes:** `DocumentRecognized` (suficiente — só ganha campos no metadado/ContentReference).
- **Snapshots:** nenhum necessário para mídia.
- **O que precisa nascer:** **uma** tabela — `production.media_blobs(sha256 text PK, mime text, size int, bytes bytea NOT NULL, created_at timestamptz)`. Imutável (content-addressed); dedup natural pela PK sha256.

## 7. EVENT STORE — a cadeia exata

```
evento recebido      → messages.upsert (Evolution webhook; documentMessage) — HTTP, não persistido
        ↓
[captura NOVO]       → getBase64 → bytes → sha256 → MediaStore.put (blob imutável)
        ↓
evento persistido    → append em event_store.events: DocumentRecognized
                        (is_relevant=true, fact_ref, hash encadeado)
        ↓
documento criado     → DocumentAggregate.recognize (fábrica de domínio)
        ↓
documento reconhecido→ o MESMO DocumentRecognized carrega {storageKey=sha256, mime, fileName, size}
        ↓
documento disponível → Read Model projeta o Documento; GET /documents/:id/content serve o blob
```

_O Event Store já modela "criado→reconhecido" (é um ato só: `recognize`). CAT-02 adiciona a
**captura dos bytes ANTES** e a **disponibilização DEPOIS** — sem novo tipo de evento obrigatório._

## 8. SEGURANÇA

- **Arquivos inválidos:** allowlist de mime (`application/pdf`, `image/jpeg`, `image/png`), limite de tamanho (ex.: 20 MB), verificação de **magic bytes** (não confiar no mime declarado).
- **Duplicação:** **content-addressing por sha256** (mesmo conteúdo → mesma chave → 1 blob) + idempotência `(subscriber, event_id)` do Event Store (mesma mensagem processada 1×).
- **Perda:** capturar o blob **antes** de emitir `DocumentRecognized`; a Outbox garante que o evento não se perde; blob gravado com commit atômico.
- **Corrupção:** recalcular sha256 após o download; **rejeitar** se divergir do esperado.
- **Upload parcial:** validar `size baixado == size declarado` **e** sha256; só comita no casamento total; caso contrário, reprocessa (idempotente).

## 9. PERFORMANCE

- **Downloads repetidos:** store content-addressed → se o sha256 já existe, **não baixa de novo**; idempotência do dispatcher evita reprocessar a mesma mensagem.
- **OCR repetido / LLM repetida:** derivar-uma-vez — resultado de OCR/extração **cacheado por sha256** em `production.documents` (o documento é imutável ⇒ cache eterno).
- **Reprocessamento:** ledger de entregas + cache por sha256 garantem captura/OCR/LLM **uma vez** por conteúdo.

## 10. AUDITORIA (prova de integridade)

Três hashes devem coincidir para provar que **o documento enviado == o documento usado**:

1. **Origem (cliente):** `fileSha256`/`fileEncSha256` do payload do WhatsApp (Evolution) + `messageId`.
2. **Captura:** sha256 recalculado sobre os bytes baixados, gravado no **evento `DocumentRecognized`** (append-only, hash-chain — imutável).
3. **Uso:** qualquer consumo referencia `storageKey=sha256`; re-hash do blog no `MediaStore` deve bater.
   Prova futura = `hash(blob armazenado) == sha256 no evento == fileSha256 do WhatsApp`, com data,
   responsável (AHRI) e cadeia de eventos reconstituível (R9).

## 11. MATRIZ DE RASTREABILIDADE

| Requisito                 | Código existente (reuso)                         | Código novo                                    | Teste                       | Execução           |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------- | --------------------------- | ------------------ |
| Baixar bytes da Evolution | `http-client`, `apikey`, config                  | `getMediaBase64()`                             | unit gateway (mock http)    | Evolution real     |
| Perceber mídia            | `mapEvolutionUpsert` (mediaUrl/mime/fileName)    | —                                              | ✅ mapper.test              | ✅                 |
| Validar/hash/dedup        | idempotência do Event Store                      | passo de captura                               | unit (mime/size/sha256)     | com mídia real     |
| Guardar blob              | `PgJsonStore` (padrão)                           | `MediaStorePort`+`PgMediaStore`+`media_blobs`  | integração PG               | PG de produção     |
| Reconhecer documento      | `RecognizeDocumentUseCase`, `DocumentRecognized` | metadado estendido                             | REAL_FIRST_CLIENT (adaptar) | com mídia real     |
| Servir aos portais        | telas de Documentos                              | read model + `GET /documents/:id/content`+auth | unit rota                   | portais publicados |
| Auditoria de integridade  | Event Store hash-chain                           | asserção sha256                                | unit (hash bate)            | com mídia real     |

## 12. SPRINTS FUTURAS (cada uma entrega valor isolado)

- **CAT-02A — Captura e guarda dos bytes.** `getMediaBase64` + `MediaStorePort` + `media_blobs` + validação/sha256/dedup. **Valor:** os bytes reais passam a existir e ficam auditáveis (mesmo sem UI).
- **CAT-02B — Vínculo ao caso.** `DocumentRecognized` passa a carregar `{storageKey, sha256, size}`; `ContentReference` estendida. **Valor:** o caso aponta para o conteúdo real, com prova de integridade.
- **CAT-02C — Disponibilizar aos humanos.** Read model + `GET /documents/:id/content` autenticado + visualizador nos portais. **Valor:** advogado/perito/admin **abrem** o documento.
- **CAT-02D — Processamento derivado.** Cache de OCR/extração por sha256 (não reprocessar); a AHRI passa a "ler" o conteúdo. **Valor:** substância — o caso anda sobre a prova.

---

### Resultado esperado desta sprint

O Reconstrua passará a tratar documentos reais **reusando quase tudo**: Evolution, webhook,
mapper, domínio do Documento, evento `DocumentRecognized`, Event Store (auditoria/dedup) e o
store JSONB já existem. O genuinamente novo cabe em **1 método de gateway, 1 port + 1 adapter,
1 tabela, 1 passo de captura, 1 rota de conteúdo e 1 cache** — entregues em quatro sprints que
agregam valor isoladamente. Nenhum runtime, contrato ou regra precisa ser reescrito.

_Especificação apenas. Nenhum código escrito, nenhum arquivo de produção alterado, nenhum commit._
