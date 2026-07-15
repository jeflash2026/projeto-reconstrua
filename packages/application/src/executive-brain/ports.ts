// ─────────────────────────────────────────────────────────────────────────────
// PORTS do Executive Brain. O Brain LÊ projeções e o catálogo de regras por estes
// ports (adapters na infraestrutura). Não há port de ESCRITA de domínio: o Brain
// decide, não muta. (Ele emite UseCaseIntent; a EXECUTAÇÃO do caso de uso é de
// outro runtime, por fábrica congelada — item 6 da ADR-0002A.)
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionSnapshot } from './mission-snapshot.js';
import type { OperationalRuleSpec } from './rule.js';

/** Lê o snapshot (Read Model) de Verdade/Estado/Etapa de uma missão. */
export interface MissionSnapshotPort {
  load(missionId: string): Promise<MissionSnapshot | null>;
}

/** Serve o catálogo de Regras Operacionais vigentes (Read Model de ROs). */
export interface RuleCatalogPort {
  all(): Promise<readonly OperationalRuleSpec[]>;
}

/** Resolve a missão a partir da conversa (chatId → missionId). */
export interface MissionResolverPort {
  resolve(chatId: string): Promise<string>;
}
