# OPERATIONAL TRUTH — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 07 — VERDADE OPERACIONAL** · Sprint 1G (Núcleo Cognitivo) · Data: 2026-07-13
**Fontes congeladas:** Entidade 07 (Volume 01, itens 1–24); E8 completo (E8-L01…L09; INV-E8-01…07); Lei Epistemológica nº 6; Lei 1, Lei 2; DF-02, DF-03, DF-05, DF-08; DF-09, DF-12, DF-13; R5 (RO-R5-001, *fora* da entidade); Art. 11º, Art. 14º; Lei 3; INV-02.
**Localização:** `packages/domain/src/operational-truth/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅.

---

## 0. Leitura prévia e fronteira de camadas (exigência do sprint)

**Natureza:** a Verdade Operacional é uma **síntese datada, imutável e única por missão** (E8; item 3). Não há estado mutável: "revisão" = **nova síntese** preservando as anteriores (E8-L04; INV-E8-03). Item 12: "possui **nada**; é síntese; aponta Estado/Etapa (08/09)". Nasce **por síntese** (E8) → verbo da fábrica = `synthesize`.

| Pertence à ENTIDADE | Event Store | Projeções | Casos de uso / R5 | Futuras APIs |
|---|---|---|---|---|
| identidade; vínculo a 1 Missão (Lei 2); datação (E8-L03); justificativa de cadeia demonstrável (INV-E8-02/L06); incerteza declarada opcional (INV-E8-07); responsável da síntese (INV-E8-06); evento-contrato `OperationalTruthSynthesized` | INV-VO-01 (unicidade da vigente) e INV-VO-04 (histórico perpétuo) | INV-VO-05 (agregações são métricas, não verdade — DF-03) | **R5**: 4 condições de legitimidade, execução da síntese, "Verdade construída/preservada", veiculação por Evento Relevante (E8-L08) | INV-VO-03 (nenhuma interface produz/altera — DF-08) — garantia CQRS |

**Dúvidas normativas → resolvidas por OMISSÃO conservadora:**
1. **Estado/Etapa (itens 12/18/22):** Entidades 08/09 **futuras**; a Verdade "aponta" para elas, mas a referência **não é modelada** (não antecipar). O conteúdo do "onde a missão está" pertence a ESTADO (08).
2. **Evento veicular (item 8/18; E8-L08):** a causação Evento Relevante→nova síntese é **R5 + Event Store** (regra operacional/workflow, proibidos aqui). Item 14 não lista evento. → **omitido**.
3. **INV-VO-01…05 não são predicados de instância única** — são sistêmicos. A entidade garante só **boa-formação estrutural**; registrado, não inventado.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `operational-truth-id.ts` (`OperationalTruthId`) | ✔ |
| Aggregate Root (previsto) | `operational-truth.ts` (`OperationalTruthAggregate extends AggregateRoot`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`ChainJustification`, `DeclaredUncertainty`) + `refs.ts` (`OperationalTruthMissionRef`, `SynthesisResponsibleRef`) | ✔ |
| Eventos como contratos | `operational-truth-events.ts` (`OperationalTruthSynthesized`) | ✔ |
| Manifesto de invariantes | `operational-truth-invariants.ts` (INV-VO-01..VO-05) | ✔ |
| Testes unitários + invariantes | `operational-truth.test.ts` (12 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `OperationalTruthId` (Identity única) | Síntese única e datada; individualização no histórico perpétuo (E8-L03; INV-E8-03) |
| `OperationalTruthMissionRef` obrigatória | Calculada por Missão (item 1; Lei 2; INV-VO-01) |
| `ChainJustification` (não-vazio, opaco) | Cadeia demonstrável / justificativa completa (INV-E8-02; E8-L06; itens 14/19) |
| `DeclaredUncertainty` OPCIONAL (não-vazio se presente) | Incerteza declarada quando existir; jamais preenchida artificialmente (INV-E8-07; E8-L05; item 14) |
| `SynthesisResponsibleRef` + `synthesizedAt` | Síntese referencia responsável/RO + datação (INV-E8-06; DF-09; DF-13; Art. 14º; E8-L03) |
| Fábrica `OperationalTruthAggregate.synthesize(...)` | A Verdade nasce por síntese (E8 — "COMO NASCE A VERDADE OPERACIONAL") |
| `OperationalTruthSynthesized` emitido | Marco da síntese — contrato vazio |
| Ausência de estado/"vigência" mutável | Cada síntese é imutável; revisão = nova síntese (E8-L04); unicidade da vigente é do event-store (INV-VO-01) |
| Ausência de conteúdo de Estado/Etapa | "Possui nada; é síntese" (item 12); ESTADO(08)/ETAPA(09) posteriores — não antecipar |
| Ausência de referência ao Evento veicular | E8-L08 é causação de R5/Event Store, não atributo da síntese |
| Ausência de agregação/KPI/métrica | INV-VO-05 (agregações são métricas derivadas, não verdade — DF-03) |
| Ausência de execução de síntese / 4 condições | R5 (RO-R5-001) — regra operacional, fora da entidade |
| Ausência de método `decide` | Item 16 ("jamais decidir"); E8-L07 (a Verdade torna decisões possíveis, não as cria) |
| Construtor privado + fábrica; sem mutadores | Nenhuma interface produz/altera (INV-VO-03; DF-08) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-VO-01..INV-VO-05)

O Canon (item 15) enumera **exatamente cinco**; nada além. **Achado:** nenhuma é predicado de instância única — todas são sistêmicas.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-VO-01 | Exatamente uma vigente por missão por instante | E8-L03 | event-store |
| INV-VO-02 | Fonte única no Sistema; jamais duas | Lei 1; DF-02 | cross-entity |
| INV-VO-03 | Nenhuma interface a produz/altera | DF-08 | cqrs |
| INV-VO-04 | Histórico perpétuo; nenhuma anterior apagada | INV-E8-03; Lei 3; DF-11 | event-store |
| INV-VO-05 | Agregações são métricas derivadas, não verdade | DF-03 | projection |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (boa-formação) | `VO-POR-MISSAO`, `VO-CADEIA-DEMONSTRAVEL`, `VO-RASTREABILIDADE`, `VO-INCERTEZA-DECLARADA` | Guardas descritivas na fábrica `synthesize` (não são INV-VO numeradas; derivam de E8/itens 1/14/19). Runtime: `VO-POR-MISSAO`, `VO-CADEIA-DEMONSTRAVEL`. |
| **event-store** | INV-VO-01, INV-VO-04 | Unicidade da vigente e histórico perpétuo append-only (Sprints 2+). |
| **cross-entity** | INV-VO-02 | Fonte única no Sistema inteiro (arquitetura/composição). |
| **cqrs** | INV-VO-03 | Interfaces só leem Read Models; jamais produzem/alteram Verdade (Sprints 2+). Entidade contribui por construtor privado + ausência de mutadores. |
| **projection** | INV-VO-05 | Métricas/KPIs são projeções derivadas, nunca a Verdade (Sprints 2+). |

**Nenhuma INV-VO-01..05 é de locus `entity`** — confirmado por teste (`enforcement !== 'entity'` para todas). A entidade enforça apenas boa-formação estrutural.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** (MISSÃO referenciada só por `OperationalTruthMissionRef` nominal). `import type` já aplicado nos imports type-only (padrão de lint vigente).
- **Sem R5/Event Store/projeção:** as quatro condições de legitimidade, a unicidade da vigente e as métricas estão **mapeadas** aos loci, não simuladas.
- **Testes (12):** síntese plena com e sem incerteza (emite `OperationalTruthSynthesized`); negativos a `VO-POR-MISSAO`, `VO-CADEIA-DEMONSTRAVEL`, `VO-INCERTEZA-DECLARADA` (incerteza vazia), `VO-RASTREABILIDADE` (responsável ausente, datação inválida); igualdade por identidade; teste estrutural de ausência de `state/estado/isCurrent/vigente/current/stage/etapa/decide/decision/aggregate/metric/kpi/recalculate`; engine de invariantes; completude do manifesto (5 ids) + prova de que nenhuma é locus `entity`.
- **`@ts-expect-error`** em Missão e responsável ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0 erros) · `pnpm test` (**7 arquivos, 73 testes, todos passam**; 12 novos desta entidade).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 5 invariantes são exatamente as do item 15; as guardas `VO-*` derivam de E8/itens 1/14/19 (boa-formação e rastreabilidade já no Canon). R5, veiculação por evento e Estado/Etapa foram deixados aos seus loci, não inventados nem antecipados.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável da síntese e leitura; sem execução de R5, sem estado, sem decisão, sem agregação.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes sistêmicas mapeadas aos loci, sem simulação; Estado/Etapa (08/09) pendentes conforme o próprio Canon.

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **Verbo `synthesize` (não `recognize`):** fidelidade a E8 — a Verdade **nasce por síntese**, não é reconhecida como fato preexistente. A fábrica materializa o **resultado** de uma síntese já feita conforme R5; **não** executa R5 nem avalia legitimidade.
- **INV-VO-01..05 sistêmicas:** diferentemente das entidades 01–06 (que tinham ao menos uma invariante de nível de entidade), aqui **nenhuma** das cinco é predicado de instância — é da natureza de "fonte única". O array de runtime usa guardas de boa-formação com ids descritivos; documentado e testado.
- **Estado/Etapa e Evento veicular omitidos** (ver seção 0), pendentes das Entidades 08/09 e de R5/Event Store.

---

## 8. Veredito final

**Entidade 07 — VERDADE OPERACIONAL implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando sua natureza de síntese datada, imutável e única por missão, com cadeia demonstrável e incerteza declarada, sem estado operacional, sem execução de R5, sem conteúdo de Estado/Etapa, sem agregação e sem produção por interface. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, projeção ou regra operacional foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 08 sem autorização explícita.**
