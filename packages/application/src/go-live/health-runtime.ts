// ─────────────────────────────────────────────────────────────────────────────
// HEALTH RUNTIME — cada runtime publica seu estado (ONLINE/OFFLINE/DEGRADED/
// FAILED) + tempo de resposta, fila, memória e último processamento. Registro
// central consultável (boot, checklist, observabilidade). Não decide nada.
// ─────────────────────────────────────────────────────────────────────────────

export type HealthStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'FAILED';

export interface ComponentHealth {
  readonly component: string;
  readonly status: HealthStatus;
  readonly responseMs: number | null;
  readonly queueDepth: number | null;
  readonly memoryBytes: number | null;
  readonly lastProcessedAt: Date | null;
  readonly detail: string | null;
  readonly reportedAt: Date;
}

export class HealthRuntime {
  private readonly byComponent = new Map<string, ComponentHealth>();

  report(health: ComponentHealth): void {
    this.byComponent.set(health.component, health);
  }

  get(component: string): ComponentHealth | null {
    return this.byComponent.get(component) ?? null;
  }

  all(): readonly ComponentHealth[] {
    return [...this.byComponent.values()];
  }

  /** Saúde global: FAILED se algum falhou; DEGRADED se algum degradado/offline. */
  overall(): HealthStatus {
    const statuses = this.all().map((h) => h.status);
    if (statuses.length === 0) return 'OFFLINE';
    if (statuses.includes('FAILED')) return 'FAILED';
    if (statuses.includes('OFFLINE') || statuses.includes('DEGRADED')) return 'DEGRADED';
    return 'ONLINE';
  }
}

export function online(component: string, reportedAt: Date, over: Partial<ComponentHealth> = {}): ComponentHealth {
  return {
    component,
    status: 'ONLINE',
    responseMs: null,
    queueDepth: null,
    memoryBytes: null,
    lastProcessedAt: null,
    detail: null,
    reportedAt,
    ...over,
  };
}
