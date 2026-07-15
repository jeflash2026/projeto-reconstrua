# Auditoria de Implementação — Mission Runtime (Sprint 2D)

> A AHRI deixa de apenas conversar e passa a **EXECUTAR o trabalho**: reconhece
> Pessoa/Cliente/Documento/Evento, constrói Conhecimento, sintetiza Verdade→Estado→
> Etapa, conduz Operação, produz Projeções e audita — sempre por **decisão do
> Executive Brain**, sempre por **fábrica congelada**, persistindo **só via Event
> Store** e publicando **via Dispatcher**, **sem LLM** e **sem tocar infraestrutura**.

- **Data:** 2026-07-14
- **Domínio, Sprint 2A, 2B e 2C:** CONGELADOS e **intocados** (ver §9).
- **ADR de referência:** ADR-0002A (Use Cases mutam o domínio por fábrica; item 6).

## 0. Portões obrigatórios

```
pnpm typecheck   → Tasks: 12 successful, 12 total   EXIT 0
pnpm lint        → Tasks: 12 successful, 12 total   EXIT 0
pnpm test        → Tasks: 12 successful, 12 total   EXIT 0
   domain          194 passed
   application       65 passed
   infrastructure    69 passed | 4 skipped   (+14 de 2D; skip = Pg do 2A)
   api                2 passed
```
**330 testes passando; 14 novos no Sprint 2D.**

## 1. Auditoria adversarial PRÉVIA (exigida antes de implementar)

**Pergunta:** é possível implementar o Mission Runtime e R1–R9 usando SOMENTE
agregados congelados + Event Store congelado, sem alterar Domínio/2A/2B/2C?
**Resposta: SIM.** Evidências levantadas na auditoria:

| Requisito | Primitiva congelada que o satisfaz |
|---|---|
| Persistir eventos de qualquer agregado | `EventSourcedRepository`/`EventStore.append` são genéricos; `toUncommitted` aceita **payload aditivo** (`MapOptions.payload`) → o dado da entidade entra na Application, sem tocar os eventos mínimos do domínio |
| Executar cada R por fábrica | Toda entidade tem fábrica `Result<Agg,…>` emitindo evento: `Person.recognize`, `Cliente.recognize`, `Document.recognize`, `Event.recognize`, `Case/Process.recognize`, `OperationalTruth.synthesize`→`State.derive`→`Stage.represent`, `Operation.conduct`, `Projection.derive` |
| Liberar eventos | `AggregateRoot.pullDomainEvents()` (público) |
| Construir IDs/refs | `*.fromUuid(uuid)` / `*.fromString(str)` em todos os Ids e Refs |
| R9 integridade | `assertStreamIntegrity` (2A) já exportado |
| Publicar | `append` enfileira a outbox atomicamente → Dispatcher (2A.2) |

**Achado material tratado (não bloqueante):** `OperationalState.derive` EXIGE
`derivedFromTruth` — logo um "Estado Inicial" (flow 1) só existe se derivado de uma
**Verdade inicial mínima**. A pipeline de onboarding, por isso, sintetiza uma Verdade
mínima antes de derivar Estado/Etapa — respeitando "nunca criar Estado diretamente".
**Conclusão: implementar integralmente, sem alterar módulo congelado.**

## 2. Os 12 componentes do Mission Runtime (inventário)

Todos em `packages/application/src/mission-runtime/`:

| Componente | Arquivo | Papel |
|---|---|---|
| MissionRuntime | `mission-runtime.ts` | Orquestra: intenções do Brain → pipelines → resultado |
| MissionContext | `use-case.ts` | Entrada imutável de cada Use Case |
| MissionContextLoader | `mission-context-loader.ts` | Carrega/salva identidades da missão |
| MissionContextAssembler | `mission-context-assembler.ts` | Compõe o contexto do passo |
| MissionValidator | `mission-validator.ts` | Pré-condições universais (proíbe decisão sem RO) |
| MissionExecutor | `mission-executor.ts` | Valida + executa um Use Case |
| MissionTransactionRuntime | `mission-transaction-runtime.ts` | Fronteira de escrita atômica (Event Store) |
| MissionRecoveryRuntime | `mission-recovery-runtime.ts` | Idempotência (conflito→skip) + isolamento de falha |
| MissionAuditRuntime | `mission-audit-runtime.ts` | Registra cada execução (rastreável) |
| MissionResultBuilder | `mission-result-builder.ts` | Agrega resultados + identidade final |
| MissionUseCaseRegistry | `mission-use-case-registry.ts` | Nome → pipeline |
| MissionPipeline | `mission-pipeline.ts` | Sequência ordenada com fluxo de dados |

