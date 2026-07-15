# PROJECTION — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 10 — PROJEÇÃO** · Sprint 1J · Data: 2026-07-14
**Fontes congeladas:** Entidade 10 (Volume 01, itens 1–24); DF-03, DF-06, DF-08, DF-13, DF-24; INV-E8-04; E4-L08; Lei 1; Art. 10º, Art. 11º; Entidade 07 (Verdade).
**Localização:** `packages/domain/src/projection/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (10 arquivos, 103 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** leitura **DERIVADA da Verdade Operacional** (métrica/indicador/cenário), orientada a antecipar/dimensionar, a serviço da missão, que **jamais substitui, reinterpreta ou recalcula a Verdade como verdade** (DF-03; INV-E8-04). Descartável e recalculável (item 9); "possui nada; é leitura derivada" (item 12); sempre **declarada como derivada** (item 19). Verbo da fábrica = `derive`.

**Diferença formal:** Verdade(07) = fonte oficial única; Estado(08) = situação oficial derivada da Verdade; Etapa(09) = representação visual oficial do Estado; **Projeção(10) = leitura lateral, auxiliar, descartável, NÃO-oficial** — informa, jamais constitui verdade/estado/decisão.

**Respostas explícitas:**
- Projeção pode alterar a Verdade? **NÃO** (item 8; INV-PJ-01; INV-E8-04; DF-03).
- Projeção pode alterar o Estado? **NÃO** (INV-PJ-02; DF-08; DF-03).
- Projeção pode alterar a Etapa? **NÃO** (item 13; a Etapa deriva do Estado, jamais da Projeção).
- Projeção pode produzir decisões? **NÃO** (itens 4/5/16 — apoia a decisão humana, não a produz).
- Circularidade? **NÃO** (item 24). Deriva exclusivamente da Verdade; referencia Verdade(07) por identidade; nada referencia a Projeção. Direção única `Verdade → Projeção`.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `projection-id.ts` (`ProjectionId`) | ✔ |
| Aggregate Root (previsto) | `projection.ts` (`ProjectionAggregate`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`DerivedReading`) + `refs.ts` (`ProjectionTruthRef`) | ✔ |
| Eventos como contratos | `projection-events.ts` (`ProjectionDerived`) | ✔ |
| Manifesto de invariantes | `projection-invariants.ts` (INV-PJ-01..PJ-02) | ✔ |
| Testes unitários + invariantes | `projection.test.ts` (9 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `ProjectionId` (Identity única) | Individualização da leitura derivada (Entidade 10) |
| `ProjectionTruthRef` obrigatória e exclusiva | Deriva exclusivamente da Verdade (item 11; INV-PJ-01; DF-03) |
| `DerivedReading` (não-vazio, opaco) | Métrica/leitura derivada, declarada como derivada (itens 3/19/20; DF-03) |
| `calculatedAt` (Date válida) | Recalculabilidade — cada leitura é instantânea (itens 8/9); Art. 14º |
| Fábrica `ProjectionAggregate.derive(...)` | "Leitura derivada da Verdade" (item 1) |
| `ProjectionDerived` emitido | Marco da derivação — contrato vazio |
| Ausência de mutador da Verdade | INV-PJ-01 (jamais substitui/reinterpreta/recalcula como verdade; DF-03; INV-E8-04) |
| Ausência de referência/mutador de Estado | INV-PJ-02 (nunca altera Estado; DF-08) |
| Ausência de referência à Etapa | Item 13 (não possui Etapa) |
| Ausência de método `decide` | Itens 4/5/16 (informa; jamais decide nem constitui verdade) |
| Ausência de apresentação como verdade/score | Item 17; E4-L08 (score não é verdade) |
| Ausência de cálculo da métrica / agregação multi-missão | DF-13 (Regra Operacional) / projeção de leitura — fora |
| Ausência de referência à MISSÃO | Item 11 (dependência exclusiva da Verdade); missão transitiva via a Verdade |
| Construtor privado + fábrica | Não produzida por interface como fonte (INV-E8-04; DF-08) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-PJ-01..INV-PJ-02)

O Canon (item 15) enumera **exatamente duas**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-PJ-01 | Deriva da Verdade e jamais a substitui/reinterpreta/recalcula como verdade | DF-03; INV-E8-04 | **entity** |
| INV-PJ-02 | Nunca altera o Estado Operacional | DF-08 | **entity** (estrutural) |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-PJ-01, INV-PJ-02 | INV-PJ-01: `derive` exige a Verdade de origem + leitura declarada derivada; sem qualquer mutador da Verdade (runtime + estrutural). INV-PJ-02: **estrutural** — a Projeção não conhece, não referencia e não altera o Estado (comprovado por teste de ausência). |

Runtime como `Invariant<ProjectionAggregate>`: **INV-PJ-01**. INV-PJ-02 é estrutural (ausência). Guardas não numeradas: `PJ-LEITURA-DERIVADA` (leitura presente), `PJ-DATADA` (datação). Confirmado por teste que **ambas as INV-PJ são locus `entity`** — a Projeção é a primeira entidade cujas invariantes do Canon são **todas** garantidas no nível de entidade (por referência e por ausência).

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — a Verdade(07) é referenciada só por `Uuid` nominal (zero import → zero ciclo). `import type` aplicado nos type-only.
- **Sem DF-13/projeção de leitura/agregação:** o cálculo da métrica e a agregação multi-missão ficam fora (Regra Operacional / read-projection).
- **Testes (9):** derivação com emissão de `ProjectionDerived`; negativos a `INV-PJ-01` (sem Verdade), `PJ-LEITURA-DERIVADA` (leitura vazia), `PJ-DATADA` (datação inválida); igualdade por identidade; teste estrutural de ausência de `state/estado/stage/etapa/alterTruth/recalculateTruth/substitute/setState/alterState/mutate/decide/decision`; engine de invariantes; completude do manifesto (2 ids) + prova de que ambas são `entity`.
- **`@ts-expect-error`** em Verdade ausente comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**10 arquivos, 103 testes**; 9 novos).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 2 invariantes são as do item 15; guardas `PJ-*` derivam de itens 3/14/19 e Art. 14º. Cálculo/agregação (DF-13/read-projection) e missão direta deixados fora.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável da leitura derivada; sem alterar Verdade/Estado/Etapa, sem decidir.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **Verbo `derive`:** fidelidade ao item 1 ("leitura derivada da Verdade"). Não calcula a métrica (DF-13) nem altera a Verdade/Estado.
- **`DerivedReading` opaca:** a métrica é preservada e declarada derivada, não computada nem interpretada; não é catálogo.
- **Missão direta e agregação multi-missão omitidas:** item 11 fixa dependência exclusiva da Verdade (missão transitiva via a Verdade); a agregação multi-missão (ex. item 20) é projeção de leitura — camada proibida neste sprint.

---

## 8. Veredito final

**Entidade 10 — PROJEÇÃO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando sua natureza de leitura derivada, subordinada e descartável, que jamais substitui a Verdade, jamais altera o Estado ou a Etapa e jamais decide. As cinco perguntas obrigatórias foram respondidas conforme o Canon (todas restritivas). Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, projeção de leitura, regra operacional ou comportamento de entidades futuras foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 11 sem autorização explícita.**
