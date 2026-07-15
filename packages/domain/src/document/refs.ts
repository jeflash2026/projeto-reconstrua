// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS (Canon DF-18). O Documento conhece a(s) Missão(ões) a que
// é incorporado e o responsável pelo reconhecimento APENAS por identidade — sem
// implementar essas entidades (o Documento "não conhece Missão além das
// referências previstas pelo Canon"). Nenhum comportamento alheio aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** Referência à Missão à qual o Documento é incorporado (Canon: Entidade 03 — Reconhecimento; INV-D08; Lei 2). */
export class MissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): MissionRef {
    return new MissionRef(id);
  }
  static fromString(id: string): MissionRef {
    return new MissionRef(toUuid(id));
  }
  equals(other?: MissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** Responsável pela efetivação do reconhecimento (Canon: Entidade 03, seção 7; INV-D03). */
export class DocumentRecognitionResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): DocumentRecognitionResponsibleRef {
    return new DocumentRecognitionResponsibleRef(id);
  }
  static fromString(id: string): DocumentRecognitionResponsibleRef {
    return new DocumentRecognitionResponsibleRef(toUuid(id));
  }
  equals(other?: DocumentRecognitionResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
