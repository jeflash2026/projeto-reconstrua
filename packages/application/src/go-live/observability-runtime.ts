// ─────────────────────────────────────────────────────────────────────────────
// OBSERVABILITY RUNTIME — registra tempo de resposta, eventos, erros, fila,
// latência e estatísticas. Tudo AUDITÁVEL (log estruturado append-only em memória
// de processo). Nunca decide.
//
// B5.3 — DURABILIDADE: além da trilha em memória (preservada), cada observação passa
// por um SINK. O sink padrão emite APENAS erros e degradações (health) para stderr,
// em UMA linha estruturada — assim falhas relevantes sobrevivem a reinícios via
// `docker logs`, sem duplicar/flooding (event/latency/queue/stat NÃO vão ao stderr).
// Não é um novo sistema de logs: é a saída padrão do processo pelo MESMO runtime.
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

/** Consumidor durável de observações (B5.3). O padrão escreve erros/degradações no stderr. */
export type ObservationSink = (observation: Observation) => void;

/** Sink padrão: SÓ erros e degradações (health) → stderr, uma linha por ocorrência. */
export function stderrErrorSink(observation: Observation): void {
  if (observation.kind !== 'error' && observation.kind !== 'health') return;
  const suffix = observation.detail !== null ? ` :: ${observation.detail}` : '';
  process.stderr.write(
    `[reconstrua] ${observation.at.toISOString()} ${observation.kind.toUpperCase()} ${observation.component}/${observation.name}${suffix}\n`,
  );
}

export interface ObservabilityStats {
  readonly totalEvents: number;
  readonly totalErrors: number;
  readonly avgLatencyMs: number | null;
  readonly byComponent: Readonly<Record<string, number>>;
}

export class ObservabilityRuntime {
  private readonly log: Observation[] = [];

  /** `sink` durável (default: stderr para erros/degradações). Injetável para testes. */
  constructor(private readonly sink: ObservationSink = stderrErrorSink) {}

  record(observation: Observation): void {
    this.log.push(observation); // trilha em memória PRESERVADA
    this.sink(observation); // durável: erros/degradações → stderr (docker logs)
  }

  event(component: string, name: string, at: Date, detail: string | null = null): void {
    this.record({ kind: 'event', component, name, value: null, detail, at });
  }

  error(component: string, name: string, at: Date, detail: string): void {
    this.record({ kind: 'error', component, name, value: null, detail, at });
  }

  /** B5.3 — DEGRADAÇÃO relevante (ex.: início em modo degradado). Registrada E durável. */
  degraded(component: string, name: string, at: Date, detail: string): void {
    this.record({ kind: 'health', component, name, value: null, detail, at });
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
