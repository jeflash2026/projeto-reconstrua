// ─────────────────────────────────────────────────────────────────────────────
// DECISION STATE READ MODEL (RFC-0035-G) — o Read Model de DECISÃO, por missão,
// que respalda a fronteira `MissionSnapshotPort`. É irmão de AdminProjection e
// Workflow: um fold do log de eventos, NUNCA leitura de outra projeção/memória.
//
// Guarda EXCLUSIVAMENTE o que os produtores atuais conseguem fornecer (RFC-0035-H):
// hoje, apenas `truthEstablished` (existência de `operational-truth.synthesized`).
// Campos sem produtor NÃO entram aqui — o adapter os deixa no default de
// `emptySnapshot`, sem heurística e sem valor inventado. Novos campos entram neste
// registro quando (e só quando) seus produtores existirem.
//
// Reutiliza production.documents (JsonStore) via namespace próprio; nenhum runtime muda.
// ─────────────────────────────────────────────────────────────────────────────
import { reviveDates, type JsonStore } from '../production/json-store.js';

/** Estado de decisão projetado por missão. Somente campos com produtor real hoje. */
export interface DecisionStateRecord {
  readonly missionId: string;
  /** 🟢 A Verdade Operacional já foi sintetizada ao menos uma vez para esta missão. */
  readonly truthEstablished: boolean;
  /** 🟢 B4.1 — Estado terminal oficial quando encerrado (`'ENCERRADA'`); `null`/ausente
   *  enquanto em curso. Produtor: `operational-state.derived` com `terminalState`
   *  (CloseMission). Sticky: uma derivação normal não o limpa; a REABERTURA (B4.3) o fará. */
  readonly terminalState?: 'ENCERRADA' | null;
  /** Momento do evento que atualizou este registro pela última vez. */
  readonly updatedAt: Date;
}

export interface DecisionStateStore {
  load(missionId: string): Promise<DecisionStateRecord | null>;
  save(record: DecisionStateRecord): Promise<void>;
  /** Todos os registros de decisão (para métricas operacionais; B4.4, somente leitura). */
  all(): Promise<readonly DecisionStateRecord[]>;
}

const NAMESPACE = 'decision-state';

/** Persistência REAL sobre JsonStore (Postgres em produção; in-memory em dev/test). */
export class JsonDecisionStateStore implements DecisionStateStore {
  constructor(private readonly store: JsonStore) {}

  async load(missionId: string): Promise<DecisionStateRecord | null> {
    const raw = await this.store.get(NAMESPACE, missionId);
    return raw ? reviveDates<DecisionStateRecord>(raw, ['updatedAt']) : null;
  }

  save(record: DecisionStateRecord): Promise<void> {
    return this.store.put(NAMESPACE, record.missionId, record);
  }

  async all(): Promise<readonly DecisionStateRecord[]> {
    const raws = await this.store.list(NAMESPACE);
    return raws.map((raw) => reviveDates<DecisionStateRecord>(raw, ['updatedAt']));
  }
}

/** Variante determinística para testes e modo local. */
export class InMemoryDecisionStateStore implements DecisionStateStore {
  private readonly records = new Map<string, DecisionStateRecord>();

  load(missionId: string): Promise<DecisionStateRecord | null> {
    return Promise.resolve(this.records.get(missionId) ?? null);
  }

  save(record: DecisionStateRecord): Promise<void> {
    this.records.set(record.missionId, record);
    return Promise.resolve();
  }

  all(): Promise<readonly DecisionStateRecord[]> {
    return Promise.resolve([...this.records.values()]);
  }
}
