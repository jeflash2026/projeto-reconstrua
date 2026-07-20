# Arquitetura — GO-LIVE 15C · Solicitações Complementares de Documentos (Workflow 2)

> **Status:** REVISÃO 4 — APROVADA para implementação. Incorpora as Decisões 1–4 (entidade de DOMÍNIO; Snapshot como Single Source of Truth; memória operacional; SLA) e as Decisões 5–7 (pertencimento ao CASO; desacoplamento do armazenamento via `fulfilledBy`; REOPENED). Sprint 15C-1 em execução.
> **Fundação já commitada (local, `1907690`):** protótipo em `packages/application/src/document-request/` — será **movido/refundado no domínio** no 15C-1, conforme a Decisão A.

## Princípios (invioláveis)

- **DocumentRequest é entidade do DOMÍNIO JURÍDICO** *(Decisão A)* — não pertence à conversa. A conversa **executa a missão**; o Mission Runtime **observa o estado do domínio**; o painel **administra**. Toda a verdade concentrada no Mission Runtime e no domínio.
- **Dois workflows independentes.** Workflow 1 (obrigatórios: HISCON + RG/CNH + comprovante de endereço) vale para 100% dos clientes e já está na política de conversa. Workflow 2 (complementares) **não é automático**.
- **A AHRI nunca decide documentos complementares** — apenas executa solicitações formais do advogado. E **nunca esquece** uma solicitação em aberto *(Decisão C)*.
- **A política de conversa nunca consulta banco** *(Decisão B)*: lê exclusivamente o **Mission Snapshot**. Single Source of Truth.
- **Associação nunca é chute**: 1 pendência ⇒ automática; múltiplas ⇒ IA identifica; dúvida ⇒ confirmação com o cliente antes de associar.
- **O DocumentRequest pertence a um CASO** *(Decisão 5)*: `caseId` é a identidade funcional (Case → DocumentRequests). Cliente poderá ter vários casos; a conversa trabalha sempre no contexto da missão/caso ativo. `clientId` é apenas o canal de entrega.
- **O aggregate NÃO armazena o documento** *(Decisão 6)*: representa a NECESSIDADE documental; o arquivo pertence ao subsistema de Documentos. Relacionamento `fulfilledBy → DocumentId`. Nunca caminhos de arquivo/uploads no aggregate — separa domínio jurídico, gestão documental e storage.
- **Nunca apagar, nunca recriar — REABRIR** *(Decisão 7)*: documento incorreto ⇒ o advogado REABRE a mesma solicitação (`REOPENED`), preservando todo o histórico.
- **Rastreabilidade completa**: autoria, datas, `history`, origem, prioridade e SLA.

---

## 0. Posição arquitetural *(Decisões A e B)*

```
                     ┌────────────────────────────────────────────┐
                     │        DOMÍNIO JURÍDICO (packages/domain)  │
                     │  DocumentRequestAggregate                  │
                     │  • ciclo de vida próprio (§9)              │
                     │  • eventos de domínio (§3)                 │
                     │  • SLA/reminderPolicy (§ SLA)              │
                     └───────────────┬────────────────────────────┘
                                     │ eventos (append-only, Event Store)
                                     ▼
                     ┌────────────────────────────────────────────┐
                     │  MISSION RUNTIME / PROJEÇÕES               │
                     │  read model (PgJsonStore) +                │
                     │  MissionSnapshot.documentRequests (§2b)    │◄─── OBSERVA, nunca decide
                     └───────┬───────────────────┬────────────────┘
                             │ snapshot          │ read model
                             ▼                   ▼
              ┌──────────────────────┐   ┌─────────────────────────┐
              │ CONVERSA (AHRI)      │   │ PAINEL DO ADVOGADO      │
              │ CONSOME o snapshot   │   │ ADMINISTRA a entidade   │
              │ executa a missão     │   │ (criar/listar/cancelar) │
              └──────────────────────┘   └─────────────────────────┘
```

- **Domínio** (`packages/domain/src/document-request/`): aggregate com invariantes e transições; nenhuma dependência de conversa/infrā.
- **Aplicação**: casos de uso (criar/associar/lembrar/cancelar) que emitem eventos via Event Store; projeção alimenta o read model e o snapshot.
- **Conversa**: só lê `MissionSnapshot.documentRequests` (nunca o store).
- **Painel**: APIs de administração (§4).

## 1. Fluxograma completo do Workflow 2

