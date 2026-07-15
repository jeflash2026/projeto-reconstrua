// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTIVITY METRICS — alimentadas pelos próprios read models do 3D: acessos
// (cursor), decisões (gate), eventos ocultados (dobra), comunicações da AHRI
// (bridge). "Tempo economizado" é ESTIMATIVA PARAMETRIZADA e declarada — nunca um
// número inventado sem base.
// ─────────────────────────────────────────────────────────────────────────────

export type ProductivityEventKind =
  | 'access'
  | 'decision_opened'
  | 'decision_resolved'
  | 'ahri_communication'
  | 'events_hidden'
  | 'relevant_changes';

export interface ProductivityEvent {
  readonly advogadoId: string;
  readonly kind: ProductivityEventKind;
  readonly value: number;
  readonly at: Date;
}

export interface ProductivityStore {
  record(event: ProductivityEvent): Promise<void>;
  byAdvogado(advogadoId: string): Promise<readonly ProductivityEvent[]>;
}

/** Parâmetros DECLARADOS da estimativa de tempo economizado. */
export interface SavingsParams {
  readonly secondsPerHiddenEvent: number; // leitura evitada por evento dobrado
  readonly secondsPerAhriCommunication: number; // mensagem que o advogado não escreveu
}

export const DEFAULT_SAVINGS: SavingsParams = {
  secondsPerHiddenEvent: 20,
  secondsPerAhriCommunication: 240,
};

export interface ProductivityReport {
  readonly advogadoId: string;
  readonly accesses: number;
  readonly decisionsResolved: number;
  /** ms entre o 1º acesso e a 1ª decisão resolvida (null se ainda não decidiu). */
  readonly timeToFirstDecisionMs: number | null;
  readonly eventsHidden: number;
  readonly relevantChanges: number;
  readonly ahriCommunications: number;
  /** Estimativa declarada (parâmetros incluídos no relatório). */
  readonly estimatedTimeSavedSeconds: number;
  readonly savingsParams: SavingsParams;
}

export class ProductivityRuntime {
  constructor(
    private readonly store: ProductivityStore,
    private readonly params: SavingsParams = DEFAULT_SAVINGS,
  ) {}

  async record(advogadoId: string, kind: ProductivityEventKind, value: number, at: Date): Promise<void> {
    await this.store.record({ advogadoId, kind, value, at });
  }

  async report(advogadoId: string): Promise<ProductivityReport> {
    const events = await this.store.byAdvogado(advogadoId);
    const sum = (kind: ProductivityEventKind): number =>
      events.filter((e) => e.kind === kind).reduce((total, e) => total + e.value, 0);
    const firstAccess = events.find((e) => e.kind === 'access')?.at ?? null;
    const firstDecision = events.find((e) => e.kind === 'decision_resolved')?.at ?? null;
    const eventsHidden = sum('events_hidden');
    const ahriCommunications = sum('ahri_communication');
    return {
      advogadoId,
      accesses: events.filter((e) => e.kind === 'access').length,
      decisionsResolved: events.filter((e) => e.kind === 'decision_resolved').length,
      timeToFirstDecisionMs:
        firstAccess && firstDecision ? Math.max(0, firstDecision.getTime() - firstAccess.getTime()) : null,
      eventsHidden,
      relevantChanges: sum('relevant_changes'),
      ahriCommunications,
      estimatedTimeSavedSeconds:
        eventsHidden * this.params.secondsPerHiddenEvent +
        ahriCommunications * this.params.secondsPerAhriCommunication,
      savingsParams: this.params,
    };
  }
}
