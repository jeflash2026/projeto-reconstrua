# Auditoria de Implementação — GO LIVE Runtime (Sprint 2F)

> A operação REAL: o fluxo obrigatório completo (Meta Ads → WhatsApp/Evolution →
> Perception → Executive Brain → Mission Runtime → Event Store → Dispatcher → Read
> Models → Memória → Relationship → Conversation → Cliente) rodando automaticamente,
> com Boot, Health, Workflow, Scheduler, Notification, Human Handoff, Portais,
> Observabilidade e um Checklist automático que **bloqueia produção** se qualquer
> item falhar. **Nenhuma simulação de fluxo; nenhum módulo congelado alterado.**

- **Data:** 2026-07-14
- **Congelados e INTOCADOS:** Domínio, 2A, 2A.2, 2B, 2C, 2D, 2E.

## 0. Portões obrigatórios

```
pnpm typecheck   → 12/12   EXIT 0
pnpm lint        → 12/12   EXIT 0
pnpm test        → 12/12   EXIT 0
   domain 194 · application 86 (+9) · infrastructure 82 (+7) | 4 skipped · api 4
```
**366 testes passando; 16 novos no Sprint 2F.**

## 1. Auditoria adversarial PRÉVIA — conclusão: 100% aditivo

| Componente 2F | Primitiva congelada consumida (verificada por grep antes de codar) |
|---|---|
| Workflow | `EventSubscriber` (2A) sobre os eventos REAIS do domínio (`document.recognized`, `pericia.framed`, `advogado.designated`, `mission.created`, `operational-stage.represented`, `process.recognized`) |
| Notification / Human Handoff | consumidores das intenções `NotificationIntentOut`/`EscalationIntentOut` que **2C já emite** (estavam sem consumidor — 2F os preenche) |
| Scheduler → Brain | tarefas vencidas → sinais temporais → `onTemporalTrigger`/`tick` **públicos** de 2B → o Brain decide |
| Boot | usa `start/stop`/`register` públicos do Dispatcher; compõe as raízes de composição existentes |
| Health/Observability/Checklist/Portais | módulos novos, só leitura |

**Nenhum requisito exigiu alterar congelado. Implementação integral autorizada pela própria auditoria.**

## 2. Os componentes implementados

Em `packages/application/src/go-live/` (lógica pura) + `packages/infrastructure/src/go-live/` (adapters/composição):

| # | Componente | Arquivo | Prova |
|---|---|---|---|
| 1 | **Boot Runtime** | `boot-runtime.ts` | sobe em ordem de dependência; falha → FAILED + dependentes pulados (teste) |
| 2 | **Health Runtime** | `health-runtime.ts` | ONLINE/OFFLINE/DEGRADED/FAILED + responseMs/fila/memória/último processamento; agregação global |
| 3 | **Workflow Runtime** | `workflow-runtime.ts` | `EventSubscriber`: documento→reconhecido→perícia→prazo→advogado→distribuição→acompanhamento→conclusão (read model de progresso) + agenda follow-ups |
| 4 | **Scheduler Runtime** | `scheduler-runtime.ts` | tarefas futuras duráveis (lembrar/reenviar/prazo/advogado/perito); idempotente; cancela; dispara 1× (testes) |
| 5 | **Notification Runtime** | `notification-runtime.ts` | consome intenção do Brain; **anti-spam** (intervalo por audiência×motivo); proveniência preservada (testes) |
| 6 | **Human Handoff Runtime** | `human-handoff-runtime.ts` | encaminha ao papel decidido PELO BRAIN (Operador/Perito/Advogado/Supervisor/Adm); idempotente; "apenas encaminha" (teste) |
| 7 | **Portal Integration** | `portal-integration-runtime.ts` | matriz de acesso por papel; operador **não** vê métricas/health (teste) |
| 8 | **Observability Runtime** | `observability-runtime.ts` | trilha auditável (eventos/erros/latência/fila/estatísticas) |
| 9 | **Go-Live Checklist** | `go-live-checklist.ts` | 18 itens; **qualquer falha OU check ausente ⇒ produção BLOQUEADA** (testes) |
| + | Temporal Signal Dispatcher | `temporal-signal-dispatcher.ts` | tarefa vencida → sinal temporal → 2B → Brain decide |
| + | FullLoopBrainAdapter | `full-loop-brain-adapter.ts` (infra) | o fluxo obrigatório inteiro dentro do port congelado de 2B |
| + | assembleGoLive | `build-go-live.ts` (infra) | raiz de composição da operação completa |

## 3. O fluxo obrigatório, provado ponta a ponta

