// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP RECURRENCE RUNTIME (B4.2) — recorrência CONTROLADA do acompanhamento.
//
// CAUSA: o Workflow agenda um acompanhamento UMA VEZ por evento de domínio (one-shot).
// Num processo jurídico longo (meses) sem novos eventos, após o disparo o cliente
// deixaria de ser acompanhado. CORREÇÃO: quando um acompanhamento AO CLIENTE dispara e
// o Brain DECIDE (por Regra Operacional) falar (RO-4C-FOLLOWUP-*), agenda-se o PRÓXIMO
// no MESMO Scheduler — sem novo scheduler, sem nova persistência, sem novo fluxo.
//
// LIMITES CLAROS (anti-spam):
//   • cadência mínima fixa entre nudges (`cadenceMs`) — nunca mais rápido;
//   • teto de nudges CONSECUTIVOS por streak (`maxConsecutive`) — depois, silêncio até
//     um novo marco do processo re-armar (o Workflow já agenda em cada evento);
//   • só recorre se ESTE disparo produziu acompanhamento ao cliente: encerrado (STOP,
//     B4.1), escalação a humano ou espera NÃO recorrem — a cadeia termina sozinha.
// A recorrência RESPEITA automaticamente o encerramento (B4.1): uma missão ENCERRADA
// decide STOP (RO-STOP-CONCLUDED-001), que não é acompanhamento ⇒ a cadeia não segue.
// ─────────────────────────────────────────────────────────────────────────────
import type { TurnResult } from '../conversation/conversation-runtime.js';
import type { ScheduledTask, SchedulerRuntime } from './scheduler-runtime.js';

/** Regras que representam ACOMPANHAMENTO ao cliente (e por isso devem recorrer). */
const FOLLOW_UP_RULE_REFS: readonly string[] = ['RO-4C-FOLLOWUP-SILENCE', 'RO-4C-FOLLOWUP-TIMEOUT'];

export interface FollowUpRecurrencePolicy {
  /** Cadência mínima entre acompanhamentos consecutivos (ms). Nunca mais rápido. */
  readonly cadenceMs: number;
  /** Teto de acompanhamentos CONSECUTIVOS por streak (sem resposta/novo marco). Anti-spam. */
  readonly maxConsecutive: number;
}

export const DEFAULT_FOLLOW_UP_RECURRENCE: FollowUpRecurrencePolicy = {
  cadenceMs: 3 * 24 * 60 * 60_000, // 3 dias — mesma cadência do Workflow
  maxConsecutive: 8, // até 8 nudges por streak (~24 dias) e então aguarda um novo marco
};

/** streak (índice de recorrência) codificado no id da tarefa: `…#<n>`; base = 0. */
function streakOf(id: string): number {
  const match = /#(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

/** id da PRÓXIMA ocorrência: substitui/adiciona o sufixo `#<n>` de forma determinística. */
function nextIdFor(id: string, next: number): string {
  return `${id.replace(/#\d+$/, '')}#${String(next)}`;
}

export class FollowUpRecurrenceRuntime {
  constructor(
    private readonly scheduler: SchedulerRuntime,
    private readonly policy: FollowUpRecurrencePolicy = DEFAULT_FOLLOW_UP_RECURRENCE,
  ) {}

  /**
   * Chamado após um sinal temporal disparar e o turno ser decidido. Se o Brain decidiu
   * ACOMPANHAR o cliente (RO-4C-FOLLOWUP-*) e o teto não foi atingido, agenda o próximo.
   * Determinístico e idempotente (o Scheduler dedup por id).
   */
  async onFollowUpFired(task: ScheduledTask, result: TurnResult, now: Date): Promise<void> {
    const followedUp = result.intents.some(
      (intent) =>
        intent.operationalRuleRef !== null &&
        FOLLOW_UP_RULE_REFS.includes(intent.operationalRuleRef),
    );
    if (!followedUp) return; // encerrado (STOP), escalação ou espera ⇒ a cadeia termina

    const next = streakOf(task.id) + 1;
    if (next >= this.policy.maxConsecutive) return; // teto anti-spam atingido ⇒ aguarda novo marco

    await this.scheduler.schedule({
      id: nextIdFor(task.id, next),
      chatId: task.chatId,
      missionId: task.missionId,
      kind: task.kind,
      dueAt: new Date(now.getTime() + this.policy.cadenceMs),
      note: `recurrence:${String(next)}`,
      createdAt: now,
    });
  }
}
