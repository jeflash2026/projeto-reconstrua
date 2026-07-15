// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade PERITO. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<PeritoAggregate>);
//  (B) manifesto completo INV-PT-01..INV-PT-03 com referência normativa e LOCUS.
// O Canon (Entidade 16, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma execução/produção de perícia é implementada.
//
// INV-PT-01 (atos privativos de perícia só pelo perito) é CROSS-ENTITY: a
// exclusividade vale no Sistema (a AHRI — INV-AH-03 — e não-peritos jamais os
// praticam); o Perito é o titular legítimo. INV-PT-02 (distinto de PERÍCIA) é
// ESTRUTURAL — o Perito tem atributos de papel humano, não de etapa. INV-PT-03
// (responsabilidade temporária; missão do Projeto) é de instância.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { PeritoAggregate } from './perito.js';

// (A) Invariantes garantidas pela própria entidade, na designação.
export const peritoEntityInvariants: ReadonlyArray<Invariant<PeritoAggregate>> = [
  defineInvariant<PeritoAggregate>({
    id: 'INV-PT-03',
    canonReference: 'PERITO INV-PT-03; Lei Geral; item 13',
    description: 'Responsabilidade temporária sobre a Missão (que pertence ao Projeto); Pessoa e Missão referenciadas, jamais possuídas.',
    check: (p) => p.person != null && p.mission != null,
  }),
  defineInvariant<PeritoAggregate>({
    id: 'PT-ATUA-NA-PERICIA',
    canonReference: 'PERITO item 11/18; INV-PT-02; DF-17',
    description: 'O Perito atua numa fase PERÍCIA (13) referenciada — atua na etapa, não é a etapa.',
    check: (p) => p.expertise != null,
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

export interface PeritoInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const PERITO_INVARIANTS_MANIFEST: ReadonlyArray<PeritoInvariantSpec> = [
  { id: 'INV-PT-01', canonReference: 'DF-09', description: 'Atos privativos de perícia só podem ser praticados pelo Perito; a AHRI e não-peritos jamais.', enforcement: 'cross-entity' },
  { id: 'INV-PT-02', canonReference: 'DF-17', description: 'Distinto da PERÍCIA (etapa); jamais se confunde com ela.', enforcement: 'entity' },
  { id: 'INV-PT-03', canonReference: 'Lei Geral', description: 'Responsabilidade temporária; a missão pertence ao Projeto, jamais ao Perito.', enforcement: 'entity' },
];
