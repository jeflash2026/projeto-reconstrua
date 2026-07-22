// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade ESTADO OPERACIONAL. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<OperationalStateAggregate>);
//  (B) manifesto completo INV-EO-01..INV-EO-04 com referência normativa e LOCUS.
// O Canon (Entidade 08, item 15) enumera EXATAMENTE quatro invariantes; nada além.
// Nenhuma regra operacional (R5/R6) é implementada aqui.
//
// Diferentemente da VERDADE, o Estado POSSUI uma invariante genuinamente de
// instância: INV-EO-02 (deriva exclusivamente da Verdade) — o Estado referencia
// exatamente uma Verdade e não tem fonte autônoma.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { OperationalStateAggregate } from './operational-state.js';

// (A) Invariantes garantidas pela própria entidade, na derivação.
export const operationalStateEntityInvariants: ReadonlyArray<Invariant<OperationalStateAggregate>> =
  [
    defineInvariant<OperationalStateAggregate>({
      id: 'INV-EO-02',
      canonReference: 'ESTADO INV-EO-02; INV-02; DF-08',
      description:
        'O Estado deriva exclusivamente da Verdade Operacional (fonte única e obrigatória).',
      check: (s) => s.derivedFromTruth != null,
    }),
    defineInvariant<OperationalStateAggregate>({
      id: 'EO-POR-MISSAO',
      canonReference: 'Entidade 08, item 22; Lei 2; INV-EO-01 (parcial)',
      description: 'O Estado pertence a exatamente uma Missão.',
      check: (s) => s.mission != null,
    }),
  ];

// (B) Manifesto completo das 4 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  'entity' | 'event-store' | 'projection' | 'cqrs' | 'use-case' | 'cross-entity';

export interface OperationalStateInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const OPERATIONAL_STATE_INVARIANTS_MANIFEST: ReadonlyArray<OperationalStateInvariantSpec> = [
  {
    id: 'INV-EO-01',
    canonReference: 'Lei 2',
    description: 'Exatamente um Estado por missão por instante; jamais dois simultâneos.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-EO-02',
    canonReference: 'INV-02; DF-08',
    description: 'Deriva exclusivamente da Verdade Operacional; jamais fonte autônoma.',
    enforcement: 'entity',
  },
  {
    id: 'INV-EO-03',
    canonReference: 'DF-05; DF-14',
    description: 'Muda somente por evolução (R6), via Evento Relevante.',
    enforcement: 'use-case',
  },
  {
    id: 'INV-EO-04',
    canonReference: 'DF-08; DF-03; Lei 1',
    description: 'Jamais alterado por interface; nenhum dashboard o recalcula.',
    enforcement: 'cqrs',
  },
];
