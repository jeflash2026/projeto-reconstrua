// ─────────────────────────────────────────────────────────────────────────────
// R6a — CONSTRUIR VERDADE. NUNCA cria Verdade "diretamente": executa a fábrica
// congelada `OperationalTruthAggregate.synthesize` (E8 — nasce por síntese). Cada
// turno re-sintetiza uma nova Verdade a partir dos fatos da missão. Persiste
// OperationalTruthSynthesized.
// ─────────────────────────────────────────────────────────────────────────────
import {
  OperationalTruthAggregate,
  OperationalTruthId,
  OperationalTruthMissionRef,
  SynthesisResponsibleRef,
} from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, type UseCaseOutcome } from '../types.js';
import {
  persistNew,
  successOutcome,
  type MissionContext,
  type MissionUseCase,
  type UseCaseDeps,
} from '../use-case.js';

export class BuildTruthUseCase implements MissionUseCase {
  readonly name = 'BuildTruth';
  readonly streamType = 'operational-truth';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Missão (Lei 2)');
    }
    const truthId = this.deps.uuid.next();
    const result = OperationalTruthAggregate.synthesize({
      id: OperationalTruthId.fromUuid(truthId),
      mission: OperationalTruthMissionRef.fromString(ctx.identity.missionId),
      chainJustification: 'Síntese a partir dos fatos operacionais reconhecidos na missão.',
      declaredUncertainty: 'Síntese incremental; sujeita a novos elementos probatórios.',
      synthesizedAt: ctx.now,
      synthesizedBy: SynthesisResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
    });
    if (result.isErr())
      return failedOutcome(this.name, this.streamType, result.unwrapErr().message);

    const appended = await persistNew(
      this.deps.appender,
      this.streamType,
      truthId,
      result.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.missionId),
      { missionId: ctx.identity.missionId },
    );
    return successOutcome(this.name, this.streamType, truthId, appended, {
      latestTruthId: truthId,
    });
  }
}
