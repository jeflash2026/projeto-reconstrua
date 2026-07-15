// ─────────────────────────────────────────────────────────────────────────────
// DECISION RUNTIME — quando existe competência exclusiva do advogado, a AHRI:
// PARA, EXPLICA, MOSTRA CONTEXTO, MOSTRA FUNDAMENTOS e AGUARDA. Nunca decide.
//
// Um DecisionRequest é o ponto de parada: carrega a explicação, o contexto factual
// e o fundamento — e fica aberto até o ADVOGADO resolver (aceitar/recusar). A
// resolução dispara o After-Decision (continuidade automática). Idempotente por
// chave (missão × tipo) para a preparação noturna nunca duplicar pedidos.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';

export type LawyerDecisionType =
  | 'confirm_distribution' // documentação completa → confirmar distribuição
  | 'confirm_conclusion' // missão madura → confirmar conclusão
  | 'confirm_pendency_resolved' // cliente afirma resolvido → confirmar
  | 'acknowledge_risk' // risco sinalizado → aceite consciente
  | 'juridical_review'; // prazo/matéria exige análise jurídica

export type DecisionStatus = 'open' | 'accepted' | 'rejected';

export interface DecisionRequest {
  readonly id: string;
  readonly advogadoId: string;
  readonly missionId: string;
  readonly type: LawyerDecisionType;
  /** A EXPLICAÇÃO: por que a AHRI parou aqui. */
  readonly explanation: string;
  /** O CONTEXTO: fatos que sustentam o pedido (nunca conclusões). */
  readonly context: readonly string[];
  /** O FUNDAMENTO constitucional/operacional da parada. */
  readonly fundamento: string;
  readonly createdAt: Date;
  readonly status: DecisionStatus;
  readonly resolvedAt: Date | null;
  readonly resolutionNote: string | null;
}

export interface DecisionStore {
  save(decision: DecisionRequest): Promise<void>;
  byId(id: string): Promise<DecisionRequest | null>;
  openFor(advogadoId: string): Promise<readonly DecisionRequest[]>;
  byMissionAndType(missionId: string, type: LawyerDecisionType): Promise<DecisionRequest | null>;
}

export interface OpenDecisionInput {
  readonly advogadoId: string;
  readonly missionId: string;
  readonly type: LawyerDecisionType;
  readonly explanation: string;
  readonly context: readonly string[];
  readonly fundamento: string;
}

export class DecisionGateRuntime {
  constructor(
    private readonly store: DecisionStore,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  /** Abre o ponto de parada (idempotente por missão×tipo enquanto aberto). */
  async open(input: OpenDecisionInput): Promise<DecisionRequest> {
    const existing = await this.store.byMissionAndType(input.missionId, input.type);
    if (existing && existing.status === 'open') return existing;
    const decision: DecisionRequest = {
      id: this.uuid.next(),
      advogadoId: input.advogadoId,
      missionId: input.missionId,
      type: input.type,
      explanation: input.explanation,
      context: input.context,
      fundamento: input.fundamento,
      createdAt: this.clock.now(),
      status: 'open',
      resolvedAt: null,
      resolutionNote: null,
    };
    await this.store.save(decision);
    return decision;
  }

  async awaiting(advogadoId: string): Promise<readonly DecisionRequest[]> {
    return this.store.openFor(advogadoId);
  }

  /** A resolução é EXCLUSIVA do advogado dono. A AHRI jamais resolve. */
  async resolve(
    advogadoId: string,
    decisionId: string,
    accepted: boolean,
    note: string | null,
  ): Promise<DecisionRequest> {
    const decision = await this.store.byId(decisionId);
    if (!decision || decision.advogadoId !== advogadoId) {
      throw new Error('decisão inexistente ou não pertence a este advogado');
    }
    if (decision.status !== 'open') return decision;
    const resolved: DecisionRequest = {
      ...decision,
      status: accepted ? 'accepted' : 'rejected',
      resolvedAt: this.clock.now(),
      resolutionNote: note,
    };
    await this.store.save(resolved);
    return resolved;
  }
}
