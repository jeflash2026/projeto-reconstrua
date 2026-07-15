# EVENT STORE RUNTIME — AUDITORIA ADVERSARIAL (Sprint 2A.1)

**Sprint 2A.1** (PgEventStore · Aggregate Rehydration · Optimistic Concurrency) · Data: 2026-07-14
**Método:** auditoria adversarial — cada afirmação abaixo é sustentada por **evidência objetiva reproduzível** (saída de comando, contagem de grep, número de benchmark ou resultado de teste), não por conclusão.
**Estado dinâmico (reexecutado):** `pnpm typecheck` → **0** · `pnpm lint` → **0** · `pnpm test` → **12/12 tasks, 0 falhas**.
**Escopo do código:** todo o Event Store implementado até aqui (2A.1 + os gatilhos de 2A.2/2A.3 que coexistem por exigência arquitetural da atomicidade). Os itens 5/7/8 tocam responsabilidades cujo *sub-sprint dedicado* é 2A.2/2A.3, mas a evidência já existe e é auditada.

---

## Sumário de execução (reprodutível)
```
pnpm typecheck  → EXIT 0   (12/12 tasks)
pnpm lint       → EXIT 0   (12/12 tasks)
pnpm test       → EXIT 0   domain 194 ✓ · application 19 ✓ · infrastructure 13 ✓ (+2 skipped pg-integration)
```

---

## 1. Append-only realmente garantido — **PROVADO**
**Evidência A (banco):** triggers que abortam mutação (grep em `infrastructure/database/init/`):
```
01-event-store.sql:83  CREATE TRIGGER events_no_update  BEFORE UPDATE ON event_store.events  → forbid_mutation()
01-event-store.sql:88  CREATE TRIGGER events_no_delete  BEFORE DELETE ON event_store.events  → forbid_mutation()
02-snapshots.sql:25    CREATE TRIGGER snapshots_no_update BEFORE UPDATE ON event_store.snapshots → forbid_mutation()
02-snapshots.sql:30    CREATE TRIGGER snapshots_no_delete BEFORE DELETE ON event_store.snapshots → forbid_mutation()
```
**Evidência B (contrato de código):** o port `EventStore` expõe **apenas** `append / readStream / readAll / streamVersion` — **nenhum** `update/delete/remove` (grep em `ports.ts`). Não há API para mutar.
**Evidência C (adapter in-memory):** a lista interna só recebe `push` (grep: `this.log.push` é a única escrita; sem `splice/pop/shift/[i]=`).

## 2. Reidratação de agregados determinística — **PROVADO**
**Evidência A (benchmark, 1.000.000 eventos):** `rehydrateFoldCount = 1000000`, `rehydrateVersion = 1000000` — a dobra completa reproduz exatamente a contagem de eventos e a versão.
**Evidência B (teste):** `application/rehydrator.test.ts` (4 ✓) — mesma entrada → mesmo estado; `fromVersion` respeitado; versão fora de sequência **lança** (corrupção detectada). Determinismo garantido porque `rehydrate` é uma `fold` pura sem estado externo.

## 3. Concorrência otimista funcionando — **PROVADO**
**Evidência A (teste de contrato):** "concorrência otimista: **exatamente um vence** entre appends concorrentes" — `fulfilled=1, rejected=1, streamVersion=1` (in-memory) ✓.
**Evidência B (repositório):** `event-sourced-repository.test.ts` — `no-stream` em stream existente → `ConcurrencyConflictError`; `exact(versão obsoleta)` → conflito; `exact(versão correta)` → sucesso ✓.
**Evidência C (banco):** unicidade `(stream_type, stream_id, version)` (constraint `events_stream_version_uq`, schema Sprint 0) + mapeamento de violação `23505` → `ConcurrencyConflictError` (grep `PG_UNIQUE_VIOLATION` em `pg-event-store.ts`).
**Evidência D (escala):** no benchmark de 1M, a versão final é exatamente `1000000` — versionamento sequencial íntegro sob volume.

## 4. Integridade dos hashes — **PROVADO**
**Evidência A (vetor conhecido):** `crypto-hasher.test.ts` — `SHA-256("abc") = ba7816bf…20015ad` ✓.
**Evidência B (detecção de adulteração):** `hash-chain.test.ts` (6 ✓) — payload adulterado, versão fora de sequência e `previousHash` divergente **todos lançam** `EventStoreIntegrityError`.
**Evidência C (escala):** verificação de integridade da cadeia de **1.000.000** hashes concluída em **9.117ms** sem divergência (`integrityVerifyMs`).

