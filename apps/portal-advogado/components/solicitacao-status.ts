// 15C-2 — vocabulário AMIGÁVEL do painel (apresentação pura; o domínio não muda).
// Status técnicos → linguagem do advogado; idade/prazo humanizados.
import type { Solicitacao, SolicitacaoStatus } from '../lib/api';

export const STATUS_AMIGAVEL: Record<SolicitacaoStatus, string> = {
  PENDING: 'Aguardando cliente',
  REOPENED: 'Aguardando novo envio',
  RECEIVED: 'Documento recebido',
  AWAITING_CONFIRMATION: 'Confirmando documento',
  CANCELLED: 'Solicitação cancelada',
};

export const STATUS_CLASSE: Record<SolicitacaoStatus, string> = {
  PENDING: 'sol-st-pendente',
  REOPENED: 'sol-st-reaberta',
  RECEIVED: 'sol-st-recebida',
  AWAITING_CONFIRMATION: 'sol-st-confirmando',
  CANCELLED: 'sol-st-cancelada',
};

const DIA = 24 * 60 * 60 * 1000;

function dias(ms: number): number {
  return Math.floor(ms / DIA);
}

/** "há 2 horas" / "há 2 dias" — idade da solicitação. */
export function idadeDe(criadaEm: string, agora: Date = new Date()): string {
  const ms = agora.getTime() - new Date(criadaEm).getTime();
  if (ms < 60 * 60 * 1000) return 'agora há pouco';
  if (ms < DIA) return `há ${String(Math.floor(ms / (60 * 60 * 1000)))} h`;
  const d = dias(ms);
  return d === 1 ? 'há 1 dia' : `há ${String(d)} dias`;
}

/** "vence amanhã" / "vence em 3 dias" / "vencida há 2 dias" — SLA humanizado. */
export function prazoDe(
  dueAt: string | null,
  status: SolicitacaoStatus,
  agora: Date = new Date(),
): { texto: string; vencida: boolean } {
  if (dueAt === null) return { texto: 'sem prazo', vencida: false };
  if (status === 'RECEIVED' || status === 'CANCELLED')
    return { texto: `prazo ${new Date(dueAt).toLocaleDateString('pt-BR')}`, vencida: false };
  const ms = new Date(dueAt).getTime() - agora.getTime();
  if (ms < 0) {
    const d = dias(-ms);
    return {
      texto:
        d === 0 ? 'vencida hoje' : d === 1 ? 'vencida há 1 dia' : `vencida há ${String(d)} dias`,
      vencida: true,
    };
  }
  const d = dias(ms);
  if (d === 0) return { texto: 'vence hoje', vencida: false };
  if (d === 1) return { texto: 'vence amanhã', vencida: false };
  return { texto: `vence em ${String(d)} dias`, vencida: false };
}

/** Urgente = prioridade alta OU prazo vencido/vencendo hoje (e ainda aberta). */
export function ehUrgente(s: Solicitacao, agora: Date = new Date()): boolean {
  const aberta =
    s.status === 'PENDING' || s.status === 'REOPENED' || s.status === 'AWAITING_CONFIRMATION';
  if (!aberta) return false;
  if (s.priority === 'alta') return true;
  return s.dueAt !== null && new Date(s.dueAt).getTime() - agora.getTime() < DIA;
}

/** Responsável ATUAL pelo próximo passo (quem a bola está esperando). */
export function responsavelAtual(s: Solicitacao): string {
  switch (s.status) {
    case 'PENDING':
    case 'REOPENED':
      return 'Cliente';
    case 'AWAITING_CONFIRMATION':
      return 'AHRI';
    case 'RECEIVED':
      return 'Advogado';
    case 'CANCELLED':
      return '—';
  }
}

/** A mensagem que a AHRI enviará (preview do form — MESMO formato do backend). */
export function previewMensagemAhri(
  documentName: string,
  optionalMessage: string,
  requestedBy: string,
  clienteNome = 'cliente',
): string {
  const extra = optionalMessage.trim() ? `\n\n${optionalMessage.trim()}` : '';
  return (
    `Olá, ${clienteNome}.\n\n` +
    `${requestedBy}, responsável pelo seu processo, solicitou um documento complementar para dar continuidade ao andamento da ação.\n\n` +
    `Documento solicitado:\n${documentName.trim() || '—'}${extra}\n\n` +
    `Assim que possível, envie por aqui.`
  );
}
