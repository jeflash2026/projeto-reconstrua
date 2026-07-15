// ─────────────────────────────────────────────────────────────────────────────
// Contrato dos Use Cases do Mission Runtime (R1–R9). Cada Use Case: recebe o
// contexto (intenção do Brain + fatos + identidades), valida pré-condições, executa
// o AGREGADO CONGELADO por fábrica, e persiste EXCLUSIVAMENTE via `EventAppender`
// (Event Store). Nunca usa LLM; nunca toca infra; nunca cria Verdade/Estado/Etapa
// "diretamente" (só via synthesize/derive/represent).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, DomainEvent, UuidGenerator } from '@reconstrua/domain';
import { NO_STREAM, toUncommitted, type AppendResult, type EventProvenance } from '../event-store/index.js';
import type { EventAppender } from './ports.js';
import type { MissionFacts, MissionIdentity, MissionUseCaseIntent, UseCaseOutcome } from './types.js';

/** Constrói o resultado de sucesso a partir do append (rastreável). */
export function successOutcome(
  useCase: string,
  streamType: string,
  streamId: string,
  result: AppendResult,
  identityPatch: Partial<MissionIdentity>,
): UseCaseOutcome {
  return {
    useCase,
    ok: true,
    skipped: false,
    streamType,
    streamId,
    appended: result.events.length,
    eventTypes: result.events.map((e) => e.eventType),
    identityPatch,
    error: null,
  };
}

export interface MissionRuntimeConfig {
  /** Uuid (string) do responsável operacional AHRI (DECISOR das atuações). */
  readonly ahriResponsibleId: string;
}

export interface MissionContext {
  readonly intent: MissionUseCaseIntent;
  readonly facts: MissionFacts;
  readonly identity: MissionIdentity;
  readonly now: Date;
}

export interface UseCaseDeps {
  readonly appender: EventAppender;
  readonly uuid: UuidGenerator;
  readonly clock: Clock;
  readonly config: MissionRuntimeConfig;
}

export interface MissionUseCase {
  readonly name: string;
  readonly streamType: string;
  execute(ctx: MissionContext): Promise<UseCaseOutcome>;
}

/** Emite o(s) evento(s) de domínio de um agregado recém-criado no seu stream, sob
 *  concorrência otimista NO_STREAM (idempotência: se já existir → conflito). */
export async function persistNew(
  appender: EventAppender,
  streamType: string,
  streamId: string,
  aggregate: { pullDomainEvents(): readonly DomainEvent[] },
  isRelevant: boolean,
  provenance: EventProvenance,
  payload: Readonly<Record<string, unknown>>,
): Promise<AppendResult> {
  const events = aggregate
    .pullDomainEvents()
    .map((e) => toUncommitted(e, { isRelevant, provenance, payload }));
  return appender.append(streamType, streamId, NO_STREAM, events, provenance);
}
