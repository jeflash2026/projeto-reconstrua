# PERSON — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 02 — PESSOA** · Sprint 1B · Data: 2026-07-13
**Fontes congeladas:** Entidade 02 (Volume 01); DF-23 (reconhecimento, seis elementos); DF-20; DF-18 (menção nominal); Lei do Reconhecimento; Art. 6º; Lei 2; Lei 3; DF-08; DF-11.
**Localização:** `packages/domain/src/person/`
**Padrão:** oficial (CONVENTIONS.md §10), idêntico ao da MISSÃO.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `person-id.ts` (`PersonId`) | ✔ |
| Aggregate Root (previsto) | `person.ts` (`Person extends AggregateRoot`) — identidade global + evento de reconhecimento | ✔ |
| Value Objects mínimos | `value-objects.ts` (`CivilIdentity`, `RecognitionOrigin`) + `refs.ts` (`RecognitionResponsibleRef`, `EvidenceRef`) | ✔ |
| Eventos como contratos | `person-events.ts` (`PersonRecognized`) | ✔ |
| Manifesto de invariantes | `person-invariants.ts` (`PERSON_INVARIANTS_MANIFEST`, INV-P01..P15) | ✔ |
| Testes unitários | `person.test.ts` | ✔ |
| Testes das invariantes | `person.test.ts` | ✔ |
| Tabela de derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `PersonId` (Identity única) | Elemento de reconhecimento 1 (DF-23); base de INV-P01/INV-P02 |
| `CivilIdentity` (não-vazia) | Elemento 2 (DF-23); INV-P14; suficiência é do R2 (não da entidade) |
| `RecognitionOrigin` (não-vazia) | Elemento 3 (DF-23); autorização de origem é do R2/Governança |
| `recognizedAt` (Date válida) | Elemento 4 (DF-23) |
| `RecognitionResponsibleRef` (nominal) | Elemento 5 (DF-23); DF-18; R2/CA-06 (quem efetiva) |
| `EvidenceRef[]` não-vazio (nominal) | Elemento 6 (DF-23); referência a DOCUMENTO (Entidade 03); DF-18 |
| Fábrica `Person.recognize(...)` (não `create`) | Lei do Reconhecimento; INV-P15 ("reconhece, nunca cria") |
| `PersonRecognized` emitido | DF-23 (marco do reconhecimento) — contrato vazio |
| Ausência de campos `state/etapa/workflow/timeline` | INV-P03 (são exclusivos da MISSÃO — DF-08/Lei 2) |
| Ausência de método de encerramento | INV-P13 (a Pessoa nunca é encerrada — DF-11) |
| Ausência de "dono"/titularidade | INV-P05 (nunca pertence ao Sistema — Lei Geral) |
| Identidade civil imutável (VO no construtor) | INV-P08 (representação jamais altera a identidade civil) |
| `Result<Person, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-P01..INV-P15)

Reproduzido de `person-invariants.ts`. Cada invariante com referência normativa e locus (ver seção 4).

| ID | Descrição resumida | Ref. Canon |
|---|---|---|
| INV-P01 | Identidade única e permanente; mudança cadastral não cria nova Pessoa | Entidade 02; Identidade Civil |
| INV-P02 | Jamais duplicada (mesmo indivíduo = uma Pessoa) | Lei 1 |
| INV-P03 | Nunca possui Estado/Etapa/Workflow/Timeline | DF-08; Lei 2 |
| INV-P04 | Zero, uma ou N missões; cada missão sua pertence a ela | DF-20 |
| INV-P05 | Nunca pertence ao Sistema | Lei Geral |
| INV-P06 | Nunca reduzida a identificador (dignidade) | Art. 6º |
| INV-P07 | Vínculos com missões jamais apagados | DF-11; Lei 3 |
| INV-P08 | Representação não altera a identidade civil | Entidade 02 |
| INV-P09 | Alteração da representação é rastreável | Lei 3; Art. 14º |
| INV-P10 | Pode visualizar todas as suas missões | Lei 2 |
| INV-P11 | Nenhuma info essencial só em memória informal | Art. 11º; DF-12 |
| INV-P12 | Interesses compartilhados → missões independentes | DF-20; Individualidade |
| INV-P13 | A Pessoa nunca é encerrada | DF-11 |
| INV-P14 | Nenhum reconhecimento incompleto (6 elementos) | DF-23 |
| INV-P15 | Nunca tratada como objeto criado pelo software | Lei do Reconhecimento |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-P01, INV-P03, INV-P05, INV-P06, INV-P08, INV-P13, INV-P14, INV-P15 | Estrutura/construção: `recognize` valida os 6 elementos (INV-P14); ausência de campos de estado (INV-P03), de dono (INV-P05), de encerramento (INV-P13); identidade imutável (INV-P01/P08); fábrica de reconhecimento (INV-P15); VOs ricos (INV-P06) |
| **event-store** | INV-P02, INV-P07, INV-P11 | Unicidade e histórico perpétuo append-only (Sprints 2+) |
| **projection** | INV-P10 | Read Model das missões da Pessoa (Sprints 2+) |
| **use-case** | INV-P09 | Atualização cadastral rastreável (R2/casos de uso) |
| **cross-entity** | INV-P04, INV-P12 | Titularidade vive na MISSÃO (`beneficiary`; DF-20); independência entre missões |

Apenas INV-P14 é implementada como `Invariant<Person>` verificável em runtime; as demais "entity" são **estruturais** (garantidas pela ausência de campos/métodos), como INV-03 foi na MISSÃO.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` apenas no teste. Nenhuma tecnologia de infraestrutura; nenhuma outra entidade importada (Person **não** importa Mission).
- **Testes:** reconhecimento pleno (emite `PersonRecognized`); cinco negativos mapeados a INV-P14 (identidade/origem/data/evidências/responsável); igualdade por identidade (INV-P01/P02); teste estrutural que prova ausência de `state/etapa/workflow/timeline/missions` (INV-P03/P13); engine de invariantes; completude do manifesto (15 ids).
- **`@ts-expect-error`** nos casos de ausência de responsável comprova que o elemento é exigido pelo **tipo**, não só em runtime.

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** Suficiência de identidade, autorização de origem e não-duplicação foram **deixadas ao seu locus** (R2/Governança/event-store), não inventadas aqui.
- **Existe algum comportamento implícito?** **NÃO.** Só reconhecimento e leitura imutável; sem atualização cadastral, sem missões, sem estado.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes não-entidade mapeadas aos loci, sem simulação.

---

## 7. Ressalvas honestas

- Não executei `pnpm install`/`typecheck`/`test` (Node fora do PATH; execução de ambiente é do dono). Verificação estrutural + varredura de imports. Recomendado no ambiente do dono: `pnpm --filter @reconstrua/domain typecheck && pnpm --filter @reconstrua/domain test`.
- `KNOWN_RECOGNITION_ORIGINS` transcreve as origens da DF-23 apenas como **referência** (lista não fechada; sem enforcement) — para não impor conjunto fechado nem aprovar origens (que é do R2/Governança).

---

## 8. Veredito final

**Entidade 02 — PESSOA implementada, testada e aderente ao Livro Mestre**, no padrão oficial. Nenhuma outra entidade, caso de uso, infraestrutura, API, IA ou regra operacional foi implementada. Pronta para aprovação; **não prosseguir à Entidade 03 sem autorização explícita**.
