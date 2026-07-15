# PERITO — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 16 — PERITO** · Sprint 1P · Data: 2026-07-14
**Fontes congeladas:** Entidade 16 (Volume 01, itens 1–24); DF-06, DF-09, DF-10, DF-12, DF-17, DF-24; Art. 10º, 12º, 14º; R7 (contexto — não execução); Lei Geral; PERÍCIA (13), MISSÃO (01), PESSOA (02); E2/E8 (cadeia da prova→verdade, fundamento indireto).
**Localização:** `packages/domain/src/perito/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (16 arquivos, 165 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** papel **humano** titular dos **atos privativos de perícia** — o profissional que **produz a prova técnica** (DF-10; DF-09). Representa a **designação** de uma Pessoa como perito, numa fase pericial (PERÍCIA 13) de uma missão + a **titularidade** da competência técnica privativa — **não** a execução. Verbo = `designate`. Finalidade: produzir a prova pericial com responsabilidade técnica regulamentada.

**Separação formal (16 × 13 × 03 × 07 × 17):** PERITO *produz* a prova (privativo) × PERÍCIA(13) *enquadra* a fase (etapa) × DOCUMENTO(03) *preserva* a evidência × VERDADE(07) *sintetiza* × ADVOGADO(17) *decide* juridicamente. Cinco planos disjuntos.

**PERITO × PERÍCIA:** etapa (o "onde/quando" técnico) × papel humano (o "quem" técnico); um não substitui o outro (INV-PT-02); **sem herança** (irmãs; o Perito referencia a Perícia por identidade, não herda); **sem duplicidade** (enquadrar × produzir).
**PERITO × VERDADE:** prova técnica **não** é Verdade; a prova→Evidência(E2)→Conhecimento(E3)→Verdade(E8); a Verdade nasce **exclusivamente** por E8; o Perito **não** sintetiza → cadeia unidirecional, **sem circularidade**.
**PERITO × DOCUMENTO:** o laudo, ao ser **reconhecido**, existe como DOCUMENTO(03) — é o **Documento** que o representa (evidência), não o Perito (autor/responsável técnico).

**Respostas obrigatórias:** cria Verdade? **NÃO** · decide juridicamente? **NÃO** · pratica ato privativo? **SIM (de perícia; jamais de advocacia)** — mas a entidade representa a titularidade, não executa · substitui a Perícia? **NÃO** · substitui o Advogado? **NÃO** · circularidade? **NÃO** (bijeção-relação 13↔16, ponteiros `Uuid`, zero import) · sobreposição? **NÃO** · decisão fora do Canon? **NÃO**.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `perito-id.ts` (`PeritoId`) | ✔ |
| Aggregate Root (previsto) | `perito.ts` (`PeritoAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`PeritoPersonRef`, `PeritoMissionRef`, `PeritoExpertiseRef`, `PeritoAuthorityRef`) — ver §7 | ✔ |
| Eventos como contratos | `perito-events.ts` (`PeritoDesignated`) | ✔ |
| Manifesto de invariantes | `perito-invariants.ts` (INV-PT-01..PT-03) | ✔ |
| Testes unitários + invariantes | `perito.test.ts` (11 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `PeritoId` (Identity única) | Individualização da designação (Entidade 16) |
| `PeritoPersonRef` obrigatória | "O Perito é o profissional…" (item 1) |
| `PeritoMissionRef` obrigatória | Atua sobre a Missão (item 18; INV-PT-03) |
| `PeritoExpertiseRef` obrigatória | Depende da / atua na fase PERÍCIA (13) (item 11/18); atua na etapa, não é a etapa (INV-PT-02) |
| `PeritoAuthorityRef` obrigatória | Designação pela Governança (item 7/8; DF-12) |
| `designatedAt` (Date válida) | Temporalidade/rastreabilidade (Art. 12º/14º) |
| Fábrica `PeritoAggregate.designate(...)` | "Designação/autorização" (item 7; DF-12) |
| `PeritoDesignated` emitido | Marco da designação — contrato vazio |
| **Ausência** de `produceProof/executePericia` | Restrição do fundador: produção da prova é ato humano; a entidade não executa |
| **Ausência** de `stage/etapa/isPericia` | INV-PT-02 (distinto da PERÍCIA; DF-17) |
| **Ausência** de `advocacy/decideJuridical` | Itens 4/13 (não é advogado) |
| **Ausência** de `titularity/createTruth` | Item 13 (não detém titularidade); não cria Verdade (E8) |
| Ausência de produção de documentos | O laudo reconhecido é DOCUMENTO(03), não produto desta entidade |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-PT-01..INV-PT-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-PT-01 | Atos privativos de perícia só pelo Perito; AHRI/não-peritos jamais | DF-09 | cross-entity |
| INV-PT-02 | Distinto da PERÍCIA (etapa) | DF-17 | **entity** (estrutural) |
| INV-PT-03 | Responsabilidade temporária; missão do Projeto | Lei Geral | **entity** |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **cross-entity** | INV-PT-01 | Exclusividade sistêmica: a AHRI (INV-AH-03) e não-peritos jamais praticam ato privativo de perícia; o Perito é o titular legítimo (item 12). |
| **entity** (aqui) | INV-PT-02, INV-PT-03 | INV-PT-02 **estrutural** — o Perito tem atributos de papel humano, não de etapa (ausência de `stage/etapa/isPericia`, comprovada por teste). INV-PT-03 — runtime: Pessoa + Missão referenciadas, não possuídas. |

Guardas não numeradas: `PT-PESSOA` (item 1), `PT-ATUA-NA-PERICIA` (item 11/18), `PT-AUTORIZADO` (DF-12), `PT-DATADO` (Art. 14º). Confirmado por teste que **INV-PT-01 é cross-entity e INV-PT-02/03 são entity**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Pessoa(02)/Missão(01)/**Perícia(13)**/autoridade referenciadas só por `Uuid` nominal. **Referência mútua PERÍCIA↔PERITO (13↔16)**: bijeção-relação (o perito atua na etapa; a etapa é conduzida pelo perito), **zero import → zero ciclo de código**; ambas declaram "Circular? NÃO" (item 24); precedente Estado↔Etapa. `import type` aplicado nos type-only.
- **Sem execução/produção de perícia ou documentos:** todas fora; a entidade só representa a designação.
- **Testes (11):** designação com emissão de `PeritoDesignated`; negativos a `PT-PESSOA`, `INV-PT-03`, `PT-ATUA-NA-PERICIA`, `PT-AUTORIZADO`, `PT-DATADO`; igualdade por identidade; teste estrutural de ausência de `stage/etapa/isPericia/specializedStage/produceProof/produzirProva/executeProof/executePericia/decideJuridical/advocacy/advocacia/sign/assinar/titularity/titularidade/createTruth`; engine de invariantes; completude do manifesto (3 ids) + prova dos loci.
- **`@ts-expect-error`** em Pessoa, Missão, Perícia e autoridade ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**16 arquivos, 165 testes**; 11 novos).

