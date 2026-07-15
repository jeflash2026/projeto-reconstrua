// ─────────────────────────────────────────────────────────────────────────────
// CaseAggregate — agregado da Entidade 05 (CASO). Deriva EXCLUSIVAMENTE do Livro
// Mestre (Entidade 05; DF-01; DF-08; DF-12; DF-24; Art. 7º; Art. 14º; Lei 3).
//
// O que esta entidade FAZ (e só isto):
//   • RECONHECE (nunca inventa) um Caso dentro de uma Missão existente — fábrica
//     `recognize`, emite CaseRecognized (princípio "Caso é reconhecido, nunca
//     inventado"; itens 7/11);
//   • vincula o Caso a exatamente uma Missão (INV-CA-01; DF-08);
//   • preserva o enquadramento jurídico: contexto jurídico + fundamento jurídico
//     (itens 3/14/19; DF-01) — de forma imutável;
//   • registra a rastreabilidade do reconhecimento: responsável + momento
//     (itens 7/8; DF-12; Art. 14º), base do histórico preservado (INV-CA-03).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO é Processo nem contém Processo (INV-CA-02; Art. 7º) — nenhum atributo/método;
//   • NÃO contém estado operacional nem Verdade Operacional (item 13; Lei 2) — sem estado;
//   • NÃO decide (item 16; DF-09) — a decisão jurídica é do advogado;
//   • NÃO contém workflow nem processamento;
//   • NÃO conhece Pessoa/Documento/Evento/Processo além das referências previstas;
//     só referencia a Missão (INV-CA-01) e o responsável (Art. 14º) por identidade.
//   • NÃO possui a Missão/Pessoa/Verdade/Estado (item 13) — só as referencia.
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { CaseId } from './case-id.js';
import type { CaseMissionRef, CaseResponsibleRef } from './refs.js';
import { LegalContext, LegalFoundation } from './value-objects.js';
import { CaseRecognized } from './case-events.js';

/** Entrada de reconhecimento do Caso (Entidade 05; itens 3/7/11/14; DF-01; DF-08). */
export interface CaseRecognitionInput {
  readonly id: CaseId;
  readonly mission: CaseMissionRef; // exatamente uma (INV-CA-01; DF-08)
  readonly legalContext: string; // contexto jurídico (itens 3/14/19)
  readonly legalFoundation: string; // fundamento jurídico (item 14; DF-01)
  readonly recognizedAt: Date; // momento do reconhecimento (Art. 14º)
  readonly recognizedBy: CaseResponsibleRef; // responsável autorizado (DF-12; Art. 14º)
}

interface CaseProps {
  readonly id: CaseId;
  readonly mission: CaseMissionRef;
  readonly legalContext: LegalContext;
  readonly legalFoundation: LegalFoundation;
  readonly recognizedAt: Date;
  readonly recognizedBy: CaseResponsibleRef;
}

const CANON_REF = 'Entidade 05 — CASO';
const TRACE_ID = 'CASO-RASTREABILIDADE';
const TRACE_REF = 'Lei 3; Art. 14º; DF-12 (responsável autorizado)';

export class CaseAggregate extends AggregateRoot<CaseId> {
  private constructor(private readonly props: CaseProps) {
    super(props.id);
  }

  /** Reconhece oficialmente um Caso dentro de sua Missão (princípio: reconhecido, nunca inventado). */
  static recognize(input: CaseRecognitionInput): Result<CaseAggregate, CanonViolationError> {
    // INV-CA-01 — pertence a exatamente uma Missão (presença; não existe Caso fora de Missão).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-CA-01',
          canonReference: `${CANON_REF}; INV-CA-01; DF-08`,
          message: 'O Caso deve pertencer a exatamente uma Missão (INV-CA-01; não existe Caso fora de Missão).',
        }),
      );
    }
    // Rastreabilidade do reconhecimento — responsável e momento (Art. 14º; DF-12).
    if (input.recognizedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Reconhecimento de Caso sem responsável autorizado identificado (DF-12; Art. 14º).',
        }),
      );
    }
    if (!(input.recognizedAt instanceof Date) || Number.isNaN(input.recognizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Reconhecimento de Caso sem momento válido (Art. 14º).',
        }),
      );
    }
    // Boa-formação (item 19) — contexto jurídico presente.
    const legalContext = LegalContext.create(input.legalContext);
    if (legalContext.isErr()) {
      return Result.err(legalContext.unwrapErr());
    }
    // Boa-formação (item 19) + DF-01 — fundamento jurídico presente.
    const legalFoundation = LegalFoundation.create(input.legalFoundation);
    if (legalFoundation.isErr()) {
      return Result.err(legalFoundation.unwrapErr());
    }

    const legalCase = new CaseAggregate({
      id: input.id,
      mission: input.mission,
      legalContext: legalContext.unwrap(),
      legalFoundation: legalFoundation.unwrap(),
      recognizedAt: new Date(input.recognizedAt.getTime()),
      recognizedBy: input.recognizedBy,
    });

    legalCase.addDomainEvent(new CaseRecognized(input.id.toString(), legalCase.props.recognizedAt));
    return Result.ok(legalCase);
  }

  // Acessores imutáveis. Nenhum método de alteração de estado, síntese de Verdade,
  // decisão, processo ou workflow (INV-CA-02; item 13/16; princípios do fundador).
  get mission(): CaseMissionRef {
    return this.props.mission;
  }
  get legalContext(): LegalContext {
    return this.props.legalContext;
  }
  get legalFoundation(): LegalFoundation {
    return this.props.legalFoundation;
  }
  get recognizedAt(): Date {
    return new Date(this.props.recognizedAt.getTime());
  }
  get recognizedBy(): CaseResponsibleRef {
    return this.props.recognizedBy;
  }
}
