// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS (Canon DF-18). A Pessoa registra, no reconhecimento, o
// responsável e as evidências POR IDENTIDADE, sem implementar essas entidades
// (Responsável/papéis e DOCUMENTO têm sprints próprias). Nenhum comportamento
// alheio é implementado aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** Responsável pelo reconhecimento (Canon: elemento 5, DF-23; R2/CA-06 — quem efetiva). */
export class RecognitionResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): RecognitionResponsibleRef {
    return new RecognitionResponsibleRef(id);
  }
  static fromString(id: string): RecognitionResponsibleRef {
    return new RecognitionResponsibleRef(toUuid(id));
  }
  equals(other?: RecognitionResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}

/** Evidência utilizada no reconhecimento (Canon: elemento 6, DF-23; referência a DOCUMENTO — Entidade 03). */
export class EvidenceRef {
  private constructor(public readonly evidenceId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): EvidenceRef {
    return new EvidenceRef(id);
  }
  static fromString(id: string): EvidenceRef {
    return new EvidenceRef(toUuid(id));
  }
  equals(other?: EvidenceRef | null): boolean {
    return other != null && this.evidenceId === other.evidenceId;
  }
}
