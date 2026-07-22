# W1‑01A — ALIR FOUNDATION

### Entregável de engenharia do item `W1‑01` (Onda 1). **Sem tela. Sem banco novo. Sem feature.**

> O ALIR é a **identidade operacional do cliente** — o "sistema solar" em torno do qual tudo
> orbita (Enterprise OS). Esta Foundation **não implementa** o ALIR: ela **descobre as fontes da
> verdade**, fixa o **contrato canônico** e o **plano do Runtime (W1‑01B)**. Princípio‑mestre:
> **reutilizar primeiro, complementar depois, criar só por último.** O ALIR **não possui dado
> próprio** — é 100% projeção; nada é duplicado, migrado ou reescrito.
>
> Toda a descoberta abaixo é baseada no código real (arquivos citados), não em suposição.

---

## LEGENDA DE CLASSIFICAÇÃO (obrigatória para todo dado do ALIR)

- **CANÔNICO** — verdade de origem, vive num agregado/event stream ou store canônico. O ALIR **lê**, nunca cria.
- **DERIVADO** — projeção/fold de eventos canônicos (read model). Reconstruível.
- **CALCULADO** — computado em tempo de leitura por um algoritmo determinístico (não persistido como verdade).
- **TEMPORÁRIO** — estado transitório de processo (agenda, cursores) com validade operacional.
- **EXTERNO** — origem fora do domínio do cliente (config da empresa, sinais de qualidade, mundo externo).

> Regra anti‑duplicação: **nenhum campo CANÔNICO é copiado para dentro do ALIR como verdade** — o
> ALIR referencia/projeta. Campos sem produtor real **ficam explicitamente ausentes** (`null`/vazio),
> nunca inventados — mesma disciplina já vigente em `decision-state-read-model.ts` e `admin-metrics.ts`.

---

## ENTREGÁVEL 1 — MAPA COMPLETO DAS FONTES

**A espinha (índice do sistema solar):** `MissionIdentity` — namespace `identities`
(`document-stores.ts:299`; tipo em `mission-runtime/types.ts:40`). Liga a chave de contato
(`chatId`, WhatsApp) a **todas** as identidades canônicas do cliente:
`personId · clienteId · missionId · caseId · processId · latestTruthId · latestStateId ·
latestStageId · lastDocumentId · lastEventId`. **É o "join key" oficial do ALIR** — já existe,
será reutilizado, nada novo.

