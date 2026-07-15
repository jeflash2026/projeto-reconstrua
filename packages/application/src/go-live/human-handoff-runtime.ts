// ─────────────────────────────────────────────────────────────────────────────
// HUMAN HANDOFF RUNTIME — o consumidor das intenções `escalation` do Executive
// Brain (2C). Quando o Brain decide escalar, este runtime ENCAMINHA ao papel certo
// (Operador/Perito/Advogado/Supervisor/Administrador) como TAREFA no portal.
//
// A AHRI nunca escolhe estratégia jurídica e nunca decide competência humana AQUI:
// o papel JÁ VEM DECIDIDO pelo Brain (por Regra Operacional, com proveniência).
// Este runtime apenas encaminha e rastreia. Nada mais.
// ─────────────────────────────────────────────────────────────────────────────
import type { EscalationIntentOut } from '../executive-brain/index.js';
import type { HumanRole } from '../executive-brain/index.js';

export interface HandoffTask {
  readonly id: string;
  readonly role: HumanRole;
  readonly reasonCode: string;
  readonly missionId: string;
  readonly chatId: string | null;
  readonly operationalRuleRef: string;
  readonly fundamento: string;
  readonly createdAt: Date;
  readonly status: 'open' | 'accepted' | 'resolved';
}

export interface HandoffStore {
  save(task: HandoffTask): Promise<void>;
  byId(id: string): Promise<HandoffTask | null>;
  openByRole(role: HumanRole): Promise<readonly HandoffTask[]>;
}

export class HumanHandoffRuntime {
  constructor(private readonly store: HandoffStore) {}

  /** Encaminha a escalação decidida pelo Brain (idempotente por id da intenção). */
  async consume(intent: EscalationIntentOut): Promise<HandoffTask> {
    const existing = await this.store.byId(intent.id);
    if (existing) return existing;
    const task: HandoffTask = {
      id: intent.id,
      role: intent.role,
      reasonCode: intent.reasonCode,
      missionId: intent.missionId,
      chatId: intent.chatId,
      operationalRuleRef: intent.provenance.operationalRuleRef,
      fundamento: intent.provenance.fundamento,
      createdAt: intent.formedAt,
      status: 'open',
    };
    await this.store.save(task);
    return task;
  }

  async openFor(role: HumanRole): Promise<readonly HandoffTask[]> {
    return this.store.openByRole(role);
  }

  /** Humano aceitou/resolveu (registrado; a decisão humana é do humano). */
  async markAccepted(id: string): Promise<void> {
    const task = await this.store.byId(id);
    if (task) await this.store.save({ ...task, status: 'accepted' });
  }

  async markResolved(id: string): Promise<void> {
    const task = await this.store.byId(id);
    if (task) await this.store.save({ ...task, status: 'resolved' });
  }
}
