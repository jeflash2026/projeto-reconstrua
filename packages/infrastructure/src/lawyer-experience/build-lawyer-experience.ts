// ─────────────────────────────────────────────────────────────────────────────
// assembleLawyerExperience — composição do Sprint 3D: envolve a operação 3B
// (chamada, jamais alterada) com cursor, gate de decisão, preparação noturna,
// after-decision, plantão e produtividade.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { ConversationGateway, Sleeper } from '@reconstrua/application';
import { CursorRuntime, DecisionGateRuntime, ProductivityRuntime } from '@reconstrua/application';
import { assembleAdvogadoOperation, type AssembledAdvogadoOperation } from '../advogado-portal/build-advogado-operation.js';
import { InMemoryCursorStore, InMemoryDecisionStore, InMemoryProductivityStore } from './in-memory-stores.js';
import { NightShiftRuntime } from './night-shift-runtime.js';
import { AfterDecisionRuntime } from './after-decision-runtime.js';
import { PlantaoService } from './plantao-service.js';

export interface LawyerExperienceWiring {
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  readonly gateway?: ConversationGateway;
  readonly sleeper?: Sleeper;
}

export interface AssembledLawyerExperience {
  readonly op: AssembledAdvogadoOperation;
  readonly cursor: CursorRuntime;
  readonly gate: DecisionGateRuntime;
  readonly nightShift: NightShiftRuntime;
  readonly afterDecision: AfterDecisionRuntime;
  readonly plantao: PlantaoService;
  readonly productivity: ProductivityRuntime;
}

export function assembleLawyerExperience(wiring: LawyerExperienceWiring): AssembledLawyerExperience {
  const op = assembleAdvogadoOperation(wiring);
  const cursor = new CursorRuntime(new InMemoryCursorStore());
  const gate = new DecisionGateRuntime(new InMemoryDecisionStore(), wiring.clock, wiring.uuid);
  const productivity = new ProductivityRuntime(new InMemoryProductivityStore());
  const nightShift = new NightShiftRuntime(op, gate, productivity);
  const afterDecision = new AfterDecisionRuntime(op, gate, productivity, wiring.clock);
  const plantao = new PlantaoService(op, cursor, gate, productivity, wiring.clock);
  return { op, cursor, gate, nightShift, afterDecision, plantao, productivity };
}
