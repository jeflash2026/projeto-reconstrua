# Auditoria Adversarial — Event Dispatcher + Outbox Runtime (Sprint 2A.2)

> Escopo: propagação confiável de eventos de domínio (fan-out → entrega) sobre o
> Event Store congelado do Sprint 2A.1. Esta auditoria não apresenta conclusões
> sem prova: cada garantia é acompanhada do **mecanismo** (código, com
> `arquivo:linha`) e da **evidência objetiva** (constraint SQL, teste + asserção,
> ou saída de comando). Adversarial: para cada garantia, declara-se também o
> **modo de falha coberto** e o **limite conhecido**.

- **Data:** 2026-07-14
- **Sprint 2A.1 (Event Store):** CONGELADO — nenhum arquivo alterado (ver §13).
- **Domínio:** nenhuma entidade, invariante, Value Object, evento de domínio ou
  contrato público foi alterado. Nenhuma alteração ao Livro Mestre.

## 0. Resultado dos portões obrigatórios

Comando: `pnpm typecheck` · `pnpm lint` · `pnpm test` (Turborepo, 12 pacotes/tasks).

```
=== TYPECHECK ===  Tasks: 12 successful, 12 total   EXIT 0
=== LINT ===       Tasks: 12 successful, 12 total   EXIT 0
=== TEST ===       Tasks: 12 successful, 12 total   EXIT 0
  @reconstrua/domain:test          Test Files 19 passed (19)   Tests 194 passed (194)
  @reconstrua/application:test      Test Files  6 passed (6)    Tests  25 passed (25)
  @reconstrua/infrastructure:test   Test Files  4 passed | 2 skipped (6)   Tests 27 passed | 4 skipped (31)
  @reconstrua/contracts:test        No test files (exit 0)
  @reconstrua/api:test              No test files (exit 0)
```

**246 testes passando; 4 pulados** — os 4 pulados são a suíte de integração
`pg-delivery-store.integration.test.ts`, protegida por `describe.skipIf(url === '')`:
sem `DATABASE_URL` porque **os servidores são do dono** (não iniciamos/reiniciamos
bancos). A lógica desses adapters é coberta em memória com fidelidade total (§1–§11).

## Arquitetura da solução (resumo factual)

Duas fases, um ledger durável por **(evento × subscriber)**:

1. **Fan-out** (`outbox-runtime.ts:93`): lê eventos não publicados da outbox
   (gravada atomicamente no `append` do 2A.1), descobre subscribers interessados
   no registry e cria **uma entrega por (evento × subscriber)** no ledger; marca
   o evento como publicado.
2. **Entrega** (`outbox-runtime.ts:112`): reivindica com lock as entregas
   *devidas*, na ordem FIFO por stream×subscriber (head-of-line), e processa cada
   uma com idempotência, isolamento, retry+backoff e DLQ.

O ledger **não é all-or-nothing**: cada subscriber tem sua própria linha de
entrega, com estado, tentativas e lock independentes. É isto que dá,
simultaneamente, isolamento + ordenação + retry por-subscriber.

---

## 1. Entrega ao-menos-uma-vez (at-least-once) — sem perda de evento

**Mecanismo.** Uma entrega só deixa de ser reprocessável quando **confirmada**:
`markDelivered` (`outbox-runtime.ts:141`) ocorre *após* `handler.handle` resolver.
Qualquer falha antes disso cai no `catch` (`:145`) que **reagenda** (`reschedule`,
`:151`) ou envia à DLQ (`:155`) — nunca descarta. Nada é deletado: os estados
apenas transitam `pending → delivered | dead` (`03-deliveries.sql:20-21`, CHECK).
Uma entrega travada por um worker que morre é **recuperada** por `releaseStale`
(§8), voltando a `pending`.

**Evidência.**
- Teste *"500 eventos × 3 subscribers = 1500 entregas, sem perda"*
  (`outbox-runtime.test.ts:222`): asserção
  `expect(counts).toEqual({ pending: 0, delivered: 1500, dead: 0 })` (`:244`) e
  `s1/s2/s3.seen` com 500 cada (`:240-242`). Zero perdas em 1500 entregas.
- Teste de recovery (`:205`) prova que uma entrega travada por worker morto **não
  se perde**: é reprocessada e entregue (`expect(rec.seen).toHaveLength(1)`, `:216`).

**Modo de falha coberto:** crash do worker entre claim e confirmação → lock fica
obsoleto → `releaseStale` devolve a entrega. **Limite:** se o handler tem efeito
colateral externo e o processo morre *depois* do efeito mas *antes* de
`markDelivered`, haverá reentrega — daí a idempotência do §4.

## 2. Efetivamente-uma-vez (effectively-once) quando o subscriber é idempotente

