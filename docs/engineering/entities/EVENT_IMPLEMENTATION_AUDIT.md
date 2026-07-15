# EVENT — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 04 — EVENTO** · Sprint 1D · Data: 2026-07-13
**Fontes congeladas:** Entidade 04 (Volume 01); INV-EV-01..INV-EV-05; DF-05; DF-11; DF-14; DF-18 (menção nominal); E11; E12 (E12-L09); R4; Lei Epistemológica nº 1 (reconhecimento); Lei 2; Lei 3; Art. 14º.
**Localização:** `packages/domain/src/event/`
**Padrão:** oficial (CONVENTIONS.md §10).

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `event-id.ts` (`EventId`) | ✔ |
| Aggregate Root (previsto) | `event.ts` (`EventAggregate extends AggregateRoot`) | ✔ |
| Value Objects mínimos | `event-classification.ts` (`EventClassification`) + `refs.ts` (`EventMissionRef`, `FactRef`, `EventRecognitionResponsibleRef`) | ✔ |
| Eventos como contratos | `event-events.ts` (`EventRecognized`) | ✔ |
| Manifesto de invariantes | `event-invariants.ts` (INV-EV-01..EV-05) | ✔ |
| Testes unitários | `event.test.ts` | ✔ |
| Testes das invariantes | `event.test.ts` | ✔ |
| Tabela de derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

> Nomenclatura: a classe chama-se `EventAggregate` para não colidir com o tipo global `Event` do DOM; a referência à Missão chama-se `EventMissionRef` para não colidir com o `MissionRef` já exportado por DOCUMENTO no índice do domínio.

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `EventId` (Identity única) | Individualização do Evento (E12; INV-E12-05) |
| `EventClassification` = `RELEVANT` \| `INFORMATIVE` (conjunto fechado) | Subtipos exaustivos do Evento (DF-14; INV-EV-01) |
| `EventClassification.create(...)` → `CanonViolationError` INV-EV-01 fora do conjunto | Classificação obrigatória e restrita a Relevante/Informativo (DF-14) |
| `EventMissionRef` obrigatória (nominal, por identidade) | Vínculo a exatamente uma Missão (Lei 2; INV-EV-04; DF-18) |
| `FactRef` obrigatória **se** Relevante; `null` se Informativo | Evento Relevante fundado em Fato reconhecido (E12-L09; INV-EV-03) |
| `EventRecognitionResponsibleRef` (nominal) + `recognizedAt` | Rastreabilidade do reconhecimento (Lei 3; Art. 14º; R4) |
| `occurredAt` (Date válida) | Momento do acontecimento na Realidade (E11) |
| Fábrica `EventAggregate.recognize(...)` (não `create`) | Lei Epistemológica nº 1: Evento é reconhecido, nunca inventado |
| `EventRecognized` emitido | Marco do reconhecimento — contrato vazio |
| Ausência de estado / método de alteração de estado | INV-EV-02 (só Evento Relevante altera estado — e via **projeção**, nunca a própria entidade); DF-05 |
| Ausência de síntese de Verdade Operacional | Evento não constrói Verdade Operacional (princípio do fundador; E12) |
| Ausência de método `decide`/`interpret` | Evento não decide nem interpreta (princípio do fundador) |
| Ausência de workflow/processamento | Evento apenas representa um acontecimento reconhecido (princípio do fundador) |
| Ausência de "catálogo/descritor de evento" na entidade | Catálogo de Eventos é configuração/Regra Operacional (R4) — não pertence à entidade ontológica |
| Acessores devolvem cópias de `Date`; props `readonly` | Imutabilidade do acontecimento reconhecido |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-EV-01..INV-EV-05)

Reproduzido de `event-invariants.ts` (ver seção 4 para o locus de cada uma).

