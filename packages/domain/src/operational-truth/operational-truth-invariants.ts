// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade VERDADE OPERACIONAL. Mesma estrutura das demais:
//  (A) invariantes de boa-formação verificáveis na construção (Invariant<...>);
//  (B) manifesto completo INV-VO-01..INV-VO-05 com referência normativa e LOCUS.
//
// ACHADO NORMATIVO (registrado na auditoria): as CINCO invariantes do Canon
// (INV-VO-01..05) são SISTÊMICAS — tratam de unicidade da Verdade vigente, fonte
// única no Sistema, não-produção por interfaces, histórico perpétuo e distinção
// verdade×métrica. NENHUMA é um predicado de instância única; todas vivem em
// event-store / cross-entity / cqrs / projection. Por isso o array de runtime (A)
// contém apenas GUARDAS DE BOA-FORMAÇÃO (ids descritivos), e o manifesto (B) mapeia
// cada INV-VO ao seu locus real. Nenhuma regra operacional (R5) é implementada.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { OperationalTruthAggregate } from './operational-truth.js';

// (A) Boa-formação estrutural garantida pela própria entidade, na síntese.
// Ids descritivos derivados de E8 / itens 1/14/19 (qualificações definicionais),
// pois nenhuma INV-VO-01..05 é predicado de instância única.
export const operationalTruthEntityInvariants: ReadonlyArray<Invariant<OperationalTruthAggregate>> = [
  defineInvariant<OperationalTruthAggregate>({
    id: 'VO-POR-MISSAO',
    canonReference: 'Entidade 07, item 1; Lei 2; INV-VO-01 (parcial)',
    description: 'Toda Verdade Operacional é calculada para exatamente uma Missão.',
    check: (t) => t.mission != null,
  }),
  defineInvariant<OperationalTruthAggregate>({
    id: 'VO-CADEIA-DEMONSTRAVEL',
    canonReference: 'INV-E8-02; E8-L06; itens 14/19',
    description: 'Toda Verdade Operacional demonstra sua cadeia (justificativa presente).',
    check: (t) => t.chainJustification.value.length > 0,
  }),
];

// (B) Manifesto completo das 5 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  | 'entity'
  | 'event-store'
  | 'projection'
  | 'cqrs'
  | 'use-case'
  | 'cross-entity';

export interface OperationalTruthInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const OPERATIONAL_TRUTH_INVARIANTS_MANIFEST: ReadonlyArray<OperationalTruthInvariantSpec> = [
  { id: 'INV-VO-01', canonReference: 'E8-L03', description: 'Exatamente uma Verdade vigente por missão por instante; anteriores permanecem como histórico datado.', enforcement: 'event-store' },
  { id: 'INV-VO-02', canonReference: 'Lei 1; DF-02', description: 'Fonte única de estado operacional no Sistema; jamais duas verdades oficiais.', enforcement: 'cross-entity' },
  { id: 'INV-VO-03', canonReference: 'DF-08', description: 'Nenhuma interface produz ou altera a Verdade; toda tela a consome.', enforcement: 'cqrs' },
  { id: 'INV-VO-04', canonReference: 'INV-E8-03; Lei 3; DF-11', description: 'Histórico das sínteses é perpétuo; nenhuma Verdade anterior é apagada.', enforcement: 'event-store' },
  { id: 'INV-VO-05', canonReference: 'DF-03', description: 'Agregações e KPIs são métricas derivadas, jamais a Verdade Operacional.', enforcement: 'projection' },
];
