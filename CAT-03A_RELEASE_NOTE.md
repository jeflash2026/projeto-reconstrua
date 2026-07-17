# CAT-03A — RELEASE NOTE
### Transformar documento em texto bruto (Anthropic Vision, cache por sha256)

**Capacidade:** o sistema transforma um documento em texto bruto.
**Commit:** `51f4edc` · **Data:** 2026-07-16 · **Base:** `0baa931` → **HEAD:** `51f4edc`

---

## O que muda
Novo módulo `packages/infrastructure/src/reading/`. O `DocumentReaderService.readById(documentId)`
faz: `DocumentLink (sha256) → cache → MediaStore.read (bytes) → Anthropic Vision → texto bruto → cache`.
Cacheado por **sha256** (documento imutável ⇒ lido uma vez por conteúdo). Nunca lança; limites de
mime (pdf/jpeg/png) e tamanho (20 MB); PDF via bloco `document`, imagem via bloco `image`.

## Escopo — ABSOLUTAMENTE puro
O serviço **apenas existe** e fica **exposto em `assembleProduction`** para uso futuro. **Ninguém o
chama automaticamente.** Sem rota, endpoint, UI, botão, subscriber, gatilho, leitura na conversa,
OCR estruturado, HISCON, extração, evento, read model, portal ou comportamento da AHRI. Sem tocar
Event Store, Mission Runtime, Executive Brain, Conversation Runtime, DocumentAggregate,
RecognizeDocumentUseCase. **Nenhuma tabela nova.** O adapter de **Vision é separado** do de texto
(Anthropic/Gemini Completion **intocados**).

## Reaproveitamento
`DocumentLinkStore` (documentId→sha256) + `MediaStorePort.read` (bytes+mime) — CAT-02A/B/C ·
`HttpClient`/`ResilientHttpClient` + `config.llm.anthropicApiKey/anthropicModel` · `production.documents`
(JsonStore) como cache · helpers `conversation/json.ts` (sem duplicar) · `sha256` (chave).

## Validação de produção (não apenas testes)
- **Deploy `51f4edc`: Success (53s)** — `assembleProduction` (agora com `documentReader`) monta sem
  quebrar; api no ar.
- **Go-Live ao vivo:** `ready:true`; health **ONLINE**; gate `llm` = anthropic; landing `/` = 200.
- **Portões locais:** typecheck (infra+api) OK; lint limpo; **reading 12/12**; **media 02A/B/C + go-live
  50/50**; **produção/admin/REAL_FIRST_CLIENT 28/28**.
- *Nota:* por ser dormente (sem gatilho, por design), a leitura real não é exercitável externamente;
  a lógica está provada pelos 12 testes e a montagem pelo deploy verde.

## Riscos
- **P1 (LGPD/dados) — latente, não ativado:** o Vision enviaria o conteúdo do documento à Anthropic
  (mesmo perímetro do LLM de texto). Mas **ninguém chama o serviço** nesta sprint → nenhum dado é
  enviado ainda. O envio real só ocorre quando um gatilho for adicionado (sprint futura) — momento de
  reconfirmar LGPD.
- **P0/P2:** nenhum — módulo aditivo/isolado; sem env/tabela/rota nova; nunca lança.
- **P4:** custo de tokens de visão (mitigado por cache + limite de tamanho); qualidade de transcrição
  (texto bruto, aceitável).

## Rollback
`git revert 51f4edc` + push → o módulo `reading/` e a exposição somem; `media_blobs`, `DocumentLink`,
CAT-02C inalterados; o cache em `production.documents` fica inerte. Sem migração/contrato → limpa.
Emergência: imagem anterior via `deploy.sh`.

## Declaração
**CAT-03A APROVADA PARA PRODUÇÃO**
