# OPERATION — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 11 — OPERAÇÃO** · Sprint 1K · Data: 2026-07-14
**Fontes congeladas:** Entidade 11 (Volume 01, itens 1–24); DF-06, DF-08, DF-13, DF-24; Volume 03 (R1–R9); Lei 4; Art. 8º, 10º, 11º, 13º, 14º, 16º; R6, R7, R8, R9; DF-11; CA-13 (demarcação OPERAÇÃO × adjetivo "operacional").
**Localização:** `packages/domain/src/operation/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (11 arquivos, 112 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** conjunto das **ações conduzidas em função de uma missão** (DF-08) — o agir organizado sobre a missão (reconhecer, construir verdade, evoluir, atuar, auditar — R1–R9), **regido integralmente pelo Volume 03** e sempre **auditável** (Lei 4; R9). Não possui entidades (item 12). Verbo da fábrica = `conduct`.

**Diferença formal:** MISSÃO(01) é a unidade central (o "o quê"); a OPERAÇÃO é o **agir sobre** ela (item 4). CASO(05) = contexto jurídico; PROCESSO(06) = instrumento jurídico; EVENTO(04) = acontecimento reconhecido — a Operação **referencia**, não é nem substitui nenhum deles. VERDADE(07) e ESTADO(08): a Operação **não** os constrói, possui ou altera (item 13). O adjetivo "operacional" (Verdade/Estado/Etapa *Operacional*) **não** é a entidade OPERAÇÃO (CA-13; item 4).

**Respostas explícitas:**
- A Operação pode alterar a Verdade? **NÃO** (item 13; INV-E8-04).
- A Operação pode alterar o Estado? **NÃO** (o Estado deriva só da Verdade — INV-EO-02).
- A Operação pode decidir? **NÃO** (decisão é do humano — DF-09; itens 16/17).
- A Operação pode substituir Processo ou Caso? **NÃO** (entidades distintas; referencia, não possui — itens 4/12/13).
- Circularidade? **NÃO** (item 24). `Missão → Operação`; a Operação referencia Missão(01) por identidade e não possui Missão/Verdade/Pessoa; nada a referencia de volta.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `operation-id.ts` (`OperationId`) | ✔ |
| Aggregate Root (previsto) | `operation.ts` (`OperationAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`OperationMissionRef`, `OperationResponsibleRef`) — ver §7 | ✔ |
| Eventos como contratos | `operation-events.ts` (`OperationConducted`) | ✔ |
| Manifesto de invariantes | `operation-invariants.ts` (INV-OP-01..OP-03) | ✔ |
| Testes unitários + invariantes | `operation.test.ts` (9 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `OperationId` (Identity única) | Individualização do agir; base da auditabilidade (Entidade 11; R9) |
| `OperationMissionRef` obrigatória | Existe em função de uma Missão (item 11; INV-OP-01; DF-08) |
| `OperationResponsibleRef` obrigatória | Conduzida por responsáveis/AHRI (itens 7/8/18; Art. 10º/14º); auditabilidade (INV-OP-03) |
| `conductedAt` (Date válida) | Auditabilidade/rastreabilidade (Lei 4; Art. 14º) |
| Fábrica `OperationAggregate.conduct(...)` | "Ações conduzidas em função de uma missão" (item 1) |
| `OperationConducted` emitido | Marco da condução — contrato vazio |
| Ausência de execução de R1–R9 / agir autônomo | INV-OP-02 (rege-se pelo Volume 03; governança na camada de execução) |
| Ausência de mutador de Verdade/Estado | Item 13 (não possui Verdade); INV-E8-04; INV-EO-02 |
| Ausência de método `decide` | DF-09; itens 16/17 (jamais decidir) |
| Ausência de posse/substituição de Processo/Caso | Itens 4/12/13 (referencia, não possui) |
| Ausência de coleção de ações/eventos | Item 12 ("referencia ações/eventos; não possui entidades") — evitar workflow |
| Ausência de ref a REGRA OPERACIONAL (12) | Entidade posterior; INV-OP-02 é natureza, não ponteiro |
| Construtor privado + fábrica | Condução sob Regras Operacionais (DF-13), não por interface |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-OP-01..INV-OP-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-OP-01 | Existe em função de uma missão | DF-08 | **entity** |
| INV-OP-02 | Rege-se integralmente pelo Volume 03 (R1–R9) | Volume 03; DF-13 | use-case |
| INV-OP-03 | É sempre auditável | R9; Lei 4 | event-store |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-OP-01 | `conduct` exige a Missão (função exclusiva); runtime `INV-OP-01` + `OP-AUDITAVEL` (responsável). |
| **use-case** | INV-OP-02 | A governança por R1–R9 vive na execução; a entidade contribui por NÃO ter agir autônomo (estrutural). |
| **event-store** | INV-OP-03 | Auditoria operacional perpétua (R9); a entidade contribui com a rastreabilidade (responsável + datação). |

Runtime como `Invariant<OperationAggregate>`: **INV-OP-01** + `OP-AUDITAVEL`. Confirmado por teste que **apenas INV-OP-01 é locus `entity`**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — a Missão(01) é referenciada só por `Uuid` nominal (zero import → zero ciclo). `import type` aplicado nos type-only.
- **Sem R1–R9/Regra Operacional/workflow:** INV-OP-02/03 **mapeadas** aos loci, não simuladas; nenhuma ação é executada ou sequenciada.
- **Testes (9):** condução com emissão de `OperationConducted`; negativos a `INV-OP-01` (sem Missão), `OP-AUDITAVEL` (sem responsável, datação inválida); igualdade por identidade; teste estrutural de ausência de `verdade/truth/state/estado/process/processo/case/caso/decide/decision/execute/workflow/substitute`; engine de invariantes; completude do manifesto (3 ids) + prova de que só INV-OP-01 é `entity`.
- **`@ts-expect-error`** em Missão e responsável ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**11 arquivos, 112 testes**; 9 novos).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 3 invariantes são as do item 15; guardas `OP-*` derivam de INV-OP-01/03, R9, Lei 4 e Art. 14º. Regra Operacional(12), execução de R1–R9 e coleção de ações deixadas fora.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável do marco de condução e leitura; sem executar ações, sem alterar Verdade/Estado, sem decidir.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas e relações (conjunto de ações; regida pelo Volume 03; auditável), **não** um valor escalar. Os "Value Objects mínimos" são as referências imutáveis (`refs.ts`). Criar um VO textual (ex. "descrição") seria **invenção fora do Canon** — deliberadamente evitado.
- **Verbo `conduct`:** fidelidade ao item 1 ("ações conduzidas"). Materializa o marco ontológico; **não** executa R1–R9.
- **Regra Operacional(12), papéis(14–18)/AHRI e coleção de ações omitidos:** entidade posterior / anteciparia entidades futuras / seria workflow. INV-OP-02 é subordinação de natureza (use-case), não ponteiro.

---

## 8. Veredito final

**Entidade 11 — OPERAÇÃO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando sua natureza de agir conduzido em função de uma missão, regido pelo Volume 03 e auditável, que jamais altera a Verdade ou o Estado, jamais decide e jamais substitui ou possui Processo/Caso/Missão/Verdade/Pessoa. As cinco perguntas obrigatórias foram respondidas conforme o Canon. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, projeção de leitura, regra operacional, execução de R1–R9 ou comportamento de entidades futuras foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 12 sem autorização explícita.**
