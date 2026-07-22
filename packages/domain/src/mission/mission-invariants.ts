// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade MISSÃO. Duas coisas, honestamente separadas:
//
//  (A) invariantes VERIFICÁVEIS NO NÍVEL DA ENTIDADE (na construção/estrutura) —
//      implementadas como Invariant<Mission> e testadas;
//  (B) o MANIFESTO das 19 invariantes do Canon (INV-01..INV-19), cada uma com sua
//      referência normativa e o LOCUS onde é garantida. Muitas NÃO são exigíveis da
//      entidade isolada (dependem do event store append-only, da projeção da
//      Verdade Operacional, do CQRS ou de casos de uso futuros) — e este manifesto
//      diz exatamente qual é qual, para não fingir enforcement que a entidade não faz.
//
// Nenhuma regra operacional é implementada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { Mission } from './mission.js';

// (A) Invariantes garantidas pela própria entidade, na construção.
export const missionEntityInvariants: ReadonlyArray<Invariant<Mission>> = [
  defineInvariant<Mission>({
    id: 'INV-17',
    canonReference: 'MISSÃO INV-17; DF-20 (uma única Pessoa titular)',
    description: 'A missão pertence a exatamente uma Pessoa (um beneficiário).',
    check: (m) => m.beneficiary != null,
  }),
  defineInvariant<Mission>({
    id: 'INV-06',
    canonReference: 'MISSÃO INV-06; Art. 10º; DF-19',
    description: 'A missão possui responsável operacional inicial identificado.',
    check: (m) => m.initialResponsible != null,
  }),
  defineInvariant<Mission>({
    id: 'INV-18',
    canonReference: 'MISSÃO INV-18; DF-19 (sete elementos)',
    description: 'A missão nasce completa: objetivo, motivo e data de criação presentes.',
    check: (m) =>
      m.initialObjective.value.length > 0 &&
      m.openingReason.value.length > 0 &&
      m.createdAt instanceof Date &&
      !Number.isNaN(m.createdAt.getTime()),
  }),
];

// (B) Manifesto completo das 19 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  | 'entity' // garantida pela entidade Missão (aqui)
  | 'event-store' // garantida pelo event store append-only (infra — Sprints 2+)
  | 'projection' // garantida pela projeção da Verdade Operacional (Sprints 2+)
  | 'cqrs' // garantida pela separação escrita/leitura (arquitetura)
  | 'use-case' // garantida por caso de uso operacional (R1/R6 — sprints futuras)
  | 'cross-entity'; // depende de outra entidade ainda não implementada

export interface MissionInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const MISSION_INVARIANTS_MANIFEST: ReadonlyArray<MissionInvariantSpec> = [
  {
    id: 'INV-01',
    canonReference: 'Lei 2/DF-07',
    description: 'Ocupa exatamente uma etapa operacional; jamais duas simultâneas.',
    enforcement: 'projection',
  },
  {
    id: 'INV-02',
    canonReference: 'DF-08; Lei 2',
    description: 'O estado deriva exclusivamente da Verdade Operacional, por missão.',
    enforcement: 'projection',
  },
  {
    id: 'INV-03',
    canonReference: 'Lei Geral (titularidade)',
    description: 'Nunca pertence a colaborador/advogado/operador/AHRI; pertence ao Projeto.',
    enforcement: 'entity',
  },
  {
    id: 'INV-04',
    canonReference: 'Lei 3; DF-11',
    description: 'Nunca perde histórico.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-05',
    canonReference: 'Lei 1; Entidade 01',
    description: 'Nunca pode ser duplicada.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-06',
    canonReference: 'Art. 10º; DF-19',
    description: 'Possui responsável operacional identificado em todo instante.',
    enforcement: 'entity',
  },
  {
    id: 'INV-07',
    canonReference: 'Art. 9º',
    description: 'Próxima ação conhecida ou impedimento registrado.',
    enforcement: 'use-case',
  },
  {
    id: 'INV-08',
    canonReference: 'DF-05; DF-14',
    description: 'Somente Eventos Relevantes alteram estado; Informativos jamais.',
    enforcement: 'projection',
  },
  {
    id: 'INV-09',
    canonReference: 'DF-08',
    description: 'Nenhuma interface altera o estado diretamente.',
    enforcement: 'cqrs',
  },
  {
    id: 'INV-10',
    canonReference: 'Lei 4; DF-09; DF-13',
    description: 'Toda automação referencia Regra Operacional e produz histórico verificável.',
    enforcement: 'use-case',
  },
  {
    id: 'INV-11',
    canonReference: 'Art. 12º',
    description: 'Transição de responsável preserva integralmente o contexto.',
    enforcement: 'use-case',
  },
  {
    id: 'INV-12',
    canonReference: 'Art. 14º',
    description: 'Rastreabilidade integral.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-13',
    canonReference: 'Art. 11º; DF-12',
    description: 'Nenhuma informação essencial existe apenas em memória informal.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-14',
    canonReference: 'DF-11',
    description: 'Encerra só com motivo legítimo, responsável, data, histórico e rastreabilidade.',
    enforcement: 'use-case',
  },
  {
    id: 'INV-15',
    canonReference: 'DF-11',
    description: 'Jamais desaparece do sistema.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-16',
    canonReference: 'Lei 2; Lei da Individualidade',
    description: 'Missões são independentes; nenhuma contém/bloqueia/altera outra.',
    enforcement: 'cross-entity',
  },
  {
    id: 'INV-17',
    canonReference: 'DF-20',
    description: 'Pertence a exatamente uma Pessoa; nunca múltiplos titulares.',
    enforcement: 'entity',
  },
  {
    id: 'INV-18',
    canonReference: 'DF-19',
    description: 'Nunca nasce incompleta (sete elementos obrigatórios).',
    enforcement: 'entity',
  },
  {
    id: 'INV-19',
    canonReference: 'DF-19',
    description:
      'Nunca nasce arbitrária: fundamento legítimo, evidência suficiente, critérios mínimos.',
    enforcement: 'use-case',
  },
];
