# SUPERVISOR — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 18 — SUPERVISOR** · Sprint 1R · Data: 2026-07-14
**Fontes congeladas:** Entidade 18 (Volume 01, itens 1–24); DF-06, DF-09, DF-12, DF-24; Art. 10º, 12º, 14º; R7 (supervisão — contexto, não execução); Lei 4; Lei Geral; MISSÃO (01), PESSOA (02), papéis 14–17; E8 (Verdade), INV-EO-02/04 (Estado).
**Localização:** `packages/domain/src/supervisor/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (18 arquivos, 185 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** papel **humano** de **supervisão da atuação** sobre as missões — quem zela pela **conformidade** (Art. 10º; R7). Representa a **designação** de uma Pessoa como supervisor de uma missão + a responsabilidade temporária de supervisão — **não** a execução da supervisão. Verbo = `designate`. Finalidade: assegurar que a atuação obedeça ao Canon (item 5; R7; Lei 4).

**Separação formal (18 × 17 × 15 × 14 × 16 × 11):** o Supervisor é **meta-atividade** (verifica conformidade); ADVOGADO *decide* × OPERADOR *conduz* × AHRI *automatiza* × PERITO *produz prova* × OPERAÇÃO é o *agir*. O Supervisor **não executa nenhuma** dessas — fiscalizar ≠ executar/conduzir/decidir/produzir. Sem sobreposição.

**SUPERVISOR × AHRI:** supervisionar não é executar (meta × execução); não é decidir (item 17); a AHRI continua assistiva (INV-AH-01); o Supervisor não a substitui (item 22 — supervisiona, não substitui).
**SUPERVISOR × OPERADOR:** supervisionar não é conduzir; conduzir não é supervisionar (papéis próprios; R7/DF-10).
**SUPERVISOR × ADVOGADO:** supervisionar não é decidir juridicamente (item 17; INV-AD-01); jamais pratica advocacia (item 4/13; INV-SU-01; INV-AD-02).
**SUPERVISOR × PERITO:** supervisionar não é produzir prova técnica (item 4; INV-PT-01; INV-SU-01).

**Perguntas obrigatórias:** decide juridicamente? **NÃO** · pratica atos privativos? **NÃO** · conduz operacionalmente? **NÃO** · produz prova técnica? **NÃO** · cria Verdade? **NÃO** · altera diretamente o Estado? **NÃO** · substitui AHRI/Operador/Advogado/Perito? **NÃO** · sobreposição? **NÃO** · circularidade? **NÃO** · decisão fora do Canon? **NÃO**.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `supervisor-id.ts` (`SupervisorId`) | ✔ |
| Aggregate Root (previsto) | `supervisor.ts` (`SupervisorAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`SupervisorPersonRef`, `SupervisorMissionRef`, `SupervisorAuthorityRef`) — ver §7 | ✔ |
| Eventos como contratos | `supervisor-events.ts` (`SupervisorDesignated`) | ✔ |
| Manifesto de invariantes | `supervisor-invariants.ts` (INV-SU-01..SU-03) | ✔ |
| Testes unitários + invariantes | `supervisor.test.ts` (10 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `SupervisorId` (Identity única) | Individualização da designação (Entidade 18) |
| `SupervisorPersonRef` obrigatória | Papel humano (item 2) |
| `SupervisorMissionRef` obrigatória | Supervisiona na Missão (item 18; INV-SU-02) |
| `SupervisorAuthorityRef` obrigatória | Designação pela Governança (item 7/8/11; DF-12) |
| `designatedAt` (Date válida) | Temporalidade/rastreabilidade (Art. 12º/14º) |
| Fábrica `SupervisorAggregate.designate(...)` | "Designação/autorização" (item 7; DF-12) |
| `SupervisorDesignated` emitido | Marco da designação — contrato vazio |
| **Ausência** de ato privativo/advocacia/perícia | INV-SU-01; item 4/13 (não substitui competências privativas) |
| **Ausência** de `decideJuridical` | Item 17 (não decide juridicamente; DF-09) |
| **Ausência** de `conductOperation` | Não é operador (supervisiona, não conduz) |
| **Ausência** de `produceProof` | Não é perito |
| **Ausência** de `createTruth`/`alterState` | Não cria Verdade (E8); não altera Estado (INV-EO-02/04) |
| **Ausência** de `titularity/ownMission` | Item 13; INV-SU-02 (a missão é do Projeto) |
| Ausência de refs a papéis 14–17 | Supervisão → OPERAÇÃO/R7 (recomendação R1) |
| Ausência de critérios de supervisão | INV-SU-03 → Governança (DF-12; item 24) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-SU-01..INV-SU-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-SU-01 | Supervisão não cria ato privativo; não decide juridicamente | DF-09 | **entity** (estrutural) |
| INV-SU-02 | Responsabilidade temporária; missão do Projeto | Lei Geral | **entity** |
| INV-SU-03 | Critérios completos de supervisão na Governança | DF-12 | use-case |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-SU-01, INV-SU-02 | INV-SU-01 **estrutural** — ausência de método de ato privativo/decisão/condução/produção (comprovada por teste). INV-SU-02 — runtime: Pessoa + Missão referenciadas, não possuídas. |
| **use-case** | INV-SU-03 | Os critérios completos de supervisão são definidos na Governança (DF-12; item 24), fora desta entidade. |

Guardas não numeradas: `SU-PESSOA` (item 2), `SU-AUTORIZADO` (DF-12), `SU-DATADO` (Art. 14º). Confirmado por teste que **INV-SU-01/02 são entity e INV-SU-03 é use-case**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Pessoa(02)/Missão(01)/autoridade referenciadas só por `Uuid` nominal; **nenhuma referência aos papéis 14–17** (R1 → sem lógica operacional; elimina o maior fan-out do bloco; DAG). `import type` aplicado nos type-only.
- **Sem execução da supervisão / sem critérios:** a verificação de conformidade (R7) e os critérios (Governança/DF-12) ficam fora.
- **Testes (10):** designação com emissão de `SupervisorDesignated`; negativos a `SU-PESSOA`, `INV-SU-02`, `SU-AUTORIZADO`, `SU-DATADO`; igualdade por identidade; teste estrutural de ausência de `privativeAct/atoPrivativo/decideJuridical/advocacy/advocacia/produceProof/produzirProva/executePericia/conductOperation/conducaoDiaria/alterState/createTruth/titularity/titularidade/ownMission`; engine de invariantes; completude do manifesto (3 ids) + prova dos loci.
- **`@ts-expect-error`** em Pessoa, Missão e autoridade ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**18 arquivos, 185 testes**; 10 novos).

