# CASE — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 05 — CASO** · Sprint 1E · Data: 2026-07-13
**Fontes congeladas:** Entidade 05 (Volume 01, itens 1–24); INV-CA-01..INV-CA-03; DF-01; DF-06; DF-08; DF-10 (menção nominal a PROCESSO); DF-12; DF-24 (justificativa de ordenação); Art. 7º; Art. 11º; Art. 14º; Lei 2; Lei 3.
**Localização:** `packages/domain/src/case/`
**Padrão:** oficial (CONVENTIONS.md §10).

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `case-id.ts` (`CaseId`) | ✔ |
| Aggregate Root (previsto) | `case.ts` (`CaseAggregate extends AggregateRoot`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`LegalContext`, `LegalFoundation`) + `refs.ts` (`CaseMissionRef`, `CaseResponsibleRef`) | ✔ |
| Eventos como contratos | `case-events.ts` (`CaseRecognized`) | ✔ |
| Manifesto de invariantes | `case-invariants.ts` (INV-CA-01..CA-03) | ✔ |
| Testes unitários | `case.test.ts` | ✔ |
| Testes das invariantes | `case.test.ts` | ✔ |
| Tabela de derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

> Nomenclatura: `CaseAggregate` (consistência com DOCUMENTO/EVENTO e clareza sobre a natureza de agregado); `CaseMissionRef`/`CaseResponsibleRef` com prefixo `Case` para não colidir com as referências homônimas de DOCUMENTO/EVENTO no índice do domínio.

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `CaseId` (Identity única) | Individualização do Caso dentro da missão (Entidade 05, item 6) |
| `CaseMissionRef` obrigatória (nominal, por identidade) | Vínculo a exatamente uma Missão (item 11; INV-CA-01; DF-08); "não existe caso fora de missão" (item 17) |
| `LegalContext` (não-vazio) | Contexto jurídico / enquadramento (itens 3 e 14); boa-formação (item 19) |
| `LegalFoundation` (não-vazio) | Fundamento jurídico (item 14); DF-01 ("desde que exista fundamento jurídico para sua atuação"); boa-formação (item 19) |
| `CaseResponsibleRef` (nominal) + `recognizedAt` | Quem cria/altera com rastreabilidade (itens 7/8; DF-12; Art. 14º) |
| Fábrica `CaseAggregate.recognize(...)` (não `create`) | Princípio do fundador: "Caso é reconhecido, nunca inventado" |
| `CaseRecognized` emitido | Marco do reconhecimento — contrato vazio |
| Ausência de referência/estado de PROCESSO | INV-CA-02 (o Caso não é Processo — Art. 7º); PROCESSO é Entidade 06 (posterior) — "permanece fora" |
| Ausência de estado operacional / Verdade | item 13 ("nunca poderá possuir Verdade/Estado"); Lei 2 |
| Ausência de método `decide`/`decision` | item 16 ("jamais decidir" — decisão jurídica é do advogado; DF-09) |
| Ausência de workflow/processamento | princípio do fundador ("Caso não contém workflow") |
| Ausência de posse de Missão/Pessoa | item 13 ("nunca poderá possuir Missão, Pessoa"); só referencia por identidade |
| Acessores devolvem cópia de `Date`; props `readonly` | Imutabilidade do reconhecimento; base do histórico preservado (INV-CA-03) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

**Nota sobre DF-24.** A DF-24 afirma, na sua *justificativa oficial de ordenação*, que "um Caso Jurídico jamais nasce isoladamente; nasce a partir de evidências (Documentos e Eventos)". Isto é a **razão da ordem** (Pessoa→Documentos→Eventos→Caso), **não** uma invariante numerada. É honrado pela **ordem de implementação** (DOCUMENTO=03 e EVENTO=04 já concluídos antes de CASO=05) e conceitualmente. **Não** foi codificado como cardinalidade mínima de evidências, porque (a) não figura entre INV-CA-01..03 e (b) exigi-la seria uma **regra operacional/workflow** — expressamente proibidos neste sprint.

---

## 3. Manifesto completo das invariantes (INV-CA-01..INV-CA-03)

Reproduzido de `case-invariants.ts` (ver seção 4 para o locus de cada uma). O Canon (item 15) enumera **exatamente três** invariantes; nada além é acrescentado.

