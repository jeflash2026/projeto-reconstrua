// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade ADVOGADO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<AdvogadoAggregate>);
//  (B) manifesto completo INV-AD-01..INV-AD-03 com referência normativa e LOCUS.
// O Canon (Entidade 17, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhum comportamento operacional nem execução de decisão é implementado.
//
// INV-AD-01 (decisão jurídica definitiva só do advogado) e INV-AD-02 (atos
// privativos de advocacia só por ele) são CROSS-ENTITY: a exclusividade vale no
// Sistema (a AHRI — INV-AH-01/03 —, operador, perito e supervisor jamais decidem
// juridicamente/assinam); o Advogado é o titular legítimo. INV-AD-03
// (responsabilidade temporária; missão do Projeto) é de instância.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { AdvogadoAggregate } from './advogado.js';

// (A) Invariantes garantidas pela própria entidade, na designação.
export const advogadoEntityInvariants: ReadonlyArray<Invariant<AdvogadoAggregate>> = [
  defineInvariant<AdvogadoAggregate>({
    id: 'INV-AD-03',
    canonReference: 'ADVOGADO INV-AD-03; Lei Geral; item 13',
    description: 'Responsabilidade temporária sobre a Missão (que pertence ao Projeto); Pessoa e Missão referenciadas, jamais possuídas.',
    check: (a) => a.person != null && a.mission != null,
  }),
  defineInvariant<AdvogadoAggregate>({
    id: 'AD-AUTORIZADO',
    canonReference: 'ADVOGADO item 7/8/11; DF-12',
    description: 'A designação possui autoridade designante identificada (autorização da Governança).',
    check: (a) => a.designatedBy != null,
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

export interface AdvogadoInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const ADVOGADO_INVARIANTS_MANIFEST: ReadonlyArray<AdvogadoInvariantSpec> = [
  { id: 'INV-AD-01', canonReference: 'DF-09', description: 'A decisão jurídica definitiva só pode ser do Advogado (profissional humano competente).', enforcement: 'cross-entity' },
  { id: 'INV-AD-02', canonReference: 'DF-09', description: 'Os atos privativos de advocacia só podem ser praticados pelo Advogado.', enforcement: 'cross-entity' },
  { id: 'INV-AD-03', canonReference: 'Lei Geral', description: 'Responsabilidade temporária; a missão pertence ao Projeto, jamais ao Advogado.', enforcement: 'entity' },
];
