// ─────────────────────────────────────────────────────────────────────────────
// CURSOR DE LEITURA — cada advogado tem um cursor persistente: último acesso,
// último evento visto (globalSeq) por missão, última missão aberta. O delta é
// SEMPRE calculado a partir do cursor — nunca recalculando tudo, nunca mostrando
// o que ele já viu.
// ─────────────────────────────────────────────────────────────────────────────

export interface LawyerCursor {
  readonly advogadoId: string;
  readonly lastAccessAt: Date | null;
  readonly lastMissionOpened: string | null;
  /** Último globalSeq visto por missão (delta por missão). */
  readonly seenByMission: Readonly<Record<string, number>>;
  readonly updatedAt: Date;
}

export interface CursorStore {
  load(advogadoId: string): Promise<LawyerCursor | null>;
  save(cursor: LawyerCursor): Promise<void>;
}

export function emptyCursor(advogadoId: string, now: Date): LawyerCursor {
  return { advogadoId, lastAccessAt: null, lastMissionOpened: null, seenByMission: {}, updatedAt: now };
}

export class CursorRuntime {
  constructor(private readonly store: CursorStore) {}

  async get(advogadoId: string, now: Date): Promise<LawyerCursor> {
    return (await this.store.load(advogadoId)) ?? emptyCursor(advogadoId, now);
  }

  /** Registra acesso (o quadro foi servido) sem marcar eventos como vistos. */
  async touchAccess(advogadoId: string, now: Date): Promise<LawyerCursor> {
    const current = await this.get(advogadoId, now);
    const next: LawyerCursor = { ...current, lastAccessAt: now, updatedAt: now };
    await this.store.save(next);
    return next;
  }

  /** Marca a missão como vista até `globalSeq` (a abertura do quadro do processo). */
  async markSeen(advogadoId: string, missionId: string, globalSeq: number, now: Date): Promise<LawyerCursor> {
    const current = await this.get(advogadoId, now);
    const previous = current.seenByMission[missionId] ?? 0;
    const next: LawyerCursor = {
      ...current,
      lastAccessAt: now,
      lastMissionOpened: missionId,
      seenByMission: { ...current.seenByMission, [missionId]: Math.max(previous, globalSeq) },
      updatedAt: now,
    };
    await this.store.save(next);
    return next;
  }

  seenUpTo(cursor: LawyerCursor, missionId: string): number {
    return cursor.seenByMission[missionId] ?? 0;
  }
}
