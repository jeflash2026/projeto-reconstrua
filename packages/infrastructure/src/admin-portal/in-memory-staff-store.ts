// ─────────────────────────────────────────────────────────────────────────────
// InMemoryStaffStore — adapter do diretório operacional da equipe. Adapter Postgres
// entra pelo mesmo port sem tocar o runtime.
// ─────────────────────────────────────────────────────────────────────────────
import type { StaffMember, StaffRole, StaffStore } from '@reconstrua/application';

export class InMemoryStaffStore implements StaffStore {
  private readonly members = new Map<string, StaffMember>();

  save(member: StaffMember): Promise<void> {
    this.members.set(member.id, member);
    return Promise.resolve();
  }
  byId(id: string): Promise<StaffMember | null> {
    return Promise.resolve(this.members.get(id) ?? null);
  }
  byRole(role: StaffRole): Promise<readonly StaffMember[]> {
    return Promise.resolve([...this.members.values()].filter((m) => m.role === role));
  }
  all(): Promise<readonly StaffMember[]> {
    return Promise.resolve([...this.members.values()]);
  }
  byCpf(cpf: string): Promise<StaffMember | null> {
    return Promise.resolve([...this.members.values()].find((m) => (m.cpf ?? null) === cpf) ?? null);
  }
}
