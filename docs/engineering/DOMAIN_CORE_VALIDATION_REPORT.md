# DOMAIN CORE — RELATÓRIO DE VALIDAÇÃO DINÂMICA

**Checkpoint do Núcleo do Domínio (Entidades 01–06)** · Data: 2026-07-13
**Ambiente provisionado.** Execução dinâmica realizada. **Resultado: 1 etapa com erros → certificação NÃO emitida.**
**Nenhuma correção aplicada** (aguardando autorização do fundador, conforme protocolo).

---

## 1. Provisionamento do ambiente

| Item | Resultado |
|---|---|
| Node | **v24.18.0** |
| Corepack | v0.35.0 (habilitação global falhou por EPERM em `C:\Program Files\nodejs`; contornado com shim `pnpm.cmd` — sem alterar o repo) |
| pnpm | **9.12.0** (pinado em `package.json` → `packageManager`) |
| `pnpm install` | **OK** (exit 0) — 244 pacotes; 2 subdependências deprecated (avisos, não erros) |
| Lockfile | **`pnpm-lock.yaml` gerado** na raiz |

> O shim de `pnpm` foi criado **fora** do repositório (`%LOCALAPPDATA%\pnpm-shim\pnpm.cmd`) apenas para que o Turbo localizasse o binário. Nenhum arquivo do domínio, do Canon ou de configuração do projeto foi tocado no provisionamento.

---

## 2. Resultado das três etapas

| Etapa | Comando | Resultado |
|---|---|---|
| Typecheck | `pnpm typecheck` | ✅ **PASS** — 12/12 tasks; `@reconstrua/domain` `tsc --noEmit` sem erros |
| Test | `pnpm test` | ✅ **PASS** — `@reconstrua/domain`: **6 arquivos, 61 testes, 61 passed** (Mission 10, Person 10, Document 10, Event 11, Case 10, Process 10) |
| Lint | `pnpm lint` | ❌ **FAIL** — 14 erros, todos em `@reconstrua/domain` |

**Conclusão da etapa:** como o Lint falhou, o núcleo **não pode ser certificado** neste momento.

---

## 3. Relatório completo dos erros (Lint)

Todos os 14 erros são regras **estilísticas** do `@typescript-eslint`. Nenhum é erro de tipo, de teste, de lógica de domínio, de invariante ou de arquitetura.

### 3.1 `@typescript-eslint/consistent-type-imports` (12 erros)

| # | Arquivo | Linha | Import afetado | Erro |
|---|---|---|---|---|
| 1 | `packages/domain/src/mission/mission.ts` | 22 | `MissionId` | All imports in the declaration are only used as types. Use `import type` |
| 2 | `packages/domain/src/mission/mission.ts` | 23 | refs (`BeneficiaryPersonRef`, `InitialOperationalResponsibleRef`) | idem |
| 3 | `packages/domain/src/person/person.ts` | 24 | `PersonId` | idem |
| 4 | `packages/domain/src/person/person.ts` | 25 | refs (`RecognitionResponsibleRef`, `EvidenceRef`) | idem |
| 5 | `packages/domain/src/document/document.ts` | 27 | `DocumentId` | idem |
| 6 | `packages/domain/src/document/document.ts` | 28 | refs (`MissionRef`, `DocumentRecognitionResponsibleRef`) | idem |
| 7 | `packages/domain/src/event/event.ts` | 25 | `EventId` | idem |
| 8 | `packages/domain/src/event/event.ts` | 26 | refs (`EventMissionRef`, `FactRef`, `EventRecognitionResponsibleRef`) | idem |
| 9 | `packages/domain/src/case/case.ts` | 27 | `CaseId` | idem |
| 10 | `packages/domain/src/case/case.ts` | 28 | refs (`CaseMissionRef`, `CaseResponsibleRef`) | idem |
| 11 | `packages/domain/src/process/process.ts` | 27 | `ProcessId` | idem |
| 12 | `packages/domain/src/process/process.ts` | 28 | refs (`ProcessMissionRef`, `ProcessCaseRef`, `ProcessResponsibleRef`) | idem |