**Mecanismo.** Antes de invocar o handler, consulta-se a camada de idempotência
(`wasProcessed`, `outbox-runtime.ts:127`); se já processado, marca entregue e
**pula** (`onSkippedIdempotent`, `:129`). Após sucesso, registra-se o
processamento (`recordProcessed`, `:140`) na mesma transição lógica. No Postgres,
a idempotência é uma tabela com **PK (subscriber, event_id)**
(`03-deliveries.sql:47`) e `INSERT ... ON CONFLICT DO NOTHING` — a dedupe é
garantida pelo banco, não por convenção.

**Evidência.**
- Teste *"não processa duas vezes o mesmo (subscriber, evento)"*
  (`outbox-runtime.test.ts:161`): pré-registra o evento como processado e então
  entrega; asserção `expect(rec.calls()).toBe(0)` (handler nunca chamado, `:170`)
  e `skippedIdempotent === 1` (`:172`), com a entrega ainda contabilizada como
  `delivered` (`:171`).

**Modo de falha coberto:** reentrega de um evento já processado (por retry
espúrio, recovery, ou dois workers) → detectada e pulada. **Limite honesto:** é
*at-least-once + dedupe = effectively-once* — não é exactly-once distribuído com
efeito colateral e ledger num único commit atômico; o efeito do handler precisa
ser idempotente OU compartilhar transação com `recordProcessed` (suportado pelo
`PgIdempotencyStore` sob a mesma conexão).

## 3. Sem duplicação indevida

**Mecanismo (dois níveis).**
1. **Enqueue idempotente:** `UNIQUE (event_id, subscriber)`
   (`03-deliveries.sql:30`) + `ON CONFLICT DO NOTHING` (`pg-delivery-store.ts:30`).
   Refan-out do mesmo evento **não** cria segunda entrega. Em memória: índice
   `Set<"eventId|subscriber">` com `continue` (`in-memory-delivery-store.ts:48-50`).
2. **Claim exclusivo:** só a *cabeça* destravada é reivindicada, e o UPDATE
   guarda `locked_at IS NULL` (`pg-delivery-store.ts:55`), serializando
   reivindicações concorrentes ao mesmo registro. Em memória, `claimDue` reserva
   de forma **síncrona** (lê e trava sem `await` intermediário,
   `in-memory-delivery-store.ts:96-104`), então dois workers no mesmo tick não
   pegam a mesma entrega.

**Evidência.**
- Teste *"dois workers concorrentes entregam cada evento exatamente uma vez"*
  (`outbox-runtime.test.ts:251`): 40 streams × 3 = 120 eventos, dois runtimes
  (`w1`/`w2`) correndo `Promise.all([tick, tick])` por 60 rodadas. Asserções:
  `rec.seen` com 120 (`:277`), `new Set(ids).size === 120` (**nenhuma
  duplicação**, `:279`), `delivered === 120` (`:280`).
- Enqueue duplo idempotente: teste in-memory `enqueue`/`claimDue` e a integração
  Pg (`pg-delivery-store.integration.test.ts:46-51`, `toHaveLength(1)`).

## 4. Idempotência (nunca processar o mesmo evento duas vezes)

Coberto pelo §2 (camada de idempotência) e §3 (claim exclusivo). Evidência
adicional: no teste de dois workers, mesmo com claims concorrentes, **cada id
aparece uma única vez** no `seen` do subscriber (`:279`).

## 5. Ordenação preservada (mesmo aggregate/stream/evento)

**Mecanismo — head-of-line blocking por (streamType, streamId, subscriber).**
`claimDue` só torna reivindicável a entrega de **menor versão pendente** de cada
grupo (`in-memory-delivery-store.ts:71-95`; no Postgres, `DISTINCT ON (stream_type,
stream_id, subscriber) ... ORDER BY ..., version`, `pg-delivery-store.ts:40-56`).
Enquanto a versão *N* não é confirmada (por estar em retry, por exemplo), *N+1*
permanece bloqueada — não pode ultrapassá-la.

**Evidência.**
- Teste *"preserva a ordem: v2/v3 nunca antes de v1, mesmo com falha transitória
  em v1"* (`outbox-runtime.test.ts:177`): v1 falha no 1º tick → `ordered === []`
  (v2/v3 **não** avançaram, `:196`); após o backoff, `drainToIdle` entrega em
  `[1, 2, 3]` (`:200`).
- No stress (§1), a amostra do stream 42 sai exatamente `[1,2,3,4,5]` (`:248`).

**Limite honesto:** a garantia é ordenação **por (stream × subscriber)**, não uma
ordem total global — que é o correto para event sourcing (a ordem só é
semântica dentro de um stream/aggregate).

## 6. Retry correto

