// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade PROJEÇÃO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<ProjectionAggregate>);
//  (B) manifesto completo INV-PJ-01..INV-PJ-02 com referência normativa e LOCUS.
// O Canon (Entidade 10, item 15) enumera EXATAMENTE duas invariantes; nada além.
// Nenhuma regra operacional (DF-13) nem projeção de leitura é implementada.
//
// Ambas são garantidas no nível de ENTIDADE: INV-PJ-01 (deriva da Verdade e jamais
// a substitui) — a Projeção referencia uma Verdade e carrega leitura declarada
// derivada, sem qualquer mutador da Verdade; INV-PJ-02 (nunca altera Estado) —
// ESTRUTURAL: a Projeção não conhece nem referencia o Estado, e não tem mutadores.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { ProjectionAggregate } from './projection.js';

// (A) Invariantes garantidas pela própria entidade, na derivação.
export const projectionEntityInvariants: ReadonlyArray<Invariant<ProjectionAggregate>> = [
  defineInvariant<ProjectionAggregate>({
    id: 'INV-PJ-01',
    canonReference: 'PROJEÇÃO INV-PJ-01; DF-03; INV-E8-04',
    description: 'Deriva da Verdade (fonte obrigatória) e jamais a substitui/recalcula como verdade.',
    check: (p) => p.derivedFromTruth != null && p.reading.value.length > 0,
  }),
];

// (B) Manifesto completo das 2 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  | 'entity'
  | 'event-store'
  | 'projection'
  | 'cqrs'
  | 'use-case'
  | 'cross-entity';

export interface ProjectionInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const PROJECTION_INVARIANTS_MANIFEST: ReadonlyArray<ProjectionInvariantSpec> = [
  { id: 'INV-PJ-01', canonReference: 'DF-03; INV-E8-04', description: 'Toda projeção deriva da Verdade e jamais a substitui, reinterpreta ou recalcula como verdade.', enforcement: 'entity' },
  { id: 'INV-PJ-02', canonReference: 'DF-08', description: 'Nunca altera o Estado Operacional (não o conhece nem o referencia).', enforcement: 'entity' },
];
