// ─────────────────────────────────────────────────────────────────────────────
// Formatação HUMANA (UX/Presence): datas como gente fala ("hoje", "ontem",
// "17 de julho") e saudação pelo relógio REAL do Brasil — o menor gesto que diz
// "isto foi escrito para agora, não gravado".
// ─────────────────────────────────────────────────────────────────────────────

const TZ = 'America/Sao_Paulo';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

function partesEm(data: Date): { dia: number; mes: number; ano: number; hora: number } {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    hour12: false,
  });
  const partes = Object.fromEntries(fmt.formatToParts(data).map((p) => [p.type, p.value]));
  return {
    dia: Number(partes['day']),
    mes: Number(partes['month']),
    ano: Number(partes['year']),
    hora: Number(partes['hour']),
  };
}

/** "hoje" · "ontem" · "17 de julho" (com ano só quando é outro ano). */
export function dataHumana(iso: string, agora: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const a = partesEm(d);
  const b = partesEm(agora);
  if (a.ano === b.ano && a.mes === b.mes && a.dia === b.dia) return 'hoje';
  const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  const c = partesEm(ontem);
  if (a.ano === c.ano && a.mes === c.mes && a.dia === c.dia) return 'ontem';
  const nome = `${String(a.dia)} de ${MESES[a.mes - 1] ?? ''}`;
  return a.ano === b.ano ? nome : `${nome} de ${String(a.ano)}`;
}

/** Saudação pelo horário de Brasília. */
export function saudacaoPorHora(agora: Date): string {
  const { hora } = partesEm(agora);
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}
