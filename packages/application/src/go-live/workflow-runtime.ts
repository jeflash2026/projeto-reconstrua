// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW RUNTIME — acompanha AUTOMATICAMENTE toda missão. É um `EventSubscriber`
// (port congelado de 2A): a cada evento de domínio publicado pelo Dispatcher, (1)
// atualiza o PROGRESSO da missão (read model: documento→perícia→prazo→advogado→
// distribuição→acompanhamento→conclusão) e (2) AGENDA os acompanhamentos futuros no
// Scheduler (prazos vêm de parâmetros operacionais, não de invenção).
//
// O Workflow NÃO decide ação: quando o acompanhamento vence, o sinal temporal vai ao
// Brain (que decide). Reagir≠decidir.
// ─────────────────────────────────────────────────────────────────────────────
import type { StoredEvent } from '../event-store/index.js';
import type { EventSubscriber } from '../event-store/index.js';
import type { SchedulerRuntime, ScheduledTaskKind } from './scheduler-runtime.js';
import type { ObservabilityRuntime } from './observability-runtime.js';

export type WorkflowStep =
  | 'documento_recebido'
  | 'documento_reconhecido'
  | 'pericia_disponivel'
  | 'prazo_administrativo'
  | 'advogado'
  | 'distribuicao'
  | 'acompanhamento'
  | 'conclusao';

export interface MissionProgress {
  readonly missionId: string;
  readonly steps: readonly WorkflowStep[];
  readonly updatedAt: Date;
}

export interface WorkflowProgressStore {
  load(missionId: string): Promise<MissionProgress | null>;
  save(progress: MissionProgress): Promise<void>;
  all(): Promise<readonly MissionProgress[]>;
}

export interface WorkflowTimings {
  /** Prazo administrativo padrão após documento (ms) — parâmetro de RO. */
  readonly adminDeadlineMs: number;
  /** Acompanhamento periódico (ms). */
  readonly followUpMs: number;
}

export const DEFAULT_WORKFLOW_TIMINGS: WorkflowTimings = {
  adminDeadlineMs: 10 * 24 * 60 * 60_000, // 10 dias — parâmetro operacional
  followUpMs: 3 * 24 * 60 * 60_000,
};

interface EventReaction {
  readonly step: WorkflowStep;
  readonly schedule: { readonly kind: ScheduledTaskKind; readonly delayMs: keyof WorkflowTimings } | null;
}

const REACTIONS: Readonly<Record<string, EventReaction>> = {
  'document.recognized': { step: 'documento_reconhecido', schedule: { kind: 'follow_deadline', delayMs: 'adminDeadlineMs' } },
  'pericia.framed': { step: 'pericia_disponivel', schedule: { kind: 'follow_perito', delayMs: 'followUpMs' } },
  'advogado.designated': { step: 'advogado', schedule: { kind: 'follow_advogado', delayMs: 'followUpMs' } },
  'process.recognized': { step: 'distribuicao', schedule: null },
  'operational-stage.represented': { step: 'acompanhamento', schedule: null },
  'mission.created': { step: 'acompanhamento', schedule: { kind: 'remind_client', delayMs: 'followUpMs' } },
};

function missionIdOf(event: StoredEvent): string | null {
  if (event.streamType === 'mission') return event.streamId;
  const fromPayload = event.payload['missionId'];
  return typeof fromPayload === 'string' ? fromPayload : null;
}

export class WorkflowRuntime implements EventSubscriber {
  readonly name = 'workflow';
  readonly interestedIn = Object.keys(REACTIONS);

  constructor(
    private readonly progressStore: WorkflowProgressStore,
    private readonly scheduler: SchedulerRuntime,
    private readonly timings: WorkflowTimings = DEFAULT_WORKFLOW_TIMINGS,
    private readonly observability?: ObservabilityRuntime,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    const reaction = REACTIONS[event.eventType];
    if (!reaction) return;
    const missionId = missionIdOf(event);
    if (missionId === null) return;

    // 1) Progresso da missão (read model; idempotente por passo).
    const current = (await this.progressStore.load(missionId)) ?? { missionId, steps: [], updatedAt: event.recordedAt };
    if (!current.steps.includes(reaction.step)) {
      await this.progressStore.save({
        missionId,
        steps: [...current.steps, reaction.step],
        updatedAt: event.recordedAt,
      });
    }

    // 2) Agenda o acompanhamento futuro (o Brain decidirá a ação quando vencer).
    if (reaction.schedule) {
      const chatId = typeof event.payload['chatId'] === 'string' ? event.payload['chatId'] : missionId;
      await this.scheduler.schedule({
        id: `wf:${event.id}:${reaction.schedule.kind}`,
        chatId,
        missionId,
        kind: reaction.schedule.kind,
        dueAt: new Date(event.recordedAt.getTime() + this.timings[reaction.schedule.delayMs]),
        note: `workflow:${event.eventType}`,
        createdAt: event.recordedAt,
      });
    }

    this.observability?.event('workflow', event.eventType, event.recordedAt, missionId);
  }

  async progress(missionId: string): Promise<MissionProgress | null> {
    return this.progressStore.load(missionId);
  }
}
