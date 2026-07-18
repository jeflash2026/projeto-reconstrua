// ─────────────────────────────────────────────────────────────────────────────
// BUILD ALIR (GO LIVE A · R1) — liga o ALIRProjectionBuilder aos adapters REAIS já
// existentes na produção. Nenhum store novo, nenhuma projeção nova: só composição.
//
// Nota crítica (auditoria de readiness): o ProjectionBackedMissionSnapshotAdapter
// do Brain é chaveado por CHAT (resolve chatId→missionId internamente), mas o
// ALIRProjectionBuilder consulta snapshots por MISSÃO. Por isso este arquivo traz o
// MissionKeyedSnapshotAdapter: MESMO Decision State Read Model, MESMO overlay do
// RFC-0035-G/B4.1 (truthEstablished + stateCode='ENCERRADA'), apenas chaveado por
// missionId. Sem ele, o estado terminal se perderia silenciosamente no ALIR.
// ─────────────────────────────────────────────────────────────────────────────
import { ALIRProjectionBuilder } from '@reconstrua/application';
import type {
  ALIRSources,
  AssignmentStore,
  HandoffStore,
  JuridicalWorkStore,
  MemoryStore,
  MissionIdentityMap,
  SchedulerStore,
  StaffStore,
  WorkflowProgressStore,
} from '@reconstrua/application';
import type { DecisionStateStore } from '../executive-brain/decision-state-read-model.js';
// Overlay ÚNICO (refactor pós-R1): a implementação vive ao lado do adapter do Brain,
// que delega a ela. Aqui apenas se reutiliza — nenhuma lógica própria.
import { MissionKeyedSnapshotAdapter } from '../executive-brain/projection-backed-mission-snapshot-adapter.js';

export { MissionKeyedSnapshotAdapter };

export interface ALIRWiring {
  readonly identityMap: MissionIdentityMap;
  readonly memoryStore: MemoryStore;
  readonly decisionState: DecisionStateStore;
  readonly progressStore: WorkflowProgressStore;
  readonly schedulerStore: SchedulerStore;
  readonly handoffStore: HandoffStore;
  readonly assignmentStore: AssignmentStore;
  readonly staffStore: StaffStore;
  readonly juridicalStore: JuridicalWorkStore;
}

export interface AssembledALIR {
  /** A visão única do cliente (Regra 1) — composição sob demanda, sem cache. */
  readonly builder: ALIRProjectionBuilder;
}

/** Monta o ALIR de produção sobre os stores REAIS já criados pelo assembleProduction. */
export function assembleALIR(wiring: ALIRWiring): AssembledALIR {
  const sources: ALIRSources = {
    identities: wiring.identityMap,
    memory: wiring.memoryStore,
    snapshots: new MissionKeyedSnapshotAdapter(wiring.decisionState),
    workflow: wiring.progressStore,
    scheduler: wiring.schedulerStore,
    handoffs: wiring.handoffStore,
    assignments: wiring.assignmentStore,
    staff: wiring.staffStore,
    juridical: wiring.juridicalStore,
  };
  return { builder: new ALIRProjectionBuilder(sources) };
}
