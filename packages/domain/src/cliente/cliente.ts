// ─────────────────────────────────────────────────────────────────────────────
// ClienteAggregate — agregado da Entidade 19 (CLIENTE). Deriva EXCLUSIVAMENTE do
// Livro Mestre (Entidade 19; DF-23; DF-12; Art. 5º/6º/14º; Entidade 02 — PESSOA;
// INV-P02; Lei Geral).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a condição de Cliente de uma Pessoa reconhecida — fábrica
//     `recognize`, emite ClienteRecognized (item 7; DF-23);
//   • vincula a Pessoa (02) de quem é condição (item 11; INV-CL-01);
//   • registra o responsável autorizado e a datação (item 7/8; DF-12; Art. 14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO é a Pessoa (item 4) — é uma CONDIÇÃO dela; SEM atributos de indivíduo;
//   • NÃO cria nem duplica Pessoa (INV-CL-02; INV-P02) — só referencia uma existente;
//   • NÃO altera a identidade civil da Pessoa (INV-CL-03) — SEM método;
//   • NÃO reduz a Pessoa a registro comercial (Art. 5º/6º); NÃO trata como lead/usuário (item 4/17);
//   • NÃO possui a Missão nem seu Estado/Verdade (item 13) — só se relaciona via a Pessoa;
//   • NÃO decide, NÃO conduz, NÃO produz prova, NÃO automatiza — não é papel de atuação;
//   • NÃO modela a relação de serviço em curso nem a referência a missões (item 12/18 —
//     transitivo/operacional, fora).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { ClienteId } from './cliente-id.js';
import type { ClientePersonRef, ClienteRecognitionResponsibleRef } from './refs.js';
import { ClienteRecognized } from './cliente-events.js';

/** Entrada de reconhecimento da condição de Cliente (Entidade 19; itens 1/7/11). */
export interface ClienteRecognitionInput {
  readonly id: ClienteId;
  readonly person: ClientePersonRef; // a Pessoa reconhecida de quem é condição (INV-CL-01)
  readonly recognizedBy: ClienteRecognitionResponsibleRef; // responsável autorizado (DF-12; Art. 14º)
  readonly recognizedAt: Date; // datação (rastreabilidade — item 8)
}

interface ClienteProps {
  readonly id: ClienteId;
  readonly person: ClientePersonRef;
  readonly recognizedBy: ClienteRecognitionResponsibleRef;
  readonly recognizedAt: Date;
}

const PERSON_ID = 'INV-CL-01';
const PERSON_REF = 'Entidade 19; INV-CL-01; item 11; Entidade 02; DF-23';
const RESP_ID = 'CL-RASTREAVEL';
const RESP_REF = 'Entidade 19; item 7/8; DF-12; Art. 14º';

export class ClienteAggregate extends AggregateRoot<ClienteId> {
  private constructor(private readonly props: ClienteProps) {
    super(props.id);
  }

  /**
   * Reconhece a condição de Cliente a partir de uma Pessoa já reconhecida (item 7;
   * DF-23). NÃO cria/duplica/altera a Pessoa: assembla o marco imutável da condição
   * (pessoa + responsável) e valida a boa-formação.
   */
  static recognize(input: ClienteRecognitionInput): Result<ClienteAggregate, CanonViolationError> {
    // INV-CL-01 — todo Cliente é a condição de uma Pessoa reconhecida.
    if (input.person == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: PERSON_ID,
          canonReference: PERSON_REF,
          message: 'Todo Cliente é a condição de uma Pessoa reconhecida; a Pessoa é obrigatória (INV-CL-01).',
        }),
      );
    }
    // item 7/8 — responsável autorizado pelo reconhecimento (rastreabilidade).
    if (input.recognizedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: RESP_ID,
          canonReference: RESP_REF,
          message: 'Reconhecimento da condição de Cliente sem responsável autorizado identificado (DF-12; Art. 14º).',
        }),
      );
    }
    // Datação — rastreabilidade (item 8; Art. 14º).
    if (!(input.recognizedAt instanceof Date) || Number.isNaN(input.recognizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: RESP_ID,
          canonReference: RESP_REF,
          message: 'Reconhecimento da condição de Cliente sem datação válida (Art. 14º).',
        }),
      );
    }

    const cliente = new ClienteAggregate({
      id: input.id,
      person: input.person,
      recognizedBy: input.recognizedBy,
      recognizedAt: new Date(input.recognizedAt.getTime()),
    });

    cliente.addDomainEvent(new ClienteRecognized(input.id.toString(), cliente.props.recognizedAt));
    return Result.ok(cliente);
  }

  // Acessores imutáveis. NENHUM método de criação/duplicação/alteração de Pessoa,
  // alteração de identidade civil, alteração de Estado/Verdade, decisão, condução,
  // prova ou posse (INV-CL-01/02/03; itens 4/13).
  get person(): ClientePersonRef {
    return this.props.person;
  }
  get recognizedBy(): ClienteRecognitionResponsibleRef {
    return this.props.recognizedBy;
  }
  get recognizedAt(): Date {
    return new Date(this.props.recognizedAt.getTime());
  }
}
