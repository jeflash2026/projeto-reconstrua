# OPERADOR — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 15 — OPERADOR** · Sprint 1O · Data: 2026-07-14
**Fontes congeladas:** Entidade 15 (Volume 01, itens 1–24); DF-06, DF-09, DF-10, DF-12, DF-24; Art. 10º, 12º, 14º; R7 (contexto — não execução); Lei Geral; PESSOA (02), MISSÃO (01).
**Localização:** `packages/domain/src/operador/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (15 arquivos, 154 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** papel **humano** de **condução operacional diária** das missões (DF-10; Art. 10º). É uma **Pessoa** (item 1) com **responsabilidade temporária** (INV-OPr-01), designada pela Governança (DF-12), que **não** pratica atos privativos (INV-OPr-02) nem decide juridicamente (item 17), e **não** detém titularidade (item 13). Verbo = `designate`. **Representa a existência da designação; NÃO executa a condução (OPERAÇÃO/R7).**

**Fronteira rigorosa (OPERADOR × AHRI × SUPERVISOR × OPERAÇÃO):**

| | Natureza | Faz | JAMAIS faz |
|---|---|---|---|
| OPERAÇÃO (11) | o *agir* organizado (abstrato) | é o conjunto de ações | ser *quem* age |
| **OPERADOR (15)** | **quem** conduz (humano) | condução diária; aciona a competência certa | ato privativo, decisão jurídica, titularidade |
| AHRI (14) | automação assistiva | executa RO aprovada | decidir; ato privativo; criar verdade |
| SUPERVISOR (18) | oversight | supervisiona a atuação | conduzir; substituir competência privativa |

**Sem sobreposição** (formal): quatro planos disjuntos — *agir* (Operação) × *conduzir-humano* (Operador) × *automatizar-assistivo* (AHRI) × *fiscalizar* (Supervisor). A tensão AHRI↔Operador ("conduz operacionalmente" × "condução diária") resolve-se por complementaridade via DF-09 (a AHRI executa RO aprovada e é assistiva; o Operador faz condução humana). Nenhuma responsabilidade é detida por dois.

**Sem circularidade** (formal): o Operador referencia Pessoa(02), Missão(01) e a autoridade designante (DF-12, nominal); **omite** as refs de interação "aciona AHRI/Advogado/Perito" (OPERAÇÃO/R7 — recomendação R1). Direção `Pessoa/Missão → Operador`; nada o referencia de volta → DAG. No código, zero import entre entidades.

**Perguntas obrigatórias:**
- Decisão fora do Canon? **NÃO.** · Regra inventada? **NÃO.** · Comportamento implícito? **NÃO.** · Dependência de infraestrutura? **NÃO.** · Aderência? **SIM.**
- Pratica ato privativo / decide juridicamente? **NÃO** (INV-OPr-02; item 17 — por ausência estrutural).
- Detém titularidade da missão? **NÃO** (item 13; INV-OPr-01 — a missão é do Projeto).

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `operador-id.ts` (`OperadorId`) | ✔ |
| Aggregate Root (previsto) | `operador.ts` (`OperadorAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`OperadorPersonRef`, `OperadorMissionRef`, `OperadorAuthorityRef`) — ver §7 | ✔ |
| Eventos como contratos | `operador-events.ts` (`OperadorDesignated`) | ✔ |
| Manifesto de invariantes | `operador-invariants.ts` (INV-OPr-01..OPr-03) | ✔ |
| Testes unitários + invariantes | `operador.test.ts` (10 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `OperadorId` (Identity única) | Individualização da designação (Entidade 15) |
| `OperadorPersonRef` obrigatória | "O Operador é a pessoa responsável…" (item 1) |
| `OperadorMissionRef` obrigatória | Atua sobre a Missão (item 11/18; INV-OPr-01) |
| `OperadorAuthorityRef` obrigatória | Designação pela Governança/autorização (item 7/8/11; DF-12) |
| `designatedAt` (Date válida) | Temporalidade/rastreabilidade (Art. 12º/14º) |
| Fábrica `OperadorAggregate.designate(...)` | "Designação pelo Sistema/Governança" (item 7; DF-12) |
| `OperadorDesignated` emitido | Marco da designação — contrato vazio |
| Ausência de condução autônoma | A condução diária é OPERAÇÃO(11)/R7 |
| **Ausência** de `privativeAct/sign/parecer` | INV-OPr-02 (não pratica ato privativo; DF-09) |
| **Ausência** de `decideJuridical` | Item 17 (não decide juridicamente; DF-09) |
| **Ausência** de `titularity/ownMission` | Item 13; INV-OPr-01 (a missão é do Projeto) |
| Ausência de refs a AHRI/Advogado/Perito | Interação → OPERAÇÃO/R7 (recomendação R1) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-OPr-01..INV-OPr-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-OPr-01 | Responsabilidade temporária; missão pertence ao Projeto | Lei Geral | **entity** |
| INV-OPr-02 | Não pratica ato privativo; não decide juridicamente | DF-09 | **entity** (estrutural) |
| INV-OPr-03 | Transição de designação preserva contexto | Art. 12º | use-case |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-OPr-01, INV-OPr-02 | `designate` exige Pessoa + Missão + autoridade; runtime `INV-OPr-01` (pessoa+missão referenciadas, não possuídas) + `OPr-AUTORIZADO`. INV-OPr-02: **estrutural** — ausência de ato privativo/decisão jurídica (comprovado por teste). |
| **use-case** | INV-OPr-03 | O processo de transição de designação preserva contexto (Sprints 2+). |

Guardas não numeradas: `OPr-PESSOA` (item 1), `OPr-DATADO` (Art. 14º). Confirmado por teste que **INV-OPr-01/02 são `entity` e INV-OPr-03 é use-case**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Pessoa(02)/Missão(01)/autoridade referenciadas só por `Uuid` nominal; **nenhuma referência a AHRI/Advogado/Perito** (R1). `import type` aplicado nos type-only.
- **Sem execução da condução:** OPERAÇÃO/R7 fora; a entidade só representa a designação.
- **Testes (10):** designação com emissão de `OperadorDesignated`; negativos a `OPr-PESSOA`, `INV-OPr-01`, `OPr-AUTORIZADO`, `OPr-DATADO`; igualdade por identidade; teste estrutural de ausência de `privativeAct/atoPrivativo/decideJuridical/decideJuridica/decideLegal/sign/assinar/parecer/ownMission/titularity/titularidade/produceProof`; engine de invariantes; completude do manifesto (3 ids) + prova dos loci.
- **`@ts-expect-error`** em Pessoa, Missão e autoridade ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**15 arquivos, 154 testes**; 10 novos).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 3 invariantes são as do item 15; guardas `OPr-*` derivam de itens 1/7/13 e Art. 14º. Condução, transição e interação deixadas fora.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável da designação; nenhuma condução, ato privativo, decisão ou titularidade.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO conduz:** a condução operacional diária é a OPERAÇÃO(11)/R7; a entidade representa a **designação** do operador.
- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas/relações, não um valor escalar; os VOs mínimos são as referências. Inventar um VO textual seria fora do Canon.
- **Refs de interação omitidas** (recomendação R1): "aciona AHRI/Advogado/Perito" é da OPERAÇÃO/R7 — elimina a mutualidade nominal e preserva o DAG.
- **`OperadorPersonRef` incluída** (item 1: "a pessoa responsável"): o papel é uma qualificação de uma Pessoa (02, já existente); referência nominal, sem antecipar.

---

## 8. Veredito final

**Entidade 15 — OPERADOR implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a designação de uma Pessoa como operador de uma Missão, com responsabilidade temporária e autorização da Governança, que **jamais** pratica ato privativo, decide juridicamente, conduz autonomamente ou detém titularidade. As fronteiras com AHRI/SUPERVISOR/OPERAÇÃO foram demonstradas sem sobreposição nem circularidade. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, execução (OPERAÇÃO/R7), workflow ou antecipação das Entidades 16–19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 16 sem autorização explícita.**
