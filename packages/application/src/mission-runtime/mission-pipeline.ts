// ─────────────────────────────────────────────────────────────────────────────
// MISSION PIPELINE — uma sequência ORDENADA de Use Cases que realiza um fluxo
// obrigatório (ex.: OnboardClient = R1→R2→CriarMissão→Verdade→Estado→Etapa). Cada
// passo recebe o contexto com as identidades PRODUZIDAS pelos passos anteriores
// (fluxo de dados). Para na primeira falha (não deixa a missão em meio-estado
// inconsistente entre passos). Determinístico.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionContextAssembler } from './mission-context-assembler.js';
import type { MissionExecutor } from './mission-executor.js';
import { mergeIdentity, type MissionFacts, type MissionIdentity, type MissionUseCaseIntent, type UseCaseOutcome } from './types.js';
import type { MissionUseCase } from './use-case.js';

export interface PipelineRun {
  readonly outcomes: readonly UseCaseOutcome[];
  readonly identity: MissionIdentity;
}

export class MissionPipeline {
  constructor(
    readonly name: string,
    private readonly steps: readonly MissionUseCase[],
    private readonly executor: MissionExecutor,
    private readonly assembler: MissionContextAssembler,
  ) {}

  async run(
    intent: MissionUseCaseIntent,
    facts: MissionFacts,
    identity: MissionIdentity,
    now: Date,
  ): Promise<PipelineRun> {
    let current = identity;
    const outcomes: UseCaseOutcome[] = [];
    for (const step of this.steps) {
      const ctx = this.assembler.assemble(intent, facts, current, now);
      const outcome = await this.executor.execute(step, ctx);
      outcomes.push(outcome);
      if (!outcome.ok) break;
      current = mergeIdentity(current, outcome.identityPatch);
    }
    return { outcomes, identity: current };
  }
}
