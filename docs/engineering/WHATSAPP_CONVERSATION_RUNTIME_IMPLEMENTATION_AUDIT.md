# Auditoria de Implementação — WhatsApp Conversation Runtime (Sprint 2B)

> A AHRI passa a conversar com pessoas reais pelo WhatsApp (Evolution API) como uma
> inteligência viva — não chatbot, não árvore de decisão, não template. Esta
> auditoria prova, com **mecanismo** (código, `arquivo:linha`) e **evidência**
> (teste + asserção, ou saída de comando), que o Runtime cumpre a spec 2B **sem
> violar a fronteira constitucional**: o LLM percebe e frasea, o Executive Brain
> decide, e a Conversa apenas executa intenções.

- **Data:** 2026-07-14
- **Sprint 2A (Event Store / Dispatcher / Outbox) e Domínio:** CONGELADOS e
  **intocados** — todo o 2B é código novo em módulos novos (ver §8).
- **ADR de referência:** ADR-0002A (três camadas cognitivas) — esta é a **Camada 3
  (Conversation)** + a humanização de entrega.

## 0. Portões obrigatórios

```
pnpm typecheck   → Tasks: 12 successful, 12 total   EXIT 0
pnpm lint        → Tasks: 12 successful, 12 total   EXIT 0
pnpm test        → Tasks: 12 successful, 12 total   EXIT 0
   domain          194 passed
   application       38 passed   (+13 de 2B)
   infrastructure    55 passed | 4 skipped   (+28 de 2B; skip = Pg do 2A, sem DATABASE_URL)
   api                2 passed   (+2 de 2B)
```
**289 testes passando; 43 novos no Sprint 2B.** Os 4 pulados são a integração
Postgres do Sprint 2A (política: servidores são do dono).

## 1. O fluxo obrigatório, implementado

```
WhatsApp → Perception → Executive Brain → (Use Cases → Event Store: alhures) → Conversation → WhatsApp
```

Implementado ponta a ponta em `ConversationRuntime.receive`
([conversation-runtime.ts:71](../../packages/application/src/conversation/conversation-runtime.ts)):
1. **Percebe** — o LLM de percepção *entende* (percepções mecânicas não passam por LLM) → `Percept`.
2. **Contexto** (read-only) é montado.
3. **Executive Brain decide** — `brain.decide({percept, context})` devolve `ConversationIntent[]`.
   **A Conversa não cria intenção.**
4. **Executa** cada intenção: fala (frasea + enfileira) ou cala.
5. **Entrega humana** drena a fila (nunca instantânea, nunca sobreposta).

**Evidência:** teste *"percebe → Brain decide → frasea → entrega, e NUNCA
instantaneamente"* ([conversation-runtime.e2e.test.ts:73](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts))
e o teste HTTP *"POST /webhook/evolution processa um texto e entrega uma resposta viva"*
([conversation-webhook.test.ts](../../apps/api/src/conversation-webhook.test.ts)).

## 2. Os doze runtimes (inventário)

Todos em `packages/application/src/conversation/` (lógica pura, testável, sem tecnologia):

| # | Runtime | Arquivo | Papel |
|---|---------|---------|-------|
| 1 | Conversation | `conversation-runtime.ts` | Maestro do fluxo; executa intenções |
| 2 | Session | `session-runtime.ts` | Ciclo de vida da conversa (turnos, presença, awaiting) |
| 3 | Conversation Memory | `conversation-memory-runtime.ts` | Log de integração (entrada/percept/intenção/saída) |
| 4 | Prompt Builder | `prompt-builder-runtime.ts` | Quadro de fraseado + anti-repetição (sem template) |
| 5 | Message Queue | `message-queue-runtime.ts` | Fila FIFO de saída por conversa |
| 6 | Delivery | `delivery-runtime.ts` | Encenação humana: ler→pensar→digitar→enviar |
| 7 | Typing | `typing-runtime.ts` | "Digitando…" (composing) pela duração calculada |
| 8 | Presence | `presence-runtime.ts` | available/composing/paused no gateway + sessão |
| 9 | Delay | `delay-runtime.ts` | Primitiva de espera (Sleeper injetável) |
| 10 | Human-like Timing | `human-like-timing-runtime.ts` | Cadência determinística (nunca instantâneo) |
| 11 | Silence Detection | `silence-detection-runtime.ts` | Percebe silêncio/timeout (não decide) |
| 12 | Conversation Context | `conversation-context-runtime.ts` | Visão read-only para expressão/Brain |

Suporte: `percept.ts`, `intent.ts`, `phrasing.ts`, `humanization-policy.ts`, `ports.ts`.

## 3. Integração completa com a Evolution

- **Entrada (webhook → Percept):** `mapEvolutionUpsert`
  ([evolution-webhook-mapper.ts](../../packages/infrastructure/src/conversation/evolution/evolution-webhook-mapper.ts))
  normaliza as **doze naturezas**: texto, áudio, imagem, pdf, documento,
  localização, contato, silêncio, timeout, reação, edição, exclusão. Ignora
  `fromMe`; payload irreconhecível → `null`.
  **Evidência:** 13 casos em [evolution-webhook-mapper.test.ts](../../packages/infrastructure/src/conversation/evolution/evolution-webhook-mapper.test.ts)
  (um por natureza + fromMe + desconhecido).
