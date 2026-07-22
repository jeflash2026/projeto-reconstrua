// ─────────────────────────────────────────────────────────────────────────────
// PROJECTION-BACKED MISSION SNAPSHOT ADAPTER (RFC-0035-G) — implementa o contrato
// CONGELADO `MissionSnapshotPort` (somente `load`) servindo o snapshot a partir do
// Decision State Read Model. Substitui APENAS a implementação por trás do port; o
// DTO, buildFacts, GoalSelector, RuleEvaluator e o Brain permanecem intocados.
//
// O Brain carrega por `chatId`; os eventos de domínio são chaveados por `missionId`.
// Este adapter resolve `chatId → missionId` pelo MESMO `MissionIdentityMap` que o
// Mission Runtime mantém — sem índice secundário, sem novo contrato de resolução.
// Missão nova/desconhecida (sem identidade ou sem registro) ⇒ `null` ⇒ o chamador
// aplica seu `?? emptySnapshot` (default legítimo do primeiro turno).
//
// Sobre o registro projetado, apenas os campos com produtor real são aplicados
// (`truthEstablished`; B4.1: `stateCode='ENCERRADA'` quando encerrado); os demais
// permanecem no default de `emptySnapshot`.
// ─────────────────────────────────────────────────────────────────────────────
import { emptySnapshot } from '@reconstrua/application';
import type {
  MissionIdentityMap,
  MissionSnapshot,
  MissionSnapshotPort,
} from '@reconstrua/application';
import type { DecisionStateStore } from './decision-state-read-model.js';

/**
 * Snapshot chaveado por MISSÃO — a IMPLEMENTAÇÃO ÚNICA do overlay (R1/refactor):
 * campos com produtor real sobre `emptySnapshot`; nada além. Usada diretamente pelo
 * ALIR (que já possui o missionId) e, por delegação, pelo adapter do Brain abaixo.
 */
export class MissionKeyedSnapshotAdapter implements MissionSnapshotPort {
  constructor(private readonly store: DecisionStateStore) {}

  async load(missionId: string): Promise<MissionSnapshot | null> {
    const record = await this.store.load(missionId);
    if (record === null) return null; // projeção ainda não alcançou esta missão → emptySnapshot

    // Overlay dos campos COM produtor sobre o default; campos sem produtor ficam no default.
    // B4.1 — Estado terminal ENCERRADA ativa RO-STOP-CONCLUDED e bloqueia o acompanhamento.
    // GO-LIVE 9B (Truth Layer): registro projetado ⇒ o CASO existe no domínio.
    return {
      ...emptySnapshot(missionId),
      caseExists: true,
      truthEstablished: record.truthEstablished,
      ...(record.terminalState === 'ENCERRADA' ? { stateCode: 'ENCERRADA' } : {}),
    };
  }
}

export class ProjectionBackedMissionSnapshotAdapter implements MissionSnapshotPort {
  private readonly byMission: MissionKeyedSnapshotAdapter;

  constructor(
    store: DecisionStateStore,
    private readonly identities: MissionIdentityMap,
  ) {
    this.byMission = new MissionKeyedSnapshotAdapter(store);
  }

  async load(chatId: string): Promise<MissionSnapshot | null> {
    const identity = await this.identities.load(chatId);
    const missionId = identity?.missionId ?? null;
    if (missionId === null) return null; // missão ainda não nasceu → emptySnapshot no chamador
    // GO-LIVE 9B (Truth Layer): identidade→missão EXISTE ⇒ caseExists=true, mesmo
    // que a projeção de decisão ainda não tenha alcançado esta missão (lag de turno).
    // A EXISTÊNCIA do caso é fato de DOMÍNIO (missão criada), não da projeção.
    const snap = await this.byMission.load(missionId); // overlay ÚNICO (MissionKeyedSnapshotAdapter)
    return { ...(snap ?? emptySnapshot(missionId)), caseExists: true };
  }
}
