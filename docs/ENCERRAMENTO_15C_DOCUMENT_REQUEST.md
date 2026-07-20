# ENCERRAMENTO OFICIAL — GO-LIVE 15C · Módulo DocumentRequest

**Status: CONGELADO — módulo finalizado, pronto para homologação.**
**Data de encerramento: 2026-07-20.**
**Escopo encerrado:** Workflow 2 — Solicitações Complementares de Documentos (o advogado solicita; a AHRI faz todo o restante).
**Fora de escopo (decretos próprios):** rota administrativa de cadastro de canais de notificação do advogado (módulo administrativo).

A partir deste documento, o módulo **não recebe novas funcionalidades**. Mudanças só por decreto novo, com ADR próprio.

---

## 1. Release Notes do 15C

| Sprint | Commit | Entrega |
|---|---|---|
| 15C (decreto) | `1907690` | Separação dos dois workflows documentais (Workflow 1: elegibilidade HISCON+RG/comprovante · Workflow 2: DocumentRequest do advogado). A AHRI **nunca** decide documentos complementares. |
| 15C-1 · parte 1 | `19b35cf` | `DocumentRequestAggregate` como entidade de **domínio** + documento de arquitetura (Revisão 4, aprovada) com as Decisões 1–7. |
| 15C-1 · parte 2 | `160d5fb` | Correções da auditoria (`registrarMensagemEnviada`, `fromState` seguro) + read model persistente (`PgJsonStore`, ns `document-requests`) + projeção no Mission Snapshot + APIs do advogado. |
| 15C-2 | `8bc6e61` | Painel do Advogado (UX first): lista com filtros/busca, detalhe com timeline completa (histórico nunca escondido), formulário com preview da mensagem da AHRI, statuses amigáveis, ações cancelar/reabrir. |
| 15C-3 | `036f14a` | Mission Runtime × Conversa: a missão operacional nasce do **snapshot** (Single Source of Truth); associação inteligente (única/IA/confirmação); disparo proativo criado→mensagem→messaged. |
| 15C-4 | `59e0dfc` | Autonomia Operacional: resolução da confirmação pelo texto do cliente (jamais adivinhar), SLA automático no motor temporal existente, entrega ao advogado via NotificationChannel com dedup, resiliência provada, homologação final. |

**Resultado:** o advogado apenas solicita (e, se preciso, reabre). Cobrança, lembrete, associação, confirmação na dúvida e notificação de recebimento são 100% da AHRI.

---

## 2. ADR final do módulo DocumentRequest

**Contexto.** O advogado precisa de documentos complementares específicos por caso. A conversa da AHRI não pode inventar pedidos, esquecer pendências, nem virar dona de uma verdade paralela.

**Decisões (todas vigentes e congeladas):**

- **Decisão 1 — Associação nunca "por ordem".** Documento que chega casa com a pendência por: (a) pendência **única** → associação automática; (b) múltiplas + nome do arquivo casa com **uma** → associação por IA (tokens normalizados); (c) dúvida → **perguntar ao cliente** e aguardar (`AWAITING_CONFIRMATION`). Jamais adivinhar.
- **Decisão 2 — Persistência em `PgJsonStore`** (ns `document-requests`) com auditoria completa: `createdBy`/`createdAt`/`updatedAt` + `history` append-only.
- **Decisão 3 — Canal de Notificação é entidade própria** (`NotificationChannel`: tipo/endereço/preferido/verificadoEm), não um campo solto no advogado. Cadastro administrativo fica para decreto próprio.
- **Decisão 4 (A) — Entidade de DOMÍNIO.** `DocumentRequestAggregate` vive em `packages/domain`, com invariantes e eventos próprios.
- **Decisão 5 (B) — Mission Runtime conhece o DocumentRequest.** O resumo é projetado em `MissionSnapshot.documentRequests`; a conversa lê **exclusivamente o snapshot** — nunca o store.
- **Decisão 6 — A AHRI não pode esquecer.** Pendência aberta ⇒ missão operacional presente em todo turno, até `RECEIVED`/`CANCELLED`.
- **Decisão 7 — SLA pertence à entidade** (`dueAt` + `reminderPolicy`), não ao fluxo de conversa.
- **Decisão 5 (rev. 3) — Pertence a um CASO.** `caseId` é a identidade funcional; `clientId` é só o canal de entrega.
- **Decisão 6 (rev. 3) — Não armazena o documento.** Cumprimento por referência `fulfilledBy` = DocumentId do subsistema documental; refs com cara de caminho/arquivo (`/[\\/]|\.(pdf|png|jpe?g|docx?)$/i`) são rejeitadas.
- **Decisão 7 (rev. 3) — Reabertura, nunca recriação.** `REOPENED` preserva todo o histórico, zera `lastMessagedAt` e reativa o SLA. Nada é apagado, nada é recriado.

