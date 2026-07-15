// ─────────────────────────────────────────────────────────────────────────────
// Value Objects estritamente necessários ao reconhecimento da Pessoa.
// Canon: DF-23 (seis elementos obrigatórios) — "Nenhuma Pessoa é reconhecida de
// forma incompleta" → INV-P14. Um elemento vazio equivale a elemento ausente.
//
// IMPORTANTE: a SUFICIÊNCIA da identidade civil e a AUTORIZAÇÃO da origem NÃO são
// validadas aqui — pertencem ao caso de uso de Reconhecimento (R2) e à Governança
// (DF-12). Aqui garante-se apenas a PRESENÇA do elemento (INV-P14).
// ─────────────────────────────────────────────────────────────────────────────
import { ValueObject } from '../kernel/value-object.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';

const CANON_REF = 'Entidade 02 — PESSOA; DF-23 (seis elementos obrigatórios); INV-P14';

/**
 * Identidade civil (Canon: elemento de reconhecimento 2, DF-23).
 * Representação opaca; sua estrutura interna e a "suficiência" (DF-23) são do R2.
 * INV-P08: esta representação jamais altera/constitui a identidade civil real.
 */
export class CivilIdentity extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<CivilIdentity, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-P14',
          canonReference: CANON_REF,
          message: 'Identidade civil ausente: a Pessoa não pode ser reconhecida de forma incompleta (DF-23).',
        }),
      );
    }
    return Result.ok(new CivilIdentity(trimmed));
  }
}

/**
 * Origem do reconhecimento (Canon: elemento 3, DF-23).
 * As origens da DF-23 estão em KNOWN_RECOGNITION_ORIGINS apenas como REFERÊNCIA;
 * a lista NÃO é fechada ("outra origem oficialmente aprovada" — DF-23) e a
 * autorização de origens pertence ao R2/Governança. Aqui só se exige presença.
 */
export class RecognitionOrigin extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }
  get value(): string {
    return this.props.value;
  }
  static create(raw: string): Result<RecognitionOrigin, CanonViolationError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.err(
        new CanonViolationError({
          invariantId: 'INV-P14',
          canonReference: CANON_REF,
          message: 'Origem do reconhecimento ausente (DF-23).',
        }),
      );
    }
    return Result.ok(new RecognitionOrigin(trimmed));
  }
}

/** Referência das origens enumeradas na DF-23 (lista NÃO fechada; sem enforcement aqui). */
export const KNOWN_RECOGNITION_ORIGINS: ReadonlyArray<string> = [
  'atendimento_humano',
  'portal_do_cliente',
  'convite_enviado',
  'whatsapp',
  'importacao_autorizada',
  'integracao_oficial',
  'ahri',
  'outra_origem_oficialmente_aprovada',
];
