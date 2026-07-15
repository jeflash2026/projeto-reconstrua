// ─────────────────────────────────────────────────────────────────────────────
// ADMIN METRICS — o READ MODEL administrativo (projeção somente-leitura dos eventos
// de domínio). É a ÚNICA fonte de dados do Administration Intelligence e do Founder
// Console: nada é inventado; o que não foi capturado fica explicitamente ausente
// (null / mapa vazio) — jamais um número fabricado.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReadModel } from '@reconstrua/domain';

export interface AdminMetrics extends ReadModel {
  readonly clientCount: number;
  readonly personCount: number;
  readonly missionCount: number;
  readonly caseCount: number;
  readonly processCount: number;
  readonly documentCount: number;
  /** Documentos por dia ('YYYY-MM-DD' → contagem). */
  readonly documentsByDay: Readonly<Record<string, number>>;
  readonly truthSyntheses: number;
  readonly stateDerivations: number;
  readonly stageRepresentations: number;
  readonly operationCount: number;
  readonly projectionCount: number;
  /** Marca d'água informativa (máximo globalSeq visto) — NÃO é guard de dedup. */
  readonly lastGlobalSeq: number;
  /**
   * Dedup POR STREAM (correção A1/4B): última versão aplicada de cada stream.
   * Casa com a garantia real do Dispatcher (ordem por stream) — exactly-once
   * lógico sem perda sob intercalação/reentrega.
   */
  readonly processedByStream: Readonly<Record<string, number>>;

  // ── Dados NÃO capturados no domínio congelado → explicitamente ausentes ──────
  /** Processos por advogado — vazio até existir designação de papéis. */
  readonly perAdvogado: Readonly<Record<string, number>>;
  /** Valor financeiro sob administração — null = não disponível. */
  readonly financialUnderAdministration: number | null;
  /** Atribuição por campanha — vazio até existir fonte de origem. */
  readonly campaignAttribution: Readonly<Record<string, number>>;
}

export function emptyMetrics(now: Date): AdminMetrics {
  return {
    projectedAt: now,
    clientCount: 0,
    personCount: 0,
    missionCount: 0,
    caseCount: 0,
    processCount: 0,
    documentCount: 0,
    documentsByDay: {},
    truthSyntheses: 0,
    stateDerivations: 0,
    stageRepresentations: 0,
    operationCount: 0,
    projectionCount: 0,
    lastGlobalSeq: 0,
    processedByStream: {},
    perAdvogado: {},
    financialUnderAdministration: null,
    campaignAttribution: {},
  };
}