## 3. Os Use Cases oficiais R1–R9 (cada um por fábrica congelada)

| R | Use Case | Arquivo | Fábrica congelada | Stream |
|---|---|---|---|---|
| R1 | Reconhecer Pessoa | `r1-recognize-person.ts` | `Person.recognize` | person |
| R2 | Reconhecer Cliente | `r2-recognize-cliente.ts` | `ClienteAggregate.recognize` | cliente |
| — | Criar Missão | `create-mission.ts` | `Mission.create` | mission |
| R3 | Reconhecer Documento | `r3-recognize-document.ts` | `DocumentAggregate.recognize` | document |
| R4 | Reconhecer Evento | `r4-recognize-event.ts` | `EventAggregate.recognize` (RELEVANT+Fato) | event |
| R5 | Construir Conhecimento | `r5-build-knowledge.ts` | `Case.recognize` + `Process.recognize` | case/process |
| R6a | Construir Verdade | `r6-build-truth.ts` | `OperationalTruth.synthesize` | operational-truth |
| R6b | Atualizar Estado | `r6-derive-state.ts` | `OperationalState.derive` | operational-state |
| R6c | Atualizar Etapa | `r6-represent-stage.ts` | `OperationalStage.represent` | operational-stage |
| R7 | Executar Operação | `r7-execute-operation.ts` | `Operation.conduct` | operation |
| R8 | Produzir Projeções | `r8-produce-projection.ts` | `Projection.derive` (Informativo) | projection |
| R9 | Auditoria Integral | `r9-audit-integral.ts` | `assertStreamIntegrity` (LÊ+verifica) | — |

## 4. Os três fluxos obrigatórios (pipelines)

- **Flow 1 — "Olá":** `OnboardClient` = R1 → R2 → Criar Missão → **Verdade** →
  Estado → Etapa. (Verdade mínima inicial para o Estado poder derivar.)
- **Flow 2 — documento:** `IngestDocument` = R3 → R4 → R5 → Verdade → Estado → Etapa.
- **Flow 3 — novos documentos:** o MESMO `IngestDocument`; R5 (Conhecimento base) é
  **idempotente** (Caso/Processo já existem → pula), enquanto R3/R4 acrescentam o novo
  documento/evento e R6 **re-sintetiza** Verdade→Estado→Etapa ("Atualizar Conhecimento").

**Evidência.** Testes *"onboarding completo"*, *"ingesta documento (R3→R4→R5→R6)"*,
*"Fluxo 3: … Conhecimento base é idempotente"* em
[mission-runtime.test.ts](../../packages/infrastructure/src/mission-runtime/mission-runtime.test.ts);
e o fim-a-fim *Percepção → Brain → Mission Runtime → Event Store* em
[mission-brain-integration.test.ts](../../packages/infrastructure/src/mission-runtime/mission-brain-integration.test.ts).

## 5. As obrigações de cada Use Case (todas cumpridas)

| Obrigação (spec 2D) | Como é garantido | Evidência |
|---|---|---|
| Receber intenções **exclusivamente do Brain** | `MissionRuntime.execute(facts, intents)`; `toMissionUseCaseIntents` só projeta `use_case` do BrainOutcome | integração 2C→2D |
| Validar pré-condições | `MissionValidator` (universais) + checagens específicas em cada Use Case | teste "sem operationalRuleRef é recusada" |
| Executar **só agregados congelados** | Só fábricas estáticas; grep "new Aggregate" = vazio | §8 |
| Persistir **só via Event Store** | Use Cases escrevem só por `persistNew`→`EventAppender`→`EventStore.append` | §8 |
| Publicar **via Dispatcher** | `append` enfileira a outbox atomicamente (2A.2) | 2A.2 |
| **Jamais** tocar infra | Sem import de `@reconstrua/infrastructure` | §8 (vazio) |
| **Jamais** usar LLM | Sem port/import de LLM | §8 (vazio) |
| **Nunca** criar Verdade/Estado/Etapa diretamente | Só `synthesize`/`derive`/`represent` | §8 (vazio) |
| **Nunca** ignorar Regras Operacionais | `MissionValidator` recusa intenção sem `operationalRuleRef` | teste "nenhuma decisão sem regra" |

## 6. Proveniência DECISOR/TIPO/FUNDAMENTO/REGRA em cada evento

**Mecanismo.** `baseProvenance`/`foundedProvenance`
([provenance.ts](../../packages/application/src/mission-runtime/provenance.ts))
carimbam actor(DECISOR)/decisionType(TIPO)/fundamento/operationalRuleRef a partir da
intenção do Brain; eventos RELEVANTES levam `factRef` (E12-L09, exigido pelo Event
Store). **Evidência:** teste *"carimba PROVENIÊNCIA … e Fato nos eventos relevantes"*
— `provenance.actor==='AHRI'`, `operationalRuleRef` presente, `isRelevant` com
`factRef` não-nulo.

