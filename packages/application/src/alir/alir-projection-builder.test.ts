// ─────────────────────────────────────────────────────────────────────────────
// ALIR PROJECTION BUILDER (W1-01B · B-2) — testes. Fakes mínimos dos 9 ports reais.
// Cobre: composição completa, caso terminal, cliente desconhecido, composição
// PARCIAL (Regra 5), métricas de observabilidade (Regra 6), capacidades calculadas
// (Regra 7), hash estável (Regras 4/6) e alinhamento ao registry do contrato (B-1).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { MissionIdentityMap } from '../mission-runtime/ports.js';
import type { MissionIdentity } from '../mission-runtime/types.js';
import type { MemoryStore } from '../living-memory/ports.js';
import { emptyMemory, type ClientMemory } from '../living-memory/client-memory.js';
import type { MissionSnapshotPort } from '../executive-brain/ports.js';
import {
  emptySnapshot,
  type HumanRole,
  type MissionSnapshot,
} from '../executive-brain/mission-snapshot.js';
import type { MissionProgress, WorkflowProgressStore } from '../go-live/workflow-runtime.js';
import type { ScheduledTask, SchedulerStore } from '../go-live/scheduler-runtime.js';
import type { HandoffStore, HandoffTask } from '../go-live/human-handoff-runtime.js';
import type {
  AssignmentStore,
  CaseAssignment,
  JuridicalEntry,
  JuridicalWorkStore,
} from '../advogado-portal/juridical-work.js';
import type { StaffMember, StaffRole, StaffStore } from '../admin-portal/staff-directory.js';
import { ALIRProjectionBuilder, type ALIRSources } from './alir-projection-builder.js';
import { ALIR_FIELDS } from './alir-contract.js';

