// ─────────────────────────────────────────────────────────────────────────────
// AFTER DECISION RUNTIME — assim que o advogado decide, a AHRI continua SOZINHA:
// registra o marco jurídico (fluxo 3B), informa o cliente (Brain decide o QUE
// falar — ponte 3B), atualiza a memória viva (fato datado com fonte), registra
// produtividade e auditoria. O advogado decide; TODO o resto é automático.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type {
  DecisionGateRuntime,
  DecisionRequest,
  JuridicalEntryKind,
  ProductivityRuntime,
} from '@reconstrua/application';
import type { AssembledAdvogadoOperation } from '../advogado-portal/build-advogado-operation.js';

const ENTRY_KIND_OF: Readonly<Record<DecisionRequest['type'], JuridicalEntryKind>> = {
  confirm_distribution: 'distribuicao',
  confirm_conclusion: 'conclusao',
  confirm_pendency_resolved: 'movimentacao',
  acknowledge_risk: 'observacao',
  juridical_review: 'movimentacao',
};

export interface AfterDecisionOutcome {
  readonly decision: DecisionRequest;
  readonly missionContinued: boolean;
  readonly clientInformed: boolean;
  readonly ruleRefs: readonly string[];
}

export class AfterDecisionRuntime {
  constructor(
    private readonly op: AssembledAdvogadoOperation,
    private readonly gate: DecisionGateRuntime,
    private readonly productivity: ProductivityRuntime,
    private readonly clock: Clock,
  ) {}

  async resolve(
    advogadoId: string,
    decisionId: string,
    accepted: boolean,
    note: string | null,
  ): Promise<AfterDecisionOutcome> {
    const now = this.clock.now();
    const decision = await this.gate.resolve(advogadoId, decisionId, accepted, note);
    await this.productivity.record(advogadoId, 'decision_resolved', 1, now);

    // Recusa: registra e para (a recusa também é decisão do advogado, auditada).
    if (!accepted) {
      this.op.observability.event(
        'after-decision',
        `rejected:${decision.type}`,
        now,
        decision.missionId,
      );
      return { decision, missionContinued: false, clientInformed: false, ruleRefs: [] };
    }

    // 1) Continuar a missão: o marco vira registro jurídico pelo FLUXO 3B.
    const entry = await this.op.work.addEntry({
      advogadoId,
      missionId: decision.missionId,
      kind: ENTRY_KIND_OF[decision.type],
      text: note ?? decision.explanation,
    });

    // 2) Avisar o cliente: a ponte 3B informa a AHRI; o BRAIN decide a fala.
    const ahri = await this.op.bridge.notify(entry);
    if (ahri.decidedToSpeak) {
      await this.productivity.record(advogadoId, 'ahri_communication', 1, now);
    }

    // 3) Atualizar a memória viva: fato datado, com fonte (a decisão).
    const chatId =
      this.op.projector.missions().find((m) => m.missionId === decision.missionId)?.chatId ?? null;
    if (chatId !== null) {
      const memory = await this.op.memoryStore.load(chatId);
      if (memory) {
        await this.op.memoryStore.save({
          ...memory,
          rememberedEvents: [
            ...memory.rememberedEvents,
            {
              description: `marco jurídico: ${entry.kind} — ${entry.text}`,
              source: { kind: 'domain_event', ref: `decision:${decision.id}`, at: now },
            },
          ],
        });
      }
    }

    // 4) Auditoria (workflow/timeline já refletem por construção: registro 3B + eventos).
    this.op.observability.event(
      'after-decision',
      `accepted:${decision.type}`,
      now,
      decision.missionId,
    );

    return {
      decision,
      missionContinued: true,
      clientInformed: ahri.decidedToSpeak,
      ruleRefs: ahri.ruleRefs,
    };
  }
}