**Consequências.** Toda a inteligência nasce do aggregate + snapshot. Infraestrutura (subscribers, autonomia, notifier) apenas **executa** transições do aggregate — nenhuma regra duplicada, nenhuma verdade paralela. Falhas de WhatsApp/read model ficam na infraestrutura: nenhuma exceção chega ao domínio.

---

## 3. Fluxograma definitivo

```
ADVOGADO (painel)                    AHRI (autônoma)                        CLIENTE (WhatsApp)
─────────────────                    ───────────────                        ──────────────────
solicitar documento ──► criar (PENDING) ──► anunciar ─────────────────────► "Olá! Dr. X solicitou…"
                                    │
                                    │  tick (motor temporal único)
                                    ├─► varredura SLA: política vencida ──► "Oi! Passando para lembrar…"
                                    │   (registrarLembrete ANTES do envio)
                                    │
                                    │  documento chega (evento 'document')
                                    ├─► 1 pendência ──────► associar(unica) ─► RECEIVED
                                    ├─► N pendências, nome casa com 1 ─► associar(ia) ─► RECEIVED
                                    └─► dúvida ─► AWAITING_CONFIRMATION ──► "É **A** ou **B**?"
                                            │                                    │
                                            │   resposta identifica UMA ◄────────┘
                                            ├─► associar(confirmacao-cliente) ─► RECEIVED
                                            │   (as demais retornam a PENDING)
                                            └─► "não sei"/ambíguo ─► permanece AWAITING (jamais adivinhar)
                                    │
                       RECEIVED ────┴─► notificar advogado (canal preferido, ◄─ NotificationChannel
◄── "O cliente enviou…"                dedup por requestId+versão)
                                    │
reabrir (ilegível) ──► REOPENED (histórico intacto, SLA reativado) ─► ciclo recomeça
cancelar ──────────► CANCELLED (terminal; SLA e cobrança param)
```

---

## 4. Lista de eventos do domínio

Stream: `document-request` (streamId = requestId, `ANY_VERSION`).

| Evento | Quando |
|---|---|
| `document-request.created` | O advogado criou a solicitação (→ PENDING). |
| `document-request.messaged` | A AHRI entregou a mensagem inicial ao cliente (uma por abertura). |
| `document-request.confirmation-asked` | Dúvida na associação — a AHRI pediu confirmação (→ AWAITING_CONFIRMATION). |
| `document-request.received` | Um DocumentId cumpriu a solicitação (→ RECEIVED). |
| `document-request.reopened` | O advogado reabriu (→ REOPENED; histórico preservado). |
| `document-request.cancelled` | O advogado cancelou (→ CANCELLED, terminal). |
| `document-request.reminded` | Lembrete automático de SLA enviado. |

Evento **consumido** (stream `document`): `document.recognized` com payload `{missionId, contentReference, mimeType}` — o gatilho da associação (casa por `missionId === caseId`).

---

## 5. Máquina de estados final

```
                    ┌──────────────────────────────────────────┐
                    ▼                                          │
 (criar) ──► PENDING ⇄ AWAITING_CONFIRMATION ──► RECEIVED ⇄ REOPENED
                    │            │ (retornarPendente)   (reabrir: histórico
                    │            ▼                       intacto, SLA reativo)
                    └──────► CANCELLED  ◄─── (cancelar, de qualquer estado aberto)
                              (TERMINAL)
```

- **Abertos** (cobram, SLA ativo, associáveis): `PENDING`, `AWAITING_CONFIRMATION`, `REOPENED`.
- `RECEIVED` ⇔ `fulfilledBy` + `receivedAt` preenchidos (invariante do `fromState`).
- `CANCELLED` é terminal: nenhum lembrete, nenhuma associação, nenhuma reabertura.
- Guardas no aggregate: lembrete só em aberto; mensagem inicial uma por abertura; associar exige aberto.

---

## 6. Arquitetura final (Domain → Runtime → Snapshot → Conversation → Infrastructure)

