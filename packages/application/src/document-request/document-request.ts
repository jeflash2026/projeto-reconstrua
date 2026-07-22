// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST — camada de APLICAÇÃO (GO-LIVE 15C · Sprint 15C-1).
//
// A ENTIDADE vive no domínio jurídico (DocumentRequestAggregate — Decisão A/5/6/7).
// Aqui ficam apenas: o READ MODEL (store por CASO), o fragmento do
// MissionSnapshot (Single Source of Truth da conversa — Decisão B) e as
// MENSAGENS autoradas que a AHRI entrega (nunca inventa).
//
// A associação inteligente (única/IA/confirmação — Decisão 1) é executada no
// pipeline (15C-3) usando as TRANSIÇÕES do aggregate; não existe mais associação
// "por ordem" como regra.
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentRequestState } from '@reconstrua/domain';

// ── READ MODEL (porta) — consultas por CASO (Decisão 5) + entrega por cliente ─
export interface DocumentRequestStore {
  salvar(state: DocumentRequestState): Promise<void>;
  porId(requestId: string): Promise<DocumentRequestState | null>;
  /** Todas as solicitações do CASO (identidade funcional — painel/auditoria). */
  doCaso(caseId: string): Promise<readonly DocumentRequestState[]>;
  /** Solicitações ABERTAS do cliente (entrega/cobrança pela AHRI). */
  abertasDoCliente(clientId: string): Promise<readonly DocumentRequestState[]>;
  /** 15C-2 — todas as solicitações do ADVOGADO (a lista do painel). */
  doAdvogado(lawyerId: string): Promise<readonly DocumentRequestState[]>;
  /** 15C-4 — todas as ABERTAS do sistema (varredura de SLA). */
  abertas(): Promise<readonly DocumentRequestState[]>;
}

const ABERTOS = new Set(['PENDING', 'AWAITING_CONFIRMATION', 'REOPENED']);

export class InMemoryDocumentRequestStore implements DocumentRequestStore {
  private readonly porIdMap = new Map<string, DocumentRequestState>();
  salvar(state: DocumentRequestState): Promise<void> {
    this.porIdMap.set(state.requestId, state);
    return Promise.resolve();
  }
  porId(requestId: string): Promise<DocumentRequestState | null> {
    return Promise.resolve(this.porIdMap.get(requestId) ?? null);
  }
  doCaso(caseId: string): Promise<readonly DocumentRequestState[]> {
    return Promise.resolve(
      [...this.porIdMap.values()]
        .filter((r) => r.caseId === caseId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    );
  }
  abertasDoCliente(clientId: string): Promise<readonly DocumentRequestState[]> {
    return Promise.resolve(
      [...this.porIdMap.values()]
        .filter((r) => r.clientId === clientId && ABERTOS.has(r.status))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    );
  }
  doAdvogado(lawyerId: string): Promise<readonly DocumentRequestState[]> {
    return Promise.resolve(
      [...this.porIdMap.values()]
        .filter((r) => r.lawyerId === lawyerId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    );
  }
  abertas(): Promise<readonly DocumentRequestState[]> {
    return Promise.resolve(
      [...this.porIdMap.values()]
        .filter((r) => ABERTOS.has(r.status))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    );
  }
}

// ── SNAPSHOT (Decisão B) — o resumo que o Mission Runtime projeta ─────────────
export interface DocumentRequestsResumo {
  readonly totalPendentes: number; // abertas (PENDING + AWAITING + REOPENED)
  readonly prioridadeMaisAlta: 'alta' | 'normal' | null;
  readonly aguardandoConfirmacao: number;
  readonly ultimaSolicitacao: {
    readonly requestId: string;
    readonly documentName: string;
    readonly requestedBy: string;
    readonly dueAt: Date | null;
  } | null;
}

/** Resume as solicitações de um cliente/caso para o MissionSnapshot. Puro. */
export function resumoDocumentRequests(
  states: readonly DocumentRequestState[],
): DocumentRequestsResumo {
  const abertas = states.filter((s) => ABERTOS.has(s.status));
  const maisRecente =
    [...abertas].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  return {
    totalPendentes: abertas.length,
    prioridadeMaisAlta:
      abertas.length === 0 ? null : abertas.some((s) => s.priority === 'alta') ? 'alta' : 'normal',
    aguardandoConfirmacao: abertas.filter((s) => s.status === 'AWAITING_CONFIRMATION').length,
    ultimaSolicitacao: maisRecente
      ? {
          requestId: maisRecente.requestId,
          documentName: maisRecente.documentName,
          requestedBy: maisRecente.requestedBy,
          dueAt: maisRecente.dueAt,
        }
      : null,
  };
}

// ── MENSAGENS autoradas (a AHRI entrega — nunca inventa) ──────────────────────

/** Mensagem inicial ao CLIENTE ao criar a solicitação. Nome desconhecido ⇒ "Olá!". */
export function mensagemAoCliente(state: DocumentRequestState, clienteNome: string): string {
  const extra = state.optionalMessage ? `\n\n${state.optionalMessage}` : '';
  const saudacao = clienteNome.trim() !== '' ? `Olá, ${clienteNome}.` : 'Olá!';
  return (
    `${saudacao}\n\n` +
    `${state.requestedBy}, responsável pelo seu processo, solicitou um documento complementar para dar continuidade ao andamento da ação.\n\n` +
    `Documento solicitado:\n${state.documentName}${extra}\n\n` +
    `Assim que possível, envie por aqui.`
  );
}

/** Pergunta de confirmação (Decisão 1) quando há múltiplas pendências e dúvida. */
export function perguntaDeConfirmacao(candidatas: readonly DocumentRequestState[]): string {
  const nomes = candidatas.map((c) => c.documentName);
  return `Recebi seu arquivo! Só confirmando: ele é ${nomes.map((n) => `**${n}**`).join(' ou ')}?`;
}

/** Lembrete de SLA (Decisão D) — enviado automaticamente pela cadência da entidade. */
export function mensagemDeLembrete(state: DocumentRequestState, clienteNome: string): string {
  const saudacao = clienteNome.trim() !== '' ? `Oi, ${clienteNome}!` : 'Oi!';
  return (
    `${saudacao} Passando para lembrar: ${state.requestedBy} aguarda a ${state.documentName} ` +
    `para dar andamento ao seu processo. Pode enviar por aqui quando conseguir.`
  );
}

/** Notificação ao ADVOGADO após RECEIVED (canal de notificação — Decisão 3). */
export function notificacaoAoAdvogado(state: DocumentRequestState, clienteNome: string): string {
  return (
    `O cliente ${clienteNome} acabou de enviar o documento solicitado:\n\n` +
    `${state.documentName}.\n\n` +
    `O documento já está disponível para análise no painel.`
  );
}