---

## 6. Respostas obrigatórias

- **Decisão criada fora do Canon?** **NÃO.**
- **Regra inventada?** **NÃO.** As 3 invariantes são as do item 15; guardas `SU-*` derivam de itens 2/7/13 e Art. 14º. Execução, supervisão dos papéis e critérios (Governança) deixados fora.
- **Comportamento implícito?** **NÃO.** Só materialização imutável da designação; nenhuma supervisão, ato privativo, decisão, condução, prova, criação de verdade ou alteração de estado.
- **Dependência de infraestrutura?** **NÃO.**
- **Sobreposição de responsabilidade?** **NÃO.** Supervisionar (meta) × decidir (Advogado) × conduzir (Operador) × automatizar (AHRI) × produzir prova (Perito) × agir (Operação) — planos disjuntos.
- **Circularidade?** **NÃO.** `Pessoa/Missão → Supervisor`; sem refs a papéis 14–17; nada o referencia de volta → DAG; zero import.
- **Integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO executa a supervisão:** verificar conformidade e acionar correções (R7) são atos operacionais, fora daqui. A entidade representa a **designação** do supervisor.
- **Refs aos papéis 14–17 omitidas** (recomendação R1): "supervisiona OPERADOR/PERITO/ADVOGADO/AHRI" (item 18) é atuação/interação → OPERAÇÃO/R7; era o maior fan-out do bloco — omiti-lo elimina a mutualidade nominal e mantém o DAG.
- **Critérios de supervisão fora** (INV-SU-03): o próprio Canon (item 24; DF-12) os remete à Governança — não são modelados na entidade.
- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas, não um valor escalar; os VOs mínimos são as referências.
- **Transição (Art. 12º) → use-case.**

---

## 8. Veredito final

**Entidade 18 — SUPERVISOR implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a designação de uma Pessoa como supervisor de uma missão, cuja função é zelar pela conformidade da atuação, e que **jamais** pratica ato privativo, decide juridicamente, conduz a operação, produz prova técnica, cria Verdade, altera diretamente o Estado, detém titularidade ou substitui qualquer outro papel. As separações com ADVOGADO/OPERADOR/AHRI/PERITO/OPERAÇÃO foram demonstradas sem sobreposição nem circularidade. Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, comportamento operacional, workflow, critério de supervisão ou antecipação da Entidade 19 foi implementada. Validação dinâmica integral aprovada. **Não prosseguir à Entidade 19 sem autorização explícita.**