| Órbita do ALIR                             | Fonte real (reutilizável)                                                         | Onde vive (namespace / stream / arquivo)                                           | Classe                                   | Existe?                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| **Índice / Identidade**                    | `MissionIdentity`                                                                 | `identities` · `types.ts:40`                                                       | CANÔNICO (índice)                        | 🟢                                           |
| **Pessoa**                                 | Agregado `Person` (event‑sourced) + `identity.personId`                           | stream `person` (event store) · `domain/person`                                    | CANÔNICO                                 | 🟢                                           |
| **Conversas**                              | `ConversationStore` (`MemoryEntry`)                                               | `conv:<chatId>` / `conv-idx:<chatId>` · `document-stores.ts:111`                   | CANÔNICO                                 | 🟢                                           |
| **Memória viva / AHRI**                    | `ClientMemory` (atributos, estilo, tempos, docs)                                  | `client-memory` · `living-memory/client-memory.ts`                                 | DERIVADO                                 | 🟢                                           |
| **Documentos**                             | `DocumentLink` + stream `document` + `ClientMemory.documentsSent/Pending` + texto | `document-link`, `document-text`, `client-memory`, stream `document`               | CANÔNICO + DERIVADO (pendências)         | 🟢                                           |
| **Missão · Verdade · Estado · Etapa**      | `MissionSnapshot` via `decision-state` + `identity.latest*Id`                     | `decision-state` · streams `operational-truth/state/stage` · `mission-snapshot.ts` | DERIVADO (snapshot) + CANÔNICO (eventos) | 🟢                                           |
| **Encerramento / Reabertura**              | `DecisionStateRecord.terminalState`                                               | `decision-state` · `decision-state-read-model.ts:24`                               | DERIVADO                                 | 🟢                                           |
| **Workflow / Progresso**                   | `MissionProgress`                                                                 | `workflow` · `workflow-runtime.ts:26`                                              | DERIVADO                                 | 🟢                                           |
| **Acompanhamento / Recorrência**           | `ScheduledTask`                                                                   | `scheduler` · `scheduler-runtime.ts`                                               | TEMPORÁRIO                               | 🟢                                           |
| **Operação (fila humana)**                 | `HandoffTask`                                                                     | `handoff` · `human-handoff-runtime.ts:13`                                          | CANÔNICO                                 | 🟢                                           |
| **Atribuição (advogado)**                  | `CaseAssignment`                                                                  | `assignments` · `juridical-work.ts:46`                                             | CANÔNICO                                 | 🟢                                           |
| **Situação Jurídica / Processo**           | `JuridicalEntry` + stream `process`                                               | `juridical` · `juridical-work.ts:34` · `domain/process`                            | CANÔNICO                                 | 🟢 (parcial)                                 |
| **Equipe / Responsável**                   | `StaffMember`                                                                     | `staff` · `staff-directory.ts:17`                                                  | CANÔNICO                                 | 🟢                                           |
| **Decisões / Auditoria**                   | `DecisionRequest` + event store (append‑only)                                     | `decisions` · event store                                                          | CANÔNICO                                 | 🟢                                           |
| **Timeline**                               | Event store (StoredEvent, hash‑chain)                                             | `pg-event-store` / streams do cliente                                              | CANÔNICO                                 | 🟢                                           |
| **Qualidade (AHRI/Shadow)**                | `ShadowReport`                                                                    | `shadow` / `shadow-by-id` · `production/shadow.ts`                                 | EXTERNO/DERIVADO                         | 🟢                                           |
| **Config (nº oficial, etc.)**              | `ProductionConfig`                                                                | `config` · `document-stores.ts:55`                                                 | EXTERNO                                  | 🟢                                           |
| **Próxima ação**                           | `NextBestActionPlanner` (Executive Brain) — algoritmo                             | `executive-brain` runtime (não persiste por cliente)                               | CALCULADO                                | 🟡 algoritmo existe; não exposto por cliente |
| **Perícia / Laudo**                        | — (ato humano do perito)                                                          | (nenhum)                                                                           | CANÔNICO                                 | 🔴 ausente → `W1‑03`                         |
| **Estágio Comercial (funil 1→12)**         | — (só existe `operational-stage`, que é operacional)                              | (nenhum comercial)                                                                 | DERIVADO                                 | 🔴 ausente → `W1‑04`                         |
| **Situação Comercial / Venda / Sociedade** | —                                                                                 | (nenhum)                                                                           | CANÔNICO                                 | 🔴 ausente → Onda 2/3                        |
| **Financeiro / Honorário / Distribuição**  | —                                                                                 | (nenhum)                                                                           | CANÔNICO/CALCULADO                       | 🔴 ausente → Onda 3                          |
| **Escritório Parceiro**                    | —                                                                                 | (nenhum)                                                                           | CANÔNICO                                 | 🔴 ausente → Onda 2                          |
| **Portal do Cliente**                      | —                                                                                 | (nenhum)                                                                           | EXTERNO                                  | 🔴 ausente → futuro                          |

**Conclusão da descoberta:** ~80% das órbitas do ALIR **já têm fonte real e reutilizável**. As
ausentes (perícia, estágio comercial, comercial, financeiro, escritório, portal) **não serão
inventadas** — o ALIR as expõe como **slots vazios explícitos**, preenchidos quando seus
produtores nascerem (W1‑03/04, Ondas 2/3). Isso cumpre "reutilizar → complementar → criar".

---

## ENTREGÁVEL 2 — CONTRATO OFICIAL DO ALIR

O ALIR é um **DTO de leitura** (`ALIRView`) — projeção somente‑leitura, keyed por `clienteId`
(com `missionId` como eixo do caso corrente). **Não é agregado, não tem invariantes de escrita,
não emite eventos.** Consumido pelo SO (Onda 1+) e, quando útil, como contexto do Brain (via
snapshot, que permanece a fronteira do Brain — o ALIR **não** substitui `MissionSnapshot`).

### Documentação campo‑a‑campo

Cada campo segue as 9 dimensões exigidas: **Origem · Responsável (quem altera) · Quem consome ·
Quando atualiza · Derivado|Persistido · Reconstruível · Classe**. (Descrição na 1ª coluna.)

