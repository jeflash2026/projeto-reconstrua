// ─────────────────────────────────────────────────────────────────────────────
// GO LIVE CHECKLIST — o verificador AUTOMÁTICO de produção. Executa TODOS os
// checks nomeados (Event Store, Dispatcher, Brain, Conversation, Memory,
// Relationship, Founder Console, Workflow, Scheduler, Notification, Health,
// Observability, WhatsApp, Read Models, CQRS, Projeções, Integridade, Auditoria).
//
// Se QUALQUER item falhar: PRODUÇÃO BLOQUEADA (`ready: false`). Sem exceção.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';

export const GO_LIVE_ITEMS = [
  'event-store',
  'dispatcher',
  'brain',
  'conversation',
  'memory',
  'relationship',
  'founder-console',
  'workflow',
  'scheduler',
  'notification',
  'health',
  'observability',
  'whatsapp',
  'read-models',
  'cqrs',
  'projections',
  'integrity',
  'audit',
] as const;

export type GoLiveItem = (typeof GO_LIVE_ITEMS)[number];

export interface GoLiveCheck {
  readonly item: GoLiveItem;
  /** Executa a verificação REAL do subsistema. Lança/false = falha. */
  run(): Promise<boolean>;
}

export interface GoLiveItemResult {
  readonly item: GoLiveItem;
  readonly passed: boolean;
  readonly error: string | null;
}

export interface GoLiveReport {
  readonly ready: boolean; // false = PRODUÇÃO BLOQUEADA
  readonly at: Date;
  readonly results: readonly GoLiveItemResult[];
  readonly missingChecks: readonly GoLiveItem[];
}

export class GoLiveChecklist {
  constructor(private readonly clock: Clock) {}

  async verify(checks: readonly GoLiveCheck[]): Promise<GoLiveReport> {
    const provided = new Set(checks.map((c) => c.item));
    const missingChecks = GO_LIVE_ITEMS.filter((item) => !provided.has(item));

    const results: GoLiveItemResult[] = [];
    for (const check of checks) {
      try {
        const passed = await check.run();
        results.push({
          item: check.item,
          passed,
          error: passed ? null : 'verificação retornou falso',
        });
      } catch (error) {
        results.push({
          item: check.item,
          passed: false,
          error: error instanceof Error ? error.message : 'falha desconhecida',
        });
      }
    }

    // Qualquer item ausente ou reprovado ⇒ produção bloqueada.
    const ready = missingChecks.length === 0 && results.every((r) => r.passed);
    return { ready, at: this.clock.now(), results, missingChecks };
  }
}
