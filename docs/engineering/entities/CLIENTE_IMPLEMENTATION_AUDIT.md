# CLIENTE — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 19 — CLIENTE** · Sprint 1S (encerra as 19 entidades) · Data: 2026-07-14
**Fontes congeladas:** Entidade 19 (Volume 01, itens 1–24); DF-06, DF-23, DF-24; Entidade 02 — PESSOA (distinção; INV-P02; Identidade Civil); Art. 5º, 6º, 14º; DF-11, DF-12; R2 (reconhecimento da Pessoa); MISSÃO (01).
**Localização:** `packages/domain/src/cliente/`
**Padrão:** oficial (CONVENTIONS.md §10). Dinâmica: typecheck ✅ · lint ✅ · test ✅ (19 arquivos, 194 testes).

---

## 0. Análise normativa prévia (exigência do sprint)

**Natureza ontológica:** a **condição** contratual/comercial que uma Pessoa assume perante o Projeto — **entidade distinta de PESSOA** (item 1). Representa o **vínculo cliente-Projeto**, subordinado à **dignidade** da Pessoa (Art. 6º) — a existência da condição, não a pessoa. Verbo = `recognize` (item 7). Finalidade: nomear a relação de serviço sem reduzir a Pessoa a registro (Art. 5º/6º).

**Separação formal (19 × 02 × 01 × 15 × 17 × 16 × 14):** quatro categorias ontológicas distintas — **condição** (Cliente) × **indivíduo** (Pessoa) × **unidade** (Missão) × **atores/papéis** (14–18). O Cliente **não atua**; é condição de uma Pessoa.

**CLIENTE × PESSOA:** Cliente ≠ Pessoa (item 4); a Pessoa existe sem ser Cliente (item 4); torna-se Cliente quando, a partir de uma Pessoa já reconhecida, assume a relação de serviço, reconhecida por responsável (item 7/20; R2; DF-23) — sem virar outra pessoa (INV-CL-02/03).
**CLIENTE × MISSÃO:** não possui a Missão (item 13); a Missão é do Projeto (DF-20; Art. 8º); relaciona-se via a Pessoa (item 18).
**CLIENTE × PAPÉIS:** jamais substitui Operador/Advogado/Perito/Supervisor/AHRI — é condição, não papel de atuação.

**Perguntas obrigatórias:** decide juridicamente? **NÃO** · conduz operacionalmente? **NÃO** · pratica atos privativos? **NÃO** · produz prova técnica? **NÃO** · cria Verdade? **NÃO** · altera Estado? **NÃO** · substitui qualquer papel? **NÃO** · sobreposição? **NÃO** · circularidade? **NÃO** · decisão fora do Canon? **NÃO**.

Nenhuma resposta exige alteração do Canon → implementação autorizada e realizada.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `cliente-id.ts` (`ClienteId`) | ✔ |
| Aggregate Root (previsto) | `cliente.ts` (`ClienteAggregate`) | ✔ |
| Value Objects mínimos | `refs.ts` (`ClientePersonRef`, `ClienteRecognitionResponsibleRef`) — ver §7 | ✔ |
| Eventos como contratos | `cliente-events.ts` (`ClienteRecognized`) | ✔ |
| Manifesto de invariantes | `cliente-invariants.ts` (INV-CL-01..CL-03) | ✔ |
| Testes unitários + invariantes | `cliente.test.ts` (9 testes) | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `ClienteId` (Identity da condição) | Individualização da condição (item 1) — distinta da identidade da Pessoa |
| `ClientePersonRef` obrigatória e exclusiva | Condição de uma Pessoa reconhecida (item 11; INV-CL-01; DF-23) |
| `ClienteRecognitionResponsibleRef` obrigatória | Reconhecida por responsável autorizado (item 7/8; DF-12; Art. 14º) |
| `recognizedAt` (Date válida) | Rastreabilidade (item 8; Art. 14º) |
| Fábrica `ClienteAggregate.recognize(...)` | "Reconhecida a partir de uma Pessoa já reconhecida" (item 7) |
| `ClienteRecognized` emitido | Marco do reconhecimento da condição — contrato vazio |
| **Ausência** de `createPerson/duplicatePerson` | INV-CL-02 (jamais cria segunda Pessoa; INV-P02) |
| **Ausência** de `alterCivilIdentity` | INV-CL-03 (não altera a identidade civil) |
| **Ausência** de `alterState/createTruth` | Item 13 (não possui Estado/Verdade da Missão) |
| **Ausência** de `decideJuridical/conductOperation/produceProof` | Item 3/4 (é condição, não papel de atuação) |
| **Ausência** de `ownPerson/ownMission` | Item 12/13 (jamais possui a Pessoa nem a Missão) |
| Ausência de ref a MISSÃO / relação de serviço | Item 18/12 (transitivo via a Pessoa / operacional) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-CL-01..INV-CL-03)