**§ Meta (cabeçalho da projeção)**

| Campo                               | Origem            | Quem altera         | Consome            | Quando atualiza       | Deriv/Persist       | Reconstruível | Classe    |
| ----------------------------------- | ----------------- | ------------------- | ------------------ | --------------------- | ------------------- | ------------- | --------- |
| `clienteId` (identidade do cliente) | `MissionIdentity` | R2 (reconhecimento) | SO                 | ao reconhecer cliente | Persistido (índice) | Sim           | CANÔNICO  |
| `chatId` (contato WhatsApp)         | `MissionIdentity` | webhook/R1          | SO/AHRI            | 1º contato            | Persistido          | Sim           | CANÔNICO  |
| `projectedAt` (quando projetado)    | Runtime ALIR      | Runtime             | SO                 | a cada recomposição   | Derivado            | Sim           | CALCULADO |
| `schemaVersion` / `contentHash`     | Runtime ALIR      | Runtime             | SO/observabilidade | a cada mudança        | Derivado            | Sim           | CALCULADO |

**§ Pessoa**

| Campo                              | Origem                            | Quem altera         | Consome | Quando          | D/P                 | Recon. | Classe   |
| ---------------------------------- | --------------------------------- | ------------------- | ------- | --------------- | ------------------- | ------ | -------- |
| `pessoa.personId`                  | `identity.personId`               | R2                  | SO      | ao reconhecer   | Persistido          | Sim    | CANÔNICO |
| `pessoa.identidadeCivil` (opaca)   | stream `person` / `CivilIdentity` | R2                  | SO      | ao reconhecer   | Persistido (evento) | Sim    | CANÔNICO |
| `pessoa.origemReconhecimento`      | `RecognitionOrigin`               | R2                  | SO      | ao reconhecer   | Persistido          | Sim    | CANÔNICO |
| `pessoa.atributos` (nome, cidade…) | `ClientMemory.attributes`         | Extrator de memória | SO      | a cada conversa | Derivado            | Sim    | DERIVADO |

**§ Contato & AHRI**

| Campo                                    | Origem                           | Quem altera | Consome       | Quando           | D/P      | Recon. | Classe   |
| ---------------------------------------- | -------------------------------- | ----------- | ------------- | ---------------- | -------- | ------ | -------- |
| `ahri.estiloConversa`                    | `ClientMemory.conversationStyle` | memória     | SO            | a cada turno     | Derivado | Sim    | DERIVADO |
| `ahri.tempoRespostaMedioMs`              | `ClientMemory.avgResponseMs`     | memória     | SO            | a cada resposta  | Derivado | Sim    | DERIVADO |
| `ahri.primeiroContatoAt/ultimoContatoAt` | `ClientMemory`                   | memória     | SO            | a cada msg       | Derivado | Sim    | DERIVADO |
| `ahri.qualidade` (Shadow)                | `ShadowReport`                   | Shadow      | SO/Supervisor | ao auditar turno | Derivado | Sim    | EXTERNO  |

**§ Documentos**

| Campo                                       | Origem                                     | Quem altera         | Consome | Quando           | D/P              | Recon. | Classe    |
| ------------------------------------------- | ------------------------------------------ | ------------------- | ------- | ---------------- | ---------------- | ------ | --------- |
| `documentos.enviados[]` (ref, sha256, mime) | `DocumentLink` + stream `document`         | R3 (reconhecimento) | SO      | ao receber doc   | Persistido       | Sim    | CANÔNICO  |
| `documentos.pendentes[]`                    | `ClientMemory.documentsPending` / snapshot | Brain/memória       | SO      | ao pedir/receber | Derivado         | Sim    | DERIVADO  |
| `documentos.textoExtraido`                  | `document-text` cache                      | leitura de doc      | SO      | ao ler doc       | Derivado (cache) | Sim    | CALCULADO |

**§ Missão (caso corrente)**

