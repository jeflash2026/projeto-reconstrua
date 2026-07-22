// ─────────────────────────────────────────────────────────────────────────────
// assembleAdministration — raiz de composição do Administration Intelligence +
// Founder Console. Fia o store de métricas, o subscriber de projeção (para o
// Dispatcher), a inteligência administrativa e o console do fundador. Um lugar de
// montagem.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AdminIntelligenceSources,
  AdminMetricsStore,
  AdminNarrationPort,
  MemoryStore,
} from '@reconstrua/application';
import {
  AdministrationIntelligenceRuntime,
  FounderConsoleRuntime,
  type FounderConsoleConfig,
} from '@reconstrua/application';
import {
  AdminProjectionSubscriber,
  InMemoryAdminMetricsStore,
} from './admin-projection-subscriber.js';
import { TemplateAdminNarration } from './fake-admin-narration.js';

export interface AdministrationWiring {
  readonly memoryStore: MemoryStore;
  readonly metricsStore?: AdminMetricsStore;
  readonly narration?: AdminNarrationPort;
  readonly founder?: FounderConsoleConfig;
  /** GO-LIVE-03 (aditivo): fontes reais (lista única + casos por advogado). */
  readonly sources?: AdminIntelligenceSources;
}

export interface AssembledAdministration {
  readonly metricsStore: AdminMetricsStore;
  readonly projectionSubscriber: AdminProjectionSubscriber;
  readonly admin: AdministrationIntelligenceRuntime;
  readonly founderConsole: FounderConsoleRuntime;
}

export function assembleAdministration(wiring: AdministrationWiring): AssembledAdministration {
  const metricsStore = wiring.metricsStore ?? new InMemoryAdminMetricsStore();
  const narration = wiring.narration ?? new TemplateAdminNarration();
  const founder = wiring.founder ?? { founderName: 'Jessé' };

  const projectionSubscriber = new AdminProjectionSubscriber(metricsStore);
  const admin = new AdministrationIntelligenceRuntime(
    metricsStore,
    wiring.memoryStore,
    wiring.sources ?? {},
  );
  const founderConsole = new FounderConsoleRuntime(admin, narration, metricsStore, founder);

  return { metricsStore, projectionSubscriber, admin, founderConsole };
}