```
DOMAIN        packages/domain/src/document-request/
              DocumentRequestAggregate (invariantes, transições, eventos, fromState seguro)

RUNTIME       packages/application/src/document-request/
              DocumentRequestRuntime (casos de uso: criar/registrarMensagem/associar/
              aguardarConfirmacao/retornarPendente/reabrir/cancelar/registrarLembrete)
              → reidrata → transiciona pelo aggregate → persiste → publica eventos (best-effort)
              DocumentRequestStore (porta) + mensagens autoradas + resumoDocumentRequests

SNAPSHOT      DocumentRequestsAwareSnapshotAdapter decora o MissionSnapshotPort:
              MissionSnapshot.documentRequests = {totalPendentes, prioridadeMaisAlta,
              aguardandoConfirmacao, ultimaSolicitacao} — Single Source of Truth da conversa

CONVERSATION  PendenciaDocumentalProvider lê SÓ o snapshot → ConversationContextRuntime →
              PromptBuilderRuntime injeta a MISSÃO OPERACIONAL (gentileza; jamais
              interromper o assunto; some quando a pendência zera)

INFRA         packages/infrastructure/src/document-request/
              JsonDocumentRequestStore (PgJsonStore ns 'document-requests'; datas revividas
                + fromState na leitura)
              DocumentArrivalSubscriber (evento 'document' → única/IA/dúvida; grava contexto
                da dúvida antes de perguntar)
              DocumentRequestComunicador (created → mensagem → recordOutbound → messaged)
              DocumentRequestAutonomia (aoReceberTexto: resolve confirmação ANTES do turno,
                mesma fila · varredura: SLA no tick — nenhum timer paralelo)
              LawyerNotifierSubscriber + JsonNotificationChannelStore (received → canal
                whatsapp preferido → sendText; dedup requestId+versão; registro de entrega)

ENTRADA       ProductionIngress: receive() → [autonomia.aoReceberTexto] → conversa
              tick() → fireDue → turnos temporais → [autonomia.varredura]
```

Regra congelada: **fluxo só de cima para baixo** — infraestrutura executa transições do aggregate; a conversa nunca toca o store.

---

## 7. APIs públicas

Todas em `apps/api` (advogado-server). Erros: `400` validação · `404` não encontrada · `409` transição inválida · `503` montagem sem o módulo.

| Método e rota | Descrição |
|---|---|
| `POST /advogado/casos/:caseId/document-requests` | Cria a solicitação. Body: `documentName`*, `clientId`*, `advogadoId`*, `requestedBy?`, `optionalMessage?`, `priority?` (`normal`\|`alta`), `dueAt?` (ISO), `reminderPolicy?` (`nenhum`\|`24h`\|`48h`\|`72h`\|`semanal`). `201` → estado + `anuncio` (disparo proativo best-effort). |
| `GET /advogado/casos/:caseId/document-requests` | Todas as solicitações do caso (auditoria/dossiê). |
| `GET /advogado/document-requests` | Lista do painel do advogado autenticado (header `x-advogado-id`*). |
| `GET /advogado/document-requests/:id` | Detalhe: cabeçalho + `history` completo. |
| `POST /advogado/document-requests/:id/cancelar` | Body: `advogadoId`*, `motivo?`. Encerra cobrança e SLA. |
| `POST /advogado/document-requests/:id/reabrir` | Body: `advogadoId`*, `motivo?`. RECEIVED → REOPENED, histórico intacto. |

Consumidas pelo `portal-advogado` (telas Solicitações: lista/detalhe/nova) via server actions.

---

## 8. Modelo de dados

**`DocumentRequestState`** (read model = snapshot serializável do aggregate):

```
requestId        string (UUID)                       identidade técnica
caseId           string                              identidade FUNCIONAL (Decisão 5)
clientId         string (JID WhatsApp)               canal de entrega
lawyerId         string                              dono da solicitação
documentName     string                              o que foi pedido
optionalMessage  string | null                       complemento do advogado
origin           'painel-advogado' | 'sistema'
priority         'normal' | 'alta'
requestedBy      string                              nome exibido ao cliente
status           PENDING | AWAITING_CONFIRMATION | RECEIVED | REOPENED | CANCELLED
receivedAt       Date | null
fulfilledBy      string | null                       DocumentId (Decisão 6 — nunca arquivo)
dueAt            Date | null                         SLA
reminderPolicy   'nenhum' | '24h' | '48h' | '72h' | 'semanal'
lastReminderAt   Date | null                         governa a cadência do lembrete
lastMessagedAt   Date | null                         mensagem inicial (uma por abertura)
createdAt / updatedAt / createdBy                    auditoria
history          [{at, por, de, para, nota}]         append-only — nunca apagado
```

**Namespaces no JsonStore (Pg em produção):**

| Namespace | Chave | Conteúdo |
|---|---|---|
| `document-requests` | requestId | `DocumentRequestState` |
| `dr-confirmacoes` | clientId | `{documentId, askedAt}` — contexto efêmero da dúvida; apagado ao resolver |
| `canais-notificacao` | lawyerId | `NotificationChannel[]` `{tipo, endereco, preferido, verificadoEm}` |
| `dr-entregas` | `requestId:vN` | `RegistroDeEntrega` `{resultado: entregue\|falhou\|sem-canal, canal mascarado, tentativa, em, erro}` — também é a chave de dedup |

