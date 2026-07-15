// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade AHRI. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<AhriAggregate>);
//  (B) manifesto completo INV-AH-01..INV-AH-04 com referência normativa e LOCUS.
// O Canon (Entidade 14, item 15) enumera EXATAMENTE quatro invariantes; nada além.
// Nenhum comportamento cognitivo (E9/E10) nem atuação (R7/R8) é implementado.
//
// AS QUATRO SÃO DE NÍVEL DE ENTIDADE — a salvaguarda IA×humano é estrutural:
//  • INV-AH-01 (assistiva, nunca decisão final) — por AUSÊNCIA de método de decisão;
//  • INV-AH-02 (referencia Regra Operacional + registro) — por REFERÊNCIA obrigatória;
//  • INV-AH-03 (jamais ato privativo/decisão jurídica) — por AUSÊNCIA;
//  • INV-AH-04 (jamais cria fato/verdade) — por AUSÊNCIA.
// (A não-contradição universal e o rastro perpétuo são reforçados no event-store/
// governança; a entidade garante a impossibilidade estrutural por instância.)
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { AhriAggregate } from './ahri.js';

// (A) Invariantes garantidas pela própria entidade, na assunção de responsabilidade.
export const ahriEntityInvariants: ReadonlyArray<Invariant<AhriAggregate>> = [
  defineInvariant<AhriAggregate>({
    id: 'INV-AH-02',
    canonReference: 'AHRI INV-AH-02; DF-09; DF-13',
    description: 'Toda atuação referencia uma Regra Operacional e possui registro DECISOR/TIPO/FUNDAMENTO.',
    check: (a) => a.governingRule != null && a.record != null && a.record.fundamento.length > 0,
  }),
  defineInvariant<AhriAggregate>({
    id: 'AH-DE-MISSAO',
    canonReference: 'AHRI item 12; DF-09',
    description: 'A assunção de responsabilidade operacional é de exatamente uma Missão.',
    check: (a) => a.mission != null,
  }),
];

// (B) Manifesto completo das 4 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  | 'entity'
  | 'event-store'
  | 'projection'
  | 'cqrs'
  | 'use-case'
  | 'cross-entity';

export interface AhriInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const AHRI_INVARIANTS_MANIFEST: ReadonlyArray<AhriInvariantSpec> = [
  { id: 'INV-AH-01', canonReference: 'Art. 15º', description: 'Função assistiva; jamais decisão final.', enforcement: 'entity' },
  { id: 'INV-AH-02', canonReference: 'DF-09; DF-13', description: 'Toda automação referencia Regra Operacional com registro DECISOR/TIPO/FUNDAMENTO.', enforcement: 'entity' },
  { id: 'INV-AH-03', canonReference: 'DF-09', description: 'Jamais pratica ato privativo nem decide juridicamente.', enforcement: 'entity' },
  { id: 'INV-AH-04', canonReference: 'E9-L06', description: 'Jamais cria fatos, evidência, documento, evento, conhecimento ou verdade.', enforcement: 'entity' },
];