// ── fakes mínimos ───────────────────────────────────────────────────────────────
class FakeIdentityMap implements MissionIdentityMap {
  constructor(private readonly map: Map<string, MissionIdentity>) {}
  load(chatId: string): Promise<MissionIdentity | null> {
    return Promise.resolve(this.map.get(chatId) ?? null);
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
}
class FakeMemoryStore implements MemoryStore {
  constructor(private readonly map: Map<string, ClientMemory>) {}
  load(chatId: string): Promise<ClientMemory | null> {
    return Promise.resolve(this.map.get(chatId) ?? null);
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
  all(): Promise<readonly ClientMemory[]> {
    return Promise.resolve([...this.map.values()]);
  }
}
class FakeSnapshotPort implements MissionSnapshotPort {
  constructor(private readonly map: Map<string, MissionSnapshot>) {}
  load(missionId: string): Promise<MissionSnapshot | null> {
    return Promise.resolve(this.map.get(missionId) ?? null);
  }
}
class FakeWorkflowStore implements WorkflowProgressStore {
  constructor(private readonly map: Map<string, MissionProgress>) {}
  load(missionId: string): Promise<MissionProgress | null> {
    return Promise.resolve(this.map.get(missionId) ?? null);
  }
  save(): Promise<void> {
    return Promise.resolve();
  }
  all(): Promise<readonly MissionProgress[]> {
    return Promise.resolve([...this.map.values()]);
  }
}
class FakeSchedulerStore implements SchedulerStore {
  constructor(private readonly tasks: readonly ScheduledTask[]) {}
  save(): Promise<void> {
    return Promise.resolve();
  }
  byId(id: string): Promise<ScheduledTask | null> {
    return Promise.resolve(this.tasks.find((t) => t.id === id) ?? null);
  }
  due(now: Date): Promise<readonly ScheduledTask[]> {
    return Promise.resolve(
      this.tasks.filter((t) => t.status === 'pending' && t.dueAt.getTime() <= now.getTime()),
    );
  }
  pendingCount(): Promise<number> {
    return Promise.resolve(this.tasks.filter((t) => t.status === 'pending').length);
  }
  all(): Promise<readonly ScheduledTask[]> {
    return Promise.resolve(this.tasks);
  }
}
class FakeHandoffStore implements HandoffStore {
  constructor(private readonly tasks: readonly HandoffTask[]) {}
  save(): Promise<void> {
    return Promise.resolve();
  }
  byId(id: string): Promise<HandoffTask | null> {
    return Promise.resolve(this.tasks.find((t) => t.id === id) ?? null);
  }
  openByRole(role: HumanRole): Promise<readonly HandoffTask[]> {
    return Promise.resolve(this.tasks.filter((t) => t.role === role && t.status === 'open'));
  }
}
class FakeAssignmentStore implements AssignmentStore {
  constructor(private readonly list: readonly CaseAssignment[]) {}
  save(): Promise<void> {
    return Promise.resolve();
  }
  byMission(missionId: string): Promise<CaseAssignment | null> {
    return Promise.resolve(this.list.find((a) => a.missionId === missionId) ?? null);
  }
  byAdvogado(advogadoId: string): Promise<readonly CaseAssignment[]> {
    return Promise.resolve(this.list.filter((a) => a.advogadoId === advogadoId));
  }
}
class FakeStaffStore implements StaffStore {
  constructor(private readonly list: readonly StaffMember[]) {}
  save(): Promise<void> {
    return Promise.resolve();
  }
  byId(id: string): Promise<StaffMember | null> {
    return Promise.resolve(this.list.find((m) => m.id === id) ?? null);
  }
  byRole(role: StaffRole): Promise<readonly StaffMember[]> {
    return Promise.resolve(this.list.filter((m) => m.role === role));
  }
  all(): Promise<readonly StaffMember[]> {
    return Promise.resolve(this.list);
  }
}
class FakeJuridicalStore implements JuridicalWorkStore {
  constructor(private readonly list: readonly JuridicalEntry[]) {}
  save(): Promise<void> {
    return Promise.resolve();
  }
  byId(id: string): Promise<JuridicalEntry | null> {
    return Promise.resolve(this.list.find((e) => e.id === id) ?? null);
  }
  byAdvogado(advogadoId: string): Promise<readonly JuridicalEntry[]> {
    return Promise.resolve(this.list.filter((e) => e.advogadoId === advogadoId));
  }
  byMission(missionId: string): Promise<readonly JuridicalEntry[]> {
    return Promise.resolve(this.list.filter((e) => e.missionId === missionId));
  }
}

// ── seed helpers ──────────────────────────────────────────────────────────────
const NOW = new Date('2026-07-18T12:00:00.000Z');
const DUE = new Date('2026-07-25T12:00:00.000Z');

function identity(over: Partial<MissionIdentity>): MissionIdentity {
  return {
    chatId: 'c1',
    personId: 'p1',
    clienteId: 'cli-1',
    missionId: 'm1',
    caseId: 'case-1',
    processId: 'proc-1',
    latestTruthId: null,
    latestStateId: null,
    latestStageId: null,
    lastDocumentId: null,
    lastEventId: null,
    ...over,
  };
}
function memory(over: Partial<ClientMemory>): ClientMemory {
  return {
    ...emptyMemory('c1'),
    attributes: [
      {
        key: 'nome',
        value: 'Maria',
        source: { kind: 'conversation', ref: 'msg1', at: NOW },
        confidence: 0.9,
      },
    ],
    documentsPending: ['HISCON'],
    conversationStyle: 'objetivo',
    avgResponseMs: 1200,
    firstContactAt: NOW,
    lastContactAt: NOW,
    ...over,
  };
}
function snapshot(over: Partial<MissionSnapshot>): MissionSnapshot {
  return {
    ...emptySnapshot('m1'),
    stageCode: 'ANALISE',
    stateCode: 'EM_ANALISE',
    truthEstablished: true,
    ...over,
  };
}

interface Seed {
  readonly identities?: MissionIdentity[];
  readonly memories?: ClientMemory[];
  readonly snapshots?: MissionSnapshot[];
  readonly progress?: MissionProgress[];
  readonly tasks?: ScheduledTask[];
  readonly handoffs?: HandoffTask[];
  readonly assignments?: CaseAssignment[];
  readonly staff?: StaffMember[];
  readonly juridical?: JuridicalEntry[];
}
function sources(seed: Seed): ALIRSources {
  return {
    identities: new FakeIdentityMap(new Map((seed.identities ?? []).map((i) => [i.chatId, i]))),
    memory: new FakeMemoryStore(new Map((seed.memories ?? []).map((m) => [m.chatId, m]))),
    snapshots: new FakeSnapshotPort(new Map((seed.snapshots ?? []).map((s) => [s.missionId, s]))),
    workflow: new FakeWorkflowStore(new Map((seed.progress ?? []).map((p) => [p.missionId, p]))),
    scheduler: new FakeSchedulerStore(seed.tasks ?? []),
    handoffs: new FakeHandoffStore(seed.handoffs ?? []),
    assignments: new FakeAssignmentStore(seed.assignments ?? []),
    staff: new FakeStaffStore(seed.staff ?? []),
    juridical: new FakeJuridicalStore(seed.juridical ?? []),
  };
}

function fullSeed(over: { snapshots?: MissionSnapshot[] } = {}): Seed {
  return {
    identities: [identity({})],
    memories: [memory({})],
    snapshots: over.snapshots ?? [snapshot({})],
    progress: [
      { missionId: 'm1', steps: ['documento_recebido', 'documento_reconhecido'], updatedAt: NOW },
    ],
    tasks: [
      {
        id: 't1',
        chatId: 'c1',
        missionId: 'm1',
        kind: 'remind_client',
        dueAt: DUE,
        note: null,
        createdAt: NOW,
        status: 'pending',
      },
      {
        id: 't2',
        chatId: 'c1',
        missionId: 'm1',
        kind: 'follow_deadline',
        dueAt: NOW,
        note: null,
        createdAt: NOW,
        status: 'fired',
      },
    ],
    handoffs: [
      {
        id: 'h1',
        role: 'operador',
        reasonCode: 'DOC',
        missionId: 'm1',
        chatId: 'c1',
        operationalRuleRef: 'RO-1',
        fundamento: 'x',
        createdAt: NOW,
        status: 'open',
      },
    ],
    assignments: [{ missionId: 'm1', advogadoId: 'adv-1', assignedBy: 'admin', assignedAt: NOW }],
    staff: [
      {
        id: 'adv-1',
        role: 'advogado',
        name: 'Dr X',
        email: null,
        active: true,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    juridical: [
      {
        id: 'j1',
        advogadoId: 'adv-1',
        missionId: 'm1',
        kind: 'numero_processo',
        text: '0001234-55.2026',
        dueAt: null,
        attachmentRef: null,
        done: true,
        createdAt: NOW,
      },
      {
        id: 'j2',
        advogadoId: 'adv-1',
        missionId: 'm1',
        kind: 'prazo',
        text: 'contestação',
        dueAt: DUE,
        attachmentRef: null,
        done: false,
        createdAt: NOW,
      },
    ],
  };
}

describe('ALIRProjectionBuilder · composição completa', () => {
  it('monta o Aggregate a partir das fontes reais', async () => {
    const { alir, metrics } = await new ALIRProjectionBuilder(sources(fullSeed())).compose('c1', {
      now: NOW,
    });

    expect(alir.clienteId).toBe('cli-1');
    expect(alir.core.pessoa.personId).toBe('p1');
    expect(alir.core.pessoa.atributos).toContainEqual({ key: 'nome', value: 'Maria' });

    expect(alir.operational.missao.missionId).toBe('m1');
    expect(alir.operational.missao.stageCode).toBe('ANALISE');
    expect(alir.operational.missao.stateCode).toBe('EM_ANALISE');
    expect(alir.operational.missao.truthEstablished).toBe(true);
    expect(alir.operational.missao.terminalState).toBeNull();
    expect(alir.operational.missao.progresso).toEqual([
      'documento_recebido',
      'documento_reconhecido',
    ]);
    expect(alir.operational.missao.acompanhamento).toEqual({
      pendentes: 1,
      proximoVencimentoAt: DUE,
    });

    expect(alir.operational.documentos.pendentes).toEqual(['HISCON']);
    expect(alir.operational.documentos.enviados).toEqual([]);
    expect(alir.operational.ahri.estiloConversa).toBe('objetivo');
    expect(alir.operational.ahri.tempoRespostaMedioMs).toBe(1200);

    expect(alir.operational.operacao.handoffsAbertos).toHaveLength(1);
    expect(alir.operational.operacao.atribuicao?.advogadoId).toBe('adv-1');
    expect(alir.operational.operacao.responsaveis).toEqual([
      { id: 'adv-1', role: 'advogado', name: 'Dr X' },
    ]);

    expect(alir.operational.juridico.processoRef).toBe('0001234-55.2026');
    expect(alir.operational.juridico.pendencias).toHaveLength(2);

    // health: handoff aberto (-30) + docs pendentes (-20) = 50 → YELLOW
    expect(alir.healthScore).toEqual({
      score: 50,
      band: 'YELLOW',
      reasons: ['escalonamento humano aberto', 'documentos pendentes'],
    });

    // observabilidade (Regra 6)
    expect(metrics.contentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(metrics.sourcesConsulted).toEqual(
      expect.arrayContaining([
        'identities',
        'client-memory',
        'mission-snapshot',
        'workflow',
        'scheduler',
        'handoff',
        'assignments',
        'staff',
        'juridical',
      ]),
    );
    expect(metrics.fieldsReconstructed).toEqual(
      expect.arrayContaining(['operational.missao.stateCode', 'healthScore', 'contentHash']),
    );
    expect(metrics.fieldsUnavailable).toEqual(
      expect.arrayContaining([
        'operational.documentos.enviados',
        'operational.timeline',
        'operational.proximaAcao',
        'extensions.pericia',
      ]),
    );
    expect(metrics.compositionMs).toBeGreaterThanOrEqual(0);
  });
});

describe('ALIRProjectionBuilder · caso terminal', () => {
  it('encerrado → terminalState ENCERRADA e saúde GREEN', async () => {
    const seed = fullSeed({ snapshots: [snapshot({ stateCode: 'ENCERRADA' })] });
    const { alir } = await new ALIRProjectionBuilder(sources(seed)).compose('c1', { now: NOW });
    expect(alir.operational.missao.terminalState).toBe('ENCERRADA');
    expect(alir.healthScore).toEqual({ score: 100, band: 'GREEN', reasons: ['caso encerrado'] });
  });
});

describe('ALIRProjectionBuilder · cliente desconhecido', () => {
  it('sem identidade → ALIR vazio consistente, chatId como identidade provisória', async () => {
    const { alir, metrics } = await new ALIRProjectionBuilder(sources({})).compose('novo@c.us', {
      now: NOW,
    });
    expect(alir.clienteId).toBe('novo@c.us');
    expect(alir.operational.missao.missionId).toBeNull();
    expect(alir.healthScore?.band).toBe('GREEN');
    expect(metrics.fieldsUnavailable).toContain('operational.documentos.enviados');
  });
});

describe('ALIRProjectionBuilder · composição parcial (Regra 5)', () => {
  it('groups=[CORE] não consulta fontes operacionais nem computa agregados', async () => {
    const { alir, metrics } = await new ALIRProjectionBuilder(sources(fullSeed())).compose('c1', {
      now: NOW,
      groups: ['CORE'],
    });
    expect(alir.core.pessoa.personId).toBe('p1');
    // operational permanece no default do contrato
    expect(alir.operational.missao.missionId).toBeNull();
    expect(alir.healthScore).toBeNull();
    expect(metrics.groups).toEqual(['CORE']);
    expect(metrics.sourcesConsulted).toEqual(['identities', 'client-memory']);
    expect(metrics.sourcesConsulted).not.toContain('workflow');
  });
});

describe('ALIRProjectionBuilder · hash estável (Regras 4/6)', () => {
  it('conteúdo igual → mesmo hash mesmo com projectedAt diferente; conteúdo diferente → hash diferente', async () => {
    const builder = new ALIRProjectionBuilder(sources(fullSeed()));
    const a = await builder.compose('c1', { now: NOW });
    const b = await builder.compose('c1', { now: new Date('2027-01-01T00:00:00.000Z') });
    expect(b.alir.contentHash).toBe(a.alir.contentHash);

    const changed = fullSeed();
    const c = await new ALIRProjectionBuilder(
      sources({ ...changed, memories: [memory({ documentsPending: ['HISCON', 'CTPS'] })] }),
    ).compose('c1', { now: NOW });
    expect(c.alir.contentHash).not.toBe(a.alir.contentHash);
  });
});

describe('ALIRProjectionBuilder · alinhamento ao contrato (B-1)', () => {
  it('todo campo reportado nas métricas existe no registry ALIR_FIELDS', async () => {
    const knownPaths = new Set(ALIR_FIELDS.map((f) => f.path));
    const { metrics } = await new ALIRProjectionBuilder(sources(fullSeed())).compose('c1', {
      now: NOW,
    });
    for (const p of [...metrics.fieldsReconstructed, ...metrics.fieldsUnavailable]) {
      expect(knownPaths.has(p), `path fora do contrato: ${p}`).toBe(true);
    }
  });
});
