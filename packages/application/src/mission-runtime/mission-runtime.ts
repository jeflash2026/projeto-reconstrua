// ─────────────────────────────────────────────────────────────────────────────
// MISSION RUNTIME — o orquestrador. Recebe os FATOS percebidos + as INTENÇÕES de
// Use Case vindas EXCLUSIVAMENTE do Executive Brain, resolve cada intenção no
// registry (pipeline), executa (Event Store + Dispatcher via append atômico),
// audita e devolve o resultado com a identidade evoluída da missão.
//
// A AHRI passa a EXECUTAR o trabalho — sempre por decisão do Brain, sempre por
// fábrica congelada, sempre persistindo no Event Store, nunca com LLM, nunca
// tocando infra, nunca criando Verdade/Estado/Etapa diretamente.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { MissionContextLoader } from './mission-context-loader.js';
import type { MissionUseCaseRegistry } from './mission-use-case-registry.js';
import type { MissionAuditRuntime } from './mission-audit-runtime.js';
import type { MissionResultBuilder } from './mission-result-builder.js';
import {
  failedOutcome,
  type MissionFacts,
  type MissionIdentity,
  type MissionResult,
  type MissionUseCaseIntent,
  type UseCaseOutcome,
} from './types.js';

export interface MissionRuntimeDeps {
  readonly loader: MissionContextLoader;
  readonly registry: MissionUseCaseRegistry;
  readonly audit: MissionAuditRuntime;
  readonly resultBuilder: MissionResultBuilder;
  readonly clock: Clock;
}

export class MissionRuntime {
  constructor(private readonly deps: MissionRuntimeDeps) {}

  async execute(
    facts: MissionFacts,
    intents: readonly MissionUseCaseIntent[],
  ): Promise<MissionResult> {
    const chatId = facts.chatId;
    let identity: MissionIdentity = await this.deps.loader.load(chatId);
    const all: UseCaseOutcome[] = [];

    for (const intent of intents) {
      const pipeline = this.deps.registry.resolve(intent.useCase);
      if (!pipeline) {
        all.push(
          failedOutcome(intent.useCase, 'unknown', `Use Case não registrado: ${intent.useCase}`),
        );
        continue;
      }
      const now = this.deps.clock.now();
      const run = await pipeline.run(intent, facts, identity, now);
      all.push(...run.outcomes);
      identity = run.identity;
      await this.deps.audit.record(chatId, intent, run.outcomes);
    }

    await this.deps.loader.save(identity);
    return this.deps.resultBuilder.build(chatId, all, identity);
  }
}
