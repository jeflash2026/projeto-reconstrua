// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade PESSOA. Mesma estrutura da MISSÃO:
//  (A) invariantes verificáveis na construção (Invariant<Person>);
//  (B) manifesto completo INV-P01..INV-P15 com referência normativa e LOCUS de
//      enforcement — dizendo honestamente o que a entidade garante e o que é
//      garantido pelo event store / projeções / casos de uso / outras entidades.
// Nenhuma regra operacional é implementada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { Person } from './person.js';

// (A) Invariante garantida pela própria entidade, na construção (reconhecimento).
export const personEntityInvariants: ReadonlyArray<Invariant<Person>> = [
  defineInvariant<Person>({
    id: 'INV-P14',
    canonReference: 'PESSOA INV-P14; DF-23 (seis elementos)',
    description:
      'Reconhecimento completo: identidade civil, origem, data, responsável e ao menos uma evidência.',
    check: (p) =>
      p.civilIdentity.value.length > 0 &&
      p.origin.value.length > 0 &&
      p.recognizedAt instanceof Date &&
      !Number.isNaN(p.recognizedAt.getTime()) &&
      p.responsible != null &&
      p.evidences.length > 0,
  }),
];

// (B) Manifesto completo das 15 invariantes do Canon e onde cada uma é garantida.
export type EnforcementLocus =
  | 'entity'
  | 'event-store'
  | 'projection'
  | 'cqrs'
  | 'use-case'
  | 'cross-entity';

export interface PersonInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const PERSON_INVARIANTS_MANIFEST: ReadonlyArray<PersonInvariantSpec> = [
  { id: 'INV-P01', canonReference: 'Entidade 02; Identidade Civil', description: 'Identidade única e permanente; mudanças cadastrais/documentais jamais criam nova Pessoa.', enforcement: 'entity' },
  { id: 'INV-P02', canonReference: 'Entidade 02; Lei 1', description: 'Jamais duplicada: o mesmo indivíduo real corresponde a exatamente uma Pessoa.', enforcement: 'event-store' },
  { id: 'INV-P03', canonReference: 'DF-08; Lei 2', description: 'Nunca possui Estado, Etapa, Workflow nem Timeline Operacional (são da MISSÃO).', enforcement: 'entity' },
  { id: 'INV-P04', canonReference: 'DF-20', description: 'Possui zero, uma ou múltiplas missões; cada missão sua pertence exatamente a ela.', enforcement: 'cross-entity' },
  { id: 'INV-P05', canonReference: 'Lei Geral (titularidade)', description: 'Nunca pertence ao Sistema; o Sistema apenas administra missões relacionadas a ela.', enforcement: 'entity' },
  { id: 'INV-P06', canonReference: 'Art. 6º', description: 'Nenhuma decisão a reduz a identificador; preserva dignidade, transparência, segurança, respeito.', enforcement: 'entity' },
  { id: 'INV-P07', canonReference: 'DF-11; Lei 3', description: 'Vínculos com suas missões jamais apagados; nenhuma missão sua desaparece.', enforcement: 'event-store' },
  { id: 'INV-P08', canonReference: 'Entidade 02 — Identidade Civil', description: 'A representação operacional jamais altera, constitui ou substitui a identidade civil.', enforcement: 'entity' },
  { id: 'INV-P09', canonReference: 'Lei 3; Art. 14º', description: 'Toda alteração da representação operacional é rastreável.', enforcement: 'use-case' },
  { id: 'INV-P10', canonReference: 'Lei 2', description: 'A Pessoa pode visualizar todas as suas missões.', enforcement: 'projection' },
  { id: 'INV-P11', canonReference: 'Art. 11º; DF-12', description: 'Nenhuma informação essencial existe apenas em memória informal.', enforcement: 'event-store' },
  { id: 'INV-P12', canonReference: 'DF-20; Lei da Individualidade', description: 'Interesses compartilhados jamais geram missão comum: sempre missões independentes.', enforcement: 'cross-entity' },
  { id: 'INV-P13', canonReference: 'DF-11', description: 'A Pessoa nunca é encerrada; somente missões se encerram.', enforcement: 'entity' },
  { id: 'INV-P14', canonReference: 'DF-23', description: 'Nenhum reconhecimento incompleto (seis elementos obrigatórios).', enforcement: 'entity' },
  { id: 'INV-P15', canonReference: 'Lei do Reconhecimento', description: 'Nenhuma implementação trata a Pessoa como objeto criado pelo software.', enforcement: 'entity' },
];
