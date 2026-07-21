// Formatação de exibição — pura e testável.

export function formatDate(iso: string | null): string {
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function formatMoney(value: number | null): string {
  if (value === null) return 'sem fonte de dados';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function shortId(id: string | null | undefined, size = 8): string {
  // Defensivo: dado de formato antigo/ausente NUNCA derruba o SSR do painel.
  if (typeof id !== 'string' || id === '') return '—';
  return id.length <= size ? id : `${id.slice(0, size)}…`;
}

export function healthBadgeClass(status: string): string {
  if (status === 'ONLINE') return 'ok';
  if (status === 'DEGRADED') return 'warn';
  if (status === 'FAILED' || status === 'OFFLINE') return 'bad';
  return 'dim';
}
