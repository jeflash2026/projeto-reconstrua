# ADVOGADO — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 17 — ADVOGADO** · Sprint 1Q · Data: 2026-07-14
**Fontes congeladas:** Entidade 17 (Volume 01, itens 1–24); DF-06, DF-09, DF-10, DF-12, DF-24; Art. 10º, 12º, 14º; R7 (contexto — não execução); Lei Geral; PROCESSO (06), CASO (05), MISSÃO (01), PESSOA (02); E8 (Verdade); INV-EO-02/04 (Estado).
**Localização:** `packages/domain/src/advogado/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (17 arquivos, 175 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** papel **humano** titular da **decisão jurídica definitiva** e dos **atos privativos da advocacia** (DF-10; DF-09). Representa a **designação** de uma Pessoa como advogado de uma missão + a titularidade da competência jurídica privativa — **não** a execução das decisões. Verbo = `designate`. Finalidade: prover a competência jurídica definitiva da missão.

**Separação formal (17 × 16 × 15 × 14 × 18 × 06 × 05):** decisão-jurídica (Advogado) × prova-técnica (Perito) × condução (Operador) × automação assistiva (AHRI) × supervisão (Supervisor) — competências disjuntas; e os **papéis são QUEM**, PROCESSO(06)/CASO(05) são **O QUÊ** (instrumento/contexto). Sem sobreposição.

**ADVOGADO × AHRI:** a AHRI jamais pratica advocacia (DF-09; INV-AH-03; INV-AD-02) nem decide juridicamente (DF-09; item 17; INV-AH-01; INV-AD-01); toda decisão jurídica é exclusivamente humana (DF-09). **Estruturalmente:** a AHRI(14) não tem método de decisão/assinatura/ato privativo (ausência — INV-AH-01/03/04, testada) e o Advogado é titular exclusivo (INV-AD-01/02, cross-entity).
**ADVOGADO × PERITO:** parecer jurídico (privativo de advocacia) ≠ laudo técnico (privativo de perícia); laudo é insumo/evidência, decisão é ato decisório; um jamais substitui o outro (INV-AD-01/02 × INV-PT-01; item 4 de ambos).
**ADVOGADO × PROCESSO:** o Processo é instrumento; o Advogado atua sobre ele (item 18); o Processo não é o Advogado.
**ADVOGADO × CASO:** o Caso é contexto; o Advogado decide sobre ele (item 18); o Caso não é o Advogado.
**ADVOGADO × MISSÃO:** o Advogado jamais possui a Missão (item 13; INV-AD-03); a Missão pertence ao Projeto (Art. 8º; Lei Geral; beneficiária é a Pessoa — DF-20).

**Perguntas obrigatórias:** decide juridicamente? **SIM** (competência exclusiva — INV-AD-01; a entidade representa a titularidade) · pratica atos privativos? **SIM** (de advocacia — INV-AD-02) · AHRI o substitui? **NÃO** · Operador o substitui? **NÃO** · Perito o substitui? **NÃO** · Supervisor o substitui? **NÃO** · cria Verdade? **NÃO** · altera diretamente o Estado? **NÃO** (Estado deriva da Verdade via R6 — INV-EO-02/04) · sobreposição? **NÃO** · circularidade? **NÃO** · decisão fora do Canon? **NÃO**.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `advogado-id.ts` (`AdvogadoId`) | ✔ |
| Aggregate Root (previsto) | `advogado.ts` (`AdvogadoAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`AdvogadoPersonRef`, `AdvogadoMissionRef`, `AdvogadoAuthorityRef`) — ver §7 | ✔ |
| Eventos como contratos | `advogado-events.ts` (`AdvogadoDesignated`) | ✔ |
| Manifesto de invariantes | `advogado-invariants.ts` (INV-AD-01..AD-03) | ✔ |
| Testes unitários + invariantes | `advogado.test.ts` (10 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `AdvogadoId` (Identity única) | Individualização da designação (Entidade 17) |
| `AdvogadoPersonRef` obrigatória | "O Advogado é o profissional…" (item 1) |
| `AdvogadoMissionRef` obrigatória | Atua sobre a Missão (item 11/18; INV-AD-03) |
| `AdvogadoAuthorityRef` obrigatória | Designação pela Governança (item 7/8; DF-12) |
| `designatedAt` (Date válida) | Temporalidade/rastreabilidade (Art. 12º/14º) |
| Fábrica `AdvogadoAggregate.designate(...)` | "Designação/autorização" (item 7; DF-12) |
| `AdvogadoDesignated` emitido | Marco da designação — contrato vazio |
| **Ausência** de execução de decisão/assinatura | Ato humano do advogado (item 12/16); a entidade não executa |
| **Ausência** de `produceProof/executePericia` | Item 4 (não é perito) |
| **Ausência** de `conductOperation` | Item 4 (não é operador) |
| **Ausência** de `createTruth` | A Verdade nasce do Conhecimento (E8) |
| **Ausência** de `alterState` | O Estado deriva da Verdade via R6 (INV-EO-02/04) |
| **Ausência** de `titularity/ownMission` | Item 13; INV-AD-03 (a missão é do Projeto) |
| Ausência de refs a PROCESSO/CASO | Atuação → OPERAÇÃO/R7 (recomendação R1) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-AD-01..INV-AD-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-AD-01 | Decisão jurídica definitiva só do Advogado | DF-09 | cross-entity |
| INV-AD-02 | Atos privativos de advocacia só por ele | DF-09 | cross-entity |
| INV-AD-03 | Responsabilidade temporária; missão do Projeto | Lei Geral | **entity** |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **cross-entity** | INV-AD-01, INV-AD-02 | Exclusividade sistêmica: a AHRI (INV-AH-01/03), operador, perito e supervisor jamais decidem juridicamente/assinam/praticam advocacia; o Advogado é o titular legítimo. |
| **entity** (aqui) | INV-AD-03 | Runtime: Pessoa + Missão referenciadas, não possuídas (temporário; missão do Projeto). Reforçada por ausência estrutural de titularidade. |

Guardas não numeradas: `AD-PESSOA` (item 1), `AD-AUTORIZADO` (DF-12), `AD-DATADO` (Art. 14º). Confirmado por teste que **INV-AD-01/02 são cross-entity e INV-AD-03 é entity**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Pessoa(02)/Missão(01)/autoridade referenciadas só por `Uuid` nominal; **nenhuma referência a PROCESSO/CASO nem a outros papéis** (R1 → sem lógica operacional; DAG). `import type` aplicado nos type-only.
- **Sem execução de decisão/operacional:** decisões jurídicas, assinatura e condução de processos ficam fora (ato humano / OPERAÇÃO/R7).
- **Testes (10):** designação com emissão de `AdvogadoDesignated`; negativos a `AD-PESSOA`, `INV-AD-03`, `AD-AUTORIZADO`, `AD-DATADO`; igualdade por identidade; teste estrutural de ausência de `conductOperation/conducaoDiaria/produceProof/produzirProva/executePericia/alterState/alterarEstado/alterTruth/createTruth/createFact/titularity/titularidade/ownMission`; engine de invariantes; completude do manifesto (3 ids) + prova dos loci.
- **`@ts-expect-error`** em Pessoa, Missão e autoridade ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**17 arquivos, 175 testes**; 10 novos).

