// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade DOCUMENTO. Mesma estrutura da MISSÃO/PESSOA:
//  (A) invariantes verificáveis na construção (Invariant<DocumentAggregate>);
//  (B) manifesto completo INV-D01..INV-D14 com referência normativa e LOCUS.
// Nenhuma regra operacional é implementada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { DocumentAggregate } from './document.js';

// (A) Invariantes garantidas pela própria entidade, na construção (reconhecimento).
export const documentEntityInvariants: ReadonlyArray<Invariant<DocumentAggregate>> = [
  defineInvariant<DocumentAggregate>({
    id: 'INV-D02',
    canonReference: 'DOCUMENTO INV-D02',
    description: 'O Documento reconhecido possui origem registrada.',
    check: (d) => d.origin.value.length > 0,
  }),
  defineInvariant<DocumentAggregate>({
    id: 'INV-D08',
    canonReference: 'DOCUMENTO INV-D08',
    description: 'Individualizado, com origem e incorporado a ao menos uma Missão.',
    check: (d) => d.incorporatedInto.length > 0 && d.origin.value.length > 0,
  }),
  defineInvariant<DocumentAggregate>({
    id: 'INV-D10',
    canonReference: 'DOCUMENTO INV-D10',
    description: 'Possui conteúdo probatório preservado (referência imutável).',
    check: (d) => d.content.value.length > 0,
  }),
];

// (B) Manifesto completo das 14 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  'entity' | 'event-store' | 'projection' | 'cqrs' | 'use-case' | 'cross-entity';

export interface DocumentInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const DOCUMENT_INVARIANTS_MANIFEST: ReadonlyArray<DocumentInvariantSpec> = [
  {
    id: 'INV-D01',
    canonReference: 'Entidade 03; Lei do Reconhecimento',
    description: 'Jamais inventado: o Sistema reconhece, nunca cria um Documento.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D02',
    canonReference: 'Entidade 03',
    description: 'Jamais perde sua origem.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D03',
    canonReference: 'Lei 3; Art. 14º',
    description: 'Jamais perde rastreabilidade (origem, momento, responsável).',
    enforcement: 'event-store',
  },
  {
    id: 'INV-D04',
    canonReference: 'Entidade 03',
    description: 'Jamais confundido com decisão, estado ou conclusão.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D05',
    canonReference: 'DF-20; Entidade 03',
    description: 'Compartilhado entre missões apenas quando as Regras Operacionais permitirem.',
    enforcement: 'use-case',
  },
  {
    id: 'INV-D06',
    canonReference: 'Entidade 03 — Reconhecimento',
    description: 'Reconhecimento jamais significa validação, aprovação ou aceitação de veracidade.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D07',
    canonReference: 'DF-09; Entidade 03',
    description:
      'O valor jurídico definitivo jamais pertence ao Documento (é da interpretação humana).',
    enforcement: 'entity',
  },
  {
    id: 'INV-D08',
    canonReference: 'Entidade 03 — Reconhecimento',
    description:
      'Individualizado, com origem, incorporado a ≥1 Missão, integrando a Verdade Operacional.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D09',
    canonReference: 'DF-05; E8',
    description: 'A incorporação jamais altera, por si só, o Estado Operacional.',
    enforcement: 'projection',
  },
  {
    id: 'INV-D10',
    canonReference: 'Entidade 03',
    description:
      'O conteúdo probatório jamais é alterado; alterações da representação são rastreáveis.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D11',
    canonReference: 'DF-11; Lei 3',
    description: 'Um Documento reconhecido jamais desaparece.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-D12',
    canonReference: 'Entidade 03',
    description: 'Nunca pertence ao Sistema; o Sistema mantém apenas sua representação.',
    enforcement: 'entity',
  },
  {
    id: 'INV-D13',
    canonReference: 'Lei 1; Entidade 03',
    description:
      'O mesmo documento real corresponde a uma única individualização; compartilhar não duplica.',
    enforcement: 'event-store',
  },
  {
    id: 'INV-D14',
    canonReference: 'Lei 4; DF-09; DF-13',
    description:
      'Toda automação que reconheça/classifique/vincule referencia Regra Operacional e produz histórico.',
    enforcement: 'use-case',
  },
];
