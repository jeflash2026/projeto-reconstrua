// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS (Canon DF-18). O Evento conhece a Missão a que se vincula,
// o Fato que o fundamenta (quando Relevante) e o responsável pelo reconhecimento
// APENAS por identidade — sem implementar essas entidades/conceitos. Nomes com
// prefixo "Event" para não colidir com refs de outras entidades no barrel.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** Missão à qual o Evento se vincula — exatamente uma (Canon: Lei 2; INV-EV-04). */
export class EventMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): EventMissionRef {
    return new EventMissionRef(id);
  }
  static fromString(id: string): EventMissionRef {
    return new EventMissionRef(toUuid(id));
  }
  equals(other?: EventMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** Fato reconhecido que fundamenta um Evento Relevante (Canon: E11; E12-L09; INV-EV-03). */
export class FactRef {
  private constructor(public readonly factId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): FactRef {
    return new FactRef(id);
  }
  static fromString(id: string): FactRef {
    return new FactRef(toUuid(id));
  }
  equals(other?: FactRef | null): boolean {
    return other != null && this.factId === other.factId;
  }
}

/** Responsável pela efetivação do reconhecimento do Evento (Canon: R4; Art. 14º). */
export class EventRecognitionResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): EventRecognitionResponsibleRef {
    return new EventRecognitionResponsibleRef(id);
  }
  static fromString(id: string): EventRecognitionResponsibleRef {
    return new EventRecognitionResponsibleRef(toUuid(id));
  }
  equals(other?: EventRecognitionResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
