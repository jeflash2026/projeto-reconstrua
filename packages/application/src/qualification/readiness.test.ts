// ─────────────────────────────────────────────────────────────────────────────
// READINESS FOR QUALIFICATION — testes. Capacidade determinística: dado qualquer
// cliente, responde está pronto? por quê? o que falta? — sem intervenção humana.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { emptyALIR, type ALIR } from '../alir/alir-contract.js';
import { evaluateReadiness } from './readiness.js';
import {
  REQUIREMENTS,
  requirementsFor,
  type QualificationCaseType,
} from './requirements-matrix.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');
const ENVIADOS_INDISP = ['operational.documentos.enviados'];

interface Over {
  readonly missionId?: string | null;
  readonly terminalState?: 'ENCERRADA' | null;
  readonly pendentes?: readonly string[];
  readonly truthEstablished?: boolean;
}
function alirWith(over: Over): ALIR {
  const b = emptyALIR('cli-1', 'c1', NOW);
  return {
    ...b,
    operational: {
      ...b.operational,
      missao: {
        ...b.operational.missao,
        missionId: over.missionId === undefined ? 'm1' : over.missionId,
        terminalState: over.terminalState ?? null,
        truthEstablished: over.truthEstablished ?? true,
      },
      documentos: { ...b.operational.documentos, pendentes: over.pendentes ?? [] },
    },
  };
}

describe('Matriz de requisitos', () => {
  it('todo tipo de caso possui entrada e obrigatórios/opcionais disjuntos', () => {
    const types = Object.keys(REQUIREMENTS) as QualificationCaseType[];
    expect(types.length).toBeGreaterThanOrEqual(7);
    for (const t of types) {
      const r = requirementsFor(t);
      expect(r.caseType).toBe(t);
      expect(r.requiredDocuments.length).toBeGreaterThan(0);
      for (const d of r.optionalDocuments) {
        expect(r.requiredDocuments, `${t}: ${d} obrigatório e opcional`).not.toContain(d);
      }
    }
  });

  it('tipo desconhecido cai no GENERICO', () => {
    expect(requirementsFor('INEXISTENTE' as QualificationCaseType).caseType).toBe('GENERICO');
  });
});

describe('evaluateReadiness · vereditos determinísticos', () => {
  it('PRONTO quando docs satisfeitos e verdade sintetizada', () => {
    const r = evaluateReadiness({
      alir: alirWith({ pendentes: [] }),
      caseType: 'GENERICO',
      now: NOW,
    });
    expect(r.ready).toBe(true);
    expect(r.missingRequirements).toEqual([]);
    expect(r.reason).toContain('Pronto');
  });

  it('NÃO PRONTO com documento obrigatório pendente (informa o que falta)', () => {
    const r = evaluateReadiness({
      alir: alirWith({ pendentes: ['CNIS'] }),
      caseType: 'APOSENTADORIA_IDADE',
      now: NOW,
    });
    expect(r.ready).toBe(false);
    expect(r.missingRequirements).toContainEqual({
      kind: 'document',
      code: 'CNIS',
      label: 'extrato previdenciário (CNIS/HISCON)',
    });
    expect(r.confidence).toBe(1);
  });

  it('NÃO PRONTO quando a verdade não foi sintetizada', () => {
    const r = evaluateReadiness({
      alir: alirWith({ truthEstablished: false }),
      caseType: 'GENERICO',
      now: NOW,
    });
    expect(r.ready).toBe(false);
    expect(r.missingRequirements.some((x) => x.code === 'VERDADE_SINTETIZADA')).toBe(true);
  });

  it('impeditiva ENCERRADO bloqueia mesmo com tudo satisfeito', () => {
    const r = evaluateReadiness({
      alir: alirWith({ terminalState: 'ENCERRADA' }),
      caseType: 'GENERICO',
      now: NOW,
    });
    expect(r.ready).toBe(false);
    expect(r.missingRequirements[0]?.code).toBe('ENCERRADO');
    expect(r.reason).toContain('encerrado');
  });

  it('impeditiva SEM_CASO quando não há missão', () => {
    const r = evaluateReadiness({
      alir: alirWith({ missionId: null }),
      caseType: 'GENERICO',
      now: NOW,
    });
    expect(r.ready).toBe(false);
    expect(r.missingRequirements.some((x) => x.code === 'SEM_CASO')).toBe(true);
  });

  it('exige documentos específicos do tipo (BENEFICIO_INCAPACIDADE → LAUDO_MEDICO)', () => {
    const r = evaluateReadiness({
      alir: alirWith({ pendentes: ['LAUDO_MEDICO'] }),
      caseType: 'BENEFICIO_INCAPACIDADE',
      now: NOW,
    });
    expect(r.ready).toBe(false);
    expect(r.missingRequirements.some((x) => x.code === 'LAUDO_MEDICO')).toBe(true);
  });
});

describe('evaluateReadiness · confiança (determinística, não IA)', () => {
  it('recebimento inferido (enviados indisponível) reduz a confiança do PRONTO', () => {
    const r = evaluateReadiness({
      alir: alirWith({ pendentes: [] }),
      caseType: 'GENERICO',
      unavailable: ENVIADOS_INDISP,
      now: NOW,
    });
    expect(r.ready).toBe(true);
    expect(r.confidence).toBe(0.75);
  });

  it('recebimento observável → confiança plena', () => {
    const r = evaluateReadiness({
      alir: alirWith({ pendentes: [] }),
      caseType: 'GENERICO',
      unavailable: [],
      now: NOW,
    });
    expect(r.confidence).toBe(1);
  });

  it('condição impeditiva não observável (perícia) reduz confiança do PRONTO', () => {
    const r = evaluateReadiness({
      alir: alirWith({ pendentes: [] }),
      caseType: 'BENEFICIO_INCAPACIDADE',
      unavailable: [],
      now: NOW,
    });
    expect(r.ready).toBe(true);
    expect(r.confidence).toBe(0.6);
  });

  it('é determinístico: mesma entrada → mesmo resultado', () => {
    const input = {
      alir: alirWith({ pendentes: ['CNIS'] }),
      caseType: 'APOSENTADORIA_IDADE' as const,
      now: NOW,
    };
    expect(evaluateReadiness(input)).toEqual(evaluateReadiness(input));
  });
});
