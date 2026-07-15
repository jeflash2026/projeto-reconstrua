// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade REGRA OPERACIONAL. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<OperationalRuleAggregate>);
//  (B) manifesto completo INV-RO-01..INV-RO-03 com referência normativa e LOCUS.
// O Canon (Entidade 12, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma execução de regra (R1–R9) é implementada.
//
// INV-RO-01 (possui os dez elementos) é de instância: a entidade valida a presença
// dos dez elementos da DF-13 na construção. INV-RO-02 (jamais contraria o Canon) é
// SEMÂNTICA — a não-contradição plena é da Governança (G3/Lei Geral das RO); a
// entidade contribui exigindo fundamento superior citado. INV-RO-03 (toda automação
// da AHRI referencia ≥1 regra) é cross-entity — restrição sobre a AHRI (14), não
// sobre esta entidade.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { OperationalRuleAggregate } from './operational-rule.js';

// (A) Invariantes garantidas pela própria entidade, na aprovação.
export const operationalRuleEntityInvariants: ReadonlyArray<Invariant<OperationalRuleAggregate>> = [
  defineInvariant<OperationalRuleAggregate>({
    id: 'INV-RO-01',
    canonReference: 'REGRA OPERACIONAL INV-RO-01; DF-13 (dez elementos)',
    description: 'Possui os dez elementos obrigatórios da DF-13.',
    check: (r) => r.hasTenElements(),
  }),
  defineInvariant<OperationalRuleAggregate>({
    id: 'RO-FUNDAMENTO-CITADO',
    canonReference: 'REGRA OPERACIONAL itens 11/19; INV-RO-02; Lei Geral das RO',
    description: 'Cita um fundamento superior no Canon (contribuição à não-contradição).',
    check: (r) => r.canonFoundation.value.length > 0,
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

export interface OperationalRuleInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const OPERATIONAL_RULE_INVARIANTS_MANIFEST: ReadonlyArray<OperationalRuleInvariantSpec> = [
  { id: 'INV-RO-01', canonReference: 'DF-13', description: 'Possui os dez elementos obrigatórios (identificador, nome, objetivo, critério de execução, critério de bloqueio, evento de entrada, evento de saída, evidências produzidas, responsável pela aprovação, histórico de versões).', enforcement: 'entity' },
  { id: 'INV-RO-02', canonReference: 'Lei Geral das RO', description: 'Jamais contraria a Constituição, a Ontologia ou a Epistemologia; em conflito prevalece o nível superior do Canon.', enforcement: 'cross-entity' },
  { id: 'INV-RO-03', canonReference: 'DF-09', description: 'Toda automação da AHRI referencia ao menos uma Regra Operacional.', enforcement: 'cross-entity' },
];
