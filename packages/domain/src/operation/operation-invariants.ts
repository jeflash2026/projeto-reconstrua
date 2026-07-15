// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade OPERAÇÃO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<OperationAggregate>);
//  (B) manifesto completo INV-OP-01..INV-OP-03 com referência normativa e LOCUS.
// O Canon (Entidade 11, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma Regra Operacional (Volume 03 / DF-13) nem workflow é implementado aqui.
//
// INV-OP-01 (existe em função de uma missão) é de instância: a Operação referencia
// exatamente uma Missão. INV-OP-02 (rege-se pelo Volume 03) é use-case: a governança
// por R1–R9 vive na camada de execução — a entidade contribui por NÃO ter agir
// autônomo. INV-OP-03 (auditável) é event-store: o rastro perpétuo é do R9; a
// entidade contribui com a rastreabilidade (responsável + datação).
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { OperationAggregate } from './operation.js';

// (A) Invariantes garantidas pela própria entidade, na condução.
export const operationEntityInvariants: ReadonlyArray<Invariant<OperationAggregate>> = [
  defineInvariant<OperationAggregate>({
    id: 'INV-OP-01',
    canonReference: 'OPERAÇÃO INV-OP-01; DF-08',
    description: 'Toda Operação existe em função de exatamente uma Missão.',
    check: (o) => o.mission != null,
  }),
  defineInvariant<OperationAggregate>({
    id: 'OP-AUDITAVEL',
    canonReference: 'OPERAÇÃO INV-OP-03; R9; Lei 4; Art. 14º',
    description: 'A Operação registra responsável identificado (rastreabilidade da auditoria).',
    check: (o) => o.conductedBy != null,
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

export interface OperationInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const OPERATION_INVARIANTS_MANIFEST: ReadonlyArray<OperationInvariantSpec> = [
  { id: 'INV-OP-01', canonReference: 'DF-08', description: 'Toda operação existe em função de uma missão.', enforcement: 'entity' },
  { id: 'INV-OP-02', canonReference: 'Volume 03 (R1–R9); DF-13', description: 'Rege-se integralmente pelo Volume 03; nenhuma operação fora das Regras Operacionais.', enforcement: 'use-case' },
  { id: 'INV-OP-03', canonReference: 'R9; Lei 4', description: 'É sempre auditável; rastro operacional perpétuo.', enforcement: 'event-store' },
];
