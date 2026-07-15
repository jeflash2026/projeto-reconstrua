// ─────────────────────────────────────────────────────────────────────────────
// Adapters in-memory do Lawyer Experience: cursor, decisões e produtividade.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  CursorStore,
  DecisionRequest,
  DecisionStore,
  LawyerDecisionType,
  LawyerCursor,
  ProductivityEvent,
  ProductivityStore,
} from '@reconstrua/application';

export class InMemoryCursorStore implements CursorStore {
  private readonly cursors = new Map<string, LawyerCursor>();
  load(advogadoId: string): Promise<LawyerCursor | null> {
    return Promise.resolve(this.cursors.get(advogadoId) ?? null);
  }
  save(cursor: LawyerCursor): Promise<void> {
    this.cursors.set(cursor.advogadoId, cursor);
    return Promise.resolve();
  }
}

export class InMemoryDecisionStore implements DecisionStore {
  private readonly decisions = new Map<string, DecisionRequest>();
  save(decision: DecisionRequest): Promise<void> {
    this.decisions.set(decision.id, decision);
    return Promise.resolve();
  }
  byId(id: string): Promise<DecisionRequest | null> {
    return Promise.resolve(this.decisions.get(id) ?? null);
  }
  openFor(advogadoId: string): Promise<readonly DecisionRequest[]> {
    return Promise.resolve(
      [...this.decisions.values()].filter((d) => d.advogadoId === advogadoId && d.status === 'open'),
    );
  }
  byMissionAndType(missionId: string, type: LawyerDecisionType): Promise<DecisionRequest | null> {
    return Promise.resolve(
      [...this.decisions.values()].find((d) => d.missionId === missionId && d.type === type && d.status === 'open') ??
        null,
    );
  }
}

export class InMemoryProductivityStore implements ProductivityStore {
  private readonly events: ProductivityEvent[] = [];
  record(event: ProductivityEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
  byAdvogado(advogadoId: string): Promise<readonly ProductivityEvent[]> {
    return Promise.resolve(this.events.filter((e) => e.advogadoId === advogadoId));
  }
}
