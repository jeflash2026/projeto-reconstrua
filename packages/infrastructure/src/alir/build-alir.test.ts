// ─────────────────────────────────────────────────────────────────────────────
// BUILD ALIR (R1) — integração com os adapters Json REAIS sobre InMemoryJsonStore.
// Prova o ponto crítico da auditoria: o estado terminal (ENCERRADA) chega ao ALIR
// via MissionKeyedSnapshotAdapter (chaveado por missão), e a persona Operador de
// Qualificação funciona ponta a ponta sobre o wiring de produção.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { emptyMemory } from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import {
  JsonMemoryStore,
  JsonSchedulerStore,
  JsonHandoffStore,
  JsonProgressStore,
  JsonStaffStore,
  JsonAssignmentStore,
  JsonJuridicalWorkStore,
  JsonIdentityMap,
} from '../production/document-stores.js';
import { JsonDecisionStateStore } from '../executive-brain/decision-state-read-model.js';
import { assembleALIR, MissionKeyedSnapshotAdapter } from './build-alir.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function wire() {
  const json = new InMemoryJsonStore();
  const identityMap = new JsonIdentityMap(json);
  const memoryStore = new JsonMemoryStore(json);
  const decisionState = new JsonDecisionStateStore(json);
  const wiring = {
    identityMap,
    memoryStore,
    decisionState,
    progressStore: new JsonProgressStore(json),
    schedulerStore: new JsonSchedulerStore(json),
    handoffStore: new JsonHandoffStore(json),
    assignmentStore: new JsonAssignmentStore(json),
    staffStore: new JsonStaffStore(json),
    juridicalStore: new JsonJuridicalWorkStore(json),
  };
  return { ...wiring, assembled: assembleALIR(wiring) };
}

async function seedCliente(w: ReturnType<typeof wire>, over: { terminal?: boolean; pendentes?: string[] } = {}) {
  await w.identityMap.save({
    chatId: 'c1', personId: 'p1', clienteId: 'cli-1', missionId: 'm1', caseId: null,
    processId: null, latestTruthId: null, latestStateId: null, latestStageId: null,
    lastDocumentId: null, lastEventId: null,
  });
  await w.memoryStore.save({
    ...emptyMemory('c1'),
    attributes: [{ key: 'nome', value: 'Maria', source: { kind: 'conversation', ref: 'msg1', at: NOW }, confidence: 0.9 }],
    documentsPending: over.pendentes ?? ['CNIS'],
  });
  await w.decisionState.save({
    missionId: 'm1',
    truthEstablished: true,
    ...(over.terminal === true ? { terminalState: 'ENCERRADA' as const } : {}),
    updatedAt: NOW,
  });
}

describe('assembleALIR · wiring de produção', () => {
  it('compõe o ALIR de um cliente real a partir dos stores Json', async () => {
    const w = wire();
    await seedCliente(w);
    const { alir, metrics } = await w.assembled.builder.compose('c1', { now: NOW });

    expect(alir.clienteId).toBe('cli-1');
    expect(alir.core.pessoa.atributos).toContainEqual({ key: 'nome', value: 'Maria' });
    expect(alir.operational.missao.missionId).toBe('m1');
    expect(alir.operational.missao.truthEstablished).toBe(true);
    expect(alir.operational.missao.terminalState).toBeNull();
    expect(alir.operational.documentos.pendentes).toEqual(['CNIS']);
    expect(metrics.sourcesConsulted).toContain('mission-snapshot');
  });

  it('CRÍTICO: estado terminal ENCERRADA atravessa o adapter por missão até o ALIR', async () => {
    const w = wire();
    await seedCliente(w, { terminal: true });
    const { alir } = await w.assembled.builder.compose('c1', { now: NOW });
    expect(alir.operational.missao.terminalState).toBe('ENCERRADA');
  });
});

describe('MissionKeyedSnapshotAdapter', () => {
  it('é chaveado por missionId (não chatId) e aplica só campos com produtor', async () => {
    const json = new InMemoryJsonStore();
    const store = new JsonDecisionStateStore(json);
    await store.save({ missionId: 'm9', truthEstablished: true, updatedAt: NOW });
    const adapter = new MissionKeyedSnapshotAdapter(store);

    const snap = await adapter.load('m9');
    expect(snap?.truthEstablished).toBe(true);
    expect(snap?.stateCode).toBe('ABERTA'); // default sem terminal

    expect(await adapter.load('inexistente')).toBeNull();
  });
});
