// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade PROCESSO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<ProcessAggregate>);
//  (B) manifesto completo INV-PR-01..INV-PR-03 com referência normativa e LOCUS.
// O Canon (Entidade 06, item 15) enumera EXATAMENTE três invariantes; nada além
// é acrescentado. Nenhuma regra operacional é implementada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { ProcessAggregate } from './process.js';

// (A) Invariantes garantidas pela própria entidade, na construção (reconhecimento).
// Apenas INV-PR-01 é um predicado de runtime sobre a instância. INV-PR-02 (nunca é
// a missão) é ESTRUTURAL — o Processo é um agregado próprio que só REFERENCIA a
// missão por identidade, sem conter estado/Verdade da missão (comprovado por
// teste). INV-PR-03 (a missão existe sem processo) é CROSS-ENTITY — é uma
// afirmação sobre a cardinalidade da Missão, não verificável a partir do Processo.
export const processEntityInvariants: ReadonlyArray<Invariant<ProcessAggregate>> = [
  defineInvariant<ProcessAggregate>({
    id: 'INV-PR-01',
    canonReference: 'PROCESSO INV-PR-01; DF-10',
    description: 'Todo Processo pertence a uma Missão (jamais existe sem pertencer a uma).',
    check: (p) => p.mission != null,
  }),
];

// (B) Manifesto completo das 3 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  'entity' | 'event-store' | 'projection' | 'cqrs' | 'use-case' | 'cross-entity';

export interface ProcessInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const PROCESS_INVARIANTS_MANIFEST: ReadonlyArray<ProcessInvariantSpec> = [
  {
    id: 'INV-PR-01',
    canonReference: 'DF-10',
    description: 'Todo Processo pertence a uma Missão; não existe Processo fora de Missão.',
    enforcement: 'entity',
  },
  {
    id: 'INV-PR-02',
    canonReference: 'DF-10; Art. 7º',
    description: 'O Processo nunca é a Missão (é instrumento, um dos caminhos para cumpri-la).',
    enforcement: 'entity',
  },
  {
    id: 'INV-PR-03',
    canonReference: 'DF-10',
    description: 'A Missão pode existir sem Processo (o Processo não é obrigatório à Missão).',
    enforcement: 'cross-entity',
  },
];
