// ─────────────────────────────────────────────────────────────────────────────
// PORTAL INTEGRATION RUNTIME — conecta a operação aos portais. Cada papel recebe
// APENAS a sua visão (controle de acesso por seção); nunca acesso indevido. Só
// LEITURA (read models + tarefas de handoff do próprio papel). Nunca decide.
// ─────────────────────────────────────────────────────────────────────────────
import type { HumanRole } from '../executive-brain/index.js';
import type { AdminMetrics } from '../administration/index.js';
import type { AdminMetricsStore } from '../administration/index.js';
import type { HandoffTask, HumanHandoffRuntime } from './human-handoff-runtime.js';
import type { MissionProgress, WorkflowProgressStore } from './workflow-runtime.js';
import type { HealthRuntime, ComponentHealth } from './health-runtime.js';

export type PortalSection = 'metrics' | 'handoffs' | 'missions' | 'health';

/** Matriz de acesso: cada papel vê SOMENTE suas seções. */
const ACCESS: Readonly<Record<HumanRole, readonly PortalSection[]>> = {
  administrador: ['metrics', 'handoffs', 'missions', 'health'],
  supervisor: ['handoffs', 'missions', 'health'],
  advogado: ['handoffs', 'missions'],
  perito: ['handoffs', 'missions'],
  operador: ['handoffs', 'missions'],
};

export interface PortalView {
  readonly role: HumanRole;
  readonly sections: readonly PortalSection[];
  readonly metrics: AdminMetrics | null;
  readonly handoffs: readonly HandoffTask[];
  readonly missions: readonly MissionProgress[];
  readonly health: readonly ComponentHealth[];
}

export class PortalIntegrationRuntime {
  constructor(
    private readonly metricsStore: AdminMetricsStore,
    private readonly handoff: HumanHandoffRuntime,
    private readonly progressStore: WorkflowProgressStore,
    private readonly health: HealthRuntime,
  ) {}

  canAccess(role: HumanRole, section: PortalSection): boolean {
    return ACCESS[role].includes(section);
  }

  /** Monta a visão do papel — só o que a matriz permite; nada além. */
  async view(role: HumanRole): Promise<PortalView> {
    const sections = ACCESS[role];
    return {
      role,
      sections,
      metrics: sections.includes('metrics') ? await this.metricsStore.load() : null,
      handoffs: sections.includes('handoffs') ? await this.handoff.openFor(role) : [],
      missions: sections.includes('missions') ? await this.progressStore.all() : [],
      health: sections.includes('health') ? this.health.all() : [],
    };
  }
}
