// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade PERÍCIA. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<PericiaAggregate>);
//  (B) manifesto completo INV-PE-01..INV-PE-03 com referência normativa e LOCUS.
// O Canon (Entidade 13, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma execução de perícia, evolução (R6) ou produção de prova é implementada.
//
// INV-PE-01 (é etapa, não papel) e INV-PE-02 (distinta de PERITO) são ESTRUTURAIS:
// a Perícia tem atributos de etapa (missão + etapa especializada) e NÃO tem
// comportamento de papel humano (não produz prova, não decide) — comprovado por
// ausência. INV-PE-03 (etapa única por missão enquanto vigente) é event-store.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { PericiaAggregate } from './pericia.js';

// (A) Invariantes garantidas pela própria entidade, no enquadramento.
export const periciaEntityInvariants: ReadonlyArray<Invariant<PericiaAggregate>> = [
  defineInvariant<PericiaAggregate>({
    id: 'PE-DE-MISSAO',
    canonReference: 'PERÍCIA item 11/22; INV-PE-03; Lei 2',
    description: 'A etapa pericial pertence a exatamente uma Missão.',
    check: (p) => p.mission != null,
  }),
  defineInvariant<PericiaAggregate>({
    id: 'PE-ESPECIALIZA-ETAPA',
    canonReference: 'PERÍCIA item 3/11/22; INV-PE-01; DF-17',
    description: 'A Perícia é etapa: especializa exatamente uma Etapa Operacional (09).',
    check: (p) => p.specializedStage != null,
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

export interface PericiaInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const PERICIA_INVARIANTS_MANIFEST: ReadonlyArray<PericiaInvariantSpec> = [
  { id: 'INV-PE-01', canonReference: 'DF-17', description: 'É etapa operacional especializada, não papel humano.', enforcement: 'entity' },
  { id: 'INV-PE-02', canonReference: 'DF-17', description: 'Distinta do PERITO; jamais se confunde com o papel humano.', enforcement: 'entity' },
  { id: 'INV-PE-03', canonReference: 'Lei 2', description: 'Ocupa a missão como etapa única enquanto vigente.', enforcement: 'event-store' },
];
