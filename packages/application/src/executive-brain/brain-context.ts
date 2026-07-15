// ─────────────────────────────────────────────────────────────────────────────
// BRAIN CONTEXT — a entrada COMPLETA de uma decisão. O Brain recebe (spec 2C):
// Percepts, Memória, Estado, Etapa, Verdade, Contexto e Regras Operacionais.
// Tudo já em forma de LEITURA estruturada (nenhum agregado de domínio, nenhum texto).
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainMemoryView, PerceptView } from './facts.js';
import type { MissionSnapshot } from './mission-snapshot.js';
import type { OperationalRuleSpec } from './rule.js';

export interface BrainContext {
  /** Percepção estruturada (sem texto). */
  readonly percept: PerceptView;
  /** Verdade/Estado/Etapa/pendências/prazos (Read Model). */
  readonly snapshot: MissionSnapshot;
  /** Memória/relacionamento (contexto de leitura). */
  readonly memory: BrainMemoryView;
  /** Regras Operacionais vigentes. */
  readonly rules: readonly OperationalRuleSpec[];
  readonly chatId: string | null;
  readonly now: Date;
}
