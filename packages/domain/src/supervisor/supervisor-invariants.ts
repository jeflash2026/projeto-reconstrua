// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade SUPERVISOR. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<SupervisorAggregate>);
//  (B) manifesto completo INV-SU-01..INV-SU-03 com referência normativa e LOCUS.
// O Canon (Entidade 18, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma execução de supervisão nem lógica operacional é implementada.
//
// INV-SU-01 (supervisão não cria ato privativo) é ESTRUTURAL: o Supervisor não tem
// método que pratique ato privativo (advocacia/perícia), conduza ou execute.
// INV-SU-02 (responsabilidade temporária) é de instância. INV-SU-03 (critérios
// completos na Governança) é use-case: os critérios são REMETIDOS à Governança
// (DF-12; item 24), fora desta entidade.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { SupervisorAggregate } from './supervisor.js';

// (A) Invariantes garantidas pela própria entidade, na designação.
export const supervisorEntityInvariants: ReadonlyArray<Invariant<SupervisorAggregate>> = [
  defineInvariant<SupervisorAggregate>({
    id: 'INV-SU-02',
    canonReference: 'SUPERVISOR INV-SU-02; Lei Geral; item 13',
    description: 'Responsabilidade de supervisão temporária; Pessoa e Missão referenciadas, jamais possuídas.',
    check: (s) => s.person != null && s.mission != null,
  }),
  defineInvariant<SupervisorAggregate>({
    id: 'SU-AUTORIZADO',
    canonReference: 'SUPERVISOR item 7/8/11; DF-12',
    description: 'A designação possui autoridade designante identificada (autorização da Governança).',
    check: (s) => s.designatedBy != null,
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

export interface SupervisorInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const SUPERVISOR_INVARIANTS_MANIFEST: ReadonlyArray<SupervisorInvariantSpec> = [
  { id: 'INV-SU-01', canonReference: 'DF-09', description: 'A supervisão jamais cria ato privativo (de advocacia/perícia) nem decide juridicamente.', enforcement: 'entity' },
  { id: 'INV-SU-02', canonReference: 'Lei Geral', description: 'Responsabilidade de supervisão temporária; a missão pertence ao Projeto.', enforcement: 'entity' },
  { id: 'INV-SU-03', canonReference: 'DF-12', description: 'Os critérios completos de supervisão são definidos na Governança.', enforcement: 'use-case' },
];