---

## 9. Guia de homologação

Roteiro executado na homologação final do 15C-4 (peças reais; única fronteira simulada = WhatsApp). Reproduzir na homologação de produção:

1. **Cadastrar canal** do advogado (whatsapp preferido) — pré-condição da entrega.
2. **Criar 2 solicitações** no painel (uma `alta`/`24h`, uma `normal`/`24h`). Verificar: cliente recebe as 2 mensagens; snapshot `pendentes=2 prioridade=alta`; conversa menciona a pendência com gentileza.
3. **Deixar a política vencer** (>24h). Verificar: 2 lembretes; segunda varredura no mesmo instante **não duplica**; `history` ganha "lembrete automático enviado".
4. **Cliente envia arquivo ambíguo** (`documento.pdf`). Verificar: ambas AWAITING_CONFIRMATION; pergunta "É **A** ou **B**?"; lembretes param.
5. **Cliente responde "não sei"**. Verificar: nada muda (jamais adivinhar); contexto preservado.
6. **Cliente responde "É a Procuração"**. Verificar: Procuração RECEIVED com `fulfilledBy` correto e nota `(confirmacao-cliente)`; a outra volta a PENDING; advogado notificado; snapshot com 1 pendente.
7. **Cliente envia arquivo com nome que casa** (`extrato-bancario.pdf`). Verificar: associação automática; advogado notificado; snapshot vazio; conversa para de cobrar.
8. **Reabrir** a Procuração (motivo: ilegível). Verificar: REOPENED; histórico completo intacto; snapshot volta; cliente cobrado novamente.
9. **Reenviar correto**. Verificar: RECEIVED de novo (versão nova ⇒ notificação nova — correto, não é duplicação).
10. **Auditoria final**: `history` de cada solicitação sem lacunas; eventos no Event Store na ordem; registros em `dr-entregas`; `resumoDocumentRequests` zerado.
11. **Resiliência** (opcional em staging): derrubar WhatsApp durante a varredura → lembrete fica registrado, sem duplicação na volta; derrubar read model → varredura pula o ciclo com estado intacto.

Resultado da execução de referência (2026-07-20): 12 eventos, 8 mensagens, 7 entradas de histórico na solicitação reaberta, resumo final zerado. **Aprovada.**

---

## 10. Checklist de Go Live

- [x] **Aggregate testado** — 16 testes de domínio (transições, guardas, invariantes, `fromState` seguro, reabertura).
- [x] **Runtime testado** — 4 testes de aplicação (casos de uso + publicação best-effort) + exercitado em todos os e2e.
- [x] **Snapshot testado** — e2e 15C-3: projeção aparece, atualiza e some; conversa lê só o snapshot.
- [x] **APIs testadas** — validadas via runtime/store testados + homologação de referência (walkthrough com as rotas reais). *Observação: sem suite HTTP dedicada às 6 rotas; validar na homologação de produção (guia §9).*
- [x] **Reabertura testada** — domínio + walkthrough (histórico intacto, SLA reativado, notificação nova por versão nova).
- [x] **SLA testado** — cadência 24h/48h/72h/semanal; `nenhum` nunca lembra; RECEIVED/CANCELLED jamais lembrados; lembretes sucessivos respeitam a cadência.
- [x] **Scheduler testado** — varredura no `tick()` do ProductionIngress (mesmo motor temporal; ordem autonomia → turno → varredura provada em teste).
- [x] **WhatsApp testado** — envio, falha e recuperação simulados; mensagens autoradas com fallbacks de saudação corretos.
- [x] **NotificationChannel testado** — preferido/primeiro/ausente; `entregue`/`falhou`/`sem-canal` registrados; endereço mascarado.
- [x] **Idempotência validada** — lembrete registrado ANTES do envio (falha não duplica); dedup do notifier por `requestId:versão`; mensagem inicial uma por abertura.
- [x] **Resiliência validada** — WhatsApp fora, read model fora, autonomia explodindo no ingress: estado consistente, nenhuma perda, nenhuma duplicação, nenhuma exceção ao domínio, turno da conversa nunca cai.
- [x] **Lint** — eslint verde em todos os arquivos do módulo.
- [x] **Typecheck** — `tsc` verde em domain/contracts/application/infrastructure/api.
- [x] **Testes verdes** — domain **210** · application **359** · infrastructure **288** · api **100** (100% das suites).

**Pendência externa ao módulo (decreto próprio):** rota administrativa de cadastro de `NotificationChannel` (`canais-notificacao` hoje só é gravável via store). Sem cadastro, a entrega ao advogado registra `sem-canal` — comportamento correto e auditável.

---

*Módulo congelado em `59e0dfc`. Qualquer alteração futura exige decreto novo + ADR.*