---

## 6. Respostas obrigatórias

- **Decisão criada fora do Canon?** **NÃO.**
- **Regra inventada?** **NÃO.** As 3 invariantes são as do item 15; guardas `PT-*` derivam de itens 1/7/11/13/18 e Art. 14º. Execução/produção e transição deixadas fora.
- **Comportamento implícito?** **NÃO.** Só materialização imutável da designação; nenhuma produção de prova, execução, decisão, advocacia ou titularidade.
- **Dependência de infraestrutura?** **NÃO.**
- **Sobreposição de responsabilidade?** **NÃO.** Enquadrar (Perícia) × produzir (Perito) × preservar (Documento) × decidir (Advogado) × sintetizar (Verdade) — planos disjuntos.
- **Circularidade?** **NÃO.** Bijeção-relação 13↔16; ponteiros `Uuid`; zero import; Canon item 24 (ambas) "Circular? NÃO".
- **Integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência; "SIM" também para a exclusividade dos atos privativos de perícia ao Perito) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO produz a prova nem executa a perícia:** a produção é ato humano do perito; o laudo reconhecido é DOCUMENTO(03). A entidade representa a **designação** e a **titularidade** da competência privativa.
- **Referência mútua com PERÍCIA (13):** o Perito referencia a Perícia (item 11 existencial: "depende da fase pericial"); a Perícia já referencia o perito (item 19). É bijeção-relação, não ciclo — como Estado↔Etapa. Registrado explicitamente por ser ponto sensível.
- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas/relações, não um valor escalar; os VOs mínimos são as referências.
- **Refs de interação com ADVOGADO omitidas; transição (INV-PT-03/Art. 12º) → use-case.**

---

## 8. Veredito final

**Entidade 16 — PERITO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a designação de uma Pessoa como perito, titular dos atos privativos de perícia, atuando numa fase PERÍCIA de uma Missão, que **jamais** cria Verdade, decide juridicamente, pratica advocacia, detém titularidade, é a etapa ou executa/produz a prova. As separações com PERÍCIA/DOCUMENTO/VERDADE/ADVOGADO foram demonstradas sem sobreposição nem circularidade. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, execução da perícia, produção de documentos, workflow ou antecipação das Entidades 17–19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 17 sem autorização explícita.**
