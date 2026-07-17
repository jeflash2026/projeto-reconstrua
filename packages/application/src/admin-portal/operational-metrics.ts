// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL METRICS (B4.4) — INDICADORES para governar centenas de processos
// simultâneos. É uma AGREGAÇÃO PURA e determinística sobre os READ MODELS já
// existentes (TimelineProjector, Decision State, AdminMetrics, Scheduler, memória,
// progresso do Workflow, atribuições). NÃO cria projeção nem store novo; NÃO lê o
// Event Store; NÃO decide. Cada indicador nasce de dados JÁ projetados — o que não
// foi capturado fica explicitamente ausente (null), jamais inventado.
// ─────────────────────────────────────────────────────────────────────────────

/** Entradas já lidas dos read models existentes (nenhum tipo de infraestrutura). */
export interface OperationalMetricsInputs {
  /** Missões conhecidas (TimelineProjector): id + nascimento. */
  readonly missions: readonly { readonly missionId: string; readonly createdAt: Date }[];
  /** Estado terminal por missão (Decision State Read Model — B4.1/B4.3). */
  readonly terminals: readonly {
    readonly missionId: string;
    readonly terminalState: 'ENCERRADA' | null | undefined;
    readonly updatedAt: Date;
  }[];
  /** Reaberturas cumulativas (AdminMetrics — projetado). */
  readonly reopenedCount: number;
  /** Contagem do Scheduler por status (follow-ups). */
  readonly scheduler: { readonly pending: number; readonly fired: number };
  /** Interações por cliente (read model de memória). */
  readonly interactions: readonly {
    readonly messageCount: number;
    readonly firstContactAt: Date | null;
    readonly lastContactAt: Date | null;
    readonly documentsPending: number;
  }[];
  /** Progresso por missão (Workflow read model): passos registrados. */
  readonly progresses: readonly { readonly steps: readonly string[] }[];
  /** Casos por advogado (atribuições existentes: advogado → nº de casos). */
  readonly casesByAdvogado: Readonly<Record<string, number>>;
}

export interface OperationalMetrics {
  readonly totalProcessos: number;
  readonly processosAtivos: number;
  readonly processosEncerrados: number;
  readonly processosReabertos: number;
  readonly followUpsPendentes: number;
  readonly followUpsEnviados: number;
  /** Tempo médio entre interações do cliente (ms); null se não há amostra. */
  readonly tempoMedioEntreInteracoesMs: number | null;
  /** Tempo médio do nascimento até o encerramento (ms); null se nada encerrado. */
  readonly tempoMedioAteEncerramentoMs: number | null;
  readonly casosPorAdvogado: Readonly<Record<string, number>>;
  readonly casosPorEtapa: Readonly<Record<string, number>>;
  readonly casosAguardandoCliente: number;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Agrega os indicadores operacionais a partir dos read models já projetados. */
export function computeOperationalMetrics(input: OperationalMetricsInputs): OperationalMetrics {
  const totalProcessos = input.missions.length;

  const encerrados = input.terminals.filter((t) => t.terminalState === 'ENCERRADA');
  const processosEncerrados = encerrados.length;
  const processosAtivos = Math.max(0, totalProcessos - processosEncerrados);

  // Tempo médio entre interações: (última − primeira) / (nº de mensagens − 1), por cliente.
  const intervals: number[] = [];
  for (const i of input.interactions) {
    if (i.messageCount > 1 && i.firstContactAt !== null && i.lastContactAt !== null) {
      const span = i.lastContactAt.getTime() - i.firstContactAt.getTime();
      if (span >= 0) intervals.push(span / (i.messageCount - 1));
    }
  }

  // Tempo médio até encerramento: (encerramento − nascimento) por processo encerrado.
  const createdAt = new Map(input.missions.map((m) => [m.missionId, m.createdAt.getTime()]));
  const durations: number[] = [];
  for (const t of encerrados) {
    const born = createdAt.get(t.missionId);
    if (born !== undefined) {
      const span = t.updatedAt.getTime() - born;
      if (span >= 0) durations.push(span);
    }
  }

  // Casos por etapa: etapa ATUAL = último passo registrado no Workflow (ou 'sem_etapa').
  const casosPorEtapa: Record<string, number> = {};
  for (const p of input.progresses) {
    const etapa = p.steps.length > 0 ? (p.steps[p.steps.length - 1] ?? 'sem_etapa') : 'sem_etapa';
    casosPorEtapa[etapa] = (casosPorEtapa[etapa] ?? 0) + 1;
  }

  const casosAguardandoCliente = input.interactions.filter((i) => i.documentsPending > 0).length;

  return {
    totalProcessos,
    processosAtivos,
    processosEncerrados,
    processosReabertos: input.reopenedCount,
    followUpsPendentes: input.scheduler.pending,
    followUpsEnviados: input.scheduler.fired,
    tempoMedioEntreInteracoesMs: average(intervals),
    tempoMedioAteEncerramentoMs: average(durations),
    casosPorAdvogado: { ...input.casesByAdvogado },
    casosPorEtapa,
    casosAguardandoCliente,
  };
}
