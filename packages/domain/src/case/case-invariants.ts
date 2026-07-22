// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade CASO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<CaseAggregate>);
//  (B) manifesto completo INV-CA-01..INV-CA-03 com referência normativa e LOCUS.
// O Canon (Entidade 05, item 15) enumera EXATAMENTE três invariantes; nada além
// é acrescentado. Nenhuma regra operacional é implementada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { CaseAggregate } from './case.js';

// (A) Invariantes garantidas pela própria entidade, na construção (reconhecimento).
// Apenas INV-CA-01 é um predicado de runtime sobre a instância. INV-CA-02 (não é
// processo) é ESTRUTURAL — garantida pela ausência de qualquer atributo/comportamento
// de processo (comprovada por teste), não por um predicado. INV-CA-03 é do
// event-store. Por isso o array de runtime contém somente INV-CA-01.
export const caseEntityInvariants: ReadonlyArray<Invariant<CaseAggregate>> = [
  defineInvariant<CaseAggregate>({
    id: 'INV-CA-01',
    canonReference: 'CASO INV-CA-01; DF-08',
    description: 'Todo Caso pertence a exatamente uma Missão.',
    check: (c) => c.mission != null,
  }),
];

// (B) Manifesto completo das 3 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  'entity' | 'event-store' | 'projection' | 'cqrs' | 'use-case' | 'cross-entity';

export interface CaseInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const CASE_INVARIANTS_MANIFEST: ReadonlyArray<CaseInvariantSpec> = [
  {
    id: 'INV-CA-01',
    canonReference: 'DF-08',
    description: 'Todo Caso pertence a exatamente uma Missão; não existe Caso fora de Missão.',
    enforcement: 'entity',
  },
  {
    id: 'INV-CA-02',
    canonReference: 'Art. 7º',
    description: 'O Caso não é Processo (o Processo é instrumento; consequência da Missão).',
    enforcement: 'entity',
  },
  {
    id: 'INV-CA-03',
    canonReference: 'Lei 3',
    description: 'O histórico do Caso é preservado; nenhuma versão é apagada.',
    enforcement: 'event-store',
  },
];