```
ADVOGADO (painel)                    DOMÍNIO/RUNTIME                     AHRI ↔ CLIENTE (WhatsApp)
─────────────────                    ───────────────                     ─────────────────────────
Seleciona cliente
  │
  ▼
Form "Solicitar Documento"
(documento + prioridade + SLA
 + msg opcional)
  │ [Confirmar]
  ▼
POST /advogado/casos/:caseId/ ─────► DocumentRequestAggregate.criar
  document-requests                   status=PENDING · origin · dueAt/reminderPolicy
                                      evento: created → projeções + SNAPSHOT
                                        │
                                        ▼
                                      caso de uso "mensagear" ────────► AHRI envia ao cliente:
                                      evento: messaged                  "O Dr. X solicitou: <doc>…"
                                                                              │
                                    (a cada turno, a conversa lê o            │
                                     SNAPSHOT: pendências entram na           │
                                     memória operacional — Decisão C)         │
                                                                              ▼
                                                                      Cliente envia arquivo
                                                                              │
                                      pipeline do turno ◄─────────────────────┘
                                        │
                                        ▼
                            ┌── pendências do cliente (via snapshot/read model)? ──┐
                       UMA (única)                                          MÚLTIPLAS
                            │                                                    │
                            ▼                                                    ▼
                    associação AUTOMÁTICA                          IA identifica (arquivo/Reader ×
                                                                   documentName) — dúvida ⇒
                                                                   AWAITING_CONFIRMATION +
                                                                   AHRI pergunta ao cliente
                            └───────────────────┬──────────────────────┘
                                                ▼
                                      evento: received (PENDING→RECEIVED)
                                      history += · snapshot atualiza
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                Painel atualiza                Canal de Notificação do ADVOGADO
                (Recebido ✓)                   (v1: WhatsApp)

           ── SLA (Decisão D): enquanto PENDING/AWAITING, o Scheduler agenda
              lembretes pela reminderPolicy; AHRI relembra o cliente até
              RECEIVED ou CANCELLED. Cada lembrete: evento reminded. ──
```

## 2. Modelo da entidade `DocumentRequest` *(rev. Decisões A/D)*

**Aggregate de domínio** (`packages/domain`), com ciclo de vida próprio:

| Campo | Tipo | Observação |
|---|---|---|
| `requestId` | uuid | identidade |
| `caseId` | string | **identidade funcional** *(Decisão 5)* — a solicitação pertence ao Caso; consultas principais por `caseId` |
| `clientId` / `lawyerId` | string | canal de entrega (chatId AHRI) / autor |
| `documentName` | string (obrigatório) | texto livre do advogado |
| `optionalMessage` | string \| null | mensagem ao cliente |
| `origin` | `'painel-advogado'` \| `'sistema'` \| … | de onde nasceu |
| `priority` | `'normal'` \| `'alta'` | destaque no painel e na cobrança |
| `requestedBy` | string | nome de exibição do advogado |
| `status` | §9 | `PENDING` \| `AWAITING_CONFIRMATION` \| `RECEIVED` \| `REOPENED` \| `CANCELLED` |
| `receivedAt` | Date \| null | selo do recebimento |
| `fulfilledBy` | DocumentId \| null | *(Decisão 6)* referência ao subsistema de Documentos — **nunca** caminho de arquivo/upload |
| **SLA** *(Decisão D)* | | |
| `dueAt` | Date \| null | prazo opcional definido pelo advogado |
| `reminderPolicy` | `'nenhum'` \| `'24h'` \| `'48h'` \| `'72h'` \| `'semanal'` | cadência de lembrete automático; **pertence à entidade**, não à conversa |
| `lastReminderAt` | Date \| null | último lembrete enviado |
| **Auditoria** | | |
| `createdAt` / `updatedAt` / `createdBy` | | autoria e datas |
| `history` | `[{ at, por, de, para, nota? }]` | trilha append-only de transições (inclui lembretes) |

**Persistência:** eventos no **Event Store** (verdade imutável) → projeção → read model em **`PgJsonStore`** (namespace `document-requests`; sem tabela nova).

### 2b. `MissionSnapshot.documentRequests` *(Decisão B — Single Source of Truth)*

O Mission Runtime **observa** a entidade e projeta no snapshot (aditivo):

```ts
// MissionSnapshot ganha:
readonly documentRequests?: {
  readonly totalPendentes: number;            // PENDING + AWAITING_CONFIRMATION
  readonly prioridadeMaisAlta: 'alta' | 'normal' | null;
  readonly aguardandoConfirmacao: number;
  readonly ultimaSolicitacao: {               // a mais recente em aberto
    readonly requestId: string;
    readonly documentName: string;
    readonly requestedBy: string;
    readonly dueAt: Date | null;
  } | null;
};
```