O Canon (item 15) enumera **exatamente três**; nada além.

| ID | Descrição resumida | Ref. Canon | Locus |
|---|---|---|---|
| INV-CL-01 | Todo cliente é uma Pessoa reconhecida | Entidade 02; DF-23 | **entity** |
| INV-CL-02 | Jamais cria uma segunda Pessoa | INV-P02 | **entity** (estrutural) |
| INV-CL-03 | A condição não altera a identidade civil | Entidade 02 | **entity** (estrutural) |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-CL-01, INV-CL-02, INV-CL-03 | INV-CL-01: `recognize` exige a Pessoa (referência obrigatória). INV-CL-02/03: **estruturais** — ausência de qualquer método de criação/duplicação de Pessoa ou alteração de identidade civil (comprovada por teste). |

Guardas não numeradas: `CL-RASTREAVEL` (responsável + datação — item 7/8; Art. 14º). Confirmado por teste que **as três INV-CL são locus `entity`**.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** — Pessoa(02)/responsável referenciados só por `Uuid` nominal (zero import → zero ciclo). `import type` aplicado nos type-only.
- **Sem lógica operacional:** relação de serviço em curso e referência a missões ficam fora.
- **Testes (9):** reconhecimento com emissão de `ClienteRecognized`; negativos a `INV-CL-01` (sem Pessoa), `CL-RASTREAVEL` (sem responsável, datação inválida); igualdade por identidade; teste estrutural de ausência de `createPerson/criarPessoa/duplicatePerson/alterCivilIdentity/alterarIdentidade/alterState/createTruth/decideJuridical/conductOperation/produceProof/ownPerson/ownMission`; engine de invariantes; completude do manifesto (3 ids) + prova de que as três são `entity`.
- **`@ts-expect-error`** em Pessoa e responsável ausentes comprova exigência pelo **tipo**.
- **Dinâmica:** `pnpm typecheck` (12/12) · `pnpm lint` (0) · `pnpm test` (**19 arquivos, 194 testes**; 9 novos).

---

## 6. Respostas obrigatórias

- **Decisão criada fora do Canon?** **NÃO.**
- **Regra inventada?** **NÃO.** As 3 invariantes são as do item 15; a guarda `CL-RASTREAVEL` deriva do item 7/8 e Art. 14º. Relação de serviço, missões e encerramento deixados fora.
- **Comportamento implícito?** **NÃO.** Só materialização imutável da condição; nenhuma criação/alteração de Pessoa, decisão, condução, prova ou posse.
- **Dependência de infraestrutura?** **NÃO.**
- **Sobreposição de responsabilidade?** **NÃO.** Condição (Cliente) × indivíduo (Pessoa) × unidade (Missão) × atores (papéis) — categorias disjuntas.
- **Circularidade?** **NÃO.** `Pessoa → Cliente`; nada o referencia de volta → DAG; zero import.
- **Integralmente aderente ao Livro Mestre?** **SIM.**

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- **A entidade NÃO é a Pessoa nem a reduz a registro:** representa a **condição** de serviço, subordinada à dignidade (Art. 6º); referencia a Pessoa por identidade, jamais a possui/altera (item 12/13; INV-CL-02/03).
- **Ref a MISSÃO e relação de serviço omitidas:** transitivo via a Pessoa (item 18) / operacional (item 12) — fora.
- **Sem Value Object escalar próprio (sem `value-objects.ts`):** o item 14 lista naturezas/relações, não um valor escalar; os VOs mínimos são as referências.

---

## 8. Veredito final

**Entidade 19 — CLIENTE implementada, testada e aderente ao Livro Mestre**, no padrão oficial, representando a condição de serviço de uma Pessoa reconhecida, subordinada à dignidade, que **jamais** é a Pessoa, cria/duplica/altera Pessoa, possui a Missão, altera Estado/Verdade, decide, conduz, produz prova ou substitui qualquer papel. As separações com PESSOA/MISSÃO/papéis foram demonstradas sem sobreposição nem circularidade. **Encerra as 19 Entidades Fundamentais.** Nenhum caso de uso, infraestrutura, persistência, API, IA, projeção, workflow ou lógica operacional foi implementado. Validação dinâmica integral aprovada. **Não avançar para nenhuma outra camada sem autorização explícita.**
