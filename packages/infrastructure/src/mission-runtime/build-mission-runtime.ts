// ─────────────────────────────────────────────────────────────────────────────
// assembleMissionRuntime — raiz de composição do Mission Runtime. Constrói os Use
// Cases R1–R9 sobre o Event Store (2A), registra os PIPELINES dos fluxos obrigatórios
// (OnboardClient, IngestDocument) e os Use Cases isolados, e devolve o MissionRuntime
// pronto. Um único lugar de montagem.
//
//   OnboardClient  = R1 → R2 → Criar Missão → Verdade → Estado → Etapa   (flow 1)
//   IngestDocument = R3 → R4 → R5 → Verdade → Estado → Etapa            (flows 2 e 3)
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  EventStore,
  Hasher,
  IntegrityAuditorPort,
  MissionAuditSink,
  MissionIdentityMap,
  MissionRuntimeConfig,
  MissionUseCase,
} from '@reconstrua/application';
import {
  AuditIntegralUseCase,
  BuildKnowledgeUseCase,
  BuildTruthUseCase,
  CreateMissionUseCase,
  DeriveStateUseCase,
  EventStoreIntegrityAuditor,
  ExecuteOperationUseCase,
  MissionAuditRuntime,
  MissionContextAssembler,
  MissionContextLoader,
  MissionExecutor,
  MissionPipeline,
  MissionRecoveryRuntime,
  MissionResultBuilder,
  MissionRuntime,
  MissionTransactionRuntime,
  MissionUseCaseRegistry,
  MissionValidator,
  ProduceProjectionUseCase,
  RecognizeClienteUseCase,
  RecognizeDocumentUseCase,
  RecognizeEventUseCase,
  RecognizePersonUseCase,
  RepresentStageUseCase,
} from '@reconstrua/application';
import { InMemoryMissionAuditSink, InMemoryMissionIdentityMap } from './in-memory-adapters.js';

/** Uuid do responsável operacional AHRI (DECISOR) — well-known do sistema. */
export const DEFAULT_AHRI_RESPONSIBLE_ID = '00000000-0000-4000-8000-00000000a4a1';

export interface MissionRuntimeWiring {
  readonly eventStore: EventStore;
  readonly hasher: Hasher;
  readonly uuid: UuidGenerator;
  readonly clock: Clock;
  readonly config?: MissionRuntimeConfig;
  readonly identityMap?: MissionIdentityMap;
  readonly auditSink?: MissionAuditSink;
}

export interface AssembledMissionRuntime {
  readonly runtime: MissionRuntime;
  readonly registry: MissionUseCaseRegistry;
  readonly identityMap: MissionIdentityMap;
  readonly auditSink: MissionAuditSink;
  readonly auditor: IntegrityAuditorPort;
}

export function assembleMissionRuntime(wiring: MissionRuntimeWiring): AssembledMissionRuntime {
  const config = wiring.config ?? { ahriResponsibleId: DEFAULT_AHRI_RESPONSIBLE_ID };
  const identityMap = wiring.identityMap ?? new InMemoryMissionIdentityMap();
  const auditSink = wiring.auditSink ?? new InMemoryMissionAuditSink();
  const appender = new MissionTransactionRuntime(wiring.eventStore);
  const auditor = new EventStoreIntegrityAuditor(wiring.eventStore, wiring.hasher);
  const deps = { appender, uuid: wiring.uuid, clock: wiring.clock, config };

  const r1 = new RecognizePersonUseCase(deps);
  const r2 = new RecognizeClienteUseCase(deps);
  const createMission = new CreateMissionUseCase(deps);
  const r3 = new RecognizeDocumentUseCase(deps);
  const r4 = new RecognizeEventUseCase(deps);
  const r5 = new BuildKnowledgeUseCase(deps);
  const r6a = new BuildTruthUseCase(deps);
  const r6b = new DeriveStateUseCase(deps);
  const r6c = new RepresentStageUseCase(deps);
  const r7 = new ExecuteOperationUseCase(deps);
  const r8 = new ProduceProjectionUseCase(deps);
  const r9 = new AuditIntegralUseCase(auditor);

  const executor = new MissionExecutor(new MissionValidator(), new MissionRecoveryRuntime());
  const assembler = new MissionContextAssembler();
  const pipe = (name: string, steps: readonly MissionUseCase[]): MissionPipeline =>
    new MissionPipeline(name, steps, executor, assembler);

  const registry = new MissionUseCaseRegistry()
    .register(pipe('OnboardClient', [r1, r2, createMission, r6a, r6b, r6c]))
    .register(pipe('IngestDocument', [r3, r4, r5, r6a, r6b, r6c]))
    .register(pipe('RecognizePerson', [r1]))
    .register(pipe('RecognizeCliente', [r2]))
    .register(pipe('CreateMission', [createMission]))
    .register(pipe('RecognizeDocument', [r3]))
    .register(pipe('RecognizeEvent', [r4]))
    .register(pipe('BuildKnowledge', [r5]))
    .register(pipe('BuildTruth', [r6a]))
    .register(pipe('DeriveState', [r6b]))
    .register(pipe('RepresentStage', [r6c]))
    .register(pipe('ExecuteOperation', [r7]))
    .register(pipe('ProduceProjection', [r8]))
    .register(pipe('AuditIntegral', [r9]));

  const runtime = new MissionRuntime({
    loader: new MissionContextLoader(identityMap),
    registry,
    audit: new MissionAuditRuntime(auditSink, wiring.clock, wiring.uuid),
    resultBuilder: new MissionResultBuilder(),
    clock: wiring.clock,
  });

  return { runtime, registry, identityMap, auditSink, auditor };
}
