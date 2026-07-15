# ADR-0002A — Executive Brain Architecture (Runtime Cognitivo da AHRI)

**Status:** Proposto (aguardando ratificação do fundador) · **Data:** 2026-07-14 · **Escopo:** Fase 2 — camadas Application / Runtime / CQRS / Event Store
**Natureza:** documento de engenharia (fora do Canon). Não cria regra do Livro Mestre; **deriva** dele e não pode contrariá-lo (Lei 5).
**Pré-condição:** Domain Model CONGELADO (19 entidades, 101 invariantes) — esta ADR não altera nenhuma entidade, invariante, Value Object, evento de domínio, contrato público nem o Livro Mestre.
**Deriva de:** ADR-0001 (arquitetura oficial) · governada por DF-09, Art. 15º, R7/R8, E9, E10, Lei 4.

---

## 1. Contexto

A AHRI deve conduzir o cliente do primeiro "Oi" (via WhatsApp, originado de tráfego pago) até o encerramento da missão, **parecendo uma inteligência viva** — nunca chatbot, nunca árvore de decisão. Simultaneamente, o Canon congelado exige que a AHRI seja **assistiva** (Art. 15º), **jamais decida matéria humana** (DF-09; INV-AH-01/03/04), e que **toda ação automatizada nasça de uma Regra Operacional** com registro DECISOR/TIPO/FUNDAMENTO (INV-AH-02; RO-R7-001), produzindo **exclusivamente** "atuação legítima" ou "atuação impedida".

Reconciliar "viva" com "constitucionalmente limitada" é o problema central desta ADR. A resposta é **separar percepção, decisão e expressão em três camadas cognitivas**, mantendo o LLM apenas nas pontas (linguagem) e o núcleo de decisão determinístico e auditável.

---

## 2. Decisões (a ratificar pelo fundador)

| # | Decisão | Norma do Canon que a exige/justifica |
|---|---|---|
| 1 | **Três Camadas Cognitivas**: Perception → Executive Brain → Conversation. Fluxo unidirecional. | Art. 15º (assistiva); DF-09; separação de responsabilidades |
| 2 | **Executive Brain é determinístico e LIVRE de LLM.** Decide por avaliação de Regras Operacionais. | Lei 4 (auditável); DF-09; INV-AH-02; RO-R7-001 |
| 3 | **LLM vive só na Perception (entrada) e na Conversation (saída).** Sandboxed; nunca decide fato/regra. | DF-09; Art. 15º; item 11 ADR-0001 (IA sem regras) |
| 4 | **O Brain só decide estratégia OPERACIONAL**, nunca jurídica; competência humana → Human Handoff. | INV-AD-01/02; INV-PT-01; DF-09 |
| 5 | **Toda decisão do Brain carrega `regra_operacional_ref` + DECISOR/TIPO/FUNDAMENTO** ou é "impedida" com causa. | INV-AH-02; RO-R7-001; DF-13; Art. 14º |
| 6 | **Domínio só muta por Use Case chamando as fábricas congeladas**; nunca instanciação por fora; nunca leitura do Event Store por interface. | ADR-0001 itens 4/12; DF-08; invariantes |
| 7 | **Memória infinita = Event Store append-only + projeções**; LLM nunca é a memória. | Lei 3; DF-11; DF-08 |
| 8 | **Learning é offline e consultivo a humanos** (propõe Regras Operacionais); nunca realimenta o Brain ao vivo; nunca altera Verdade. | Lei 4; DF-09; DF-13; DF-03 |
| 9 | **Relationship serve dignidade/continuidade**, não CRM comercial; contexto de leitura; jamais muta domínio. | Art. 5º; Art. 6º |
| 10 | **Onde o Canon é silente, a AHRI declara incerteza (E10) e escala**; jamais inventa regra/fato. | E10; DF-13; E6-L03 |
| 11 | **Percepção de silêncio/tempo** vem do Scheduler como eventos temporais; a AHRI age no tempo sem polling mecânico. | Art. 9º (INV-07: sempre próxima ação ou impedimento) |
| 12 | **Cliente: 100% WhatsApp. Humanos: 3 Portais + Notification.** Mundos comunicam só por eventos. | ADR-0001 item 6; DF-08 |