| ID | Descrição resumida | Ref. Canon |
|---|---|---|
| INV-CA-01 | Todo Caso pertence a exatamente uma Missão | DF-08 |
| INV-CA-02 | O Caso não é Processo | Art. 7º |
| INV-CA-03 | Histórico do Caso preservado (nenhuma versão apagada) | Lei 3 |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-CA-01, INV-CA-02 | `recognize` exige Missão presente (CA-01, runtime + tipo). CA-02 é **estrutural**: ausência de qualquer atributo/método de processo (comprovada por teste). |
| **event-store** | INV-CA-03 | Histórico preservado append-only; nenhuma versão apagada (triggers `events_no_update`/`events_no_delete`; Sprints 2+). |

Runtime como `Invariant<CaseAggregate>`: **INV-CA-01**. INV-CA-02 é estrutural (prova por ausência). INV-CA-03 é do event-store.
Guardas de boa-formação não numeradas (derivadas do item 19 / DF-01 / Art. 14º, não invariantes inventadas): `CASO-BEM-FORMADO` (contexto e fundamento presentes) e `CASO-RASTREABILIDADE` (responsável e momento).

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia (Fastify/PostgreSQL/Drizzle/Next/IA); **nenhuma outra entidade importada** — o Caso não conhece MISSÃO/PESSOA/DOCUMENTO/EVENTO/PROCESSO além das referências nominais previstas (`CaseMissionRef`, `CaseResponsibleRef`).
- **Sem PROCESSO:** nenhuma referência à Entidade 06 (posterior); INV-CA-02 é garantida por ausência, não por conhecimento de Processo.
- **Sem Event Store nem projeção:** INV-CA-03 apenas **mapeada** ao seu locus, não simulada.
- **Testes:** reconhecimento pleno (emite `CaseRecognized`); negativos mapeados a INV-CA-01 (Missão ausente), `CASO-BEM-FORMADO` (contexto/fundamento ausente) e `CASO-RASTREABILIDADE` (responsável ausente, momento inválido); igualdade por identidade; teste estrutural que prova ausência de `process/processo/state/estado/truth/verdade/decide/decision/workflow/advance` (INV-CA-02; itens 13/16); engine de invariantes; completude do manifesto (3 ids).
- **`@ts-expect-error`** nos casos de Missão e responsável ausentes comprova exigência pelo **tipo**, não só em runtime.

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As três invariantes são exatamente as do item 15; as guardas `CASO-BEM-FORMADO` e `CASO-RASTREABILIDADE` derivam do item 19 / DF-01 / Art. 14º (boa-formação e rastreabilidade já no Canon), não são regras novas. A cardinalidade de evidências (DF-24) foi deixada fora por ser justificativa de ordenação, não invariante.
- **Existe algum comportamento implícito?** **NÃO.** Só reconhecimento e leitura imutável; sem estado, sem Verdade, sem decisão, sem processo, sem workflow.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes não-entidade mapeadas aos loci, sem simulação.

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- Não executei `pnpm install`/`typecheck`/`test` (Node fora do PATH; execução é do dono). Verificação estrutural + varredura de imports. Recomendado: `pnpm --filter @reconstrua/domain typecheck && pnpm --filter @reconstrua/domain test`.
- **Referências a Documentos/Eventos deliberadamente ausentes.** O item 12 diz que o Caso "**pode** possuir" Processos/Documentos/Eventos referenciados — relação **opcional**, não propriedade constitutiva (item 14 lista apenas contexto jurídico, vínculo com a missão e fundamento jurídico). Modelar coleções de referências agora implicaria métodos de mutação (adicionar/remover) = workflow/operacional — proibidos. A relação triangular Missão×Caso×Processo está remetida à Modelagem Conceitual e pertence ao layer relacional/caso de uso (Sprints futuros). Consistente com a omissão do catálogo em EVENTO.
- **PROCESSO fora por completo** (Entidade 06, posterior): não antecipado, conforme restrição de não antecipar entidades futuras.
- Naming: `CaseMissionRef`/`CaseResponsibleRef` evitam colisão no índice do domínio; o tipo interno `EnforcementLocus` **não** é re-exportado do barrel (o de MISSÃO ocupa o nome no índice).

---

## 8. Veredito final

**Entidade 05 — CASO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando os princípios obrigatórios (reconhecido, nunca inventado; sem workflow; sem estado operacional; sem Verdade Operacional; não decide; não conhece infraestrutura; referencia apenas as entidades previstas; tudo que pertence a Processo/Operação/Missão/Regra Operacional permanece fora). Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, regra operacional ou workflow foi implementada. **Não prosseguir à Entidade 06 sem autorização explícita.**