| Campo                               | Origem                                | Quem altera         | Consome  | Quando                | D/P                      | Recon. | Classe     |
| ----------------------------------- | ------------------------------------- | ------------------- | -------- | --------------------- | ------------------------ | ------ | ---------- |
| `missao.missionId/caseId/processId` | `MissionIdentity`                     | mission‑runtime     | SO       | ao criar/vincular     | Persistido               | Sim    | CANÔNICO   |
| `missao.stageCode` (etapa)          | `MissionSnapshot`/`operational-stage` | R6 represent‑stage  | SO/Brain | ao representar        | Derivado                 | Sim    | DERIVADO   |
| `missao.stateCode` (estado)         | `MissionSnapshot`/`operational-state` | R6 derive‑state     | SO/Brain | ao derivar            | Derivado                 | Sim    | DERIVADO   |
| `missao.truthEstablished`           | `DecisionStateRecord`                 | R6 build‑truth      | SO/Brain | ao sintetizar verdade | Derivado                 | Sim    | DERIVADO   |
| `missao.terminalState` (ENCERRADA)  | `DecisionStateRecord.terminalState`   | CloseMission/Reopen | SO/Brain | ao encerrar/reabrir   | Derivado                 | Sim    | DERIVADO   |
| `missao.progresso[]`                | `MissionProgress` (workflow)          | workflow‑runtime    | SO       | a cada passo          | Derivado                 | Sim    | DERIVADO   |
| `missao.acompanhamento`             | `ScheduledTask` (scheduler)           | scheduler‑runtime   | SO       | ao agendar/disparar   | Persistido (transitório) | Sim    | TEMPORÁRIO |

**§ Operação & Responsáveis**

| Campo                            | Origem           | Quem altera    | Consome     | Quando      | D/P        | Recon. | Classe   |
| -------------------------------- | ---------------- | -------------- | ----------- | ----------- | ---------- | ------ | -------- |
| `operacao.handoffsAbertos[]`     | `HandoffTask`    | Brain (escala) | SO/Operador | ao escalar  | Persistido | Sim    | CANÔNICO |
| `operacao.atribuicao` (advogado) | `CaseAssignment` | Administrador  | SO/Advogado | ao atribuir | Persistido | Sim    | CANÔNICO |
| `operacao.responsaveis[]`        | `StaffMember`    | Admin          | SO          | ao alocar   | Persistido | Sim    | CANÔNICO |

**§ Jurídico / Processo**

| Campo                                   | Origem                                  | Quem altera | Consome | Quando           | D/P        | Recon. | Classe   |
| --------------------------------------- | --------------------------------------- | ----------- | ------- | ---------------- | ---------- | ------ | -------- |
| `juridico.processo` (nº, movimentações) | stream `process` + `JuridicalEntry`     | Advogado    | SO      | a cada andamento | Persistido | Sim    | CANÔNICO |
| `juridico.pendencias[]` (prazos, docs)  | `JuridicalEntry` (kind=prazo/documento) | Advogado    | SO      | ao registrar     | Persistido | Sim    | CANÔNICO |

**§ Timeline & Auditoria**

| Campo                             | Origem                           | Quem altera | Consome       | Quando         | D/P                      | Recon. | Classe   |
| --------------------------------- | -------------------------------- | ----------- | ------------- | -------------- | ------------------------ | ------ | -------- |
| `timeline[]` (eventos do cliente) | Event store (streams do cliente) | domínio     | SO            | a cada evento  | Persistido (append‑only) | Sim    | CANÔNICO |
| `auditoria.decisoes[]`            | `DecisionRequest` + event store  | domínio     | SO/Supervisor | a cada decisão | Persistido               | Sim    | CANÔNICO |

**§ Próxima ação**

| Campo         | Origem                          | Quem altera              | Consome | Quando           | D/P                            | Recon. | Classe    |
| ------------- | ------------------------------- | ------------------------ | ------- | ---------------- | ------------------------------ | ------ | --------- |
| `proximaAcao` | `NextBestActionPlanner` (Brain) | algoritmo determinístico | SO      | ao recompor ALIR | **Não persistido** (calculado) | Sim    | CALCULADO |

**§ Slots explicitamente ausentes (sem produtor hoje — nunca inventados)**

| Campo                                          | Estado | Nasce em |
| ---------------------------------------------- | ------ | -------- |
| `pericia` (laudo, resultado)                   | `null` | `W1‑03`  |
| `estagioComercial` (funil 1→12)                | `null` | `W1‑04`  |
| `comercial` (venda/sociedade)                  | `null` | Onda 2/3 |
| `financeiro` (honorário/distribuição/aReceber) | `null` | Onda 3   |
| `escritorio` (parceiro)                        | `null` | Onda 2   |
| `portalCliente`                                | `null` | futuro   |