Teste *"Olá" no WhatsApp → missão criada, read models projetados, memória viva,
resposta entregue* ([go-live.e2e.test.ts](../../packages/infrastructure/src/go-live/go-live.e2e.test.ts)):
uma única chamada `conversation.receive(envelope)` produz, **automaticamente**:
`mission.created` no Event Store (proveniência AHRI) → Dispatcher drena → AdminMetrics
`clientCount=1, missionCount=1` (CQRS) → Workflow com progresso + follow-up agendado →
Memória Viva com nome "João" extraído (com fonte) → resposta humanizada entregue no
gateway. E o teste do **sinal temporal**: o follow-up vence, o Brain decide **com Regra
Operacional** (`RO-*`) e — sendo espera — **nenhuma mensagem mecânica** é disparada.

## 4. Defeito de concorrência ENCONTRADO e corrigido aditivamente

O e2e revelou: o Dispatcher (2A.2, congelado) entrega streams distintos **em paralelo**
(`Promise.all`), e o `AdminProjectionSubscriber` (2E, congelado) faz read-modify-write
num documento único ⇒ incrementos perdidos (last-write-wins). **Correção 2F, sem tocar
os congelados:** [`SerializedSubscriber`](../../packages/infrastructure/src/go-live/serialized-subscriber.ts)
— decorator que serializa `handle` numa fila de promessas; aplicado na composição a
admin-metrics e workflow. Evidência: o e2e do fluxo completo passou após o decorator
(antes: `clientCount 0`; depois: `1`).

## 5. Regras absolutas (verificadas)

| Regra | Prova |
|---|---|
| Nenhum congelado alterado | grep: nenhum módulo congelado referencia 2F; só `export *` nos barris |
| Nenhuma regra de domínio mudou | 194 testes de domínio idênticos |
| Nenhuma decisão fora do Brain | grep: 2F não cria intenção, não chama LLM, não chama fábrica de domínio — só CONSOME `BrainIntent` |
| Decisão jurídica só do Advogado | Handoff apenas ENCAMINHA ao papel que o Brain decidiu por RO; humano decide (teste) |
| Memória não cria fatos | 2E congelado; 2F só a alimenta pelos métodos observacionais |
| Respostas não inventam dados | Read Models (2E) inalterados; checklist usa probes reais |
| DECISOR/TIPO/FUNDAMENTO/REGRA | notificações e handoffs carregam a proveniência da intenção (testes) |
| Servidores do dono | grep: nenhum `.listen` em 2F — o Boot valida; o dono sobe |

## 6. GO LIVE CHECKLIST — bloqueio automático

18 itens verificados com probes reais (`event-store`, `dispatcher`, `brain`,
`conversation`, `memory`, `relationship`, `founder-console`, `workflow`, `scheduler`,
`notification`, `health`, `observability`, `whatsapp`, `read-models`, `cqrs`,
`projections`, `integrity`, `audit`). Provado: todos passando ⇒ `ready:true`;
**um item falhando ⇒ bloqueada**; **check ausente ⇒ bloqueada**; check que lança ⇒
reprovado com o erro registrado ([go-live.test.ts](../../packages/application/src/go-live/go-live.test.ts)).

## 7. Limites honestos (produção)

- A composição default usa adapters offline (gateway in-memory, LLM doubles,
  stores in-memory). Para o GO LIVE real, o dono injeta na MESMA `assembleGoLive`:
  `EvolutionGateway` (2B), adapters LLM reais, `SystemSleeper`, stores Postgres —
  os ports já isolam tudo; nenhum runtime muda.
- O tick do Scheduler em produção é um laço do processo (ou cron) chamando
  `temporal.tick(now)` — acionado pelo dono junto com o boot.
- Métricas de fila/memória do Health são reportadas pelos probes; medição profunda
  de RSS/heap por componente é evolução do adapter.

## 8. Veredito

O GO LIVE Runtime está implementado: Boot, Health, Workflow, Scheduler, Notification,
Human Handoff, Portais, Observabilidade e o Checklist bloqueante — todos aditivos,
com o fluxo obrigatório completo provado ponta a ponta num turno real e as regras
absolutas verificadas por teste e por grep. Um defeito real de concorrência foi
encontrado pelo e2e e corrigido aditivamente (SerializedSubscriber). Portões verdes:
`typecheck` ✅ `lint` ✅ `test` ✅ (366 passando, 16 novos). Todos os congelados intocados.

**Sprint 2F — GO LIVE Runtime: ENCERRADO.**
_Aguardando autorização explícita antes do próximo Sprint._
