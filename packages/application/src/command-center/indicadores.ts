// ─────────────────────────────────────────────────────────────────────────────
// AHRI COMMAND CENTER (GO-LIVE 13A) — INDICADORES EXECUTIVOS. Traduz os Read
// Models em indicadores de NEGÓCIO (não técnicos), cada um com rótulo, valor
// apresentável, fonte e destaque. Puro; a interface apenas renderiza. Valor
// ausente vira estado explícito ('—'), nunca inventado.
// ─────────────────────────────────────────────────────────────────────────────

export type TomIndicador = 'neutro' | 'positivo' | 'atencao' | 'critico';

export interface IndicadorExecutivo {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string; // já apresentável ('—' quando ausente)
  readonly tom: TomIndicador;
  readonly fonte: string;
  readonly href: string | null;
}

export interface IndicadoresInputs {
  readonly clientesAtivos: number;
  readonly novosClientesHoje: number;
  readonly dossiesGerados: number;
  readonly casosDistribuidos: number;
  readonly aguardandoDocumentos: number;
  readonly casosCriticos: number;
  readonly tempoMedioAteDecisaoMs: number | null;
  readonly precisaoDecisoes: number | null; // 0..1
  readonly confiancaMediaIA: number | null; // 0..1
  readonly documentosProcessados: number;
  readonly valorRecuperavel: number | null; // R$
  readonly receitaPrevista: number | null; // R$
}

function money(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}
function pct(v: number | null): string {
  return v === null ? '—' : `${String(Math.round(v * 100))}%`;
}
function dur(ms: number | null): string {
  if (ms === null) return '—';
  const h = ms / 3_600_000;
  if (h < 1) return `${String(Math.round(ms / 60_000))} min`;
  if (h < 48) return `${String(Math.round(h))} h`;
  return `${String(Math.round(h / 24))} d`;
}

/** Monta os indicadores executivos a partir dos Read Models. Determinístico. */
export function indicadoresExecutivos(input: IndicadoresInputs): readonly IndicadorExecutivo[] {
  const precisaoTom: TomIndicador =
    input.precisaoDecisoes === null
      ? 'neutro'
      : input.precisaoDecisoes >= 0.8
        ? 'positivo'
        : input.precisaoDecisoes >= 0.6
          ? 'atencao'
          : 'critico';
  return [
    {
      id: 'clientes-ativos',
      rotulo: 'Clientes ativos',
      valor: String(input.clientesAtivos),
      tom: 'neutro',
      fonte: 'read-model:dashboard.activeClients',
      href: '/clientes',
    },
    {
      id: 'novos-hoje',
      rotulo: 'Novos clientes hoje',
      valor: String(input.novosClientesHoje),
      tom: input.novosClientesHoje > 0 ? 'positivo' : 'neutro',
      fonte: 'read-model:dashboard.newClientsToday',
      href: '/clientes',
    },
    {
      id: 'dossies',
      rotulo: 'Dossiês gerados',
      valor: String(input.dossiesGerados),
      tom: 'neutro',
      fonte: 'read-model:mission/dossies',
      href: '/inteligencia/dossies',
    },
    {
      id: 'distribuidos',
      rotulo: 'Casos distribuídos',
      valor: String(input.casosDistribuidos),
      tom: 'neutro',
      fonte: 'read-model:operational-metrics.processosAtivos',
      href: '/missoes',
    },
    {
      id: 'aguardando-docs',
      rotulo: 'Aguardando documentos',
      valor: String(input.aguardandoDocumentos),
      tom: input.aguardandoDocumentos > 0 ? 'atencao' : 'neutro',
      fonte: 'read-model:dashboard.awaitingDocuments',
      href: '/clientes?estado=aguardando-documentos',
    },
    {
      id: 'criticos',
      rotulo: 'Casos críticos',
      valor: String(input.casosCriticos),
      tom: input.casosCriticos > 0 ? 'critico' : 'positivo',
      fonte: 'read-model:operational-metrics',
      href: '/missoes?prioridade=critica',
    },
    {
      id: 'tempo-decisao',
      rotulo: 'Tempo médio até decisão',
      valor: dur(input.tempoMedioAteDecisaoMs),
      tom: 'neutro',
      fonte: 'read-model:catalog-evolution.tempoMedio',
      href: '/inteligencia/evolucao',
    },
    {
      id: 'precisao',
      rotulo: 'Precisão das decisões',
      valor: pct(input.precisaoDecisoes),
      tom: precisaoTom,
      fonte: 'read-model:catalog-evolution.taxaAcerto',
      href: '/inteligencia/evolucao',
    },
    {
      id: 'confianca-ia',
      rotulo: 'Confiança média da IA',
      valor: pct(input.confiancaMediaIA),
      tom: 'neutro',
      fonte: 'read-model:catalog-evolution.confiancaMedia',
      href: '/inteligencia/evolucao',
    },
    {
      id: 'docs-processados',
      rotulo: 'Documentos processados',
      valor: String(input.documentosProcessados),
      tom: 'neutro',
      fonte: 'read-model:admin-metrics.documentCount',
      href: '/documentos',
    },
    {
      id: 'valor-recuperavel',
      rotulo: 'Valor potencial recuperável',
      valor: money(input.valorRecuperavel),
      tom: 'neutro',
      fonte: 'read-model:financeiro',
      href: '/financeiro',
    },
    {
      id: 'receita-prevista',
      rotulo: 'Receita prevista',
      valor: money(input.receitaPrevista),
      tom: 'neutro',
      fonte: 'read-model:admin-metrics.expectedFees',
      href: '/financeiro',
    },
  ];
}
