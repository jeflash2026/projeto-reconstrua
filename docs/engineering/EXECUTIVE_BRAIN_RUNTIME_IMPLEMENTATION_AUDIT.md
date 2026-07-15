# Auditoria de Implementação — Executive Brain Runtime (Sprint 2C)

> O cérebro operacional da AHRI. **100% determinístico, sem LLM.** Toda decisão
> nasce exclusivamente dele, de uma **Regra Operacional**, com registro
> **DECISOR/TIPO/FUNDAMENTO/REGRA**. Esta auditoria prova cada exigência da spec 2C
> com **mecanismo** (`arquivo:linha`) e **evidência** (teste + asserção, ou saída de
> comando).

- **Data:** 2026-07-14
- **Domínio, Sprint 2A e Sprint 2B:** CONGELADOS e **intocados** (ver §10).
- **ADR de referência:** ADR-0002A — **Camada 2 (Executive Brain)**, determinística,
  RO-gated, sem LLM.

## 0. Portões obrigatórios

```
pnpm typecheck   → Tasks: 12 successful, 12 total   EXIT 0
pnpm lint        → Tasks: 12 successful, 12 total   EXIT 0
pnpm test        → Tasks: 12 successful, 12 total   EXIT 0
   domain          194 passed
   application       65 passed   (+27 de 2C)
   infrastructure    58 passed | 4 skipped   (+3 de 2C; skip = Pg do 2A)
   api                2 passed
```
**319 testes passando; 30 novos no Sprint 2C.**

## 1. Arquitetura e a reconciliação com o 2B congelado

O Brain real vive em `packages/application/src/executive-brain/` (novo módulo) e
produz **as seis intenções** + auditoria. Como o port `ExecutiveBrainPort` de 2B
está **congelado** devolvendo apenas `ConversationIntent[]`, criei um
**`ConversationBrainAdapter`** ([conversation-brain-adapter.ts](../../packages/infrastructure/src/executive-brain/conversation-brain-adapter.ts))
que implementa o port congelado, chama o Brain determinístico e **projeta** as
decisões relevantes de conversa. Assim, o 2B roda contra o Brain **real** sem que
uma linha de 2B mude. As intenções não-conversacionais (use_case/notification)
pertencem a outros consumidores (UseCaseBus/Notification) — o `BrainOutcome`
completo é o artefato primário.

## 2. Componentes implementados (inventário)

Todos em `packages/application/src/executive-brain/` (puros, determinísticos):

| Componente (spec 2C) | Arquivo | Papel |
|---|---|---|
| ExecutiveBrainRuntime | `executive-brain-runtime.ts` | Orquestra o pipeline; falha fechada sem regra |
| GoalSelector | `goal-selector.ts` | Deriva o objetivo de Verdade/Estado/Etapa |
| PriorityPlanner | `priority-planner.ts` | Ordena por prioridade (desempate estável) |
| StrategyPlanner | `strategy-planner.ts` | Estratégia do turno + naturezas preferidas |
| LegitimacyGate | `legitimacy-gate.ts` | RO-R7-001: legítima × impedida |
| RuleEvaluator | `rule-evaluator.ts` | Casou/bloqueou/aplicável por regra |
| IntentEmitter | `intent-emitter.ts` | Ação(regra) → intenção tipada + proveniência |
| ExecutionPlanner | `execution-planner.ts` | Primária + apoios (use_case/notification) |
| NextBestActionPlanner | `next-best-action-planner.ts` | Escolhe a ação primária |
| EscalationPlanner | `escalation-planner.ts` | Regra de escalação/espera do catálogo |
| HumanDecisionGate | `human-decision-gate.ts` | A matéria é humana? → escalar |

Suporte: `provenance.ts`, `mission-snapshot.ts`, `conditions.ts`, `facts.ts`,
`rule.ts`, `intents.ts`, `ports.ts`, `brain-context.ts`, `planning.ts`, `audit.ts`.

## 3. 100% determinístico, sem LLM

**Mecanismo.** Nenhum componente usa aleatoriedade ou relógio na LÓGICA de decisão
(o `Clock` só carimba `formedAt`). Ordenação estável por prioridade+ref
([priority-planner.ts](../../packages/application/src/executive-brain/priority-planner.ts));
condições avaliadas por dados, não closures
([conditions.ts](../../packages/application/src/executive-brain/conditions.ts)).

**Evidência.**
- Teste *"mesma entrada ⇒ mesma saída (determinístico)"*
  ([executive-brain-runtime.test.ts](../../packages/application/src/executive-brain/executive-brain-runtime.test.ts))
  — duas execuções independentes produzem `intents` e `chosenRefs` idênticos.
- **Sem LLM (grep, saída literal):**
  ```
  Brain importando LLM (LlmPerception/LlmExpression/llm): (none — no write ports, no LLM)
  ```

