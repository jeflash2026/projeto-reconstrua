// ─────────────────────────────────────────────────────────────────────────────
// STAFF DIRECTORY — diretório OPERACIONAL da equipe (Advogados, Peritos, Operadores,
// Supervisores): cadastrar, editar, ativar, desativar, e a visão de CARGA (fila de
// handoffs por papel + processos dos read models).
//
// Fronteira honesta: isto é CONFIGURAÇÃO OPERACIONAL (como o catálogo de ROs) — NÃO
// é verdade de domínio. A designação constitucional (advogado.designated etc.)
// permanece exclusiva do domínio congelado, via Use Case futuro. Nada aqui decide
// nem muta domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { HumanRole } from '../executive-brain/index.js';
import type { HumanHandoffRuntime } from '../go-live/index.js';

export type StaffRole = Exclude<HumanRole, 'administrador'> | 'administrador';

export interface StaffMember {
  readonly id: string;
  readonly role: StaffRole;
  readonly name: string;
  readonly email: string | null;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StaffStore {
  save(member: StaffMember): Promise<void>;
  byId(id: string): Promise<StaffMember | null>;
  byRole(role: StaffRole): Promise<readonly StaffMember[]>;
  all(): Promise<readonly StaffMember[]>;
}

export interface StaffWorkload {
  readonly role: StaffRole;
  readonly activeMembers: number;
  readonly inactiveMembers: number;
  /** Fila: handoffs abertos aguardando este papel (read model 2F). */
  readonly openHandoffs: number;
  /** Carga média: fila ÷ membros ativos (null sem membros). */
  readonly avgQueuePerMember: number | null;
}

/** GO-LIVE-05 — sinaliza tentativa de bootstrap com o sistema já inicializado. */
export class AlreadyBootstrappedError extends Error {
  constructor() {
    super('sistema já inicializado — o bootstrap do administrador não se repete');
    this.name = 'AlreadyBootstrappedError';
  }
}

export class StaffDirectoryRuntime {
  constructor(
    private readonly store: StaffStore,
    private readonly handoff: HumanHandoffRuntime,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  async register(role: StaffRole, name: string, email: string | null): Promise<StaffMember> {
    const now = this.clock.now();
    const member: StaffMember = {
      id: this.uuid.next(),
      role,
      name: name.trim(),
      email,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    if (member.name === '') throw new Error('nome obrigatório');
    await this.store.save(member);
    return member;
  }

  async update(id: string, patch: Partial<Pick<StaffMember, 'name' | 'email' | 'active'>>): Promise<StaffMember> {
    const current = await this.store.byId(id);
    if (!current) throw new Error(`membro não encontrado: ${id}`);
    const next: StaffMember = { ...current, ...patch, id: current.id, role: current.role, updatedAt: this.clock.now() };
    await this.store.save(next);
    return next;
  }

  async activate(id: string): Promise<StaffMember> {
    return this.update(id, { active: true });
  }

  async deactivate(id: string): Promise<StaffMember> {
    return this.update(id, { active: false });
  }

  async list(role: StaffRole): Promise<readonly StaffMember[]> {
    return this.store.byRole(role);
  }

  /**
   * GO-LIVE-05 — o sistema JÁ foi inicializado? Autoritativo: existe pelo menos
   * um administrador ATIVO. É a única verdade do bootstrap (nunca inferida no
   * cliente). Uma vez true, permanece true — o bootstrap não reaparece.
   */
  async isBootstrapped(): Promise<boolean> {
    return (await this.store.byRole('administrador')).some((m) => m.active);
  }

  /**
   * GO-LIVE-05 — o bootstrap do PRIMEIRO administrador: acontece UMA vez na vida
   * do sistema. Se já inicializado, recusa (nunca cria um segundo por bootstrap).
   */
  async bootstrapFirstAdmin(name: string): Promise<StaffMember> {
    if (await this.isBootstrapped()) throw new AlreadyBootstrappedError();
    return this.register('administrador', name, null);
  }

  async workload(role: StaffRole): Promise<StaffWorkload> {
    const members = await this.store.byRole(role);
    const active = members.filter((m) => m.active).length;
    const open =
      role === 'administrador' ? 0 : (await this.handoff.openFor(role)).length;
    return {
      role,
      activeMembers: active,
      inactiveMembers: members.length - active,
      openHandoffs: open,
      avgQueuePerMember: active === 0 ? null : open / active,
    };
  }
}