---

## 6. Respostas obrigatórias

- **Decisão criada fora do Canon?** **NÃO.**
- **Regra inventada?** **NÃO.** As 3 invariantes são as do item 15; guardas `AD-*` derivam de itens 1/7/13 e Art. 14º. Execução, atuação sobre Processo/Caso e transição deixadas fora.
- **Comportamento implícito?** **NÃO.** Só materialização imutável da designação; nenhuma decisão, assinatura, perícia, condução, criação de verdade ou alteração de estado.
- **Dependência de infraestrutura?** **NÃO.**
- **Sobreposição de responsabilidade?** **NÃO.** Decidir (Advogado) × produzir prova (Perito) × conduzir (Operador) × automatizar (AHRI) × supervisionar (Supervisor); instrumento (Processo) × contexto (Caso) — planos disjuntos.
- **Circularidade?** **NÃO.** `Pessoa/Missão → Advogado`; sem refs a Processo/Caso/papéis; nada o referencia de volta → DAG; zero import.
- **Integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência; "SIM" também para a titularidade exclusiva da decisão jurídica e da advocacia ao Advogado) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO decide nem assina:** a decisão jurídica definitiva e a assinatura são atos HUMANOS do advogado (competência privativa; item 12/16). A entidade representa a **designação** e a **titularidade**.
- **Refs a PROCESSO/CASO omitidas** (recomendação R1): "conduz Processos; decide sobre Casos" (item 18) é **atuação**, não dependência existencial (item 11 = autorização + missão); pertence à OPERAÇÃO/R7. A relação foi **explicada** na análise, sem virar lógica operacional na entidade.
- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas/relações, não um valor escalar; os VOs mínimos são as referências.
- **Transição (INV-AD-03/Art. 12º) → use-case.**

---

## 8. Veredito final

**Entidade 17 — ADVOGADO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a designação de uma Pessoa como advogado, titular exclusivo da decisão jurídica definitiva e dos atos privativos da advocacia, que **jamais** é substituído pela IA, faz perícia, conduz a operação, cria Verdade, altera diretamente o Estado ou detém titularidade. As separações com PERITO/OPERADOR/AHRI/SUPERVISOR/PROCESSO/CASO/MISSÃO foram demonstradas sem sobreposição nem circularidade; a linha decisão-jurídica-humana × IA é garantida estruturalmente (ausência na AHRI + exclusividade no Advogado). Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, comportamento operacional, workflow ou antecipação das Entidades 18–19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 18 sem autorização explícita.**