- **Saída (gateway):** `EvolutionGateway`
  ([evolution-gateway.ts](../../packages/infrastructure/src/conversation/evolution/evolution-gateway.ts))
  implementa `ConversationGateway` sobre os endpoints REST da Evolution
  (`sendText`, `sendPresence`, `sendReaction`, `markMessageAsRead`), com HTTP
  injetável. **Evidência:** [evolution-gateway.test.ts](../../packages/infrastructure/src/conversation/evolution/evolution-gateway.test.ts).
- **HTTP:** rota `POST /webhook/evolution`
  ([server.ts](../../apps/api/src/server.ts)) — ACK imediato + processamento
  destacado (a resposta humana leva segundos; o webhook não bloqueia).

## 4. A fronteira constitucional (o que 2B **prova** que NÃO faz)

### 4.1 O LLM nunca decide — vive só em dois ports
`LlmPerceptionPort.understand` (entende) e `LlmExpressionPort.phrase` (frasea)
devolvem **dado/texto** ([ports.ts:29-46](../../packages/application/src/conversation/ports.ts)).
Nenhum caminho de decisão passa por LLM.
**Evidência:** teste *"a Conversa NÃO decide: com Brain vazio, nenhuma fala sai"*
([e2e:117](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)) —
com um Brain que devolve `[]`, mesmo uma mensagem rica **não gera resposta
alguma**. A "vida" do LLM (percepção/fraseado) roda, mas sem intenção do Brain
nada é dito. Logo, a decisão está no Brain, não no LLM.

### 4.2 Toda decisão vem do Executive Brain (Camada 2)
A Conversa consome `ExecutiveBrainPort.decide(...)`
([ports.ts:53-58](../../packages/application/src/conversation/ports.ts)) e **não
possui API para criar intenções**. Trocar o Brain (double → real) não muda uma
linha da Conversa (é um port). O Brain real é o Sprint 2C; aqui há um **double de
referência** claramente rotulado ([deterministic-executive-brain.ts:1-16](../../packages/infrastructure/src/conversation/deterministic-executive-brain.ts)),
sem motor de regras e sem acesso a domínio, só para fechar o fluxo em teste.

### 4.3 A Conversa não altera Verdade/Estado/Etapa, não cria Documento nem Evento
**Por construção:** o `ConversationRuntime` não recebe `EventStore`, `Repository`
nem `UnitOfWork` — não há port de escrita de domínio em toda a Camada 3.
**Evidência (grep, saída literal):**
```
conversation (application) importando EventStore/Repository/UnitOfWork/append de domínio:
  → apenas o comentário de fronteira em ports.ts e o ConversationStore.append
    (log de INTEGRAÇÃO, não o Event Store de domínio). Nenhum port de escrita de domínio.
conversation (application) importando @reconstrua/infrastructure: (none)
```
E o teste *"fronteira: a memória só guarda log de integração, nunca evento de
domínio"* ([e2e:126](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts))
assevera que os únicos `kind` gravados são `inbound|percept|intent|outbound|note`.
Toda intenção é registrada **com proveniência** (`operationalRuleRef`, INV-AH-02) —
teste *"registra a INTENÇÃO com proveniência"* ([e2e:104](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)).

## 5. "Parece humano" — nunca instantâneo, mecânico ou repetido

| Garantia | Mecanismo | Evidência |
|---|---|---|
| **Nunca instantâneo** | `HumanLikeTimingRuntime` garante `total >= minPreSendMs > 0` (ler+pensar+digitar) antes de todo envio ([human-like-timing-runtime.ts:37-54](../../packages/application/src/conversation/human-like-timing-runtime.ts)) | *"NUNCA responde instantaneamente"* (timing) + no e2e, `sleeper.total() >= minPreSendMs` e há `composing` **antes** de todo `text` ([e2e:73](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)) |
| **Nunca mecânico** | Cadência proporcional ao tamanho + jitter simétrico determinístico ([humanization-policy.ts:69](../../packages/application/src/conversation/humanization-policy.ts)) | *"proporcional ao tamanho"* e *"jitter dentro de ±jitter"* (timing test) |
| **Nunca repetido** | Guard anti-repetição (Jaccard) re-solicita fraseado até variar; janela configurável ([conversation-runtime.ts:169-198](../../packages/application/src/conversation/conversation-runtime.ts), [phrasing.ts](../../packages/application/src/conversation/phrasing.ts)) | *"nenhuma fala repete dentro da janela"* e *"contra um LLM teimoso, o guard esgota e deixa rastro"* ([e2e:150](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)) |
| **Nunca templates** | O Prompt Builder monta um **quadro** (intenção+contexto+tom+evitar), não um script de saída; o texto é gerado novo ([prompt-builder-runtime.ts](../../packages/application/src/conversation/prompt-builder-runtime.ts)) | Fraseados distintos por turno no teste anti-repetição |
| **Ordem, sem sobreposição** | Fila FIFO por conversa; drena uma por vez com pausa entre mensagens ([delivery-runtime.ts:60-80](../../packages/application/src/conversation/delivery-runtime.ts)) | *"duas intenções viram duas mensagens, em ordem, com digitando antes de cada"* ([e2e:194](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)) |

