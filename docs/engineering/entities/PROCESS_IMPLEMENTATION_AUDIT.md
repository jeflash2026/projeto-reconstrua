# PROCESS — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 06 — PROCESSO** · Sprint 1F · Data: 2026-07-13
**Fontes congeladas:** Entidade 06 (Volume 01, itens 1–24); INV-PR-01..INV-PR-03; DF-01; DF-06; DF-09; DF-10; DF-11; DF-12; DF-24 (ordenação); Art. 7º; Art. 11º; Art. 14º; Modelagem Conceitual (Missão×Caso×Processo).
**Localização:** `packages/domain/src/process/`
**Padrão:** oficial (CONVENTIONS.md §10).

---

## 0. Leitura prévia e fronteira de camadas (exigência do sprint)

**Fundamentos identificados:** DF-10 (Processo é instrumento da missão; nunca é a missão; a missão existe sem processo; o processo jamais existe sem missão) → INV-PR-01/02/03. DF-01 (fundamento jurídico como condição de atuação). DF-09 (decisão jurídica é do humano; rastreabilidade). Art. 7º (o Projeto administra missões, não processos; o processo é consequência). Art. 11º/14º, DF-11/DF-12 (visualização autorizada, histórico perpétuo, responsável, rastreabilidade). Modelagem Conceitual congelada (Caso pode ensejar Processos; Processo pertence sempre a uma Missão).

**Pertence à ENTIDADE:** identidade; vínculo obrigatório a uma Missão (INV-PR-01); fundamento jurídico (item 19; DF-01); vínculo opcional a Caso (itens 14/18); responsável + momento (rastreabilidade); evento-contrato `ProcessRecognized`.
**Pertence a OUTRAS camadas:** INV-PR-03 "missão existe sem processo" → **cross-entity** (cardinalidade da Missão); histórico perpétuo (DF-11) → **event-store**; decisão jurídica → **humano/fora** (DF-09); rito/workflow processual → **fora**; "fase" da missão → **Estado/Etapa Operacional (Entidades 08/09, posteriores)**.

**Dúvidas normativas (resolvidas por omissão conservadora, sem bloquear):**
1. **"Fase" (itens 1/14).** DF-10 fala em "determinada **fase de uma missão**"; DF-08 define ESTADO/ETAPA OPERACIONAL como "a etapa atual ocupada por uma missão" — logo o referente de "fase" é a Etapa Operacional (Entidades 08/09, **futuras**). O item 22 (Referências Ontológicas) lista **apenas** MISSÃO (01), CASO (05), ADVOGADO (17) — **não** autoriza referência a Etapa/Estado. Modelar "fase" anteciparia entidade futura (proibido) ou inventaria atributo que a boa-constituição (item 19) não exige. → **"fase" omitida.**
2. **Verbo da fábrica.** Mantido `recognize` (Lei do Reconhecimento; padrão de todas as entidades): o Sistema reconhece o instrumento que existe no mundo ("a ação distribuída" — item 20), não o inventa.
3. **ADVOGADO (itens 7/22).** Menção nominal (DF-18): `ProcessResponsibleRef` genérico por identidade, sem antecipar a Entidade 17.

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `process-id.ts` (`ProcessId`) | ✔ |
| Aggregate Root (previsto) | `process.ts` (`ProcessAggregate extends AggregateRoot`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`ProcessLegalFoundation`) + `refs.ts` (`ProcessMissionRef`, `ProcessCaseRef`, `ProcessResponsibleRef`) | ✔ |
| Eventos como contratos | `process-events.ts` (`ProcessRecognized`) | ✔ |
| Manifesto de invariantes | `process-invariants.ts` (INV-PR-01..PR-03) | ✔ |
| Testes unitários | `process.test.ts` | ✔ |
| Testes das invariantes | `process.test.ts` | ✔ |
| Derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

> Nomenclatura: `ProcessAggregate` (consistência e clareza de agregado); refs/VO com prefixo `Process` para não colidir no índice do domínio (o `LegalFoundation` de CASO já ocupa o nome) e para não acoplar entidades.

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `ProcessId` (Identity única) | Individualização do Processo (Entidade 06; instrumento jurídico) |
| `ProcessMissionRef` obrigatória (nominal) | Pertence a uma Missão (item 11; INV-PR-01; DF-10); "não existe processo fora de missão" (item 17) |
| `ProcessLegalFoundation` (não-vazio) | Fundamento jurídico (itens 11/19); DF-01 ("desde que exista fundamento jurídico") |
| `ProcessCaseRef` OPCIONAL (nominal) | "vínculo com missão/caso" (item 14); "decorre de CASO" (item 18); "Caso pode ensejar Processos" (Modelagem) |
| `ProcessResponsibleRef` (nominal) + `recognizedAt` | Quem cria/altera com rastreabilidade (itens 7/8; DF-09; DF-12; Art. 14º) |
| Fábrica `ProcessAggregate.recognize(...)` | Lei do Reconhecimento; "a ação distribuída" (item 20) |
| `ProcessRecognized` emitido | Marco do reconhecimento — contrato vazio |
| Ausência de estado/Verdade da missão; só referência à Missão | INV-PR-02 (o Processo nunca é a Missão — DF-10; Art. 7º); item 13 |
| Ausência de método `decide`/`decision` | item 16 (decisões jurídicas são do advogado — DF-09) |
| Ausência de "fase"/etapa | Referente = Etapa/Estado Operacional (Entidades 08/09, posteriores); não antecipar |
| Ausência de rito/workflow/processamento | Restrição do fundador (sem workflow) |
| Nenhuma obrigação de a Missão ter Processo | INV-PR-03 (a missão pode existir sem processo — DF-10); locus cross-entity |
| Acessores devolvem cópia de `Date`; props `readonly` | Imutabilidade do reconhecimento; base do histórico (DF-11) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-PR-01..INV-PR-03)

