# AHRI — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 14 — AHRI** · Sprint 1N (abre o Bloco de Papéis) · Data: 2026-07-14
**Fontes congeladas:** Entidade 14 (Volume 01, itens 1–24); DF-06, DF-09 (atribuições/vedações/registro), DF-13, DF-24; Art. 13º, 15º; E9 (E9-L06), E10; R7, R8 (contexto — não execução); Lei 4; Regra Operacional (12).
**Localização:** `packages/domain/src/ahri/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (14 arquivos, 144 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** inteligência operacional cognitiva **assistiva** (Art. 15º; DF-09). Executa comportamento **aprovado** (Regras Operacionais), raciocina conforme E9, declara incerteza conforme E10. Pode **assumir a responsabilidade operacional** de uma missão (DF-09/item 12), sempre com registro **DECISOR: AHRI / TIPO: Decisão Operacional Automatizada / FUNDAMENTO** (DF-09/item 14; INV-AH-02). Verbo = `assumeOperationalResponsibility`. **A entidade representa a EXISTÊNCIA da assunção e suas vedações — NÃO executa comportamento, NÃO roda E9/E10/R7/R8, NÃO decide.**

**Fronteira de camadas:** pertence à ENTIDADE — identidade; assunção de responsabilidade operacional de 1 Missão; referência à Regra Operacional (12) que fundamenta; registro DF-09; datação; **ausência estrutural** de decisão/ato privativo/criação de verdade. Pertence a **R7/R8/casos de uso** — o raciocínio cognitivo (E9), a declaração de incerteza (E10), a atuação e o **acionamento de papéis humanos** (recomendação R1). Pertence ao **Event Store** — rastro perpétuo das atuações (INV-AH-02 universal; Lei 3/4). Pertence a **projeções/infra** — leituras e tecnologia.

**Respostas explícitas:**
- **Decisão humana atribuída à IA?** **NÃO** — INV-AH-01/03/04 garantidas por **ausência estrutural** (sem método de decisão/privativo/criação de verdade; comprovado por teste).
- **Autonomia da IA?** **NÃO** — assistiva; atuação nasce de Regras Operacionais (item 7) e cita a RO no FUNDAMENTO (INV-AH-02); não age por vontade própria (item 8).
- **Relação com OPERAÇÃO?** a coordenação/acionamento é da OPERAÇÃO(11)/R7 — fora da entidade (R1); a AHRI só registra a assunção.
- **Relação com SUPERVISOR?** a supervisão é do R7; a AHRI é auditável (item 10), mas **não** referencia o Supervisor (interação — fora).
- **Relação com REGRA OPERACIONAL?** existencial: depende de RO (item 11) e referencia ao menos uma (INV-AH-02) — `GoverningRuleRef` (Entidade 12, já existente).
- **Circularidade?** **NÃO** (item 24). `Missão/RO → AHRI`; omite refs a papéis (R1); nada referencia a AHRI de volta.
- **Aderência ao Canon?** integral.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `ahri-id.ts` (`AhriId`) | ✔ |
| Aggregate Root (previsto) | `ahri.ts` (`AhriAggregate`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`AutomatedDecisionRecord`) + `refs.ts` (`AhriMissionRef`, `GoverningRuleRef`) | ✔ |
| Eventos como contratos | `ahri-events.ts` (`AhriOperationalResponsibilityAssumed`) | ✔ |
| Manifesto de invariantes | `ahri-invariants.ts` (INV-AH-01..AH-04) | ✔ |
| Testes unitários + invariantes | `ahri.test.ts` (10 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `AhriId` (Identity única) | Individualização da atuação auditável (Entidade 14; Lei 3/4) |
| `AhriMissionRef` obrigatória | Responsabilidade operacional de missão (item 12; DF-09) |
| `GoverningRuleRef` obrigatória | Toda automação referencia ≥1 Regra Operacional (item 11; INV-AH-02; DF-09/DF-13) |
| `AutomatedDecisionRecord` (DECISOR=AHRI / TIPO fixo / FUNDAMENTO) | Registro DF-09 (item 14; INV-AH-02) |
| `AHRI_DECISOR`, `AHRI_DECISION_TYPE` (constantes) | Valores fixos do registro DF-09 para a AHRI |
| `assumedAt` (Date válida) | Auditabilidade (Lei 4; Art. 14º) |
| Fábrica `assumeOperationalResponsibility(...)` | "A AHRI poderá assumir a responsabilidade operacional de uma missão" (DF-09) |
| `AhriOperationalResponsibilityAssumed` emitido | Marco da assunção — contrato vazio |
| **Ausência** de `decide/finalDecision` | INV-AH-01 (assistiva, nunca decisão final; Art. 15º) |
| **Ausência** de `sign/parecer/privativeAct` | INV-AH-03 (jamais ato privativo/decisão jurídica; DF-09) |
| **Ausência** de `createTruth/createFact/createEvidence` | INV-AH-04 (jamais cria fato/verdade; E9-L06) |
| Ausência de execução cognitiva/atuação | E9/E10 e R7/R8 são de outra camada |
| Ausência de ref a papéis/Supervisor | Interação → OPERAÇÃO/R7 (recomendação R1) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-AH-01..INV-AH-04)

O Canon (item 15) enumera **exatamente quatro**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-AH-01 | Função assistiva; jamais decisão final | Art. 15º | **entity** (estrutural) |
| INV-AH-02 | Toda automação referencia Regra Operacional com registro | DF-09; DF-13 | **entity** |
| INV-AH-03 | Jamais pratica ato privativo nem decide juridicamente | DF-09 | **entity** (estrutural) |
| INV-AH-04 | Jamais cria fatos/verdade/evidência/documento/evento/conhecimento | E9-L06 | **entity** (estrutural) |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-AH-01, INV-AH-02, INV-AH-03, INV-AH-04 | **A salvaguarda IA×humano é toda de nível de entidade.** INV-AH-02: `assumeOperationalResponsibility` exige `GoverningRuleRef` + `AutomatedDecisionRecord` com FUNDAMENTO (runtime). INV-AH-01/03/04: **estruturais** — ausência de qualquer método de decisão, ato privativo ou criação de fato/verdade (comprovado por teste). |

Guardas não numeradas: `AH-DE-MISSAO` (item 12), `AH-AUDITAVEL` (Lei 4). Confirmado por teste que **as quatro INV-AH são locus `entity`** (a primeira entidade cujas quatro invariantes são todas garantidas por instância — reflete a criticidade da salvaguarda). O rastro perpétuo universal (toda automação) e a não-contradição são reforçados no event-store/governança nos Sprints 2+.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Missão(01) e Regra Operacional(12) referenciadas só por `Uuid` nominal; **nenhuma referência a papéis humanos (15–18) nem Supervisor** (R1 → mutualidade eliminada, DAG mantido). `import type` aplicado nos type-only.
- **Sem execução cognitiva/atuação:** E9/E10/R7/R8 fora; a entidade só registra a assunção.
- **Testes (10):** assunção com registro DF-09 (emite `AhriOperationalResponsibilityAssumed`); negativos a `AH-DE-MISSAO`, `INV-AH-02` (sem RO; sem FUNDAMENTO), `AH-AUDITAVEL`; igualdade por identidade; **teste de salvaguarda** que prova ausência de `decide/decision/finalDecision/decideJuridical/sign/assinar/parecer/privativeAct/atoPrivativo/createTruth/criarVerdade/createFact/criarFato/createEvidence/substituteHuman` (INV-AH-01/03/04); engine de invariantes; completude do manifesto (4 ids) + prova de que as quatro são `entity`.
- **`@ts-expect-error`** em Missão e Regra Operacional ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**14 arquivos, 144 testes**; 10 novos).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 4 invariantes são as do item 15; o registro é o da DF-09; guardas `AH-*` derivam de item 12 e Lei 4. Execução cognitiva, atuação e acionamento de papéis deixados fora.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável da assunção + registro; nenhuma decisão, ato privativo, criação de verdade, raciocínio ou acionamento.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO é a "IA em execução":** não raciocina (E9), não declara incerteza em runtime (E10), não atua (R7/R8). Representa a **existência** da assunção de responsabilidade operacional com o registro DF-09 e as vedações estruturais.
- **DECISOR/TIPO fixos:** para a AHRI, o registro DF-09 tem DECISOR=AHRI e TIPO=Decisão Operacional Automatizada por definição; só o FUNDAMENTO varia (cita Regra Constitucional + RO).
- **Referências a papéis/Supervisor omitidas** (recomendação R1 do ROLE_ARCHITECTURE_AUDIT): a interação "aciona/é supervisionada" é da OPERAÇÃO(11)/R7, não atributo da AHRI — o que elimina a mutualidade nominal e preserva o DAG.

---

## 8. Veredito final

**Entidade 14 — AHRI implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a assunção de responsabilidade operacional pela inteligência assistiva, com registro DF-09 e fundamento em Regra Operacional, e com a **salvaguarda IA×humano garantida estruturalmente no nível de entidade** (jamais decide, jamais pratica ato privativo, jamais cria fato/verdade). As perguntas obrigatórias foram respondidas conforme o Canon — nenhuma decisão humana é atribuída à IA. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, execução cognitiva (E9/E10), atuação (R7/R8), workflow ou antecipação das Entidades 15–19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 15 sem autorização explícita.**
