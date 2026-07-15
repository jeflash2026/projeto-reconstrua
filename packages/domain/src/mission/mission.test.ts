// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade MISSÃO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { Mission } from './mission.js';
import type { MissionBirthInput } from './mission.js';
import { MissionId } from './mission-id.js';
import { BeneficiaryPersonRef, InitialOperationalResponsibleRef } from './refs.js';
import { MissionCreated } from './mission-events.js';
import { missionEntityInvariants, MISSION_INVARIANTS_MANIFEST } from './mission-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const MISSION_UUID = '00000000-0000-4000-8000-000000000001';
const PERSON_UUID = '00000000-0000-4000-8000-0000000000a2';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b3';

function validInput(): MissionBirthInput {
  return {
    id: MissionId.fromString(MISSION_UUID),
    beneficiary: BeneficiaryPersonRef.fromString(PERSON_UUID),
    initialObjectiveText: 'Reconstruir a situação financeira perante o contrato X.',
    openingReasonText: 'Cobranças indevidas identificadas.',
    initialResponsible: InitialOperationalResponsibleRef.fromString(RESP_UUID),
    createdAt: new Date('2026-07-13T12:00:00.000Z'),
  };
}

describe('Mission — nascimento (DF-19)', () => {
  it('nasce com os sete elementos e emite MissionCreated (elemento 7 — histórico inicial)', () => {
    const result = Mission.create(validInput());
    expect(result.isOk()).toBe(true);

    const mission = result.unwrap();
    const events = mission.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(MissionCreated);
    expect(events[0]?.eventName).toBe('mission.created');
    // Ocorrência do evento = data de criação (elemento 6).
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');

    // Consumo único: segunda extração vem vazia.
    expect(mission.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-18 — objetivo inicial vazio impede o nascimento', () => {
    const result = Mission.create({ ...validInput(), initialObjectiveText: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-18');
  });

  it('INV-18 — motivo de abertura vazio impede o nascimento', () => {
    const result = Mission.create({ ...validInput(), openingReasonText: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-18');
  });

  it('INV-18 — data de criação inválida impede o nascimento', () => {
    const result = Mission.create({ ...validInput(), createdAt: new Date('data-invalida') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-18');
  });

  it('INV-17 — a Pessoa beneficiária é obrigatória (tipo e runtime)', () => {
    // @ts-expect-error INV-17/DF-20: beneficiário é obrigatório (garantia de tipo).
    const result = Mission.create({ ...validInput(), beneficiary: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-17');
  });

  it('INV-06 — o responsável operacional inicial é obrigatório (tipo e runtime)', () => {
    // @ts-expect-error INV-06/Art.10º: responsável é obrigatório (garantia de tipo).
    const result = Mission.create({ ...validInput(), initialResponsible: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-06');
  });
});

describe('Mission — identidade (INV-05)', () => {
  it('duas missões com o mesmo MissionId são iguais; ids diferentes não', () => {
    const a = Mission.create(validInput()).unwrap();
    const b = Mission.create(validInput()).unwrap();
    expect(a.equals(b)).toBe(true); // mesmo id
    const other = Mission.create({
      ...validInput(),
      id: MissionId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('Mission — invariantes de entidade (InvariantsEngine)', () => {
  it('uma missão válida satisfaz todas as invariantes de nível de entidade', () => {
    const mission = Mission.create(validInput()).unwrap();
    const result = InvariantsEngine.enforce(mission, missionEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('Mission — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-01..INV-19, sem lacunas nem duplicatas', () => {
    const ids = MISSION_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
    for (let n = 1; n <= 19; n += 1) {
      const id = `INV-${String(n).padStart(2, '0')}`;
      expect(ids).toContain(id);
    }
  });

  it('toda invariante marcada como "entity" tem implementação verificável nesta entidade', () => {
    const entityIds = MISSION_INVARIANTS_MANIFEST.filter((s) => s.enforcement === 'entity').map(
      (s) => s.id,
    );
    const implementedIds = missionEntityInvariants.map((i) => i.id);
    // INV-03 é garantida estruturalmente (a entidade não expõe "dono"); as demais
    // ("entity") têm Invariant<Mission> correspondente.
    for (const id of entityIds) {
      if (id === 'INV-03') continue;
      expect(implementedIds).toContain(id);
    }
  });
});