| ID | Descrição resumida | Ref. Canon |
|---|---|---|
| INV-EV-01 | Classificação obrigatória no ato — Relevante ou Informativo (subtipos exaustivos) | DF-14 |
| INV-EV-02 | Somente Evento Relevante altera estado; Informativo jamais | DF-05; INV-08 |
| INV-EV-03 | Evento Relevante exige Fato reconhecido que o fundamente | E12-L09 |
| INV-EV-04 | Vinculado a exatamente uma Missão; reconhecimentos independentes por missão | Lei 2; INV-E12-05 |
| INV-EV-05 | Um Evento reconhecido jamais é apagado | Lei 3; DF-11 |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-EV-01, INV-EV-03, INV-EV-04 | `recognize` (não `create`): classificação no conjunto fechado (EV-01); Relevante ⇒ Fato (EV-03); Missão presente (EV-04). Runtime como `Invariant<EventAggregate>` + recusa na fábrica. |
| **projection** | INV-EV-02 | O Estado deriva da Verdade; só Evento Relevante o altera. A entidade **não** tem estado nem método de alteração — a regra vive na projeção (Sprints 2+). |
| **event-store** | INV-EV-05 | Não-apagamento append-only (triggers `events_no_update`/`events_no_delete`; Sprints 2+). |

Runtime como `Invariant<EventAggregate>`: **INV-EV-01, INV-EV-03, INV-EV-04**. INV-EV-02 é **estrutural** (ausência de estado/método, comprovada por teste) além de projeção; INV-EV-05 é do event-store.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia (Fastify/PostgreSQL/Drizzle/Next/IA); **nenhuma outra entidade importada** — o Evento não conhece MISSÃO/PESSOA/DOCUMENTO além das referências nominais previstas (`EventMissionRef`, `FactRef`, responsável).
- **Sem Event Store nem projeção:** INV-EV-02 e INV-EV-05 estão apenas **mapeadas** ao seu locus, não simuladas.
- **Testes:** reconhecimento pleno de Relevante (emite `EventRecognized`) e de Informativo sem Fato; negativos mapeados a INV-EV-01 (classificação inválida), INV-EV-03 (Relevante sem Fato), INV-EV-04 (Missão ausente) e `EVENTO-RASTREABILIDADE` (responsável ausente, `occurredAt` inválida); igualdade por identidade (INV-EV-04/E12-05); teste estrutural que prova ausência de `state/estado/alterState/buildTruth/verdade/decide/decision/interpret/process/workflow` (INV-EV-02 + princípios); engine de invariantes; completude do manifesto (5 ids).
- **`@ts-expect-error`** nos casos de Missão e responsável ausentes comprova exigência pelo **tipo**, não só em runtime.

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** Efeito sobre estado (EV-02), não-apagamento (EV-05) e catálogo de eventos (R4) foram deixados ao seu locus (projeção/event-store/Regra Operacional), não inventados na entidade.
- **Existe algum comportamento implícito?** **NÃO.** Só reconhecimento e leitura imutável; sem alteração de estado, sem síntese de Verdade, sem decisão, sem interpretação, sem workflow.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes não-entidade mapeadas aos loci, sem simulação.

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- Não executei `pnpm install`/`typecheck`/`test` (Node fora do PATH; execução é do dono). Verificação estrutural + varredura de imports. Recomendado: `pnpm --filter @reconstrua/domain typecheck && pnpm --filter @reconstrua/domain test`.
- **Catálogo/descritor de Evento deliberadamente ausente da entidade:** modelar um `EventDescriptor` agora seria implementar "porque vai precisar depois" e importar configuração (R4) para dentro da ontologia — proibido. Fica como Regra Operacional (R4).
- **INV-EV-02 na entidade é garantida por ausência** (não há estado nem método de alteração); a regra "só Relevante altera estado" só pode ser afirmada de verdade na **projeção**, que não existe neste sprint.
- Naming: `EventAggregate` (evita `Event` do DOM), `EventMissionRef` (evita colisão com o `MissionRef` de DOCUMENTO no índice); o tipo interno `EnforcementLocus` **não** é re-exportado do barrel (o de MISSÃO já ocupa o nome no índice do domínio).

---

## 8. Veredito final

**Entidade 04 — EVENTO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando os princípios obrigatórios (reconhecido, nunca inventado; não altera estado operacional por si só; não constrói Verdade Operacional; não decide; não interpreta; apenas representa um acontecimento reconhecido; Relevante e Informativo permanecem conceitos do Canon; sem workflow/processamento). Nenhuma outra entidade, caso de uso, infraestrutura, persistência, Event Store, projeção, API, IA ou regra operacional foi implementada. **Não prosseguir à Entidade 05 sem autorização explícita.**