> **Invariante do contrato:** todo campo do ALIR ou aponta para uma fonte **CANÔNICA/DERIVADA
> existente**, ou é **CALCULADO em leitura**, ou é **slot ausente declarado**. Nunca há dado
> "só do ALIR". Portanto o ALIR é **sempre 100% reconstruível** e **jamais fonte de duplicação**.

---

## ENTREGÁVEL 3 — MODELO DA PROJEÇÃO

**O ALIR é uma projeção COMPOSTA, keyed por `clienteId`, montada a partir do índice
`MissionIdentity` + os read models/stores já existentes.** Não introduz **nenhuma nova fonte de
verdade**. Duas propriedades constitucionais:

1. **Composição sobre o índice.** Dado um `clienteId`/`chatId`, o Runtime lê `MissionIdentity`
   para obter todos os IDs e então **compõe** cada órbita a partir de sua fonte já mapeada
   (Entregável 1). Sem novas tabelas de verdade.
2. **Materialização opcional (só cache).** Para leitura rápida no SO, o ALIR pode ser
   **materializado** como um documento derivado (namespace novo `alir`, sobre o mesmo `JsonStore`
   — cache, **não** verdade). Sendo cache, é descartável e reconstruível a qualquer momento. A
   decisão de materializar/quando é do **W1‑01B**; a Foundation apenas autoriza o cache derivado.

**Reuso‑primeiro (escada aplicada):**

- **Reutilizar:** `MissionIdentity`, `MissionSnapshot`, `ClientMemory`, `DocumentLink`,
  `MissionProgress`, `HandoffTask`, `CaseAssignment`, `JuridicalEntry`, `StaffMember`,
  `ScheduledTask`, event store, `ShadowReport`, `ProductionConfig`, `NextBestActionPlanner`.
- **Complementar:** apenas um **compositor de leitura** (`ALIRComposer`) e, se necessário, um
  **cache derivado** (`alir` namespace). Nada disso é fonte de verdade.
- **Criar (só por último):** nenhuma tabela canônica nova nesta Onda para o ALIR. Slots ausentes
  ganham fonte nas ondas próprias (W1‑03/04, 2, 3), e o ALIR passa a lê‑los sem reescrita.

**Fronteiras respeitadas:** DF‑08 (interfaces leem só read models) — o `ALIRComposer` lê stores
de leitura/índice, **nunca o event store diretamente** para decisão (a Timeline lê o log apenas
como histórico de apresentação, não como fonte de decisão). O Brain continua com `MissionSnapshot`.

---

## ENTREGÁVEL 4 — ESTRATÉGIA DE ATUALIZAÇÃO

**Mecanismo recomendado: invalidação orientada a evento, reutilizando o Event Dispatcher.**
Como cada órbita já é atualizada por seus próprios subscribers (ex.: `admin-projection-subscriber`,
`document-link-subscriber`, `decision-state` fold), o ALIR **não recalcula nada por conta própria**
— ele:

1. **Lazy compose (sempre correto):** se não houver cache, o ALIR é composto sob demanda das
   fontes atuais → nunca fica velho. É o comportamento‑base do W1‑01B.
2. **Cache + invalidação (performance):** um `ALIRInvalidationSubscriber` (irmão dos subscribers
   existentes, via `serialized-subscriber`) escuta os eventos dos streams de um cliente
   (`person/mission/document/operational-*/process/...`), resolve o `clienteId` pelo índice e
   **marca o cache daquele cliente como sujo** (ou recompoe). Sem novo sistema de eventos.

**Quando atualiza (gatilhos, por órbita):** documento recebido → §Documentos; verdade/estado/etapa
derivados → §Missão; encerrar/reabrir → §Missão.terminalState; handoff/atribuição → §Operação;
andamento jurídico → §Jurídico; nova mensagem → §Contato/AHRI; agendamento → §Acompanhamento.
Cada gatilho **já emite evento hoje**; o ALIR só reage.

**Consistência:** o cache é eventual; a leitura lazy é forte. O SO usa cache com `projectedAt`
visível; em caso de dúvida, recompõe. Nunca há escrita do ALIR de volta nas fontes (read‑only).

