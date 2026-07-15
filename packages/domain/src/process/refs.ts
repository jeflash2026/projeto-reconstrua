// ─────────────────────────────────────────────────────────────────────────────
// Referências NOMINAIS previstas pelo Canon (DF-18). O Processo conhece APENAS por
// identidade:
//   • a Missão a que pertence — OBRIGATÓRIA (INV-PR-01; item 11; DF-10);
//   • o Caso de que decorre — OPCIONAL (item 14 "vínculo com missão/caso";
//     item 18 "decorre de CASO"; Modelagem: "Caso pode ensejar Processos");
//   • o responsável autorizado pelo reconhecimento — advogado/responsável
//     (itens 7/8; DF-09; DF-12; Art. 14º).
//
// NÃO há referência a ESTADO/ETAPA OPERACIONAL (Entidades 08/09, posteriores — o
// item 22 não as autoriza), nem a Pessoa/Verdade/Estado (item 13). Nenhum
// comportamento de MISSÃO, CASO, EVENTO ou ADVOGADO é implementado aqui — só
// ponteiros de identidade. Nomes com prefixo "Process" para não colidir no índice
// do domínio.
// ─────────────────────────────────────────────────────────────────────────────
import { toUuid } from '../kernel/identity/uuid.js';
import type { Uuid } from '../kernel/identity/uuid.js';

/** A única Missão à qual o Processo pertence (Canon: Entidade 06, item 11; INV-PR-01; DF-10). */
export class ProcessMissionRef {
  private constructor(public readonly missionId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ProcessMissionRef {
    return new ProcessMissionRef(id);
  }
  static fromString(id: string): ProcessMissionRef {
    return new ProcessMissionRef(toUuid(id));
  }
  equals(other?: ProcessMissionRef | null): boolean {
    return other != null && this.missionId === other.missionId;
  }
}

/** O Caso de que o Processo decorre — OPCIONAL (Canon: Entidade 06, itens 14/18; Modelagem Conceitual). */
export class ProcessCaseRef {
  private constructor(public readonly caseId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ProcessCaseRef {
    return new ProcessCaseRef(id);
  }
  static fromString(id: string): ProcessCaseRef {
    return new ProcessCaseRef(toUuid(id));
  }
  equals(other?: ProcessCaseRef | null): boolean {
    return other != null && this.caseId === other.caseId;
  }
}

/** Responsável autorizado pelo reconhecimento (advogado/responsável — Canon: Entidade 06, itens 7/8; DF-09; DF-12; Art. 14º). */
export class ProcessResponsibleRef {
  private constructor(public readonly responsibleId: Uuid) {
    Object.freeze(this);
  }
  static fromUuid(id: Uuid): ProcessResponsibleRef {
    return new ProcessResponsibleRef(id);
  }
  static fromString(id: string): ProcessResponsibleRef {
    return new ProcessResponsibleRef(toUuid(id));
  }
  equals(other?: ProcessResponsibleRef | null): boolean {
    return other != null && this.responsibleId === other.responsibleId;
  }
}
