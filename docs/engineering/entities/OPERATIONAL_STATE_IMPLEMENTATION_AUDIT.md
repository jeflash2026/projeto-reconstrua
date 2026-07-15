# OPERATIONAL STATE — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 08 — ESTADO OPERACIONAL** · Sprint 1H (Núcleo Cognitivo) · Data: 2026-07-13
**Fontes congeladas:** Entidade 08 (Volume 01, itens 1–24 + Estados Terminais Oficiais); Entidade 07; E8; E12; DF-05, DF-08, DF-11; DF-03; Lei 1, Lei 2; INV-01, INV-02 (MISSÃO); R5, R6 (RO-R6-001, *fora* da entidade); Art. 14º.
**Localização:** `packages/domain/src/operational-state/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (8 arquivos, 85 testes).

---

## 0. Análise prévia (exigência do sprint)

**Natureza ontológica:** situação vigente da missão — "onde a missão está" — **DERIVADA EXCLUSIVAMENTE da Verdade Operacional** (INV-EO-02/INV-02/DF-08). Não é síntese; não é fonte autônoma (item 16); muda só por evolução (R6) via Evento Relevante; jamais alterada por interface (INV-EO-04). Dois estados terminais Canon: **CONCLUÍDA, ENCERRADA** (DF-11). Verbo da fábrica = `derive`.

**Distinção rigorosa da tríade:**

| | Natureza | Origem | Papel |
|---|---|---|---|
| **Verdade Operacional (07)** | Síntese datada | nasce do Conhecimento (E8) | melhor representação da realidade, por missão |
| **Estado Operacional (08)** | Situação derivada | deriva exclusivamente da Verdade (INV-EO-02) | "onde a missão está" |
| **Etapa Operacional (09)** | Representação visual | deriva do Estado, 1:1 (INV-ET-01) | a face apresentável do estado |

Cadeia: `Conhecimento → Verdade(07) → Estado(08) → Etapa(09)`.

**Invariantes — a quem pertencem:**

| Invariante | Pertence a | Locus |
|---|---|---|
| INV-EO-02 (deriva só da Verdade) | **exclusivamente ao Estado** | entity |
| INV-EO-01 (um por missão/instante) | Estado (parcial) + unicidade sistêmica | event-store |
| INV-EO-03 (muda só por Evento Relevante) | R6 / caso de uso | use-case |
| INV-EO-04 (jamais por interface) | arquitetura CQRS | cqrs |
| INV-VO-01..05 | **exclusivamente à Verdade (07)** | — |
| histórico perpétuo dos estados | Event Store | event-store |
| métricas/painéis derivados | Projeções (DF-03) | projection |

**Verificação de circularidade `Missão → Evento → Verdade → Estado → Etapa`:** DAG estrito.
- Evento Relevante **causa** (via R5) nova Verdade; a Verdade nasce do Conhecimento (E8-L01), **nunca** do Estado.
- Estado **deriva** da Verdade; **nunca** produz Verdade nem Evento (item 16; R6-L02).
- Etapa **representa** o Estado (Etapa→Estado); o Estado **não** referencia a Etapa.
- **Nenhuma aresta de retorno → NENHUM ciclo lógico.** No código, referências só por `Uuid` nominal → zero ciclo de import. **Resultado: sem ciclo; implementação autorizada e realizada.**

**Dúvidas resolvidas por omissão conservadora:** Etapa(09) e rótulos de estados **não terminais** ("nascida/em evolução/bloqueada" = *dados operacionais, não Canon*) **não** modelados; **responsável direto não modelado** (item 14 não o lista — a proveniência é `DerivedFromTruthRef` + `derivedAt`).

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `operational-state-id.ts` (`OperationalStateId`) | ✔ |
| Aggregate Root (previsto) | `operational-state.ts` (`OperationalStateAggregate`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`TerminalState`) + `refs.ts` (`OperationalStateMissionRef`, `DerivedFromTruthRef`) | ✔ |
| Eventos como contratos | `operational-state-events.ts` (`OperationalStateDerived`) | ✔ |
| Manifesto de invariantes | `operational-state-invariants.ts` (INV-EO-01..EO-04) | ✔ |
| Testes unitários + invariantes | `operational-state.test.ts` (12 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `OperationalStateId` (Identity única) | Individualização do estado derivado (Entidade 08) |
| `OperationalStateMissionRef` obrigatória | Pertence a uma Missão (item 22; Lei 2; INV-EO-01) |
| `DerivedFromTruthRef` obrigatória e exclusiva | Deriva exclusivamente da Verdade (item 11; INV-EO-02; INV-02; DF-08) |
| `TerminalState` = {CONCLUIDA, ENCERRADA} (fechado) | Estados terminais oficiais; não há terceiro (Entidade 08 — Estados Terminais; DF-11) |
| `terminalState` OPCIONAL (null = em curso) | Terminalidade "quando encerrado" (item 14); não terminais = dados operacionais, não Canon |
| `derivedAt` (Date válida) | Unicidade por instante (item 14); datação (Art. 14º) |
| Fábrica `OperationalStateAggregate.derive(...)` | "Deriva automaticamente da Verdade" (item 7) |
| `OperationalStateDerived` emitido | Marco da derivação — contrato vazio |
| Ausência de fonte autônoma / conteúdo próprio de estado | "Jamais fonte autônoma" (item 16); "possui nada; é situação" (item 12) |
| Ausência de recálculo / mutadores / alteração por interface | INV-EO-04 (jamais alterado por interface; DF-08); INV-EO-03 (muda só por R6); DF-03/Lei 1 (sem dashboard) |
| Ausência de representação visual (Etapa) | Item 4 (não é a Etapa); Etapa é 09, posterior; Etapa→Estado, não o contrário |
| Ausência de execução de R5/R6 | Regras operacionais — fora da entidade |
| Ausência de método `decide` | Entidade 08 é situação, não decisão |
| Construtor privado + fábrica | INV-EO-04 (não produzida por interface) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-EO-01..INV-EO-04)

O Canon (item 15) enumera **exatamente quatro**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-EO-01 | Exatamente um por missão por instante | Lei 2 | event-store |
| INV-EO-02 | Deriva exclusivamente da Verdade | INV-02; DF-08 | **entity** |
| INV-EO-03 | Muda só por evolução (R6), via Evento Relevante | DF-05; DF-14 | use-case |
| INV-EO-04 | Jamais alterado por interface; sem recálculo | DF-08; DF-03; Lei 1 | cqrs |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-EO-02 (+ parcial de INV-EO-01) | `derive` exige a Verdade de origem (fonte exclusiva) e a Missão; runtime `INV-EO-02` + `EO-POR-MISSAO`. Sem fonte autônoma (estrutural). |
| **event-store** | INV-EO-01 | Unicidade do estado vigente por missão/instante + histórico (Sprints 2+). |
| **use-case** | INV-EO-03 | A mudança de estado transita por R6/Evolução via Evento Relevante (Sprints 2+). |
| **cqrs** | INV-EO-04 | Interfaces só leem; nenhuma altera/recalcula o Estado. Entidade contribui com construtor privado + ausência de mutadores. |

Runtime como `Invariant<OperationalStateAggregate>`: **INV-EO-02** (genuína de instância) + `EO-POR-MISSAO`. Guardas de boa-formação não numeradas: `EO-DATADO`, `EO-ESTADO-TERMINAL` (conjunto fechado). Confirmado por teste que **apenas INV-EO-02 é locus `entity`**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Missão(01) e Verdade(07) referenciadas só por `Uuid` nominal (zero import → zero ciclo). `import type` já aplicado nos type-only.
- **Sem R5/R6/Event Store/projeção/CQRS:** todas as invariantes não-entidade **mapeadas** aos loci, não simuladas.
- **Testes (12):** derivação em curso e terminal (CONCLUÍDA/ENCERRADA), com emissão de `OperationalStateDerived`; negativos a `EO-ESTADO-TERMINAL` (terceiro terminal), `INV-EO-02` (sem Verdade), `EO-POR-MISSAO` (sem Missão), `EO-DATADO` (datação inválida); igualdade por identidade; teste estrutural de ausência de `recalculate/setState/alterState/mutate/visual/representation/etapa/stage/dashboard/decide/truth`; engine de invariantes; completude do manifesto (4 ids) + prova de que só INV-EO-02 é `entity`.
- **`@ts-expect-error`** em Verdade e Missão ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0 erros) · `pnpm test` (**8 arquivos, 85 testes, todos passam**; 12 novos desta entidade).

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As 4 invariantes são exatamente as do item 15; os estados terminais são os dois do DF-11; guardas `EO-*` derivam de itens 14/22 e Art. 14º. R5/R6, Etapa e histórico foram deixados aos seus loci.
- **Existe algum comportamento implícito?** **NÃO.** Só materialização imutável da derivação e leitura; sem recálculo, sem fonte autônoma, sem evolução, sem decisão.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes não-entidade mapeadas; Etapa(09) pendente conforme o próprio Canon.

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **Verbo `derive` (não `recognize`/`synthesize`):** fidelidade ao item 7 — o Estado deriva automaticamente da Verdade. A fábrica materializa o resultado da derivação; **não** executa R5/R6.
- **Estados não terminais não enumerados:** o Canon os declara "dados operacionais, não Canon" — a ausência de terminalidade (`terminalState = null`) os representa; só os dois terminais oficiais são modelados (conjunto fechado).
- **Responsável direto omitido:** item 14 não o lista; a proveniência é a Verdade de origem + datação.
- **Etapa(09) e evolução (R6) omitidas** por pertencerem a entidade posterior / caso de uso.

---

## 8. Veredito final

**Entidade 08 — ESTADO OPERACIONAL implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando sua natureza de situação derivada exclusivamente da Verdade, única por missão, com terminalidade oficial (CONCLUÍDA/ENCERRADA), sem fonte autônoma, sem recálculo, sem alteração por interface, sem execução de R5/R6 e sem representação visual (Etapa). A cadeia `Missão→Evento→Verdade→Estado→Etapa` foi verificada como DAG sem ciclo. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, projeção, CQRS ou regra operacional foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 09 sem autorização explícita.**
