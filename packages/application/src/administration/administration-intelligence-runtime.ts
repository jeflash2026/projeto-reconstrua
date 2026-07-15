// ─────────────────────────────────────────────────────────────────────────────
// ADMINISTRATION INTELLIGENCE RUNTIME — o cérebro administrativo. Responde perguntas
// operacionais SOMENTE a partir dos Read Models (AdminMetrics) e da Memória Viva.
// NUNCA inventa: o que não foi capturado retorna `available:false` ("não disponível").
// O roteamento pergunta→métrica é DETERMINÍSTICO (keywords); o LLM só narra depois.
// ─────────────────────────────────────────────────────────────────────────────
import { emptyMetrics } from './admin-metrics.js';
import type { AdminMetricsStore } from './ports.js';
import type { MemoryStore } from '../living-memory/index.js';
import { normalizeForMatch } from '../living-memory/index.js';

export type AdminQueryKind =
  | 'client_count'
  | 'mission_count'
  | 'process_count'
  | 'documents_today'
  | 'clients_awaiting_documents'
  | 'clients_awaiting_lawyer'
  | 'clients_awaiting_expertise'
  | 'lawyer_most_processes'
  | 'lawyer_stalest'
  | 'bottlenecks'
  | 'financial_under_administration'
  | 'best_campaign'
  | 'roi'
  | 'sector_needing_attention';

export interface AdminAnswer {
  readonly kind: AdminQueryKind;
  readonly available: boolean;
  readonly value: number | null;
  readonly items: readonly string[];
  /** Frase factual derivada do dado (não LLM, não decisão). */
  readonly fact: string;
  /** Fonte auditável do dado. */
  readonly provenance: string;
}

const NOT_CAPTURED = 'dado ainda não capturado no domínio (não disponível)';

export class AdministrationIntelligenceRuntime {
  constructor(
    private readonly metricsStore: AdminMetricsStore,
    private readonly memoryStore: MemoryStore,
  ) {}

  /** Roteia uma pergunta em linguagem para uma métrica. Determinístico; null = não sei. */
  route(question: string): AdminQueryKind | null {
    const q = normalizeForMatch(question);
    const has = (...terms: string[]): boolean => terms.every((t) => q.includes(t));
    if (has('gargalo')) return 'bottlenecks';
    if (has('setor') && (q.includes('atencao') || q.includes('atenc'))) return 'sector_needing_attention';
    if (has('advogado') && q.includes('mais processos')) return 'lawyer_most_processes';
    if (has('advogado') && (q.includes('sem movimenta') || q.includes('mais tempo'))) return 'lawyer_stalest';
    if (q.includes('aguard') && q.includes('documento')) return 'clients_awaiting_documents';
    if (q.includes('aguard') && q.includes('advogado')) return 'clients_awaiting_lawyer';
    if (q.includes('aguard') && q.includes('pericia')) return 'clients_awaiting_expertise';
    if (q.includes('documento') && q.includes('hoje')) return 'documents_today';
    if (q.includes('processo')) return 'process_count';
    if (q.includes('missao') || q.includes('missoes')) return 'mission_count';
    if (q.includes('cliente')) return 'client_count';
    if (q.includes('roi')) return 'roi';
    if (q.includes('campanha')) return 'best_campaign';
    if (q.includes('honorario') || q.includes('financeiro') || q.includes('valor')) return 'financial_under_administration';
    return null;
  }

  async answer(kind: AdminQueryKind, now: Date): Promise<AdminAnswer> {
    const metrics = (await this.metricsStore.load()) ?? emptyMetrics(now);
    const src = 'read-model:admin-metrics';

    switch (kind) {
      case 'client_count':
        return this.numeric(kind, metrics.clientCount, `${String(metrics.clientCount)} clientes reconhecidos`, src);
      case 'mission_count':
        return this.numeric(kind, metrics.missionCount, `${String(metrics.missionCount)} missões`, src);
      case 'process_count':
        return this.numeric(kind, metrics.processCount, `${String(metrics.processCount)} processos`, src);
      case 'documents_today': {
        const today = now.toISOString().slice(0, 10);
        const count = metrics.documentsByDay[today] ?? 0;
        return this.numeric(kind, count, `${String(count)} documentos chegaram hoje (${today})`, src);
      }
      case 'clients_awaiting_documents': {
        const memories = await this.memoryStore.all();
        const waiting = memories.filter((m) => m.documentsPending.length > 0).map((m) => m.chatId);
        return {
          kind,
          available: true,
          value: waiting.length,
          items: waiting,
          fact: `${String(waiting.length)} clientes aguardam documentos`,
          provenance: 'read-model:living-memory',
        };
      }
      case 'bottlenecks': {
        const memories = await this.memoryStore.all();
        const awaitingDocs = memories.filter((m) => m.documentsPending.length > 0).map((m) => m.chatId);
        const stale = memories
          .filter((m) => m.lastContactAt !== null && now.getTime() - m.lastContactAt.getTime() > 7 * 24 * 60 * 60_000)
          .map((m) => m.chatId);
        const items = [...new Set([...awaitingDocs, ...stale])];
        return {
          kind,
          available: true,
          value: items.length,
          items,
          fact: items.length === 0 ? 'nenhum gargalo detectado' : `${String(items.length)} gargalos: aguardando documentos ou sem contato há +7 dias`,
          provenance: 'read-model:living-memory',
        };
      }
      case 'sector_needing_attention': {
        const memories = await this.memoryStore.all();
        const awaitingDocs = memories.filter((m) => m.documentsPending.length > 0).length;
        return {
          kind,
          available: true,
          value: awaitingDocs,
          items: awaitingDocs > 0 ? ['atendimento/coleta de documentos'] : [],
          fact: awaitingDocs > 0 ? `atendimento: ${String(awaitingDocs)} clientes aguardando documentos` : 'nenhum setor em atenção crítica',
          provenance: 'read-model:living-memory',
        };
      }
      // ── Dados não capturados → NÃO DISPONÍVEL (jamais inventado) ──────────────
      case 'clients_awaiting_lawyer':
      case 'clients_awaiting_expertise':
      case 'lawyer_most_processes':
      case 'lawyer_stalest':
      case 'financial_under_administration':
      case 'best_campaign':
      case 'roi':
        return { kind, available: false, value: null, items: [], fact: NOT_CAPTURED, provenance: src };
    }
  }

  private numeric(kind: AdminQueryKind, value: number, fact: string, provenance: string): AdminAnswer {
    return { kind, available: true, value, items: [], fact, provenance };
  }
}