---

## 3. As Três Camadas Cognitivas

### CAMADA 1 — PERCEPTION LAYER (percebe)
Interpreta **texto, áudio, imagem, artefato documental, silêncio, tempo, emoção, urgência, intenção**. Usa o LLM (multimodal) + sinais do Scheduler. **Não decide. Não altera domínio.** Produz um **Percept** estruturado e imutável (intenção percebida, entidades, emoção, urgência, artefatos detectados, duração de silêncio). Se o artefato for um documento, produz apenas "artefato documental percebido com atributos X" — **o reconhecimento (Entidade 03) é ato de domínio posterior, decidido pelo Brain**.

### CAMADA 2 — EXECUTIVE BRAIN (decide) — determinístico
O verdadeiro cérebro operacional. **Nunca altera o Domain diretamente. Nunca viola Regra Operacional. Nunca decide juridicamente.** Trabalha exclusivamente sobre **Verdade Operacional, Estado, Etapa, Regras Operacionais, Memória, Contexto, Percept**. Decide: objetivo atual da missão, prioridade, estratégia **operacional**, quando falar/esperar/cobrar/escalar/pedir documento/parar/voltar/envolver humano. **Não conversa** — emite **Intenções** (`IntentionFormed`) e/ou dispara **Use Cases** (atos de domínio) com fundamento, e/ou emite **impedimento** ou **handoff**. Subcomponentes:
- **Goal Selector** — deriva o objetivo operacional atual da Verdade/Estado/Etapa.
- **Priority/Strategy Planner** — ordena ações por prioridade, subordinado às ROs.
- **Legitimacy Gate (RO-R7-001)** — valida cada ação candidata: responsável+autorizado+competência+registro+RO. Ilegítima → impedida (com causa). Nenhum terceiro resultado.
- **Intention Emitter** — publica Intenções para a Conversation/Notification/Scheduler.

### CAMADA 3 — CONVERSATION LAYER (fala)
Recebe **somente a Intenção**. Transforma-a em **linguagem natural** com o LLM. **Nunca templates, nunca árvore, nunca inventa fato/regra, nunca altera domínio.** Alimenta-se de Memória + Relationship para soar viva e contínua. Única responsabilidade: conversar como inteligência viva. Se a Intenção for WAIT/STOP, não fala.

> **Regra de ouro:** o LLM percebe e frasea; o Brain determinístico decide. A "vida" está na linguagem e no contexto total; a "lei" está na decisão auditável.

---

## 4. Runtimes (serviços de Application) — inventário completo

**Córtex cognitivo:** `Perception Runtime` · `Executive Brain Runtime` · `Conversation Runtime`.
**Suporte:** `Mission Runtime` (reidrata Verdade/Estado/Etapa) · `Memory Runtime` (memória infinita) · `Workflow Runtime` (sagas R1→R9) · `Scheduler Runtime` (timers duráveis) · `Notification Runtime` (humanos) · `Human Handoff Runtime` (ponte IA→humano) · `Event Store Runtime` (write side) · `CQRS/Projection Runtime` (read side).
**Novos (esta ADR):** `Relationship Runtime` · `Learning Runtime`.

### 4.1 Perception Runtime (formalização)
- **Responsabilidade:** transformar entrada bruta (mensagem, mídia, evento temporal) em `Percept` estruturado.
- **Entradas:** `InboundMessageReceived`, `TemporalTriggerFired` (silêncio/prazo).
- **Saída:** `PerceptionProduced(percept)`.
- **Ports:** `LlmPerceptionPort` (multimodal), `MediaStorePort` (blobs), `ReadModelPort` (contexto leve).
- **Fronteira:** read-only; **não decide, não muta domínio, não inventa**. Incerteza sempre explícita (E10).

