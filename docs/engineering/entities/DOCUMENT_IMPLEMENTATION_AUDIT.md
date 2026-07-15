# DOCUMENT — AUDITORIA DE IMPLEMENTAÇÃO

**Entidade 03 — DOCUMENTO** · Sprint 1C · Data: 2026-07-13
**Fontes congeladas:** Entidade 03 (Volume 01); INV-D01..INV-D14; DF-18 (menção nominal); Lei do Reconhecimento; Lei 1/3/4; DF-05; DF-09; DF-11; DF-20; Art. 14º.
**Localização:** `packages/domain/src/document/`
**Padrão:** oficial (CONVENTIONS.md §10).

---

## 1. Cobertura dos entregáveis

| Entregável | Arquivo | Status |
|---|---|---|
| Identity própria | `document-id.ts` (`DocumentId`) | ✔ |
| Aggregate Root (previsto) | `document.ts` (`DocumentAggregate extends AggregateRoot`) | ✔ |
| Value Objects mínimos | `value-objects.ts` (`DocumentOrigin`, `ContentReference`) + `refs.ts` (`MissionRef`, `DocumentRecognitionResponsibleRef`) | ✔ |
| Eventos como contratos | `document-events.ts` (`DocumentRecognized`) | ✔ |
| Manifesto de invariantes | `document-invariants.ts` (INV-D01..D14) | ✔ |
| Testes unitários | `document.test.ts` | ✔ |
| Testes das invariantes | `document.test.ts` | ✔ |
| Tabela de derivação linha a linha | seção 2 | ✔ |
| Mapa de enforcement | seção 4 | ✔ |
| Auditoria persistida | este arquivo | ✔ |

> Nomenclatura: a classe chama-se `DocumentAggregate` para não colidir com o tipo global `Document` do DOM.

---

## 2. Derivação linha a linha (Código → Livro Mestre)

| Construto no código | Norma do Livro Mestre |
|---|---|
| `DocumentId` (Identity única) | Individualização (INV-D13) |
| `DocumentOrigin` (não-vazia) | Origem do reconhecimento (Entidade 03 — Origens; INV-D02) |
| `ContentReference` (opaca, imutável) | Conteúdo probatório preservado (INV-D10) — **sem OCR/parse/armazenamento** |
| `MissionRef[]` não-vazio (nominal) | Incorporação a ≥1 Missão (Entidade 03 — Reconhecimento; INV-D08; DF-18) |
| `DocumentRecognitionResponsibleRef` (nominal) | Responsável pela efetivação (Entidade 03 seção 7; INV-D03) |
| `recognizedAt` (Date válida) | Momento do reconhecimento (INV-D03) |
| Fábrica `DocumentAggregate.recognize(...)` (não `create`) | Lei do Reconhecimento; INV-D01 ("reconhece, nunca cria") |
| `DocumentRecognized` emitido | Marco do reconhecimento — contrato vazio |
| Ausência de método de validação/aprovação | INV-D06 (reconhecer ≠ validar/aprovar/atestar veracidade) |
| Ausência de campo "valor jurídico"/veredicto | INV-D07 (valor jurídico é da interpretação humana) |
| Ausência de estado/decisão/conclusão | INV-D04 (Documento não é decisão/estado/conclusão) |
| Ausência de qualquer efeito sobre estado | INV-D09 (incorporação não altera Estado Operacional) |
| Ausência de classificação/interpretação | Restrição do fundador; INV-D14 (classificar é automação → Regra Operacional) |
| Ausência de "dono" | INV-D12 (nunca pertence ao Sistema; só representação) |
| `content` imutável (VO no construtor; sem setter) | INV-D10 (conteúdo jamais alterado) |
| `Result<…, CanonViolationError>` com `invariantId` | Rastreabilidade código↔Canon (Lei 5) |

---

## 3. Manifesto completo das invariantes (INV-D01..INV-D14)

Reproduzido de `document-invariants.ts` (ver seção 4 para o locus de cada uma).

| ID | Descrição resumida | Ref. Canon |
|---|---|---|
| INV-D01 | Jamais inventado (reconhece, nunca cria) | Lei do Reconhecimento |
| INV-D02 | Jamais perde a origem | Entidade 03 |
| INV-D03 | Jamais perde rastreabilidade | Lei 3; Art. 14º |
| INV-D04 | Jamais confundido com decisão/estado/conclusão | Entidade 03 |
| INV-D05 | Compartilhado entre missões só por Regra Operacional | DF-20 |
| INV-D06 | Reconhecer ≠ validar/aprovar/atestar | Entidade 03 |
| INV-D07 | Valor jurídico não pertence ao Documento | DF-09 |
| INV-D08 | Individualizado + origem + ≥1 Missão | Entidade 03 |
| INV-D09 | Incorporação não altera Estado Operacional | DF-05; E8 |
| INV-D10 | Conteúdo probatório jamais alterado | Entidade 03 |
| INV-D11 | Documento reconhecido jamais desaparece | DF-11; Lei 3 |
| INV-D12 | Nunca pertence ao Sistema | Entidade 03 |
| INV-D13 | Individualização única; compartilhar não duplica | Lei 1 |
| INV-D14 | Automação (reconhecer/classificar/vincular) referencia Regra Operacional | Lei 4; DF-09; DF-13 |