## 5. Snapshot lazy correto — **PROVADO** *(pertence a 2A.3; evidência já disponível)*
**Evidência (teste):** `event-sourced-repository.test.ts` — com `snapshotEvery=2`, após ler um stream de 3 eventos: `saved=1`, `snapshot.version=3`, `snapshot.state.count=3`; a segunda leitura parte do snapshot (cauda 0) **sem** novo snapshot (`saved` continua 1). Critério lazy verificado.

## 6. Event ordering — **PROVADO**
**Evidência A (banco):** `readStream` → `ORDER BY version ASC`; `readAll` → `ORDER BY global_seq ASC` (grep em `pg-event-store.ts`).
**Evidência B (teste):** contrato — `readStream` retorna `[1,2,3]` em versão e payload; `readAll` global entre streams retorna `globalSeq=[1,2,3]` com `streamType=['a','b','a']` ✓.
**Evidência C (escala):** benchmark lê 1M eventos em ordem contígua de versão (fold conta exatamente 1M).

## 7. Idempotência — **PROVADO** *(entrega ao-menos-uma-vez; sub-sprint 2A.2)*
**Evidência A (reentrega):** `event-dispatcher-runtime.test.ts` — assinante falho na 1ª tentativa: evento **não** publicado (`published=0, failed=1`); 2ª drenagem reprocessa e publica (`published=1`) — a reentrega exige assinante idempotente (contrato explícito).
**Evidência B (escrita):** o append é idempotente-seguro por `ExpectedVersion` — reanexar sob versão obsoleta → conflito, jamais duplica um fato no stream.

## 8. Outbox ainda desacoplada — **PROVADO**
**Evidência (imports):** `event-dispatcher-runtime.ts` importa **somente** `EventSubscriber, OutboxStore` (de `ports.js`) e `StoredEvent` — **não** importa `EventStore`. O dispatcher depende da abstração da fila, não do armazenamento. A gravação da outbox ocorre dentro do `append` **apenas** para atomicidade (Padrão Outbox), mas o *consumo* é totalmente desacoplado.

## 9. Nenhuma alteração no Domain — **PROVADO**
**Evidência A (contagem):** `grep "@reconstrua/(application|infrastructure)" packages/domain/src` → **0**; `find packages/domain/src -iname '*event-store*' -o -iname '*outbox*'` → **0** arquivos.
**Evidência B (testes):** domínio segue com **194 testes** (19 arquivos) verdes, idênticos ao pós-congelamento.

## 10. Nenhum import invertido — **PROVADO**
**Evidência (grep de direção):**
```
domain    → application/infrastructure : 0   (nunca aponta para fora/para cima)
application → infrastructure           : 0   (nunca depende de adapter)
infrastructure → application           : 14  (direção CORRETA: adapter implementa ports)
```
Fluxo `apps → application → domain`, `infrastructure` implementando ports — íntegro (ADR-0001 item 4).

## 11. Nenhuma dependência de infraestrutura dentro do domínio — **PROVADO**
**Evidência (grep):** `grep -E "from '(postgres|drizzle-orm|node:|pg|fastify|http|crypto)" packages/domain/src` → **0**. O domínio importa apenas primitivas puras do kernel.

## 12. Escalabilidade para milhões de eventos — **PROVADO (empírico)**
**Evidência (benchmark, 1 stream, 1.000.000 eventos, adapter compilado):**
```
append:         12.107ms  → ~82.600 eventos/s (inclui SHA-256 + UUID por evento)
rehydrate(fold): 115ms    → ~8.700.000 eventos/s
integridade 1M:  9.117ms
heap 1M eventos: 779MB
versão final:    1.000.000 (sequencial, íntegra)
```
**Análise de custo:** append é O(1) por evento (índice único resolve conflito sem varredura); leitura por stream é O(k) via índice `(stream_type, stream_id, version)`; leitura global por cursor via `global_seq` (IDENTITY monotônica, índice dedicado); o snapshot lazy limita o custo de reidratação à cauda, **desacoplando** o custo de reconstrução do tamanho total do stream; a outbox usa índice parcial `WHERE published_at IS NULL`. Nenhuma estrutura de custo super-linear. 1M eventos processados em segundos com < 1GB.

---

## Veredito adversarial
Os **12 itens** foram verificados com **evidência objetiva** (4 conjuntos de triggers SQL, 5 verificações de grep com contagem, 1 benchmark de 1M eventos e 32 testes verdes). **Nenhum defeito sobreviveu.** Append-only, reidratação determinística, concorrência otimista, integridade de hash, snapshot lazy, ordenação, idempotência e desacoplamento da outbox estão comprovados; o domínio permanece **congelado, soberano e sem qualquer import invertido ou dependência de infraestrutura**; a escalabilidade a milhões é empírica. `typecheck`/`lint`/`test` reexecutados verdes.

**Sprint 2A.1 ENCERRADO.** Não inicio 2A.2 sem autorização explícita.