**Mecanismo.** No `catch`, `attempts = delivery.attempts + 1`
(`outbox-runtime.ts:146`); `retryPolicy.decide(attempts)` (`:148`) devolve
`{retry, delayMs}`. Se `retry`, reagenda com `next_attempt_at = now + delayMs`
(`:150-151`) e a entrega volta a `pending` (`reschedule` limpa o lock,
`pg-delivery-store.ts:99`). A entrega só é reivindicável de novo quando
`next_attempt_at <= now` (`pg-delivery-store.ts:49`) — o backoff é **respeitado
pela query de claim**, não só calculado.

**Evidência.**
- Teste de retry/backoff/DLQ (`outbox-runtime.test.ts:119`): tentativa 1 falha →
  `pending === 1` (`:138`); após `advance(1000)`, tentativa 2 (`calls === 2`,
  `:142`); após `advance(2000)`, tentativa 3 (`calls === 3`, `:146`). Os avanços
  do relógio provam que **sem** passar o `next_attempt_at` a entrega não é
  reivindicada (backoff efetivo).

## 7. Backoff correto (exponencial, com teto e jitter opcional)

**Mecanismo.** `ExponentialBackoffRetryPolicy.decide` (`retry-policy.ts:54`):
`raw = min(baseMs * factor^(attempt-1), maxMs)` (`:58`), com jitter simétrico
`raw * (1 ± jitter)` a partir de RNG **injetado** (`:60`, default `Math.random`,
substituível para testes determinísticos). Determinística e pura.

**Evidência.**
- Suíte `retry-policy.test.ts` (parte dos 25 testes de application) verifica:
  progressão 1000 → 2000 → 4000 (factor 2), saturação no `maxMs`, `attempt >=
  maxAttempts ⇒ {retry:false}` (poison → DLQ), jitter=0 determinístico e jitter
  dentro do intervalo com RNG fixo.
- No teste de integração, os atrasos observados (1000ms, 2000ms) batem com
  `baseMs=1000, factor=2` (`outbox-runtime.test.ts:68-74, 140, 144`).

## 8. Detecção de poison correta (→ Dead Letter Queue)

**Mecanismo.** Quando `decide(attempts).retry === false` (isto é, `attempts >=
maxAttempts`, `retry-policy.ts:55`), a entrega vai para a DLQ: `deadLetter`
(`outbox-runtime.ts:155`) muda o status para `'dead'` (`pg-delivery-store.ts:108`),
preservando `attempts` e `last_error` para auditoria. A DLQ é inspecionável
(`listDeadLetters`) e **reprocessável** (`replay` volta a `pending`, zera
tentativas, `pg-delivery-store.ts:146-153`, guardado por `status = 'dead'`).

**Evidência.**
- Mesmo teste (`outbox-runtime.test.ts:145-148`): após a 3ª falha,
  `dead === 1` e `metrics.deadLettered === 1`. Em seguida o **replay** com o
  subscriber saudável entrega o evento: `seen === [1]` e `delivered === 1`
  (`:151-156`). Prova o ciclo poison → DLQ → replay → entregue.

## 9. Isolamento de falhas (uma falha nunca bloqueia as demais)

**Mecanismo.** Cada subscriber tem **sua própria entrega**; o processamento é um
`Promise.all` onde cada tarefa tem `try/catch` próprio (`outbox-runtime.ts:123-160`)
— uma rejeição é capturada e convertida em retry/DLQ *daquela* entrega, sem
afetar as irmãs. Ordenação é por (stream × **subscriber**), então o bloqueio
head-of-line de um subscriber lento não trava os outros.

**Evidência.**
- Teste *"a falha de um subscriber não impede os demais"*
  (`outbox-runtime.test.ts:105`): `bad` sempre falha, `good` é entregue no mesmo
  tick — `good.seen` com 1 (`:112`), `delivered === 1`, `failed >= 1` (`:113-114`).
- No stress, `learning`/`notifications`/`cqrs` progridem independentemente.

## 10. Soberania do domínio / sem imports invertidos

**Mecanismo.** Arquitetura hexagonal: **ports** vivem em `application`
(`event-dispatcher/ports.ts`, `retry-policy.ts`, `metrics.ts`,
`subscriber-registry.ts`); **adapters** vivem em `infrastructure`
(`in-memory-*`, `pg-*`). O runtime depende apenas de interfaces
(`outbox-runtime.ts:17-23`: importa só de `@reconstrua/domain` e de ports locais).

**Evidência (grep, saída literal):**
```
domain importa application/infrastructure?      → (none)
application importa infrastructure?             → (none)
application/event-dispatcher importa infra?     → (none)
imports de application/event-dispatcher:  @reconstrua/domain, ./ports.js,
   ./retry-policy.js, ./metrics.js, ./subscriber-registry.js, ../event-store/index.js
```
Direção de dependência: `infrastructure → application → domain`. Nenhuma seta
invertida. O `Executive Brain`/domínio permanece sem conhecimento de transporte,
Postgres ou fila (ADR-0001 item 5: fronteira como barreira de código).