## 4. As seis (e apenas seis) naturezas de intenção

`BrainIntent` é a união fechada de **Conversation, UseCase, Escalation, Wait, Stop,
Notification** ([intents.ts](../../packages/application/src/executive-brain/intents.ts)).
Nenhuma carrega texto gerado (o Brain decide, não escreve).

**Evidência** ([executive-brain-runtime.test.ts](../../packages/application/src/executive-brain/executive-brain-runtime.test.ts)):
saudação→`conversation`; documento percebido→`use_case`; prazo crítico→`conversation`+`notification`
no mesmo turno; missão encerrada→`stop`; nada aplicável→`wait`; matéria humana→`escalation`.

## 5. DECISOR / TIPO / FUNDAMENTO / REGRA em toda decisão

**Mecanismo.** `IntentEmitter.emit` carimba `automatedProvenance(rule.fundamento,
rule.ref)` em toda intenção ([intent-emitter.ts:24](../../packages/application/src/executive-brain/intent-emitter.ts));
`DECISOR`/`TIPO` são as **constantes do domínio congelado** (`AHRI_DECISOR`,
`AHRI_DECISION_TYPE`) importadas, não redefinidas
([provenance.ts](../../packages/application/src/executive-brain/provenance.ts)).

**Evidência.** Teste *"toda decisão carrega DECISOR/TIPO/FUNDAMENTO/REGRA"* itera
sobre TODAS as intenções e exige `decisor===AHRI`, `tipo===DECISAO_...AUTOMATIZADA`,
`fundamento` e `operationalRuleRef` não-vazios. No fim-a-fim 2C→2B, a intenção
entregue traz `operationalRuleRef` que casa `^RO-` (regra real do catálogo)
([conversation-brain-adapter.test.ts](../../packages/infrastructure/src/executive-brain/conversation-brain-adapter.test.ts)).

## 6. Catálogo de regras + "nenhuma decisão sem regra"

**Mecanismo.** Cada `OperationalRuleSpec` tem **prioridade, pré-condições, bloqueios,
ação, fundamento** ([rule.ts](../../packages/application/src/executive-brain/rule.ts)).
O catálogo default ([default-rule-catalog.ts](../../packages/infrastructure/src/executive-brain/default-rule-catalog.ts))
traz 14 regras, incluindo as **regras-meta** (escalação humana, Canon silente,
espera default). Toda ação escolhida é o invólucro de uma regra
([planning.ts](../../packages/application/src/executive-brain/planning.ts)); o
`IntentEmitter` só emite a partir de regra. Se o catálogo não tiver a regra-meta
obrigatória, o Brain **falha fechado** (`BrainCatalogError`,
[executive-brain-runtime.ts:151](../../packages/application/src/executive-brain/executive-brain-runtime.ts)).

**Evidência.** Teste *"catálogo vazio ⇒ falha fechada (nenhuma decisão sem regra)"*
— `decide` rejeita com `BrainCatalogError`. Teste *"nada aplicável ⇒ WaitIntent
(fallback com regra)"* — mesmo o "não fazer nada" é a regra `RO-WAIT`.

## 7. Legitimidade (RO-R7-001) e competência humana

**Mecanismo.** `LegitimacyGate` valida, para cada candidata, **registro** (fundamento
+regra), **competência** (matéria humana ⇒ só escalação), **autorização** (use_case
proibido sob Canon silente), **responsável** e **regra** — resultado binário:
legítima ou impedida (com causa) ([legitimacy-gate.ts](../../packages/application/src/executive-brain/legitimacy-gate.ts)).
`HumanDecisionGate` decide QUEM decide: matéria humana → advogado; Canon silente →
supervisor ([human-decision-gate.ts](../../packages/application/src/executive-brain/human-decision-gate.ts)).

**Evidência.** Testes do `LegitimacyGate` (registro ausente, competência humana,
Canon silente para use_case, caminho legítimo). Teste *"matéria humana ⇒ SÓ
escalação (AHRI não atua)"* — a saída é **uma** intenção `escalation`, sem nenhuma
`conversation`/`use_case`, e `record.humanRequired===true`.

## 8. Auditoria completa e rastreável

**Mecanismo.** Cada decisão gera um `BrainDecisionRecord` com objetivo, estratégia,
**fatos avaliados**, **resultado por regra** (casou/bloqueou/aplicável), **refs
escolhidas**, **intenções emitidas com proveniência** e **ações impedidas com causa**
([audit.ts](../../packages/application/src/executive-brain/audit.ts)); um
`BrainAuditSink` opcional persiste ([executive-brain-runtime.ts](../../packages/application/src/executive-brain/executive-brain-runtime.ts)).

