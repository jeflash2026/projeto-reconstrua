// ACOMPANHAMENTO PROCESSUAL (2026-09-11) — como o prazo aparece na tela: o
// vencimento é ESTIMADO pela API (dias úteis a partir da publicação no DJEN).

/** 'AAAA-MM-DD' → 'dd/mm/aaaa'. */
export function diaBr(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

export function prazoTexto(diasRestantes: number | null): string {
  if (diasRestantes === null) return 'sem prazo escrito';
  if (diasRestantes < -1) return `venceu há ${String(-diasRestantes)} dias`;
  if (diasRestantes === -1) return 'venceu ontem';
  if (diasRestantes === 0) return 'vence hoje';
  if (diasRestantes === 1) return 'vence amanhã';
  return `faltam ${String(diasRestantes)} dias`;
}

/** Vermelho até 3 dias (ou vencido), amarelo até 7, verde depois. */
export function classePrazo(diasRestantes: number | null): string {
  if (diasRestantes === null) return 'badge dim';
  if (diasRestantes <= 3) return 'badge bad';
  if (diasRestantes <= 7) return 'badge warn';
  return 'badge ok';
}