---

## ENTREGÁVEL 5 — ESTRATÉGIA DE RECONSTRUÇÃO

Porque o ALIR é **100% derivado**, a reconstrução é garantida em dois níveis:

- **Nível 1 (barato):** descartar o cache `alir` e **recompor** de `MissionIdentity` + read models.
  Instantâneo por cliente; em lote para todos os `clienteId`.
- **Nível 2 (fundo):** se um read model de origem se corromper, **reprocessar o event store**
  (replay) reconstrói o read model (infra já existente: `rehydrator`, projectors/subscribers) e,
  em seguida, o ALIR recompõe. Nenhum dado do ALIR se perde porque **o ALIR nunca foi a verdade**.

**Versionamento:** cada `ALIRView` carrega `schemaVersion` (evolução do contrato) e `contentHash`
(hash do conteúdo projetado) — permite invalidar caches após mudança de esquema e detectar
divergência. Reconstrução é idempotente e determinística (mesmas fontes → mesmo `contentHash`).

**Auditoria da reconstrução:** cada recomposição registra (via observabilidade existente,
`observability-runtime`) origem, `clienteId`, versão e resultado — sem PII no traço.

---

## ENTREGÁVEL 6 — PLANO DE IMPLEMENTAÇÃO DO RUNTIME (`W1‑01B`)

Só inicia **após homologação desta Foundation**. Tarefas ordenadas, cada uma reutilizando infra
existente, **sem tela**:

| #   | Tarefa (W1‑01B)                                                                   | Reutiliza                           | Entrega                                          |
| --- | --------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| B‑1 | **`ALIRView` (contrato TS)** + tipos das órbitas + slots ausentes                 | tipos de `application`              | interface de leitura oficial                     |
| B‑2 | **`ALIRComposer`** (composição lazy sobre `MissionIdentity` + read models)        | todos os stores mapeados            | projeção correta sob demanda                     |
| B‑3 | **Cache derivado** `alir` (namespace no `JsonStore`)                              | `JsonStore`/`PgJsonStore`           | leitura rápida (descartável)                     |
| B‑4 | **`ALIRInvalidationSubscriber`** (marca sujo/recompoe por evento)                 | `serialized-subscriber`, dispatcher | atualização orientada a evento                   |
| B‑5 | **Reconstrução** (recompor 1 cliente / todos)                                     | `rehydrator`, projectors            | comando de rebuild idempotente                   |
| B‑6 | **Versionamento** (`schemaVersion`,`contentHash`)                                 | — (puro)                            | invalidção por esquema + detecção de divergência |
| B‑7 | **Auditoria & observabilidade**                                                   | `observability-runtime`             | traço de composição/reconstrução                 |
| B‑8 | **Testes** (composição, invalidação, reconstrução, ausência de PII, slots vazios) | vitest suíte                        | verdes + auditoria de completude                 |

**Critérios de aceite do W1‑01B:** (a) dado um cliente real, `ALIRComposer` devolve todas as
órbitas com fonte real e os slots ausentes como `null`/vazio (sem invenção); (b) um evento em
qualquer órbita invalida/atualiza o ALIR daquele cliente; (c) `rebuild` reproduz o mesmo
`contentHash`; (d) nenhuma escrita de volta nas fontes; (e) typecheck+lint+suíte completa verdes;
(f) auditoria de completude. **Nenhum componente visual.**

---

## HOMOLOGAÇÃO DA FOUNDATION (W1‑01A)

Peço sua homologação de que: **(1)** o mapa de fontes está correto e completo; **(2)** o contrato
do ALIR e a classificação de cada campo estão aprovados; **(3)** a estratégia de projeção
(composta, sem nova verdade), atualização (invalidação por evento) e reconstrução (100% derivada)
estão aprovadas; **(4)** o plano do Runtime `W1‑01B` está aprovado.

Homologado, inicio o **W1‑01B — ALIR RUNTIME** pela tarefa **B‑1** (contrato `ALIRView`),
seguindo o ciclo Planejar→Implementar→Testar→Homologar→Publicar, **um item por vez**. Nenhuma
tela, nenhum componente visual, nenhum banco novo de verdade — apenas o primeiro ativo do
Sistema Operacional: **o ALIR**.