## 7. Idempotência, auditoria e integridade (R9)

- **Idempotência:** o `MissionIdentityMap` guarda Pessoa/Cliente/Missão/Caso — turnos
  repetidos **pulam** a recriação. Teste *"onboarding repetido não duplica a Missão"*
  (a Missão permanece com 1 evento). Rede de segurança adicional: conflito de
  concorrência → skip ([mission-recovery-runtime.ts](../../packages/application/src/mission-runtime/mission-recovery-runtime.ts)).
- **Auditoria:** `MissionAuditRuntime` registra cada execução (intenção + resultados)
  — teste *"registra a execução na auditoria"*.
- **R9 integridade:** `EventStoreIntegrityAuditor` relê os streams da missão e verifica
  a hash-chain — teste *"R9 — auditoria integral confirma a cadeia íntegra"*.

## 8. Fronteira provada (grep, saída literal)

```
mission-runtime (app) importando infrastructure:        (none — no direct infra access)
mission-runtime importando LLM:                         (só COMENTÁRIOS "nunca usa LLM")
criação DIRETA de Verdade/Estado/Etapa/Missão:          (none — só fábricas congeladas)
Use Cases persistindo fora de persistNew/EventAppender: (none)
módulo congelado referenciando 2D:                      (none)
```

## 9. Prova de não-alteração (Domínio, 2A, 2B, 2C)

- Todo o 2D é **código novo** em módulos novos: `packages/application/src/
  mission-runtime/` e `packages/infrastructure/src/mission-runtime/`.
- Reúso do congelado **apenas por import**: fábricas + Ids/Refs do Domínio; `EventStore`/
  `toUncommitted`/`assertStreamIntegrity`/`ConcurrencyConflictError` de 2A; tipos de
  intenção do Brain (2C); `InMemoryEventStore`/`CryptoHasher` (2A infra) só nos testes.
- Únicas mudanças em arquivos compartilhados: uma linha `export *` nos barris
  `application/src/index.ts` e `infrastructure/src/index.ts` (padrão dos sprints
  anteriores). Nenhuma entidade, invariante, evento de domínio, contrato público ou
  Livro Mestre alterado. Os 194 testes de Domínio e os de 2A/2B/2C passam idênticos.

## 10. Inventário de testes (14 novos, infraestrutura)

`mission-runtime.test.ts` (fluxos 1/2/3, proveniência+Fato, auditoria, idempotência,
"nenhuma decisão sem regra", Use Case desconhecido, R9 integridade) e
`mission-brain-integration.test.ts` (fim-a-fim Percepção→Brain→Mission Runtime→Event
Store, com resposta ao cliente).

## 11. Decisões reservadas e limites (honestos)

- **Read Models reais** (Postgres) para o `MissionIdentityMap` e para a leitura de
  Verdade/Estado/Etapa: os ports já isolam; 2D usa in-memory determinístico.
- **Entrega da resposta ao cliente** ("Responder Cliente") usa a Conversa 2B; 2D
  produz/expõe a intenção de conversa e executa o trabalho — a orquestração completa
  de entrega no mesmo turno é wiring de composição (2B já entrega).
- **Catálogo de ROs de missão** (`MISSION_RULE_CATALOG`) é seed derivado do Canon
  citado nos `fundamento`, injetado no Brain via port — até o catálogo oficial (DF-13).
- **Persistência Pg dos streams** já existe (2A); os testes de missão rodam sobre o
  `InMemoryEventStore` (política de servidores do dono).

## 12. Veredito

O **Mission Runtime** está implementado com os 12 componentes e os Use Cases R1–R9,
executando os três fluxos obrigatórios. Cada Use Case recebe intenção **exclusivamente
do Brain**, valida pré-condições, executa **agregados congelados por fábrica**, persiste
**só via Event Store** (publicando via Dispatcher), **sem LLM**, **sem tocar infra**, e
**nunca cria Verdade/Estado/Etapa diretamente** nem **ignora Regras Operacionais** —
tudo com registro **DECISOR/TIPO/FUNDAMENTO/REGRA** e rastreabilidade integral. A
auditoria adversarial prévia confirmou a viabilidade sem alterar módulo congelado, e a
implementação a cumpriu. Portões verdes: `typecheck` ✅ `lint` ✅ `test` ✅ (330
passando, 14 novos). Domínio, 2A, 2B e 2C intocados.

**Sprint 2D — Mission Runtime: ENCERRADO.**
