# OPERATIONAL RULE — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 12 — REGRA OPERACIONAL** · Sprint 1L · Data: 2026-07-14
**Fontes congeladas:** Entidade 12 (Volume 01, itens 1–24); DF-06, DF-09, DF-13 (dez elementos), DF-24; OPERATIONAL_STANDARD; Lei Geral das Regras Operacionais; Lei 4, Lei 5; Volume 03 (R1–R9, contexto — não execução); Art. 14º.
**Localização:** `packages/domain/src/operational-rule/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (12 arquivos, 124 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** representação formal de uma **regra executável pelo Sistema Operacional — comportamento previamente aprovado, nunca decisão humana** (DF-13), com **dez elementos obrigatórios**, escrita sob o OPERATIONAL_STANDARD, versionada, que **jamais contraria** o Canon (Lei Geral das RO). Verbo da fábrica = `approve`. **Restrição decisiva do fundador: a entidade representa a EXISTÊNCIA da regra e seus dez elementos como DADOS — NÃO executa a regra, NÃO avalia critérios, NÃO roda R1–R9.**

**Diferença formal:** OPERAÇÃO(11) é o agir (regido pela Regra); a Regra é o comportamento-aprovado que governa. EVENTO(04): a Regra **descreve** eventos de entrada/saída como tipos; não é um evento. VERDADE(07): a Regra é norma, não síntese. MISSÃO(01): a Regra é geral do Sistema (RO-Rn-NNN), não pertence a uma missão.

**Respostas explícitas:**
- Executa comportamento? **NÃO** (a entidade guarda os elementos como dados; execução é da automação/AHRI, fora).
- Decide? **NÃO** (itens 1/4/16; DF-09 — "nunca decisão humana").
- Altera Verdade? **NÃO.** · Altera Estado? **NÃO** (não executa nada; sem mutadores).
- Pode existir sem Volume 03? **NÃO** (itens 2/18; item 11/INV-RO-02 — exige fundamento superior citado).
- Circularidade? **NÃO** (item 24). Referências a AHRI(14)/OPERAÇÃO(11)/EVENTO(04) são nominais; no código não há ponteiro por identidade a nenhuma; a Operação não referencia a Regra. Sem aresta mútua.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `operational-rule-id.ts` (`OperationalRuleId`) | ✔ |
| Aggregate Root (previsto) | `operational-rule.ts` (`OperationalRuleAggregate`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`RuleCode`, `RuleDefinition`, `RuleVersion`, `CanonFoundation`) + `refs.ts` (`ApprovalResponsibleRef`) | ✔ |
| Eventos como contratos | `operational-rule-events.ts` (`OperationalRuleApproved`) | ✔ |
| Manifesto de invariantes | `operational-rule-invariants.ts` (INV-RO-01..RO-03) | ✔ |
| Testes unitários + invariantes | `operational-rule.test.ts` (12 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre) — os DEZ ELEMENTOS (DF-13)

| Construto no código | Elemento / Norma |
|---|---|
| `RuleCode` (não-vazio) | **Elemento 1** — identificador único (RO-Rn-NNN) |
| `RuleDefinition.name` | **Elemento 2** — nome |
| `RuleDefinition.objective` | **Elemento 3** — objetivo |
| `RuleDefinition.executionCriterion` (texto) | **Elemento 4** — critério de execução (descritivo, NÃO executado) |
| `RuleDefinition.blockingCriterion` (texto) | **Elemento 5** — critério de bloqueio (descritivo) |
| `RuleDefinition.inputEvent` (descritor de tipo) | **Elemento 6** — evento de entrada |
| `RuleDefinition.outputEvent` (descritor de tipo) | **Elemento 7** — evento de saída |
| `RuleDefinition.producedEvidence` | **Elemento 8** — evidências produzidas |
| `ApprovalResponsibleRef` | **Elemento 9** — responsável pela aprovação |
| `RuleVersion` (não-vazio) | **Elemento 10** — histórico de versões |
| `CanonFoundation` (não-vazio) | Item 11/19; INV-RO-02 — fundamento superior citado |
| `approvedAt` (Date válida) | Auditabilidade (Lei 4; Art. 14º) |
| Fábrica `OperationalRuleAggregate.approve(...)` | "Comportamento previamente aprovado" (item 1/7) |
| `hasTenElements()` | INV-RO-01 (verificação de presença dos dez) |
| `OperationalRuleApproved` emitido | Marco da existência — contrato vazio |
| Ausência de `execute/evaluate/apply/trigger` | Restrição do fundador (representa existência, não executa) |
| Ausência de `decide` / mutador de Verdade/Estado | Itens 4/16; DF-09 |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-RO-01..INV-RO-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-RO-01 | Possui os dez elementos | DF-13 | **entity** |
| INV-RO-02 | Jamais contraria Constituição/Ontologia/Epistemologia | Lei Geral das RO | cross-entity |
| INV-RO-03 | Toda automação da AHRI referencia ≥1 regra | DF-09 | cross-entity |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-RO-01 | `approve` valida a presença dos dez elementos (RuleCode + RuleDefinition[7] + ApprovalResponsibleRef + RuleVersion); runtime `INV-RO-01` (`hasTenElements`) + `RO-FUNDAMENTO-CITADO`. |
| **cross-entity** | INV-RO-02 | Não-contradição semântica com o Canon é da Governança (G3/Lei Geral das RO); a entidade contribui exigindo fundamento superior citado. |
| **cross-entity** | INV-RO-03 | Restrição sobre a AHRI (14): toda automação referencia ≥1 regra; verificável no lado da automação, não nesta entidade. |

Runtime como `Invariant<OperationalRuleAggregate>`: **INV-RO-01** + `RO-FUNDAMENTO-CITADO`. Guarda de datação: `RO-AUDITAVEL`. Confirmado por teste que **apenas INV-RO-01 é locus `entity`**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — AHRI/Operação/Evento não referenciados por identidade (eventos entrada/saída = descritores textuais; responsável = ref genérico). `import type` aplicado nos type-only.
- **Correção de tipo aplicada:** `RuleDefinitionFields` passou de `interface` para `type` (interface não satisfaz a restrição `Record<string, unknown>` do `ValueObject<Props>` do kernel). Erro capturado pelo `tsc` (os testes passavam, pois `vitest` não faz typecheck) e corrigido antes do fechamento; sem alterar regra do domínio.
- **Sem execução de R1–R9:** critérios de execução/bloqueio são texto; nenhum é avaliado.
- **Testes (12):** aprovação com os dez elementos + fundamento (emite `OperationalRuleApproved`); negativos a `INV-RO-01` (elemento 1, um da definição 2–8, elemento 9, elemento 10), `RO-FUNDAMENTO-CITADO` (sem fundamento), `RO-AUDITAVEL` (datação inválida); igualdade por identidade; teste estrutural de ausência de `execute/run/evaluate/apply/trigger/decide/decision/alterTruth/alterState/workflow`; engine de invariantes; completude do manifesto (3 ids) + prova de que só INV-RO-01 é `entity`.
- **`@ts-expect-error`** no elemento 9 ausente comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**12 arquivos, 124 testes**; 12 novos).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 3 invariantes são as do item 15; os dez elementos são exatamente os da DF-13; o fundamento citado deriva de item 11/19. Execução, versionamento-fluxo e referência de entidades deixados fora.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável dos dez elementos e leitura; nenhuma execução, avaliação, decisão ou mutação.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO executa a regra:** critério de execução/bloqueio são preservados como **texto descritivo**; eventos de entrada/saída como **descritores de tipo**. A execução é da automação/AHRI (fora deste escopo, por restrição do fundador).
- **`OperationalRuleId` (Uuid) × `RuleCode` (RO-Rn-NNN):** a identidade técnica do agregado é distinta do "identificador único" de negócio (elemento 1); ambos coexistem por fidelidade à DF-13.
- **Versionamento sem workflow:** a versão é um campo (elemento 10); revisões produziriam nova aprovação com nova versão — fluxo fora do escopo.
- **AHRI(14)/papéis(13–19) não antecipados:** responsável pela aprovação é ponteiro humano genérico.

---

## 8. Veredito final

**Entidade 12 — REGRA OPERACIONAL implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a **existência** de uma regra aprovada com os dez elementos da DF-13 e fundamento superior citado, sem jamais executar a regra, avaliar critérios, decidir, alterar Verdade/Estado ou rodar R1–R9. As seis perguntas obrigatórias foram respondidas conforme o Canon. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, execução de R1–R9, workflow, projeção ou antecipação das Entidades 13–19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 13 sem autorização explícita.**
