// ─────────────────────────────────────────────────────────────────────────────
// Adapters in-memory do Portal do Advogado: atribuições e trabalho jurídico.
// Adapters Postgres entram pelos mesmos ports.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AssignmentStore,
  CaseAssignment,
  CredencialPortal,
  CredenciaisStore,
  JuridicalEntry,
  JuridicalWorkStore,
} from '@reconstrua/application';

export class InMemoryAssignmentStore implements AssignmentStore {
  private readonly byMissionId = new Map<string, CaseAssignment>();

  save(assignment: CaseAssignment): Promise<void> {
    this.byMissionId.set(assignment.missionId, assignment);
    return Promise.resolve();
  }
  byMission(missionId: string): Promise<CaseAssignment | null> {
    return Promise.resolve(this.byMissionId.get(missionId) ?? null);
  }
  byAdvogado(advogadoId: string): Promise<readonly CaseAssignment[]> {
    return Promise.resolve(
      [...this.byMissionId.values()].filter((a) => a.advogadoId === advogadoId),
    );
  }
}

/** GO-LIVE-04: credenciais individuais (Auth Runtime compartilhado). */
export class InMemoryCredenciaisStore implements CredenciaisStore {
  private readonly byId = new Map<string, CredencialPortal>();

  save(credencial: CredencialPortal): Promise<void> {
    this.byId.set(credencial.sujeitoId, credencial);
    return Promise.resolve();
  }
  load(sujeitoId: string): Promise<CredencialPortal | null> {
    return Promise.resolve(this.byId.get(sujeitoId) ?? null);
  }
}

export class InMemoryJuridicalWorkStore implements JuridicalWorkStore {
  private readonly entries = new Map<string, JuridicalEntry>();

  save(entry: JuridicalEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }
  byId(id: string): Promise<JuridicalEntry | null> {
    return Promise.resolve(this.entries.get(id) ?? null);
  }
  byAdvogado(advogadoId: string): Promise<readonly JuridicalEntry[]> {
    return Promise.resolve([...this.entries.values()].filter((e) => e.advogadoId === advogadoId));
  }
  byMission(missionId: string): Promise<readonly JuridicalEntry[]> {
    return Promise.resolve([...this.entries.values()].filter((e) => e.missionId === missionId));
  }
}
