// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade ETAPA OPERACIONAL. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<OperationalStageAggregate>);
//  (B) manifesto completo INV-ET-01..INV-ET-03 com referência normativa e LOCUS.
// O Canon (Entidade 09, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma regra operacional (R5/R6) nem lógica de evolução/síntese é implementada.
//
// INV-ET-01 (corresponde a exatamente um Estado — 1:1) é genuinamente de instância:
// a Etapa referencia exatamente um Estado. INV-ET-02 (jamais diverge) é cross-entity
// (requer comparar com o Estado). INV-ET-03 (uma por missão/instante) decorre de
// INV-EO-01 via a bijeção — locus event-store.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { OperationalStageAggregate } from './operational-stage.js';

// (A) Invariantes garantidas pela própria entidade, na representação.
export const operationalStageEntityInvariants: ReadonlyArray<Invariant<OperationalStageAggregate>> = [
  defineInvariant<OperationalStageAggregate>({
    id: 'INV-ET-01',
    canonReference: 'ETAPA INV-ET-01; Lei 2; mapeamento 1:1',
    description: 'A Etapa corresponde a exatamente um Estado (referência única e obrigatória).',
    check: (e) => e.representedState != null,
  }),
  defineInvariant<OperationalStageAggregate>({
    id: 'ET-FORMA-APRESENTAVEL',
    canonReference: 'ETAPA itens 2/3/19; DF-08; Art. 11º',
    description: 'A Etapa possui forma apresentável do Estado.',
    check: (e) => e.form.value.length > 0,
  }),
];

// (B) Manifesto completo das 3 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  | 'entity'
  | 'event-store'
  | 'projection'
  | 'cqrs'
  | 'use-case'
  | 'cross-entity';

export interface OperationalStageInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const OPERATIONAL_STAGE_INVARIANTS_MANIFEST: ReadonlyArray<OperationalStageInvariantSpec> = [
  { id: 'INV-ET-01', canonReference: 'Lei 2; mapeamento 1:1', description: 'Corresponde a exatamente um Estado vigente (bijeção 1:1).', enforcement: 'entity' },
  { id: 'INV-ET-02', canonReference: 'DF-08', description: 'Jamais diverge do Estado; apresenta fielmente, jamais o altera.', enforcement: 'cross-entity' },
  { id: 'INV-ET-03', canonReference: 'Lei 2', description: 'Uma Etapa por missão por instante (decorre de INV-EO-01 via bijeção).', enforcement: 'event-store' },
];
