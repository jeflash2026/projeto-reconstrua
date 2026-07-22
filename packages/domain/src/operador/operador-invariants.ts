// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade OPERADOR. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<OperadorAggregate>);
//  (B) manifesto completo INV-OPr-01..INV-OPr-03 com referência normativa e LOCUS.
// O Canon (Entidade 15, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma condução operacional (OPERAÇÃO/R7) é implementada.
//
// INV-OPr-01 (responsabilidade temporária; missão do Projeto) é de instância: o
// Operador referencia Pessoa + Missão e NÃO detém titularidade (a missão é do
// Projeto). INV-OPr-02 (não pratica ato privativo) é ESTRUTURAL — ausência de
// métodos privativos/de decisão jurídica. INV-OPr-03 (transição preserva contexto)
// é use-case (o processo de transição de designação).
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { OperadorAggregate } from './operador.js';

// (A) Invariantes garantidas pela própria entidade, na designação.
export const operadorEntityInvariants: ReadonlyArray<Invariant<OperadorAggregate>> = [
  defineInvariant<OperadorAggregate>({
    id: 'INV-OPr-01',
    canonReference: 'OPERADOR INV-OPr-01; Lei Geral; item 13',
    description:
      'Responsabilidade temporária sobre a Missão (que pertence ao Projeto); Pessoa e Missão referenciadas, jamais possuídas.',
    check: (o) => o.person != null && o.mission != null,
  }),
  defineInvariant<OperadorAggregate>({
    id: 'OPr-AUTORIZADO',
    canonReference: 'OPERADOR item 7/8/11; DF-12',
    description:
      'A designação possui autoridade designante identificada (autorização da Governança).',
    check: (o) => o.designatedBy != null,
  }),
];

// (B) Manifesto completo das 3 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  'entity' | 'event-store' | 'projection' | 'cqrs' | 'use-case' | 'cross-entity';

export interface OperadorInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const OPERADOR_INVARIANTS_MANIFEST: ReadonlyArray<OperadorInvariantSpec> = [
  {
    id: 'INV-OPr-01',
    canonReference: 'Lei Geral',
    description: 'Responsabilidade temporária; a missão pertence ao Projeto, jamais ao Operador.',
    enforcement: 'entity',
  },
  {
    id: 'INV-OPr-02',
    canonReference: 'DF-09',
    description: 'Não pratica ato privativo de advogado/perito; não decide juridicamente.',
    enforcement: 'entity',
  },
  {
    id: 'INV-OPr-03',
    canonReference: 'Art. 12º',
    description: 'A transição de designação preserva contexto integralmente.',
    enforcement: 'use-case',
  },
];
