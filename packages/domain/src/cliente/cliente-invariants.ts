// ─────────────────────────────────────────────────────────────────────────────
// Invariantes da Entidade CLIENTE. Mesma estrutura das demais:
//  (A) invariantes verificáveis na construção (Invariant<ClienteAggregate>);
//  (B) manifesto completo INV-CL-01..INV-CL-03 com referência normativa e LOCUS.
// O Canon (Entidade 19, item 15) enumera EXATAMENTE três invariantes; nada além.
// Nenhuma lógica operacional é implementada.
//
// AS TRÊS SÃO DE NÍVEL DE ENTIDADE: INV-CL-01 (todo cliente é uma Pessoa
// reconhecida) por REFERÊNCIA obrigatória à Pessoa; INV-CL-02 (jamais cria segunda
// Pessoa) por AUSÊNCIA de criação/duplicação de Pessoa (só referencia uma
// existente); INV-CL-03 (não altera a identidade civil) por AUSÊNCIA de qualquer
// método que altere a Pessoa.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from '../kernel/invariant.js';
import { defineInvariant } from '../kernel/invariant.js';
import type { ClienteAggregate } from './cliente.js';

// (A) Invariantes garantidas pela própria entidade, no reconhecimento.
export const clienteEntityInvariants: ReadonlyArray<Invariant<ClienteAggregate>> = [
  defineInvariant<ClienteAggregate>({
    id: 'INV-CL-01',
    canonReference: 'CLIENTE INV-CL-01; Entidade 02; DF-23',
    description: 'Todo Cliente é a condição de uma Pessoa reconhecida (referência obrigatória à Pessoa).',
    check: (c) => c.person != null,
  }),
  defineInvariant<ClienteAggregate>({
    id: 'CL-RASTREAVEL',
    canonReference: 'CLIENTE item 7/8; DF-12; Art. 14º',
    description: 'O reconhecimento da condição possui responsável autorizado identificado.',
    check: (c) => c.recognizedBy != null,
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

export interface ClienteInvariantSpec {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
  readonly enforcement: EnforcementLocus;
}

export const CLIENTE_INVARIANTS_MANIFEST: ReadonlyArray<ClienteInvariantSpec> = [
  { id: 'INV-CL-01', canonReference: 'Entidade 02; DF-23', description: 'Todo cliente é uma Pessoa reconhecida.', enforcement: 'entity' },
  { id: 'INV-CL-02', canonReference: 'INV-P02', description: 'Jamais cria uma segunda Pessoa; o mesmo indivíduo corresponde a uma única Pessoa.', enforcement: 'entity' },
  { id: 'INV-CL-03', canonReference: 'Entidade 02 — Identidade Civil', description: 'A condição de cliente não altera a identidade civil da Pessoa.', enforcement: 'entity' },
];
