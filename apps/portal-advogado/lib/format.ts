// Formatação de exibição — pura e testável.

export function formatDate(iso: string | null): string {
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function shortId(id: string, size = 10): string {
  return id.length <= size ? id : `${id.slice(0, size)}…`;
}

const KIND_LABELS: Readonly<Record<string, string>> = {
  numero_processo: 'Número do processo',
  protocolo: 'Protocolo',
  despacho: 'Despacho',
  movimentacao: 'Movimentação',
  observacao: 'Observação jurídica',
  prazo: 'Prazo',
  distribuicao: 'Distribuição',
  conclusao: 'Conclusão',
  documento: 'Documento jurídico',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
