// ─────────────────────────────────────────────────────────────────────────────
// OBSERVABILITY RUNTIME — registra tempo de resposta, eventos, erros, fila,
// latência e estatísticas. Tudo AUDITÁVEL (log estruturado append-only em memória
// de processo; adapter durável entra pelo mesmo formato). Nunca decide.
// ─────────────────────────────────────────────────────────────────────────────

export type ObservationKind = 'event' | 'error' | 'latency' | 'queue' | 'health' | 'stat';

export interface Observation {
  readonly kind: ObservationKind;
  readonly component: string;
  readonly name: string;
  readonly value: number | null;
  readonly detail: string | null;
  readonly at: Date;
}

export interface ObservabilityStats {
  readonly totalEvents: number;
  readonly totalErrors: number;
  readonly avgLatencyMs: number | null;
  readonly byComponent: Readonly<Record<string, number>>;
}

export class ObservabilityRuntime {
  private readonly log: Observation[] = [];

  record(observation: Observation): void {
    this.log.push(observation);
  }

  event(component: string, name: string, at: Date, detail: string | null = null): void {
    this.record({ kind: 'event', component, name, value: null, detail, at });
  }

  error(component: string, name: string, at: Date, detail: string): void {
    this.record({ kind: 'error', component, name, value: null, detail, at });
  }

  latency(component: string, name: string, ms: number, at: Date): void {
    this.record({ kind: 'latency', component, name, value: ms, detail: null, at });
  }

  queueDepth(component: string, depth: number, at: Date): void {
    this.record({ kind: 'queue', component, name: 'queue-depth', value: depth, detail: null, at });
  }

  /** Trilha completa (auditável). */
  trail(): readonly Observation[] {
    return [...this.log];
  }

  stats(): ObservabilityStats {
    let totalEvents = 0;
    let totalErrors = 0;
    let latencySum = 0;
    let latencyCount = 0;
    const byComponent: Record<string, number> = {};
    for (const o of this.log) {
      byComponent[o.component] = (byComponent[o.component] ?? 0) + 1;
      if (o.kind === 'event') totalEvents += 1;
      if (o.kind === 'error') totalErrors += 1;
      if (o.kind === 'latency' && o.value !== null) {
        latencySum += o.value;
        latencyCount += 1;
      }
    }
    return {
      totalEvents,
      totalErrors,
      avgLatencyMs: latencyCount === 0 ? null : latencySum / latencyCount,
      byComponent,
    };
  }
}