## 6. "A AHRI sabe quando…" — do Brain, executado pela Conversa

As diretivas (`IntentDirective`, [intent.ts:23-43](../../packages/application/src/conversation/intent.ts))
cobrem o "saber" da spec: **falar/perguntar/explicar** (`speak`+`speechAct`),
**esperar** (`wait`), **calar/acompanhar** (`accompany`), **insistir** (`insist`),
**mudar de assunto** (`change_subject`), **aguardar documentos**
(`await_documents`), **avisar prazos** (`notify_deadline`), **escalar** (`handoff`),
**parar/retomar** (`stop`/`resume`). `intentSpeaks` separa as que falam das que
silenciam ([intent.ts:76](../../packages/application/src/conversation/intent.ts)).
**Evidência:** o teste das doze naturezas ([e2e:239](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts))
prova que as diretivas **falantes** falam (1 mensagem) e as **silenciosas**
(reação, exclusão, timeout→`accompany`) **calam** (0 mensagens); e o teste de
silêncio prova que `silence`→`insist` (cobra) e `timeout`→`accompany` (acompanha em
silêncio).

## 7. Idempotência, silêncio e detecção mecânica

- **Idempotência:** nunca processa a mesma mensagem 2× (`ConversationStore.hasInbound`).
  Teste *"a mesma mensagem processa uma única vez"* ([e2e:110](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)).
- **Silêncio é detecção, não decisão:** `SilenceDetectionRuntime.scan` só produz o
  `Percept` de silêncio/timeout; a AÇÃO é do Brain ([silence-detection-runtime.ts](../../packages/application/src/conversation/silence-detection-runtime.ts)).
  Testes em [silence-detection-runtime.test.ts](../../packages/application/src/conversation/silence-detection-runtime.test.ts)
  (limiares, precedência do timeout, não re-perceber, ignorar inativas). Percepção
  mecânica não chama LLM — teste *"silence: enrichment nulo"* ([e2e:280](../../packages/infrastructure/src/conversation/conversation-runtime.e2e.test.ts)).

## 8. Prova de não-alteração do Sprint 2A e do domínio

- Todo o 2B é **código novo** em módulos novos: `packages/application/src/
  conversation/`, `packages/infrastructure/src/conversation/`, `apps/api/src/`.
- Reúso do 2A/kernel **apenas por import** de ports (`Clock`, `UuidGenerator`,
  `toUuid`). Nenhuma edição a `event-store/`, `event-dispatcher/` ou ao domínio.
  Os 194 testes de domínio passam idênticos.
- Únicas mudanças fora de `conversation/`: os barrels `application/src/index.ts` e
  `infrastructure/src/index.ts` (uma linha de `export *` cada), `apps/api/src/
  index.ts` (exporta a rota) e `apps/api/package.json` (+`@reconstrua/domain`,
  dependência legítima da raiz de composição). Nenhuma entidade, invariante,
  Value Object, evento de domínio, contrato público ou Livro Mestre alterado.

## 9. Decisões reservadas e limites (honestos)

- **O Executive Brain real é o Sprint 2C.** Aqui ele é um **port** + um double de
  referência determinístico (sem regras, sem domínio) só para fechar o fluxo. A
  Conversa está pronta e não muda quando o Brain real entrar.
- **Adapters de LLM reais** (percepção multimodal, expressão) são um port; 2B usa
  doubles determinísticos. A escolha de provedor é reservada (ADR-0002A §8).
- **Persistência:** 2B entrega stores in-memory (com fidelidade e testes). Um
  adapter Postgres para memória/sessão/fila é evolução direta (os ports já isolam),
  fora do escopo desta sprint.
- **Timings** (WPM, atrasos, limiares de silêncio) são **parâmetros de Regra
  Operacional a aprovar** (ADR-0002A §8), não Canon congelado — vivem em
  `HumanizationPolicy`, configuráveis, nunca inventados pelo LLM.

## 10. Veredito

O **WhatsApp Conversation Runtime** está implementado com os doze runtimes,
integração completa de entrada e saída com a Evolution, e a rota de webhook —
produzindo uma AHRI que **parece viva** (nunca instantânea, mecânica, repetida ou
por template) e permanece **integralmente dentro da fronteira**: o LLM percebe e
frasea, o Executive Brain decide, e a Conversa **apenas executa intenções**, sem
poder alterar Verdade/Estado/Etapa nem criar Documento/Evento (garantido por
construção — não há ports de escrita de domínio). Portões verdes: `typecheck` ✅
`lint` ✅ `test` ✅ (289 passando, 43 novos). Sprint 2A e Domínio intocados.

**Sprint 2B — WhatsApp Conversation Runtime: ENCERRADO.**
