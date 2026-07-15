// ─────────────────────────────────────────────────────────────────────────────
// ProcessAggregate — agregado da Entidade 06 (PROCESSO). Deriva EXCLUSIVAMENTE do
// Livro Mestre (Entidade 06; DF-01; DF-09; DF-10; Art. 7º; Art. 14º).
//
// O que esta entidade FAZ (e só isto):
//   • RECONHECE (nunca inventa) um instrumento jurídico que existe no mundo — a
//     ação distribuída (item 20) — fábrica `recognize`, emite ProcessRecognized;
//   • vincula o Processo a exatamente uma Missão (INV-PR-01; DF-10);
//   • preserva o fundamento jurídico (itens 11/19; DF-01) de forma imutável;
//   • guarda, OPCIONALMENTE, o Caso de que decorre (itens 14/18; Modelagem);
//   • registra a rastreabilidade do reconhecimento: responsável + momento
//     (itens 7/8; DF-09; Art. 14º), base do histórico preservado.
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO é a Missão nem contém estado/Verdade da Missão (INV-PR-02; item 13; Art. 7º);
//   • NÃO decide juridicamente (item 16; DF-09 — decisão é do advogado humano);
//   • NÃO modela "fase" (referente = Etapa/Estado Operacional, Entidades 08/09
//     posteriores; item 22 não autoriza) — omitida para não antecipar entidade futura;
//   • NÃO contém workflow, rito processual nem processamento;
//   • NÃO implementa comportamento de MISSÃO, CASO, EVENTO ou ADVOGADO — só os
//     referencia por identidade;
//   • NÃO obriga a Missão a possuir Processo (INV-PR-03 é cross-entity).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { ProcessId } from './process-id.js';
import type { ProcessMissionRef, ProcessCaseRef, ProcessResponsibleRef } from './refs.js';
import { ProcessLegalFoundation } from './value-objects.js';
import { ProcessRecognized } from './process-events.js';

/** Entrada de reconhecimento do Processo (Entidade 06; itens 7/11/14; DF-01; DF-10). */
export interface ProcessRecognitionInput {
  readonly id: ProcessId;
  readonly mission: ProcessMissionRef; // exatamente uma (INV-PR-01; DF-10)
  readonly legalFoundation: string; // fundamento jurídico (itens 11/19; DF-01)
  readonly derivesFromCase?: ProcessCaseRef; // OPCIONAL — decorre de Caso (itens 14/18)
  readonly recognizedAt: Date; // momento do reconhecimento (Art. 14º)
  readonly recognizedBy: ProcessResponsibleRef; // responsável autorizado (DF-09; DF-12; Art. 14º)
}

interface ProcessProps {
  readonly id: ProcessId;
  readonly mission: ProcessMissionRef;
  readonly legalFoundation: ProcessLegalFoundation;
  readonly derivesFromCase: ProcessCaseRef | null;
  readonly recognizedAt: Date;
  readonly recognizedBy: ProcessResponsibleRef;
}

const CANON_REF = 'Entidade 06 — PROCESSO';
const TRACE_ID = 'PROCESSO-RASTREABILIDADE';
const TRACE_REF = 'DF-09; Art. 14º; DF-12 (responsável autorizado)';

export class ProcessAggregate extends AggregateRoot<ProcessId> {
  private constructor(private readonly props: ProcessProps) {
    super(props.id);
  }

  /** Reconhece oficialmente um Processo dentro de sua Missão (Lei do Reconhecimento). */
  static recognize(input: ProcessRecognitionInput): Result<ProcessAggregate, CanonViolationError> {
    // INV-PR-01 — pertence a exatamente uma Missão (jamais existe sem pertencer a uma).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-PR-01',
          canonReference: `${CANON_REF}; INV-PR-01; DF-10`,
          message: 'O Processo deve pertencer a uma Missão (INV-PR-01; não existe Processo fora de Missão).',
        }),
      );
    }
    // Rastreabilidade do reconhecimento — responsável e momento (DF-09; Art. 14º).
    if (input.recognizedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Reconhecimento de Processo sem responsável autorizado identificado (DF-09; Art. 14º).',
        }),
      );
    }
    if (!(input.recognizedAt instanceof Date) || Number.isNaN(input.recognizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Reconhecimento de Processo sem momento válido (Art. 14º).',
        }),
      );
    }
    // Boa-constituição (item 19) + DF-01 — fundamento jurídico presente.
    const legalFoundation = ProcessLegalFoundation.create(input.legalFoundation);
    if (legalFoundation.isErr()) {
      return Result.err(legalFoundation.unwrapErr());
    }

    const process = new ProcessAggregate({
      id: input.id,
      mission: input.mission,
      legalFoundation: legalFoundation.unwrap(),
      derivesFromCase: input.derivesFromCase ?? null,
      recognizedAt: new Date(input.recognizedAt.getTime()),
      recognizedBy: input.recognizedBy,
    });

    process.addDomainEvent(new ProcessRecognized(input.id.toString(), process.props.recognizedAt));
    return Result.ok(process);
  }

  // Acessores imutáveis. Nenhum método de alteração de estado, síntese de Verdade,
  // decisão jurídica, rito ou workflow (INV-PR-02; itens 13/16; princípios do fundador).
  get mission(): ProcessMissionRef {
    return this.props.mission;
  }
  get legalFoundation(): ProcessLegalFoundation {
    return this.props.legalFoundation;
  }
  /** Caso de que o Processo decorre; null quando não informado (itens 14/18; opcional). */
  get derivesFromCase(): ProcessCaseRef | null {
    return this.props.derivesFromCase;
  }
  get recognizedAt(): Date {
    return new Date(this.props.recognizedAt.getTime());
  }
  get recognizedBy(): ProcessResponsibleRef {
    return this.props.recognizedBy;
  }
}