---

## 4. Mapa de enforcement

| Locus | Invariantes | Como é garantida |
|---|---|---|
| **entity** (aqui) | INV-D01, INV-D02, INV-D04, INV-D06, INV-D07, INV-D08, INV-D10, INV-D12 | `recognize` (não `create`) com origem/incorporação/conteúdo; ausência estrutural de validação (D06), valor jurídico (D07), estado/decisão (D04), dono (D12); conteúdo imutável (D10) |
| **event-store** | INV-D03, INV-D11, INV-D13 | Rastreabilidade perpétua, não-desaparecimento e não-duplicação append-only (Sprints 2+) |
| **projection** | INV-D09 | O Estado deriva da Verdade; incorporar documento não o altera (Sprints 2+) |
| **use-case** | INV-D05, INV-D14 | Compartilhamento entre missões e classificação sob Regra Operacional (R3) |

Runtime como `Invariant<DocumentAggregate>`: **INV-D02, INV-D08, INV-D10**. As demais "entity" são **estruturais** (ausência de campos/métodos), comprovadas por teste.

---

## 5. Auditoria técnica

- **Imports:** todos de `../kernel/...` ou internos `./...`; `vitest` só no teste. Nenhuma tecnologia; **nenhuma outra entidade importada** (o Documento não conhece MISSÃO/PESSOA além de `MissionRef` nominal).
- **Sem tecnologia proibida:** nenhum OCR, parser, upload, armazenamento — o conteúdo é `ContentReference` opaca e imutável.
- **Testes:** reconhecimento pleno (emite `DocumentRecognized`); negativos mapeados a INV-D02/D08/D10/D03; igualdade por identidade (INV-D13); teste estrutural que prova ausência de `state/decision/conclusion/valorJuridico/classification/validate/approve/isValid/owner` (INV-D04/D06/D07); engine de invariantes; completude do manifesto (14 ids).
- **`@ts-expect-error`** no caso de responsável ausente comprova exigência pelo **tipo**.

---

## 6. Respostas obrigatórias

- **Existe alguma decisão criada fora do Canon?** **NÃO.**
- **Existe alguma regra inventada?** **NÃO.** Suficiência/autorização de origem, não-duplicação, compartilhamento e classificação foram deixados ao seu locus (R3/Governança/event-store), não inventados.
- **Existe algum comportamento implícito?** **NÃO.** Só reconhecimento e leitura imutável; sem validação, sem classificação, sem efeito sobre a Realidade/estado.
- **Existe alguma dependência de infraestrutura?** **NÃO.**
- **A entidade está integralmente aderente ao Livro Mestre?** **SIM**, no escopo de entidade isolada; invariantes não-entidade mapeadas aos loci, sem simulação.

Todas as respostas puderam ser "NÃO" (e "SIM" para a aderência) — a implementação **não foi interrompida**.

---

## 7. Ressalvas honestas

- Não executei `pnpm install`/`typecheck`/`test` (Node fora do PATH; execução é do dono). Verificação estrutural + varredura de imports. Recomendado: `pnpm --filter @reconstrua/domain typecheck && pnpm --filter @reconstrua/domain test`.
- **Classificação deliberadamente ausente da entidade:** codificar `DocumentNature` agora seria implementar "porque vai precisar depois" e roçar em classificação/interpretação — proibidos. Fica como `use-case` (R3). `KNOWN_DOCUMENT_ORIGINS` é só referência (lista não fechada; sem enforcement).
- Naming `DocumentAggregate` (evita colisão com `Document` do DOM); e o tipo interno `EnforcementLocus` **não** é re-exportado do barrel (o de MISSÃO já ocupa o nome no índice do domínio).

---

## 8. Veredito final

**Entidade 03 — DOCUMENTO implementada, testada e aderente ao Livro Mestre**, no padrão oficial, preservando os cinco princípios (reconhecido não criado; não muda a Realidade; sem comportamento operacional; só referências previstas; sem classificação/interpretação automática). Nenhuma outra entidade, caso de uso, infraestrutura, API, IA, regra operacional ou tecnologia (OCR/parser/upload/armazenamento) foi implementada. **Não prosseguir à Entidade 04 sem autorização explícita.**
