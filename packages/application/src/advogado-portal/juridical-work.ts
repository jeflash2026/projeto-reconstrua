// ─────────────────────────────────────────────────────────────────────────────
// TRABALHO JURÍDICO — o registro das ATIVIDADES do advogado (número do processo,
// protocolo, despacho, movimentação, observações, prazos, distribuição, conclusão,
// documentos jurídicos) e a ATRIBUIÇÃO de processos pelo Administrador.
//
// Fronteira honesta: isto é REGISTRO DE TRABALHO operacional (como o StaffDirectory
// 3A) — NÃO é Verdade Operacional, NÃO altera Estado/Etapa. O advogado nunca muta
// domínio por aqui; consequências de domínio fluem pelos Use Cases existentes,
// decididas pelo Executive Brain (ver AdvogadoAhriBridge). Isolamento: toda escrita
// e leitura é validada contra a atribuição do advogado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';

export type JuridicalEntryKind =
  | 'numero_processo'
  | 'protocolo'
  | 'despacho'
  | 'movimentacao'
  | 'observacao'
  | 'prazo'
  | 'distribuicao'
  | 'conclusao'
  | 'documento';

/** Atividades cujo teor interessa ao CLIENTE (a AHRI avalia comunicar). */
export const CLIENT_FACING_KINDS: readonly JuridicalEntryKind[] = [
  'protocolo',
  'despacho',
  'movimentacao',
  'distribuicao',
  'conclusao',
];

export interface JuridicalEntry {
  readonly id: string;
  readonly advogadoId: string;
  readonly missionId: string;
  readonly kind: JuridicalEntryKind;
  readonly text: string;
  readonly dueAt: Date | null; // para 'prazo'
  readonly attachmentRef: string | null; // para 'documento'
  readonly done: boolean; // pendência resolvida?
  readonly createdAt: Date;
}

export interface CaseAssignment {
  readonly missionId: string;
  readonly advogadoId: string;
  readonly assignedBy: string; // administrador
  readonly assignedAt: Date;
}

export interface AssignmentStore {
  save(assignment: CaseAssignment): Promise<void>;
  byMission(missionId: string): Promise<CaseAssignment | null>;
  byAdvogado(advogadoId: string): Promise<readonly CaseAssignment[]>;
}

export interface JuridicalWorkStore {
  save(entry: JuridicalEntry): Promise<void>;
  byId(id: string): Promise<JuridicalEntry | null>;
  byAdvogado(advogadoId: string): Promise<readonly JuridicalEntry[]>;
  byMission(missionId: string): Promise<readonly JuridicalEntry[]>;
}

export class NotAssignedError extends Error {
  constructor(advogadoId: string, missionId: string) {
    super(`processo ${missionId} não está atribuído ao advogado ${advogadoId}`);
    this.name = 'NotAssignedError';
  }
}

export interface NewEntryInput {
  readonly advogadoId: string;
  readonly missionId: string;
  readonly kind: JuridicalEntryKind;
  readonly text: string;
  readonly dueAt?: Date | null;
  readonly attachmentRef?: string | null;
}

export class AdvogadoWorkRuntime {
  constructor(
    private readonly assignments: AssignmentStore,
    private readonly work: JuridicalWorkStore,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  // ── Atribuição (ato do Administrador) ───────────────────────────────────────
  async assign(missionId: string, advogadoId: string, assignedBy: string): Promise<CaseAssignment> {
    const assignment: CaseAssignment = { missionId, advogadoId, assignedBy, assignedAt: this.clock.now() };
    await this.assignments.save(assignment);
    return assignment;
  }

  /** ISOLAMENTO: o advogado só enxerga o que lhe foi atribuído. */
  async isAssigned(advogadoId: string, missionId: string): Promise<boolean> {
    const assignment = await this.assignments.byMission(missionId);
    return assignment !== null && assignment.advogadoId === advogadoId;
  }

  async myMissions(advogadoId: string): Promise<readonly CaseAssignment[]> {
    return this.assignments.byAdvogado(advogadoId);
  }

  // ── Atividades do advogado ──────────────────────────────────────────────────
  async addEntry(input: NewEntryInput): Promise<JuridicalEntry> {
    if (!(await this.isAssigned(input.advogadoId, input.missionId))) {
      throw new NotAssignedError(input.advogadoId, input.missionId);
    }
    if (input.text.trim() === '') throw new Error('texto obrigatório');
    const entry: JuridicalEntry = {
      id: this.uuid.next(),
      advogadoId: input.advogadoId,
      missionId: input.missionId,
      kind: input.kind,
      text: input.text.trim(),
      dueAt: input.dueAt ?? null,
      attachmentRef: input.attachmentRef ?? null,
      done: false,
      createdAt: this.clock.now(),
    };
    await this.work.save(entry);
    return entry;
  }

  async markDone(advogadoId: string, entryId: string): Promise<JuridicalEntry> {
    const entry = await this.work.byId(entryId);
    if (!entry || entry.advogadoId !== advogadoId) {
      throw new NotAssignedError(advogadoId, entry?.missionId ?? entryId);
    }
    const updated: JuridicalEntry = { ...entry, done: true };
    await this.work.save(updated);
    return updated;
  }

  /** Entradas do advogado — SEMPRE só as dele (isolamento por construção). */
  async myEntries(advogadoId: string, kind?: JuridicalEntryKind): Promise<readonly JuridicalEntry[]> {
    const all = await this.work.byAdvogado(advogadoId);
    return kind ? all.filter((e) => e.kind === kind) : all;
  }

  /** Entradas de UMA missão, somente se atribuída ao advogado. */
  async missionEntries(advogadoId: string, missionId: string): Promise<readonly JuridicalEntry[]> {
    if (!(await this.isAssigned(advogadoId, missionId))) {
      throw new NotAssignedError(advogadoId, missionId);
    }
    return this.work.byMission(missionId);
  }

  /** Pendências: prazos e tarefas não concluídos. */
  async pending(advogadoId: string): Promise<readonly JuridicalEntry[]> {
    return (await this.work.byAdvogado(advogadoId)).filter((e) => !e.done && (e.kind === 'prazo' || e.kind === 'protocolo'));
  }

  /** Agenda: prazos com vencimento, ordenados. */
  async agenda(advogadoId: string): Promise<readonly JuridicalEntry[]> {
    return (await this.work.byAdvogado(advogadoId))
      .filter((e) => e.dueAt !== null && !e.done)
      .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  }
}
