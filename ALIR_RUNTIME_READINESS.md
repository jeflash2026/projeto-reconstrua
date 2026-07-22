# ALIR_RUNTIME_READINESS.md

### Auditoria técnica do ALIR — 4 perguntas, nada além.

---

## 1. O que já está pronto

- **Contrato canônico (B‑1):** Aggregate Operacional `ALIR` (CORE / OPERATIONAL / EXTENSIONS),
  registry `ALIR_FIELDS` com owner + classificação + origem + reconstruível por campo, `emptyALIR`,
  e 4 invariantes testados (reconstrutível; ALIR nunca é dono de verdade; slots de extensão declarados).
- **Projection Builder (B‑2):** `ALIRProjectionBuilder` compõe o Aggregate lendo **9 ports reais**,
  somente‑leitura. Inclui:
  - **composição parcial** por grupo (CORE/OPERATIONAL/EXTENSIONS);
  - **métricas** por composição (tempo, fontes consultadas, campos reconstruídos, campos indisponíveis, versão, hash);
  - **hash estável** (FNV‑1a sobre serialização canônica, ignorando campos voláteis);
  - **capacidades derivadas do estado** e **health score** representacional.
- **Órbitas já conectadas às fontes reais:** identidade (`identities`), memória viva
  (pessoa/AHRI/documentos pendentes), snapshot (etapa/estado/verdade/**terminal** — via
  `ProjectionBackedMissionSnapshotAdapter`, que faz overlay `ENCERRADA`), workflow, scheduler,
  handoff, atribuição, staff e trabalho jurídico.
- **Qualidade:** typecheck + lint limpos; **122 testes verdes** no pacote `application`.

> Em uma frase: o ALIR **compõe corretamente**, de forma parcial e observável, tudo o que já tem
> produtor — e reporta honestamente o que ainda não tem.

---

## 2. O que falta para qualquer módulo consumir o ALIR

- **DEP‑1 — Wiring de infraestrutura (principal lacuna):** não existe um `build-alir` que instancie
  o `ALIRProjectionBuilder` com os **adapters concretos** já existentes (`JsonIdentityMap`,
  `JsonMemoryStore`, `ProjectionBackedMissionSnapshotAdapter`, `JsonProgressStore`,
  `JsonSchedulerStore`, `JsonHandoffStore`, `JsonAssignmentStore`, `JsonStaffStore`,
  `JsonJuridicalWorkStore`). Hoje o Builder vive só na camada `application` (ports). **Pequeno, baixo risco.**
- **Ponto de acesso estável:** definir a fronteira única que os módulos chamam (um serviço/porta
  `ALIR.compose(chatId, groups?)`), para nenhum módulo instanciar o Builder por conta própria
  (cumpre a Regra 1 — o ALIR é a única visão do cliente).
- **Chave de consulta:** o Builder é keyed por **`chatId`**. Não há índice reverso
  `clienteId → chatId` (o `JsonIdentityMap` só tem `load(chatId)`, sem `list`). Enumerar clientes
  hoje só via `MemoryStore.all()`. Módulos que possuam apenas `clienteId` ainda não resolvem sozinhos.
- **Órbitas ainda indisponíveis** (reportadas, nunca inventadas): documentos **enviados**,
  identidade civil/origem, qualidade (Shadow), timeline, decisões, **próxima ação**, e todas as
  extensões (perícia/comercial/financeiro/escritório/portal). Cada uma se liga **quando uma
  capacidade exigir** (roadmap interno suspenso).
- _(Não pré‑requisito para consumo básico read‑only: cache/invalidação (B‑3), reconstrução em lote
  (B‑5), emissão das métricas ao sink de observabilidade (B‑7).)_

---

## 3. Riscos técnicos ainda existentes

- **Scans O(n):** `scheduler.all()`, `handoff.openByRole` e `MemoryStore.all()` varrem stores.
  Aceitável nos primeiros clientes; **vira risco de performance em escala** → mitigável com
  cache/índices (B‑3) mais tarde. Não bloqueia agora.
- **Sem cache:** cada composição relê todas as fontes; custo cresce com volume/frequência.
- **Identidade provisória (`clienteId ?? chatId`):** antes do reconhecimento de cliente, o `chatId`
  faz as vezes de `clienteId`; consumidores **não devem** tratá‑lo como identidade civil definitiva.
- **Heurísticas representacionais:** `healthScore` e `capabilities` são **projeções do estado, não
  decisões** — consumidores não podem usá‑las como autorização de negócio (a decisão continua nos
  engines/workflows — Regra 2).
- **Dependência do adapter certo:** `terminalState` só aparece se o Builder for ligado ao
  `ProjectionBackedMissionSnapshotAdapter` (confirmado que faz overlay `ENCERRADA`). Um wiring com
  outro adapter perderia o estado terminal — **ponto a fixar no `build-alir`**.
- **Versionamento de migração:** `schemaVersion = 1` fixo; breaking changes futuras dependerão da
  política da Regra 4 (documentar/versão). Não bloqueia agora.

---

## 4. Dependências que bloqueiam a primeira capacidade empresarial

| Dep.      | Descrição                                                                                  | Bloqueia?                                      | Tamanho  |
| --------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------- | -------- |
| **DEP‑1** | `build-alir` (instanciar o Builder com adapters concretos, incl. o snapshot adapter certo) | **Sim** (para qualquer consumo em produção)    | Pequeno  |
| **DEP‑2** | Ponto de acesso estável de leitura (serviço/rota interna autenticada)                      | **Sim** (para um módulo consumir)              | Pequeno  |
| **DEP‑3** | Enumerar clientes (se a capacidade precisar de lista) via `MemoryStore.all()`              | Não (já existe)                                | —        |
| **DEP‑4** | Órbitas indisponíveis (próxima ação, timeline, docs enviados, extensões)                   | **Só** bloqueia capacidades que dependam delas | Variável |

**Conclusão:** **nenhuma** dependência bloqueia uma capacidade de **leitura consolidada** que use
apenas as órbitas já conectadas. Basta **DEP‑1 + DEP‑2** (ambas pequenas e de baixo risco). As
órbitas ausentes só bloqueiam capacidades que precisem delas — e serão ligadas sob demanda.