### 4.2 Executive Brain Runtime (formalização detalhada)
- **Responsabilidade:** decidir a próxima **atuação operacional legítima** e emitir Intenções.
- **Entradas:** `PerceptionProduced` + snapshots de Mission Runtime (Verdade/Estado/Etapa) + Memory + Relationship + `RuleCatalog` (ROs vigentes).
- **Processo:** Goal Selector → Priority/Strategy Planner → Legitimacy Gate (RO-R7-001) → Intention Emitter. Determinístico: mesma entrada → mesma decisão (reprodutível para auditoria).
- **Saídas possíveis (exaustivas):** `IntentionFormed` (SPEAK/WAIT/CHARGE/ESCALATE/REQUEST_DOCUMENT/STOP/RESUME); ou invocação de **Use Case** (ato de domínio) com `AhriActuationRecord` (DECISOR=AHRI, TIPO=Decisão Operacional Automatizada, FUNDAMENTO=Regra Constitucional + RO); ou `ActuationImpeded(cause)`; ou `HumanHandoffRequested(role)`.
- **Ports:** `RuleCatalogPort`, `ReadModelPort`, `UseCaseBus` (invoca comandos), `Clock`.
- **Fronteira:** **nunca** LLM; **nunca** muta domínio direto; **nunca** jurídico; **nunca** inventa RO — silêncio do Canon → handoff/incerteza.

### 4.3 Conversation Runtime
- **Responsabilidade:** Intenção → linguagem natural → WhatsApp.
- **Entradas:** `IntentionFormed(SPEAK...)` + Memory + Relationship.
- **Saída:** `OutboundMessage` via `ConversationGateway`.
- **Ports:** `LlmExpressionPort`, `ConversationGateway`, `ReadModelPort`.
- **Fronteira:** sem decisão, sem fato/regra novos, sem domínio.

### 4.4 Relationship Runtime (novo)
- **Responsabilidade:** relacionamento contínuo — datas importantes, preferências, histórico humano, engajamento de longo prazo — **a serviço da dignidade e continuidade** (Art. 6º).
- **Entradas:** eventos de conversa/domínio (leitura), sinais de Percepção.
- **Saída:** `RelationshipContext` (projeção de Application) consumida por Conversation/Brain.
- **Ports:** `RelationshipStorePort` (armazenamento próprio da Application).
- **Fronteira:** **jamais** altera domínio; **jamais** vira CRM comercial (Art. 5º); read-context.

### 4.5 Learning Runtime (novo)
- **Responsabilidade:** aprender de eventos, feedback humano, resultados e correções; **gerar conhecimento para versões futuras**.
- **Entradas:** stream de eventos (domínio + integração), feedback dos portais, resultados de missões.
- **Saída:** `LearningInsight` / **propostas de Regra Operacional** → fila de revisão do **Portal Administração** (humano ratifica → `OperationalRuleAggregate.approve`).
- **Ports:** `LearningSinkPort` (data warehouse append-only, separado do Event Store e da Verdade).
- **Fronteira:** **offline**; **nunca** realimenta o Brain ao vivo; **nunca** altera Verdade Operacional (DF-03; Lei 4).

### 4.6 Demais runtimes (resumo)
`Mission` (reidrata estado por missão) · `Memory` (retrieval+sumarização sobre o Event Store) · `Workflow` (process managers reagindo a eventos de domínio) · `Scheduler` (timers duráveis → eventos temporais) · `Notification` (portais/canais) · `Human Handoff` (tarefa no portal + pausa/retomada por evento; preserva contexto — INV-11) · `Event Store` (append-only + outbox) · `CQRS/Projection` (Read Models; interfaces nunca leem o store — item 12).

---

## 5. Diagrama completo