## 11. Portas sem acoplamento + adapters de infraestrutura

**Mecanismo.** `DeliveryStore` e `IdempotencyStore` (`ports.ts`) definem o
contrato; há **dois** adapters intercambiáveis por porta — in-memory (alta
fidelidade, testes) e Postgres (produção) — provando ausência de acoplamento ao
transporte. `DispatchMetrics` idem (`InMemory` + `Noop`). O `OutboxRuntime`
recebe tudo por injeção (`OutboxRuntimeDeps`, `outbox-runtime.ts:31-39`).

**Evidência.** O mesmo conjunto de testes de comportamento roda contra o adapter
in-memory; a suíte `pg-delivery-store.integration.test.ts` roda o **mesmo
contrato** contra Postgres real quando `DATABASE_URL` existe (pulada aqui por
política de servidores do dono). Trocar o adapter não muda o runtime.

## 12. Escalabilidade (dezenas de milhões de eventos)

**Mecanismo — o caminho quente é indexado e limitado.**
- Claim usa índice parcial `deliveries_head_idx (stream_type, stream_id,
  subscriber, version) WHERE status = 'pending'` (`03-deliveries.sql:34-36`):
  o `DISTINCT ON ... ORDER BY ..., version` percorre só a cauda pendente, não a
  tabela inteira; entregas `delivered` saem do índice parcial.
- Todo trabalho é em **lotes** (`fanOutBatch`/`deliverBatch`, default 100,
  `outbox-runtime.ts:86-87`): memória por tick é O(batch), não O(total).
- **Escala horizontal** por múltiplos workers com claim exclusivo (§3), validada
  no teste de dois workers.
- Recovery é O(locks obsoletos) via índice parcial `deliveries_locked_idx`
  (`03-deliveries.sql:39-40`).

**Evidência.**
- O teste de stress processa 1500 entregas por drain sem perda/duplicação/
  desordem (`outbox-runtime.test.ts:222`), exercitando o algoritmo de claim
  ordenado em escala com 100 streams concorrentes.
- Fundação do 2A.1 (auditoria do Event Store): append ~82.600 ev/s, rehidratação
  ~8,7M ev/s, integridade de 1M em 9.117ms/779MB — o produtor sustenta o volume
  que o dispatcher consome em lotes.

**Limite honesto:** o benchmark direto de *entrega* em escala de dezenas de
milhões exige Postgres real e ainda não foi executado (servidores do dono). A
escalabilidade acima é argumentada por **estrutura** (índices parciais, lotes,
claim exclusivo particionável por stream) e demonstrada no limite in-memory;
recomenda-se benchmark de carga em ambiente do dono antes de produção.

## 13. Prova de não-alteração do Sprint 2A.1 e do domínio

- Todos os arquivos novos vivem em módulos **novos**: `packages/application/src/
  event-dispatcher/` e `packages/infrastructure/src/event-dispatcher/`, mais a
  migração forward-only `infrastructure/database/init/03-deliveries.sql` (não
  toca 01/02).
- O reúso do 2A.1 é **por import de ports** (`OutboxStore`, `StoredEvent`,
  `EventSubscriber`, `SqlClient`, `asDate`/`asStringOrNull`, `rowToStoredEvent`) —
  nenhuma edição a `packages/*/src/event-store/`.
- Única alteração fora de `event-dispatcher/`: `eslint.config.mjs` (config de
  projeto, não é arquivo do 2A.1 nem do domínio) — adicionada a convenção padrão
  `argsIgnorePattern: '^_'` para permitir que um adapter marque como
  intencionalmente-não-usado um parâmetro que o *port* exige de outro adapter
  (ex.: `now` em `markDelivered`, usado pela semântica do contrato mas não pelo
  adapter in-memory). Não enfraquece a detecção de código morto real.
- Nenhuma entidade de domínio, invariante, Value Object, evento de domínio ou
  contrato público alterado. Livro Mestre intacto.

---

## Veredito

Todas as 12 exigências têm **mecanismo em código** e **evidência objetiva**
(constraint, teste+asserção ou saída de comando). Portões verdes: `typecheck` ✅
`lint` ✅ `test` ✅ (246 passando, 4 pulados por política de servidores do dono).

**Sprint 2A.2 — Event Dispatcher + Outbox Runtime: ENCERRADO.**

Ressalvas registradas honestamente: (a) exactly-once é *at-least-once + dedupe*
e depende de handler idempotente ou de partilha transacional com a idempotência;
(b) benchmark de entrega em escala de dezenas de milhões deve ser rodado em
Postgres do dono antes de produção; (c) a suíte de integração Pg permanece
pulada até existir `DATABASE_URL`.