- **Causa provável:** em cada agregado, a classe de identidade (`*Id`) e as classes de referência (`*Ref`) são usadas **apenas em posição de tipo** (campos das interfaces `*RecognitionInput`/`*Props` e tipos de parâmetro). Elas nunca são construídas dentro do arquivo do agregado (as instâncias já chegam prontas pela entrada). A regra `consistent-type-imports` exige, nesse caso, o prefixo `import type`. O `tsc` **aceita** o código (por isso o typecheck passou); a regra do ESLint é mais estrita que o compilador.
- **Impacto arquitetural:** **nenhum.** Não altera runtime, semântica, invariantes, eventos, referências nem fidelidade ao Canon. É puramente sintaxe de import.
- **Viola o Livro Mestre?** **NÃO.** Nenhuma norma do Canon trata de sintaxe `import type`. É convenção de engenharia (CONVENTIONS.md/ESLint), não regra de domínio.

### 3.2 `@typescript-eslint/no-unnecessary-type-assertion` (2 erros)

| # | Arquivo | Linha:Col | Trecho | Erro |
|---|---|---|---|---|
| 13 | `packages/domain/src/kernel/value-object.ts` | 19:29 | `Object.keys(a as Record<string, unknown>)` | This assertion is unnecessary since the receiver accepts the original type of the expression |
| 14 | `packages/domain/src/kernel/value-object.ts` | 20:29 | `Object.keys(b as Record<string, unknown>)` | idem |

- **Causa provável:** nas linhas 19–20, após os `typeof`/`Array.isArray` anteriores, `a` e `b` já estão estreitados para `object`; `Object.keys` aceita `object`. O cast `as Record<string, unknown>` é redundante. (É usado de forma legítima nas linhas 26–27 para indexação `[key]`, mas não em `Object.keys`.)
- **Impacto arquitetural:** **nenhum.** Kernel (Sprint 1A), função de igualdade estrutural; o cast redundante não muda comportamento algum.
- **Viola o Livro Mestre?** **NÃO.** Convenção de engenharia.

---

## 4. Diagnóstico consolidado

- **Origem comum:** o Lint nunca havia sido executado durante os sprints 1B–1F (o ambiente não tinha `node_modules`; ver auditoria anterior). Estas 14 ocorrências são o acúmulo natural desse gap. São todas **auto-corrigíveis** com `eslint --fix` (a própria saída do ESLint informa: "14 errors potentially fixable with the `--fix` option").
- **Natureza:** 100% estilística. **Zero** erros de tipo (`tsc` passou), **zero** falhas de teste (61/61), **zero** violações do Canon, **zero** dependências tecnológicas novas.
- **Risco de correção:** mínimo e mecânico — trocar `import {` → `import type {` nos 12 pontos e remover 2 casts redundantes. **Não** toca em nenhuma regra de domínio, invariante, evento ou referência. Ainda assim, **não foi aplicada** nenhuma alteração, conforme seu protocolo (correção só após autorização).

---

## 5. Correção proposta (NÃO aplicada — aguardando autorização)

1. Nos 6 agregados: prefixar com `import type` as 12 declarações de import type-only listadas em 3.1.
2. Em `kernel/value-object.ts` linhas 19–20: remover `as Record<string, unknown>` das duas chamadas `Object.keys(...)`.
3. Reexecutar `pnpm lint && pnpm typecheck && pnpm test`; se verde, emitir `DOMAIN_CORE_CERTIFICATION.md`.

> Observação de fidelidade: nenhuma dessas correções altera regra do domínio nem o Livro Mestre — são ajustes de sintaxe/estilo exigidos pelo gate de Lint definido pelo próprio fundador ("nenhum merge com conformance/lint falhando").

---

## 6. Respostas do checkpoint

- **Typecheck:** PASS.
- **Test:** PASS (61/61).
- **Lint:** FAIL (14 erros estilísticos, auto-corrigíveis).
- **Alguma correção foi aplicada?** NÃO.
- **Algum erro viola o Livro Mestre?** NÃO.
- **O núcleo pode ser certificado agora?** NÃO — pendente exclusivamente da correção de Lint e reexecução.

**Veredito: DOMAIN CORE REJECTED** (por falha de Lint; certificação retida até autorização de correção).
