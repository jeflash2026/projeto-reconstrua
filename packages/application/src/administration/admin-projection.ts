// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PROJECTION — projeta um StoredEvent de domínio nas AdminMetrics. Pura e
// determinística.
//
// IDEMPOTÊNCIA CORRETA (correção A1 da homologação 4B): o Dispatcher garante
// ordem POR STREAM, não ordem global — o guard antigo (`globalSeq <=
// lastGlobalSeq`) descartava silenciosamente eventos "atrasados" de outros
// streams, SUBCONTANDO os read models. O dedup agora é POR STREAM
// (`processedByStream[streamId] >= version` ⇒ já aplicado), que casa exatamente
// com a garantia real do Dispatcher: exactly-once LÓGICO, nenhuma perda,
// nenhuma dupla contagem, sob qualquer intercalação e qualquer reentrega.
// `lastGlobalSeq` permanece apenas como marca d'água informativa (máximo visto).
// ─────────────────────────────────────────────────────────────────────────────
import type { StoredEvent } from '../event-store/index.js';
import type { AdminMetrics } from './admin-metrics.js';

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function projectEvent(metrics: AdminMetrics, event: StoredEvent): AdminMetrics {
  // Dedup por stream: a entrega por stream é ORDENADA (2A.2), então "versão já
  // vista" ⇔ "evento já aplicado". Reentregas e intercalações não perdem nada.
  const seen = metrics.processedByStream[event.streamId] ?? 0;
  if (event.version <= seen) return metrics; // reentrega — já aplicado

  const base: AdminMetrics = {
    ...metrics,
    projectedAt: event.recordedAt,
    lastGlobalSeq: Math.max(metrics.lastGlobalSeq, event.globalSeq),
    processedByStream: { ...metrics.processedByStream, [event.streamId]: event.version },
  };

  switch (event.streamType) {
    case 'cliente':
      return { ...base, clientCount: metrics.clientCount + 1 };
    case 'person':
      return { ...base, personCount: metrics.personCount + 1 };
    case 'mission':
      return { ...base, missionCount: metrics.missionCount + 1 };
    case 'case':
      return { ...base, caseCount: metrics.caseCount + 1 };
    case 'process':
      return { ...base, processCount: metrics.processCount + 1 };
    case 'document': {
      const day = dayKey(event.occurredAt);
      return {
        ...base,
        documentCount: metrics.documentCount + 1,
        documentsByDay: { ...metrics.documentsByDay, [day]: (metrics.documentsByDay[day] ?? 0) + 1 },
      };
    }
    case 'operational-truth':
      return { ...base, truthSyntheses: metrics.truthSyntheses + 1 };
    case 'operational-state':
      return { ...base, stateDerivations: metrics.stateDerivations + 1 };
    case 'operational-stage':
      return { ...base, stageRepresentations: metrics.stageRepresentations + 1 };
    case 'operation':
      return { ...base, operationCount: metrics.operationCount + 1 };
    case 'projection':
      return { ...base, projectionCount: metrics.projectionCount + 1 };
    default:
      return base;
  }
}