- A projeção que já alimenta o snapshot (DecisionState) passa a foldar também os eventos `document-request.*`.
- **A conversa lê SÓ isto** — o `MissaoProvider`/contexto derivam tudo do snapshot; nenhum acesso direto ao store pela política.

## 3. Eventos do ciclo de vida

| Evento | Quando | Payload mínimo |
|---|---|---|
| `document-request.created` | advogado confirma | requestId, caseId, clientId, lawyerId, documentName, origin, priority, dueAt, reminderPolicy, requestedBy |
| `document-request.messaged` | AHRI entregou ao cliente | requestId, messageId |
| `document-request.confirmation-asked` | múltiplas + dúvida ⇒ AHRI perguntou | requestId(s) candidatas, documentRef |
| `document-request.reminded` *(Decisão D)* | lembrete automático enviado | requestId, numeroDoLembrete, messageId |
| `document-request.received` | documento associado | requestId, **fulfilledBy (DocumentId)**, receivedAt, comoAssociado: `unica`\|`ia`\|`confirmacao-cliente` |
| `document-request.lawyer-notified` | notificação no canal do advogado | requestId, canal (tipo+endereço mascarado), messageId |
| `document-request.reopened` *(Decisão 7)* | advogado reabre (documento incorreto) | requestId, motivo, fulfilledByAnterior |
| `document-request.cancelled` *(v1 — condição de parada do SLA)* | advogado cancela | requestId, motivo |

## 4. APIs necessárias

Servidor do **advogado** (Bearer `ADVOGADO_ACCESS_SECRET`):

| Método/Rota | Função |
|---|---|
| `POST /advogado/casos/:caseId/document-requests` | cria (body: `documentName`, `optionalMessage?`, `priority?`, `dueAt?`, `reminderPolicy?`) → dispara mensagem da AHRI |
| `GET  /advogado/casos/:caseId/document-requests` | lista com status/history/SLA |
| `POST /advogado/document-requests/:id/cancelar` | cancela (para o SLA e a cobrança) — **v1** |
| `POST /advogado/document-requests/:id/reabrir` | *(Decisão 7)* reabre após análise (documento incorreto) — a AHRI volta a solicitar; histórico preservado |

Admin: `GET /admin/document-requests?status=…` (observabilidade) · `PATCH /admin/staff/:id/canais` (Canais de Notificação).

## 5. Alterações no painel do advogado

```
┌─ Solicitar Documento ────────────────────────────────┐
│ Documento:          [___________________]            │
│ Prioridade:         (•) Normal  ( ) Alta             │
│ Prazo (opcional):   [ dd/mm ]                        │
│ Lembrete:           (•) Nenhum ( ) 24h ( ) 48h       │
│                     ( ) 72h  ( ) Semanal             │
│ Mensagem opcional:  [___________________]            │
│                     [ Confirmar ]                    │
└──────────────────────────────────────────────────────┘

Solicitações deste caso
• Procuração [ALTA] · lembrete 48h   PENDENTE (2 lembretes)     [cancelar]
• Extrato Bancário                   AGUARDANDO CONFIRMAÇÃO
• Carta de Concessão                 RECEBIDO ✓ 20/07 → [abrir] · [history]
```

Admin (equipe): edição dos **Canais de Notificação** (`tipo` + `endereco` + `preferido`).

## 6. Integração com a AHRI *(rev. Decisões B e C)*

- **Fonte única:** a conversa enxerga pendências **exclusivamente** via `MissionSnapshot.documentRequests` (§2b), que chega ao `ConversationContextView` pelo caminho já existente do snapshot. Zero consulta a banco pela política.
- **Memória operacional — a AHRI não esquece** *(Decisão C)*: enquanto houver pendência no snapshot, ela integra a conduta de TODO turno:
  - cliente manda "bom dia" ⇒ responde normalmente **e lembra gentilmente**: "…e continuo aguardando a {Procuração} que o {Dr. X} pediu, tá?";
  - cliente pergunta outra coisa ⇒ responde a dúvida **e retoma a coleta** em seguida;
  - a solicitação só sai da conduta quando `RECEIVED`/`CANCELLED` (o snapshot esvazia).
  - Prioridade `alta` é cobrada primeiro.
- **Disparo (out-of-band):** criação ⇒ caso de uso envia a mensagem via `ConversationGateway` e registra na memória da conversa.
- **Coleta com associação inteligente:** 0 pendências ⇒ segue Workflow 1 · 1 ⇒ automática · >1 ⇒ IA (arquivo/Reader × documentName); dúvida ⇒ `AWAITING_CONFIRMATION` + pergunta ao cliente. `received.comoAssociado` audita o caminho. Falha do hook nunca derruba o turno (padrão 11D).