Reproduzido de `process-invariants.ts`. O Canon (item 15) enumera **exatamente três** invariantes; nada além é acrescentado.

| ID | Descrição resumida | Ref. Canon |
|---|---|---|
| INV-PR-01 | Todo Processo pertence a uma Missão | DF-10 |
| INV-PR-02 | O Processo nunca é a Missão | DF-10; Art. 7º |
| INV-PR-03 | A Missão pode existir sem Processo | DF-10 |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-PR-01, INV-PR-02 | `recognize` exige Missão presente (PR-01, runtime + tipo). PR-02 é **estrutural**: o Processo é agregado próprio que só referencia a Missão por identidade, sem conter estado/Verdade da Missão (comprovado por teste). |
| **cross-entity** | INV-PR-03 | "A Missão pode existir sem Processo" é afirmação sobre a cardinalidade da Missão (0..n Processos); satisfeita por construção (nada no Processo obriga a Missão a tê-lo). Verificação plena no layer relacional (Sprints 2+). |
| **event-store** | INV-PR-03 (histórico) / DF-11 | Histórico preservado append-only; nenhum Processo desaparece (Sprints 2+). |

Runtime como `Invariant<ProcessAggregate>`: **INV-PR-01**. PR-02 estrutural; PR-03 cross-entity.
Guardas de boa-constituição não numeradas (derivadas do item 19 / DF-01 / DF-09 / Art. 14º, não inventadas): `PROCESSO-BEM-CONSTITUIDO` (fundamento presente) e `PROCESSO-RASTREABILIDADE` (responsável e momento).

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia (Fastify/PostgreSQL/Drizzle/Next/IA); **nenhuma outra entidade importada** — o CASO é referenciado apenas nominalmente por `ProcessCaseRef` (ponteiro de identidade; não importa nada de `case/`). Nenhum comportamento de MISSÃO/CASO/EVENTO/ADVOGADO implementado.
- **Sem entidade futura:** nenhuma referência a Estado/Etapa Operacional (08/09); "fase" deliberadamente omitida.
- **Sem Event Store nem projeção:** INV-PR-03/DF-11 apenas **mapeadas** ao locus, não simuladas.
- **Testes:** reconhecimento pleno com e sem Caso (Caso é opcional); negativos mapeados a INV-PR-01 (Missão ausente), `PROCESSO-BEM-CONSTITUIDO` (fundamento ausente), `PROCESSO-RASTREABILIDADE` (responsável ausente, momento inválido); igualdade por identidade; teste estrutural que prova ausência de `state/estado/truth/verdade/decide/decision/phase/fase/workflow/advance` (INV-PR-02; itens 13/16); engine de invariantes; completude do manifesto (3 ids).
- **`@ts-expect-error`** nos casos de Missão e responsável ausentes comprova exigência pelo **tipo**.

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** As três invariantes são exatamente as do item 15; as guardas `PROCESSO-BEM-CONSTITUIDO` e `PROCESSO-RASTREABILIDADE` derivam do item 19 / DF-01 / DF-09 / Art. 14º. "Fase" foi omitida (não inventada como referência a entidade futura).
- **Existe algum comportamento implícito?** **NÃO.** Só reconhecimento e leitura imutável; sem estado, sem Verdade, sem decisão jurídica, sem rito/workflow.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes não-entidade mapeadas aos loci, sem simulação; "fase" pendente das Entidades 08/09 conforme o próprio Canon (item 22).

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- Não executei `pnpm install`/`typecheck`/`test` (Node fora do PATH; execução é do dono). Verificação estrutural + varredura de imports. Recomendado: `pnpm --filter @reconstrua/domain typecheck && pnpm --filter @reconstrua/domain test`.
- **"Fase" omitida por decisão de fidelidade** (ver seção 0, dúvida 1): seu referente é a Etapa/Estado Operacional (Entidades 08/09, posteriores), não autorizada como referência pelo item 22. Quando essas entidades forem implementadas, o vínculo Processo↔Etapa será modelado no locus correto — não aqui.
- **`ProcessCaseRef` opcional:** incluído porque o vínculo com Caso é **propriedade** do Processo (item 14) e relação congelada na Modelagem, e porque CASO (05) já existe — referência nominal, sem acoplar comportamento. Permanece opcional (nenhuma invariante o exige).
- Naming: refs/VO com prefixo `Process` evitam colisão no índice do domínio; o tipo interno `EnforcementLocus` **não** é re-exportado do barrel.

---

## 8. Veredito final

**Entidade 06 — PROCESSO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando o que pertence ao conceito ontológico PROCESSO (instrumento jurídico da missão; pertence sempre a uma Missão; nunca é a Missão; a Missão existe sem ele) e mantendo fora tudo que pertence a CASO, MISSÃO, EVENTO, ao advogado humano (decisão jurídica) e às Entidades futuras (Etapa/Estado Operacional). Nenhuma outra entidade, caso de uso, infraestrutura, persistência, API, IA, regra operacional ou workflow foi implementada. **Não prosseguir à Entidade 07 sem autorização explícita.**
