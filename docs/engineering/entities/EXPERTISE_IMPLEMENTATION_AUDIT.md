# EXPERTISE (PERÍCIA) — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 13 — PERÍCIA** · Sprint 1M · Data: 2026-07-14
**Fontes congeladas:** Entidade 13 (Volume 01, itens 1–24); DF-06, DF-10, DF-17, DF-24; DF-09; Lei 2; Art. 11º, Art. 14º; gênero ETAPA OPERACIONAL (09) e sua INV-ET-02; Evidência (E2) e nascimento da Verdade (E8) como fundamento indireto.
**Localização:** `packages/domain/src/pericia/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (13 arquivos, 134 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** etapa operacional **especializada** da missão (DF-17) — **espécie de Etapa Operacional (09)** — a fase de **produção técnica da prova** no curso da missão. **NÃO é o PERITO** (papel humano, 16); distintos (INV-PE-01/02). **Finalidade:** enquadrar a fase técnica de prova pericial. Verbo = `frame`. **A entidade representa a EXISTÊNCIA do procedimento pericial; NÃO executa perícia** (a prova é do Perito — item 16; DF-10).

**Diferença formal:** DOCUMENTO(03) = prova documental/evidência; EVENTO(04) = acontecimento; CASO(05) = contexto jurídico; PROCESSO(06) = instrumento jurídico; **PERÍCIA(13) = etapa (fase) especializada**.

**PERÍCIA ↔ ETAPA(09):** espécie de Etapa; referencia a Etapa que especializa (`SpecializedStageRef`); herda a natureza de etapa — jamais altera o Estado (INV-ET-02).
**PERÍCIA ↔ VERDADE(07):** não cria Verdade; a prova (do Perito) vira evidência (E2) que alimenta Conhecimento→Verdade (E8). Relação indireta, não-circular.

**Respostas explícitas:**
- A Perícia cria Verdade? **NÃO** (item 16; E8).
- A Perícia decide? **NÃO** (item 17; DF-09).
- A Perícia substitui o profissional humano? **NÃO** (itens 4/13/16; DF-17 — etapa × papel; a prova é do Perito).
- A Perícia altera Estado? **NÃO** (é etapa; INV-ET-02; mudança é R6/Evento Relevante).
- A Perícia pode existir sem Missão? **NÃO** (item 11; INV-PE-03).
- Circularidade? **NÃO** (item 24). `Missão/Etapa → Perícia`; nada referencia a Perícia de volta.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `pericia-id.ts` (`PericiaId`) | ✔ |
| Aggregate Root (previsto) | `pericia.ts` (`PericiaAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`PericiaMissionRef`, `SpecializedStageRef`, `PericiaPeritoRef`) — ver §7 | ✔ |
| Eventos como contratos | `pericia-events.ts` (`PericiaFramed`) | ✔ |
| Manifesto de invariantes | `pericia-invariants.ts` (INV-PE-01..PE-03) | ✔ |
| Testes unitários + invariantes | `pericia.test.ts` (10 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `PericiaId` (Identity única) | Individualização da fase pericial (Entidade 13) |
| `PericiaMissionRef` obrigatória | Etapa de uma Missão (item 11/22; INV-PE-03; Lei 2) |
| `SpecializedStageRef` obrigatória | "Espécie de Etapa Operacional (09)"; especialização de Etapa (item 3/11/22; INV-PE-01; DF-17) |
| `PericiaPeritoRef` obrigatória (nominal) | Conduzida tecnicamente pelo Perito; bem enquadrada = com perito responsável (itens 18/19; DF-10) — NÃO a entidade PERITO(16) |
| `framedAt` (Date válida) | Quando a fase pericial se instala (item 7); Art. 14º |
| Fábrica `PericiaAggregate.frame(...)` | Enquadrar a fase técnica (item 5/16) |
| `PericiaFramed` emitido | Marco do enquadramento — contrato vazio |
| Ausência de produção de prova / execução | Item 16 (a prova é do Perito — DF-10); restrição do fundador |
| Ausência de papel humano / confusão com Perito | INV-PE-01/02; item 13; DF-17 |
| Ausência de `decide`/interpretação | Item 17; DF-09 |
| Ausência de mutador de Estado/Verdade | É etapa (INV-ET-02); item 16 |
| Ausência de execução de R6 | Evolução é caso de uso; só enquadra o marco |
| Ausência de coleção de documentos/eventos periciais | Item 12 ("pode possuir… referenciados" — opcional/workflow) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-PE-01..INV-PE-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-PE-01 | É etapa especializada, não papel humano | DF-17 | **entity** |
| INV-PE-02 | Distinta do PERITO; jamais se confunde | DF-17 | **entity** |
| INV-PE-03 | Ocupa a missão como etapa única enquanto vigente | Lei 2 | event-store |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-PE-01, INV-PE-02 | `frame` exige Missão + Etapa especializada + perito (por identidade). **Estrutural:** a Perícia tem atributos de etapa e NÃO tem comportamento de papel (não produz prova, não decide) — comprovado por ausência. Runtime: `PE-DE-MISSAO`, `PE-ESPECIALIZA-ETAPA`. |
| **event-store** | INV-PE-03 | Unicidade da etapa pericial vigente por missão (Sprints 2+). |

Guardas não numeradas: `PE-PERITO-RESPONSAVEL` (item 19), `PE-DATADA` (item 7). Confirmado por teste que **INV-PE-01/02 são `entity` e INV-PE-03 é event-store**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Missão(01)/Etapa(09)/Perito(16) referenciados só por `Uuid` nominal (zero import → zero ciclo). `import type` aplicado nos type-only.
- **Sem execução de perícia/R6/produção de prova:** todas mapeadas aos loci corretos / fora.
- **Testes (10):** enquadramento com emissão de `PericiaFramed`; negativos a `PE-DE-MISSAO`, `PE-ESPECIALIZA-ETAPA`, `PE-PERITO-RESPONSAVEL`, `PE-DATADA`; igualdade por identidade; teste estrutural de ausência de `produceProof/produzirProva/executeProof/execute/decide/decision/interpret/perform/role/papel/alterState/alterTruth`; engine de invariantes; completude do manifesto (3 ids) + prova dos loci (PE-01/02 entity, PE-03 event-store).
- **`@ts-expect-error`** em Missão, Etapa e perito ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**13 arquivos, 134 testes**; 10 novos).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 3 invariantes são as do item 15; guardas `PE-*` derivam de itens 3/7/11/19/22. Produção de prova, R6, coleções e entidade PERITO deixadas fora.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável do enquadramento e leitura; nenhuma perícia, prova, decisão ou mutação.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO executa perícia:** a produção da prova é do PERITO (item 16; DF-10). A Perícia (etapa) apenas enquadra a fase.
- **`PericiaPeritoRef` é nominal, não a entidade PERITO(16):** referenciar QUEM conduz não confunde a etapa com o papel (INV-PE-02); PERITO permanece não antecipado.
- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas/relações, não um valor escalar; os VOs mínimos são as referências. Inventar uma "descrição" seria fora do Canon.
- **Estado(08) transitivo via a Etapa; coleções de documentos/eventos periciais omitidas** (item 12 opcional).

---

## 8. Veredito final

**Entidade 13 — PERÍCIA implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a **existência** da fase pericial como etapa especializada da missão, sem jamais executar perícia, produzir prova, criar Verdade, decidir, alterar Estado ou substituir o profissional humano. As seis perguntas obrigatórias foram respondidas conforme o Canon. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, execução de regras, interpretação automática, decisão jurídica, workflow ou antecipação das Entidades 14–19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 14 sem autorização explícita.**