```
 TRÁFEGO PAGO → LANDING → "Conversar com a AHRI" → WHATSAPP
                                                      │ (webhook)
                                             ┌────────▼─────────┐
                                             │  apps/api (Fastify)│  IngestInboundMessage (idempotente)
                                             └────────┬─────────┘
                                                      │  InboundMessageReceived
        Scheduler ──TemporalTriggerFired──┐          │
                                          ▼          ▼
                              ╔══════════ PERCEPTION RUNTIME ══════════╗   [LLM percepção]
                              ║  percebe: texto/áudio/imagem/silêncio/  ║
                              ║  tempo/emoção/urgência/intenção         ║
                              ╚═══════════════════╤════════════════════╝
                                                  │ PerceptionProduced (Percept)
   Mission Runtime ─Verdade/Estado/Etapa─┐        │
   Memory Runtime ─contexto/histórico────┤        │
   Relationship Runtime ─contexto humano─┤        ▼
   RuleCatalog (ROs vigentes) ───────────┴─► ╔════ EXECUTIVE BRAIN RUNTIME ════╗  [DETERMINÍSTICO, sem LLM]
                                              ║ Goal→Priority→LegitimacyGate    ║
                                              ║        (RO-R7-001)              ║
                                              ╚═══╤═════════╤═════════╤═════════╝
                    IntentionFormed(SPEAK) ◄──────┘         │         └──► HumanHandoffRequested ─► Notification ─► PORTAIS
                              │                    invoca Use Case              (perito/advogado/operador/supervisor/admin)
                              ▼                          │ (fábrica congelada)
                  ╔══ CONVERSATION RUNTIME ══╗           ▼
                  ║ intenção → linguagem viva ║   ┌─────────────────┐  domain events
                  ╚═════════╤════════════════╝   │  USE CASES (R1–R9)│──────────────┐
                            │ [LLM expressão]      └─────────────────┘              ▼
                            ▼                                              ╔═ EVENT STORE RUNTIME ═╗ append-only
                     ConversationGateway ─► WHATSAPP ─► CLIENTE            ║  + Outbox              ║
                                                                          ╚═══════════╤═══════════╝
                                                                                      ▼
                                                                          ╔ CQRS/PROJECTION RUNTIME ╗
                                                                          ║ Verdade/Estado/Etapa/    ║──► Read Models ──► Mission/Memory/Portais
                                                                          ║ timeline (Read Models)   ║
                                                                          ╚══════════════════════════╝
   Learning Runtime  ◄── (stream de eventos, offline) ── propõe ROs ──► PORTAL ADMIN (humano ratifica)
```

**Sequência de um turno:** WhatsApp→api→`InboundMessageReceived`→Perception→`PerceptionProduced`→Executive Brain (reidrata Verdade/Memory/Relationship/ROs; Legitimacy Gate) → {Intention→Conversation→WhatsApp} e/ou {Use Case→domain event→Event Store→Projection→Workflow} e/ou {Handoff→Notification→Portal} e/ou {Impedimento registrado}. Scheduler fecha o laço no tempo.

---

## 6. Dependências, fronteiras, ports e adapters

**Dependências (apontam para dentro):** `apps → application → domain`; `infrastructure` implementa ports; runtimes vivem em `application`, orquestram Use Cases, **nunca** importam infra nem tocam invariante.

**Ports (Application) → Adapters (Infrastructure):**
| Port | Adapter | Camada que usa |
|---|---|---|
| `ConversationInbound` (webhook) | WhatsApp webhook (Fastify) | Perception |
| `LlmPerceptionPort` / `LlmExpressionPort` | LlmGateway (sandboxed) | Perception / Conversation |
| `ConversationGateway` | WhatsApp Cloud API | Conversation |
| `RuleCatalogPort` | Read Model de Regras Operacionais | Executive Brain |
| `ReadModelPort` | PgProjections (read role) | Brain/Mission/Memory |
| `EventStorePort` / `UnitOfWork` / `Repository` | PgEventStore append-only | Use Cases / Event Store RT |
| `SchedulerPort` | DurableScheduler (timers em Postgres) | Scheduler |
| `NotificationPort` | PortalNotificationAdapter | Notification / Handoff |
| `RelationshipStorePort` | RelationshipReadStore | Relationship |
| `LearningSinkPort` | LearningWarehouse (append-only, isolado) | Learning |
| `OutboxPort` | OutboxPublisher (LISTEN/NOTIFY) | Event Store |
| `Clock` / `UuidGenerator` | infra determinística/estocástica | todos |