**Evidência.** Teste *"auditoria registra objetivo, avaliações, escolhidas,
emitidas e impedidas"* — o registro tem `evaluations.length === catálogo.length`,
`chosenRefs` não-vazio e toda emissão com `operationalRuleRef` não-vazio.

## 9. O que o Brain NUNCA faz (fronteira provada)

| Proibição (spec 2C) | Como é impossível | Evidência |
|---|---|---|
| gera texto / usa LLM | Nenhum port de LLM; intenções sem campo de texto | grep "no LLM"; tipos de `intents.ts` |
| interpreta linguagem | O Brain lê SÓ sinais estruturados (`PerceptView`), nunca `envelope.text` | grep "brain never reads raw text"; adapter usa `enrichment`+`kind` |
| envia WhatsApp | Sem `ConversationGateway` no Brain | ausência de import |
| cria Verdade / altera Estado / Etapa | Sem `EventStore`/`Repository`/`UnitOfWork`; lê snapshot read-only | grep "no write ports"; `mission-snapshot.ts` é DTO de leitura |

**Grep (saída literal):**
```
Brain importando infrastructure: (none)
Brain importando EventStore/Repository/UnitOfWork/LLM: (none — no write ports, no LLM)
Brain lendo texto bruto (envelope.text): (none — brain never reads raw text)
adapter lendo texto bruto: (none — adapter uses enrichment signals + kind only)
```

## 10. Prova de não-alteração de Domínio, 2A e 2B

- Todo o 2C é **código novo** em módulos novos: `packages/application/src/
  executive-brain/` e `packages/infrastructure/src/executive-brain/`.
- Reúso do congelado **apenas por import**: constantes `AHRI_DECISOR`/
  `AHRI_DECISION_TYPE` do domínio, e os TIPOS de intenção de 2B
  (`IntentDirective`/`SpeechAct`/`IntentUrgency`) + `Percept`/`ConversationContextView`/
  `ExecutiveBrainPort` — nenhum deles modificado.
- Nenhum arquivo de Domínio, 2A (`event-store`/`event-dispatcher`) ou 2B
  (`conversation`) foi editado. Únicas mudanças em arquivos compartilhados: uma
  linha `export *` nos barris de pacote `application/src/index.ts` e
  `infrastructure/src/index.ts` (o mesmo padrão que 2A/2B já usaram). Os 194 testes
  de Domínio e os testes de 2A/2B passam idênticos.

## 11. Inventário de testes (30 novos)

- **application (+27):** `conditions.test.ts` (operadores e composição),
  `rule-evaluator.test.ts` (casou/bloqueou/aplicável), `goal-selector.test.ts`
  (precedência e mapa), `legitimacy-gate.test.ts` (RO-R7-001),
  `executive-brain-runtime.test.ts` (seis intenções, proveniência, determinismo,
  fail-closed, competência humana, auditoria).
- **infrastructure (+3):** `conversation-brain-adapter.test.ts` (2C→2B fim-a-fim:
  saudação entregue com regra real; documento→use_case→Conversa cala; matéria
  humana→handoff).

## 12. Decisões reservadas e limites (honestos)

- **Read Models reais** (Verdade/Estado/Etapa e catálogo de ROs em Postgres) são o
  próximo passo: os ports (`MissionSnapshotPort`, `RuleCatalogPort`) já isolam; 2C
  usa adapters in-memory determinísticos.
- **Consumidores das intenções não-conversacionais** (UseCaseBus para `use_case`,
  Notification para `notification`, Human Handoff para `escalation`) são sprints
  próprios; 2C **emite** essas intenções com proveniência; a execução é alhures.
- **Catálogo default** é um seed derivado do Canon citado nos `fundamento` — os
  refs `RO-*` são placeholders operacionais até o catálogo oficial de ROs (DF-13)
  ser ratificado; a estrutura (prioridade/pré/bloqueio/ação/fundamento) é a final.

## 13. Veredito

O **Executive Brain Runtime** está implementado: determinístico, sem LLM, RO-gated,
com os onze componentes, o catálogo de regras (prioridade/pré-condições/bloqueios/
ação/fundamento), as seis naturezas de intenção, o registro DECISOR/TIPO/FUNDAMENTO/
REGRA em toda decisão, "nenhuma decisão sem regra" (fail-closed) e auditoria
rastreável. A fronteira é garantida por construção — o Brain não gera texto, não usa
LLM, não interpreta linguagem, não envia WhatsApp e não muta Verdade/Estado/Etapa. O
Brain real já dirige a Conversa 2B via adapter, sem tocar 2B. Portões verdes:
`typecheck` ✅ `lint` ✅ `test` ✅ (319 passando, 30 novos). Domínio, 2A e 2B intocados.

**Sprint 2C — Executive Brain Runtime: ENCERRADO.**
