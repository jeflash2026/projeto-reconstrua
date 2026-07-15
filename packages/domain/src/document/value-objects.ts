// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários ao reconhecimento do Documento.
// Canon: Entidade 03 — DOCUMENTO (Reconhecimento; Origens; INV-D02; INV-D10).
//
// NADA de tecnologia: sem OCR, sem parser, sem upload, sem armazenamento. O
// conteúdo probatório é representado por uma REFERÊNCIA OPACA IMUTÁVEL — o
// Documento não lê, não interpreta e não guarda bytes.
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 03 — DOCUMENTO';

/**
 * Origem do reconhecimento (Canon: Entidade 03 — Origens; INV-D02: jamais perde a
 * origem). Lista de referência em KNOWN_DOCUMENT_ORIGINS (NÃO fechada — "outra
 * origem oficialmente reconhecida"); a autorização de origem é do R3/Governança.
 * Aqui só se exige presença.
 */
export class DocumentOrigin extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<DocumentOrigin, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-D02',
          canonReference: `${CANON_REF}; INV-D02`,
          message: 'Origem ausente: o Documento jamais é reconhecido sem origem (INV-D02).',
        }),
      );
    }
    return Result.ok(new DocumentOrigin(trimmed));
  }
}

/**
 * Referência opaca ao conteúdo probatório preservado (Canon: INV-D10 — o conteúdo
 * jamais é alterado). NÃO é o conteúdo em si: é um identificador imutável fornecido
 * externamente. O Documento não computa, não interpreta e não armazena conteúdo.
 */
export class ContentReference extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<ContentReference, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-D10',
          canonReference: `${CANON_REF}; INV-D10`,
          message: 'Referência de conteúdo ausente: não há evidência a preservar (INV-D10).',
        }),
      );
    }
    return Result.ok(new ContentReference(trimmed));
  }
}

/** Origens enumeradas na Entidade 03 (REFERÊNCIA; lista não fechada; sem enforcement). */
export const KNOWN_DOCUMENT_ORIGINS: ReadonlyArray<string> = [
  'whatsapp',
  'portal',
  'upload',
  'scanner',
  'ocr',
  'pdf',
  'imagem',
  'integracoes',
  'email',
  'atendimento_presencial',
  'importacao_autorizada',
  'outra_origem_oficialmente_reconhecida',
];