**Eventos — dois planos, nunca misturados:**
- **Eventos de Domínio (contratos congelados):** `MissionCreated`, `PersonRecognized`, `DocumentRecognized`, `EventRecognized`, `OperationalTruthSynthesized`, `OperationalStateDerived`, `OperationalStageRepresented`, `AhriOperationalResponsibilityAssumed`, `OperationalRuleApproved`, `*Designated`, `ClienteRecognized` — vivem no **Event Store**.
- **Eventos de Integração/Runtime (coordenação, não-domínio):** `InboundMessageReceived`, `PerceptionProduced`, `IntentionFormed`, `ActuationImpeded`, `HumanHandoffRequested`, `HumanActionCompleted`, `TemporalTriggerFired`, `OutboundMessageDispatched` — coordenam os runtimes; podem ser persistidos para auditoria, mas **não** poluem o domínio.

---

## 7. Por que esta arquitetura produz uma IA que parece viva sem violar o Livro Mestre

**Parece viva porque:** (1) a Perception lê o cliente em toda a sua riqueza (texto/áudio/imagem/silêncio/tempo/emoção/urgência); (2) a Conversation frasea cada resposta a partir do **contexto total da missão**, nunca de templates; (3) o Brain escolhe objetivo/prioridade/timing **da Verdade real**, então a mesma etapa gera comportamentos diferentes conforme a história; (4) Relationship dá continuidade humana (lembra a pessoa ao longo do tempo, com dignidade); (5) Learning melhora as Regras Operacionais com o tempo (via humanos).

**Não viola o Canon porque:** (1) o Brain é **determinístico e RO-gated** — toda atuação carrega DECISOR/TIPO/FUNDAMENTO (INV-AH-02; RO-R7-001) ou é impedida com causa; (2) o **LLM é sandbox de linguagem** — nunca decide fato/regra (DF-09; Lei 4); (3) o **domínio só muta por fábricas congeladas** em Use Cases (invariantes intactas); (4) competência jurídica/técnica **sempre escala a humano** (Human Handoff; DF-09; INV-AD/PT); (5) onde o Canon é silente, **declara incerteza (E10) e escala** — jamais inventa; (6) **memória append-only** (Lei 3) e **interfaces só leem projeções** (item 12; DF-08); (7) Learning e Relationship são **read-context**, nunca mutam Verdade/domínio (DF-03; Art. 6º).

---

## 8. Decisões reservadas (não inventadas — pertencem ao Canon/fundador/Governança)
- Catálogo Oficial de Eventos (DF-05) e catálogo de Regras Operacionais (DF-13) — pendentes; o Brain só executa ROs aprovadas.
- Critérios completos de autorização/visibilidade e supervisão (DF-12, Governança); retenção/LGPD (DF-40).
- "10 dias administrativos" e demais *timings* — parâmetros de Regra Operacional a aprovar; **não** estão no Canon congelado.
- Escolha do provedor de LLM e de WhatsApp; broker de fila na escala (início: outbox + LISTEN/NOTIFY, per ADR-0001).

---

## 9. Alternativas consideradas e rejeitadas
- **LLM como cérebro decisor:** rejeitado — não-auditável; violaria DF-09/Lei 4/RO-R7-001. (Achado A1.)
- **Learning realimentando o Brain ao vivo (auto-tuning):** rejeitado — IA que se automodifica sem rastro. (Achado A3.)
- **Relationship como CRM de engajamento:** rejeitado — Art. 5º/6º. (Achado A4.)
- **Árvore de decisão / flow engessado para a conversa:** rejeitado — a próxima ação é *computada da Verdade*, não selecionada de um flow.
- **Sessão em memória de processo:** rejeitado — contexto vive no Event Store (memória infinita; contexto entre dias por construção).

---

## 10. Veredito
Arquitetura de **três camadas cognitivas (Perception → Executive Brain determinístico → Conversation)** com **treze runtimes** (onze + Relationship + Learning), sobre event sourcing + CQRS da ADR-0001, produz uma AHRI que **parece viva** (linguagem + contexto total + continuidade) e permanece **integralmente constitucional** (decisão determinística, RO-gated, auditável; LLM sandboxed; domínio congelado intocado; competência humana sempre preservada). Os cinco achados de auditoria foram resolvidos como *guardrails*, sem alterar o Livro Mestre. **Apta à implementação por sprints (2A→2I), começando pelo Event Store Runtime.** Nenhum código foi escrito.
```