## 7. Integração com WhatsApp do CLIENTE

- Mesma instância Evolution da conversa. Templates autorados: solicitação ("O {Dr. X}… solicitou: {doc}… envie por aqui."), confirmação ("é a {A} ou a {B}?") e **lembrete** *(Decisão D)*: "Passando para lembrar: o {Dr. X} aguarda a {Procuração} para dar andamento ao seu processo. Pode enviar por aqui quando conseguir."
- Envios registram `messaged`/`confirmation-asked`/`reminded`.

## 8. Canal de Notificação do ADVOGADO

- `StaffMember.canaisDeNotificacao: NotificationChannel[]` (`tipo: whatsapp|email|…`, `endereco`, `preferido`, `verificadoEm`). v1 entrega por WhatsApp, **somente após** `RECEIVED`. Sem canal ⇒ painel atualiza; notificação registrada não-entregue.

## 9. Estados possíveis da solicitação

```
                    ┌──────────(advogado cancela)──────────► CANCELLED (terminal)
                    │                                            ▲
PENDING ────────────┤                                            │ (cancela — de qualquer aberto)
   │                └──(associado: única OU IA confiante)──► RECEIVED
   │                                                          │      ▲
   └──(múltiplas + dúvida)──► AWAITING_CONFIRMATION ──(confirma)─────┘
                                   │                          │
                                   └──(nega/é outro)► PENDING │
                                                              ▼ (advogado reabre:
                                                     REOPENED    documento incorreto)
                                                        │  • AHRI volta a solicitar
                                                        │  • SLA reinicia
                                                        └──(associado de novo)──► RECEIVED
```
- `CANCELLED` é terminal. `RECEIVED` **pode ser reaberto** *(Decisão 7)*: `REOPENED` comporta-se como pendência (cobra, SLA ativo, pode associar) — o histórico anterior (`fulfilledBy` antigo) fica preservado no `history`. Nunca apagar; nunca recriar quando o objetivo é o mesmo.
- **SLA** *(Decisão D)*: enquanto `PENDING`/`AWAITING_CONFIRMATION`, o **Scheduler** (mecanismo temporal já existente — 4C) agenda lembretes pela `reminderPolicy`; cada disparo emite `reminded`, atualiza `lastReminderAt` e entra no `history`. Para ao alcançar estado terminal.
- `EXPIRED` fica para v2 (política de desistência).

## 10. Casos de uso ponta a ponta

1. **Feliz (única):** solicitar → mensagear → cliente envia → associação automática → `RECEIVED` → painel + canal do advogado.
2. **Múltiplas, IA confiante:** `carta-concessao.pdf` ⇒ associa à Carta (`comoAssociado=ia`).
3. **Múltiplas, dúvida:** `documento.pdf` ⇒ `AWAITING_CONFIRMATION` + pergunta; resposta associa (`confirmacao-cliente`).
4. **Documento sem pendência:** coleta nula ⇒ Workflow 1. Sem falso-positivo.
5. **"Bom dia" com pendência** *(Decisão C)*: resposta normal + lembrete gentil da Procuração.
6. **Pergunta fora do assunto com pendência** *(Decisão C)*: responde a dúvida e retoma a coleta.
7. **SLA 48h** *(Decisão D)*: sem envio em 48h ⇒ lembrete automático (evento `reminded`); repete pela cadência até `RECEIVED`/`CANCELLED`.
8. **Cancelamento:** advogado cancela ⇒ `CANCELLED`; SLA para; a AHRI deixa de cobrar (snapshot esvazia).
9. **Advogado sem canal:** painel atualiza; notificação não-entregue registrada.
10. **Prioridade alta:** destaque no painel; cobrada primeiro na conversa.

---

## Plano de sprints (rev. 3)

| Sprint | Entrega |
|---|---|
| **15C-1** | **Aggregate no domínio** (`packages/domain`) c/ ciclo de vida completo (incl. CANCELLED e SLA) · eventos · projeção → read model (PgJsonStore) · **`MissionSnapshot.documentRequests`** · APIs do advogado (criar/listar/cancelar) |
| **15C-2** | Painel do advogado (form c/ prioridade+SLA + lista c/ status/history/cancelar) · admin: Canais de Notificação |
| **15C-3** | Conversa via snapshot: memória operacional (lembrete gentil em todo turno), disparo proativo, coleta com associação inteligente |
| **15C-4** | SLA automático via Scheduler (lembretes) · entregador de notificação por canal (WhatsApp v1) · observabilidade · homologação e2e |
