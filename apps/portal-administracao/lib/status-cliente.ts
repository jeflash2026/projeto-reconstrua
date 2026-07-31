// Rótulos HUMANOS do status derivado do cliente (Jornada A) — compartilhados
// entre a lista Clientes e a aba Clientes Hoje (decreto 2026-07-31).
import type { ClienteStatus } from './api';

export const STATUS_LABEL: Record<ClienteStatus, { label: string; badge: 'ok' | 'warn' | '' }> = {
  ATENDIMENTO: { label: 'em atendimento', badge: '' },
  COLETANDO_DOCUMENTOS: { label: 'coletando documentos', badge: 'warn' },
  PRONTO_AGUARDANDO_MODALIDADE: { label: 'pronto — decidir modalidade', badge: 'warn' },
  PRONTO_AGUARDANDO_VENDA: { label: 'pronto — aguardando venda', badge: 'ok' },
  PRONTO_AGUARDANDO_PERICIA: { label: 'pronto — fila da perícia', badge: 'ok' },
  AGUARDANDO_10_DIAS: { label: 'pedidos enviados — prazo de 10 dias', badge: 'warn' },
  AGUARDANDO_SOCIO: { label: 'prazo vencido — escolher sócio', badge: 'warn' },
  EM_PROCESSO: { label: 'em processo', badge: 'ok' },
  VENDIDO: { label: 'vendido', badge: 'ok' },
  ENCERRADO: { label: 'encerrado', badge: '' },
};

export const SAUDE_ICON: Record<'GREEN' | 'YELLOW' | 'RED', string> = {
  GREEN: '🟢',
  YELLOW: '🟡',
  RED: '🔴',
};
