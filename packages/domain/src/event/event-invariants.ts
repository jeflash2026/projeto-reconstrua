// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade EVENTO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<EventAggregate>);
//  (B) manifesto completo INV-EV-01..INV-EV-05 com referência normativa e LOCUS.
// Nenhuma regra operacional é implementada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { EventAggregate } from './event.js';

// (A) Invariantes garantidas pela própria entidade, na construção (reconhecimento).
export const eventEntityInvariants: ReadonlyArray<Invariant<EventAggregate>> = [
  defineInvariant<EventAggregate>({
    id: 'INV-EV-01',
    canonReference: 'EVENTO INV-EV-01; DF-14',
    description: 'Todo Evento possui classificação obrigatória (Relevante ou Informativo).',
    check: (e) => e.classification != null,
  }),
  defineInvariant<EventAggregate>({
    id: 'INV-EV-03',
    canonReference: 'EVENTO INV-EV-03; E12-L09',
    description: 'Todo Evento Relevante é fundado em um Fato reconhecido.',
    check: (e) => !e.classification.isRelevant() || e.fact != null,
  }),
  defineInvariant<EventAggregate>({
    id: 'INV-EV-04',
    canonReference: 'EVENTO INV-EV-04; Lei 2; INV-E12-05',
    description: 'O Evento é vinculado a exatamente uma Missão.',
    check: (e) => e.mission != null,
  }),
];

// (B) Manifesto completo das 5 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  'entity' | 'event-store' | 'projection' | 'cqrs' | 'use-case' | 'cross-entity';

export interface EventInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const EVENT_INVARIANTS_MANIFEST: ReadonlyArray<EventInvariantSpec> = [
  {
    id: 'INV-EV-01',
    canonReference: 'DF-14',
    description:
      'Classificação obrigatória no ato — Relevante ou Informativo (subtipos exaustivos).',
    enforcement: 'entity',
  },
  {
    id: 'INV-EV-02',
    canonReference: 'DF-05; INV-08',
    description: 'Somente Evento Relevante altera estado; Informativo jamais.',
    enforcement: 'projection',
  },
  {
    id: 'INV-EV-03',
    canonReference: 'E12-L09',
    description: 'Evento Relevante exige Fato reconhecido que o fundamente.',
    enforcement: 'entity',
  },
  {
    id: 'INV-EV-04',
    canonReference: 'Lei 2; INV-E12-05',
    description: 'Vinculado a exatamente uma Missão; reconhecimentos independentes por missão.',
    enforcement: 'entity',
  },
  {
    id: 'INV-EV-05',
    canonReference: 'Lei 3; DF-11',
    description: 'Um Evento reconhecido jamais é apagado.',
    enforcement: 'event-store',
  },
];
