// ─────────────────────────────────────────────────────────────────────────────
// DocumentAggregate — agregado da Entidade 03 (DOCUMENTO). Deriva EXCLUSIVAMENTE
// do Livro Mestre. (Nome com sufixo "Aggregate" para não colidir com o tipo
// global `Document` do DOM.)
//
// O que esta entidade FAZ (e só isto):
//   • RECONHECE (nunca cria) um Documento preexistente — fábrica `recognize`,
//     emite DocumentRecognized (INV-D01; Lei do Reconhecimento);
//   • garante os efeitos do reconhecimento: origem (INV-D02), individualização +
//     incorporação a ≥1 Missão (INV-D08), conteúdo preservado (INV-D10);
//   • guarda esses elementos de forma imutável (INV-D10: conteúdo jamais alterado).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO valida/aprova/atesta veracidade (INV-D06) — não há tal método/flag;
//   • NÃO possui "valor jurídico" (INV-D07) — não há tal campo;
//   • NÃO é decisão/estado/conclusão (INV-D04) — sem estado, sem verdade;
//   • NÃO muda a Realidade nem o Estado Operacional (INV-D09) — sem qualquer efeito;
//   • NÃO classifica nem interpreta (proibição do fundador) — sem classificação;
//   • NÃO faz OCR/parse/upload/armazenamento — o conteúdo é referência opaca;
//   • NÃO conhece Pessoa/Processo/Caso; só referencia Missão (incorporação) e o
//     responsável pelo reconhecimento — únicas referências previstas aqui (DF-18);
//   • NÃO compartilha entre missões por si (INV-D05 é caso de uso/Regra Operacional).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { DocumentId } from './document-id.js';
import type { MissionRef, DocumentRecognitionResponsibleRef } from './refs.js';
import { DocumentOrigin, ContentReference } from './value-objects.js';
import { DocumentRecognized } from './document-events.js';

/** Entrada de reconhecimento do Documento (efeitos da Entidade 03). */
export interface DocumentRecognitionInput {
  readonly id: DocumentId; // individualização (INV-D13)
  readonly originText: string; // origem (INV-D02)
  readonly incorporatedInto: ReadonlyArray<MissionRef>; // incorporação a ≥1 Missão (INV-D08)
  readonly contentReferenceText: string; // conteúdo probatório preservado (INV-D10)
  readonly recognizedAt: Date; // momento do reconhecimento (INV-D03)
  readonly recognizedBy: DocumentRecognitionResponsibleRef; // responsável (INV-D03)
}

interface DocumentProps {
  readonly id: DocumentId;
  readonly origin: DocumentOrigin;
  readonly incorporatedInto: ReadonlyArray<MissionRef>;
  readonly content: ContentReference;
  readonly recognizedAt: Date;
  readonly recognizedBy: DocumentRecognitionResponsibleRef;
}

const CANON_REF = 'Entidade 03 — DOCUMENTO';

export class DocumentAggregate extends AggregateRoot<DocumentId> {
  private constructor(private readonly props: DocumentProps) {
    super(props.id);
  }

  /**
   * Reconhece oficialmente um Documento preexistente (INV-D01; Lei do Reconhecimento).
   * Reconhecer NÃO valida nem atesta veracidade (INV-D06).
   */
  static recognize(
    input: DocumentRecognitionInput,
  ): Result<DocumentAggregate, CanonViolationError> {
    // INV-D03 — responsável pela efetivação presente.
    if (input.recognizedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-D03',
          canonReference: `${CANON_REF}; INV-D03`,
          message: 'Reconhecimento sem responsável identificado (INV-D03).',
        }),
      );
    }
    // INV-D03 — momento válido.
    if (!(input.recognizedAt instanceof Date) || Number.isNaN(input.recognizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-D03',
          canonReference: `${CANON_REF}; INV-D03`,
          message: 'Reconhecimento sem momento válido (INV-D03).',
        }),
      );
    }
    // INV-D08 — incorporação a pelo menos uma Missão.
    if (input.incorporatedInto == null || input.incorporatedInto.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-D08',
          canonReference: `${CANON_REF}; INV-D08`,
          message: 'Documento reconhecido deve ser incorporado a ao menos uma Missão (INV-D08).',
        }),
      );
    }
    // INV-D10 — conteúdo probatório preservado.
    const content = ContentReference.create(input.contentReferenceText);
    if (content.isErr()) {
      return Result.err(content.unwrapErr());
    }
    // INV-D02 — origem registrada.
    const origin = DocumentOrigin.create(input.originText);
    if (origin.isErr()) {
      return Result.err(origin.unwrapErr());
    }

    const document = new DocumentAggregate({
      id: input.id,
      origin: origin.unwrap(),
      incorporatedInto: Object.freeze([...input.incorporatedInto]),
      content: content.unwrap(),
      recognizedAt: new Date(input.recognizedAt.getTime()),
      recognizedBy: input.recognizedBy,
    });

    document.addDomainEvent(
      new DocumentRecognized(input.id.toString(), document.props.recognizedAt),
    );
    return Result.ok(document);
  }

  // Acessores imutáveis. Nenhum acessor/método de validação, veracidade, valor
  // jurídico, estado, decisão, conclusão ou classificação (INV-D04/D06/D07).
  get origin(): DocumentOrigin {
    return this.props.origin;
  }
  get incorporatedInto(): ReadonlyArray<MissionRef> {
    return this.props.incorporatedInto;
  }
  get content(): ContentReference {
    return this.props.content;
  }
  get recognizedAt(): Date {
    return new Date(this.props.recognizedAt.getTime());
  }
  get recognizedBy(): DocumentRecognitionResponsibleRef {
    return this.props.recognizedBy;
  }
}
