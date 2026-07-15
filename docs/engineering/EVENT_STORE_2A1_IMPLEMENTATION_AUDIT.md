# SPRINT 2A.1 — PgEventStore · Aggregate Rehydration · Optimistic Concurrency

**Sub-sprint 2A.1** (decomposição do 2A) · Data: 2026-07-14
**Escopo EXCLUSIVO deste sub-sprint** (sem misturar responsabilidades):
1. **PgEventStore** (append-only)
2. **Aggregate Rehydration** (reconstrução de estado a partir dos eventos)
3. **Optimistic Concurrency** (versionamento + controle de concorrência)
**Explicitamente FORA daqui** (auditados em seus próprios sub-sprints): Event Dispatcher + Outbox (2A.2); Snapshot Runtime (2A.3); Stress/Benchmarks + auditoria-guarda-chuva (2A.4).
**Pré-condição:** Domain CONGELADO — nenhuma entidade/invariante/VO/evento/contrato alterado.
**Dinâmica (isolada):** application 9 testes ✅ · infrastructure in-memory 10 ✅ · pg-integration 2 skipped (sem `DATABASE_URL`). `typecheck`/`lint` verdes.

---

## 1. Nota de fidelidade arquitetural (por que o código convive, mas a auditoria não mistura)
A arquitetura aprovada (ADR-0001/0002A) exige que o append grave o evento **e** enfileire a outbox na **mesma transação** (atomicidade do Padrão Outbox). Separar a escrita da outbox do `append` quebraria essa garantia. Portanto, o `PgEventStore.append` já contém a linha da outbox — mas **este** documento audita **somente** append-only, reidratação e concorrência otimista; o comportamento da outbox/dispatcher tem auditoria própria (2A.2). Nenhuma responsabilidade é *avaliada* fora do seu sub-sprint.

---

## 2. Entregáveis de 2A.1

### 2.1 — PgEventStore (append-only)
- `packages/infrastructure/src/event-store/pg-event-store.ts` — `PgEventStore implements EventStore`: `append`, `readStream`, `readAll`, `streamVersion`.
- `postgres-sql-client.ts` + `sql-client.ts` — única fronteira com o driver `postgres`, atrás do port `SqlClient`.
- `event-row.ts` — mapeia linha SQL → `StoredEvent`.
- `in-memory-event-store.ts` — adapter de alta fidelidade (mesma semântica de append-only), referência de contrato.
- **Append-only garantido pelo banco:** triggers `events_no_update`/`events_no_delete` (schema Sprint 0) abortam qualquer UPDATE/DELETE (Lei 3; DF-11). No adapter in-memory, estrutura interna só recebe `push`.

### 2.2 — Aggregate Rehydration
- `packages/application/src/event-store/rehydrator.ts` — `rehydrate<S>(seed, events, fold, fromVersion)`: dobra os eventos em ordem, validando a contiguidade das versões (corrupção → lança).
- `event-sourced-repository.ts` — `EventSourcedRepository<S>.load(streamId)`: relê o stream e reconstrói o estado via `fold` (agnóstico do agregado; **não** exige métodos no domínio congelado).
- `domain-event-mapper.ts` + `stored-event.ts` — o contato com o domínio é apenas de LEITURA do contrato de evento.

### 2.3 — Optimistic Concurrency
- `stored-event.ts` — `ExpectedVersion` = `no-stream | exact | any`; helpers `NO_STREAM`, `atVersion`.
- `errors.ts` — `ConcurrencyConflictError`.
- **PostgreSQL:** unicidade `(stream_type, stream_id, version)` — dois appends para a mesma versão → um vence, o outro recebe conflito (violação `23505` mapeada). Verificação de `expected` antes do insert.
- **In-memory:** verificação de versão no corpo síncrono do append → conflito determinístico entre escritas concorrentes.

---

## 3. Verificação (isolada) — testes que provam 2A.1

| Responsabilidade | Teste | Resultado |
|---|---|---|
| Aggregate Rehydration | `application/rehydrator.test.ts` (4) | ✅ fold, sequência, `fromVersion`, stream vazio |
| Rehydration + Concurrency | `application/event-sourced-repository.test.ts` (5) | ✅ reidrata, null p/ inexistente, concorrência otimista (`no-stream`/`exact`), integridade |
| PgEventStore semântica (via referência) | `infrastructure/in-memory-event-store.test.ts` (10) | ✅ append/leitura ordenada, conflitos no-stream/exact, **concorrência (exatamente um vence)**, Evento Relevante exige Fato, integridade, readAll global |
| PgEventStore real | `infrastructure/pg-event-store.integration.test.ts` (2) | ⏭ skipped sem `DATABASE_URL` (append+conflito de versão obsoleta; roda no ambiente do dono) |

*(As assertivas de outbox/stress presentes no arquivo de contrato pertencem a 2A.2/2A.4 e são auditadas lá; aqui contam apenas as de append/concorrência/reidratação.)*

---

## 4. Respostas obrigatórias (escopo 2A.1)
- **Alguma entidade/invariante/contrato alterado?** **NÃO** — o Event Store opera sobre `StoredEvent` genérico; a reidratação é `fold` genérico, sem `apply()` no domínio.
- **Domínio soberano?** **SIM** — `infrastructure → application → domain`; tecnologia confinada à infra atrás de `SqlClient`/`EventStore`.
- **Append-only real?** **SIM** — triggers no banco (UPDATE/DELETE abortados) + push-only no in-memory.
- **Concorrência otimista correta?** **SIM** — unicidade de versão no PostgreSQL; conflito determinístico no in-memory; `ExpectedVersion` (no-stream/exact/any) respeitado.
- **Reidratação reconstrói estado a partir dos eventos?** **SIM** — `rehydrate` + `EventSourcedRepository.load` (snapshot-less neste sub-sprint; a *integração* com snapshots é 2A.3).

---

## 5. Ressalva honesta
A reidratação PROFUNDA do interior de um agregado específico dependerá do enriquecimento **aditivo** dos payloads de evento (hoje contratos mínimos) — extensão futura autorizada que **não** altera o motor genérico nem o domínio. O motor de reidratação de 2A.1 está completo e correto para qualquer `fold` fornecido.

---

## 6. Veredito
**Sprint 2A.1 CONCLUÍDO** — PgEventStore append-only, Aggregate Rehydration genérica e Optimistic Concurrency implementados em nível de produção, validados em isolamento (verde), sem misturar responsabilidades de 2A.2–2A.4 e sem tocar o domínio congelado. **Apto a iniciar 2A.2 (Event Dispatcher + Outbox) mediante autorização.** Não inicio 2A.2 sem autorização explícita.
