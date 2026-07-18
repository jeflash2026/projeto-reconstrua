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
  | 'document_count'
  | 'documents_today'
  | 'clients_awaiting_documents'
  | 'clients_awaiting_lawyer'
  | 'clients_awaiting_expertise'
  | 'lawyer_count'
  | 'lawyer_most_processes'
  | 'lawyer_stalest'
  | 'bottlenecks'
  | 'financial_under_administration'
  | 'best_campaign'
  | 'roi'
  | 'sector_needing_attention';

/**
 * GO-LIVE-03 (itens 4/5) — fontes REAIS opcionais (aditivo): a lista única de
 * clientes (GO LIVE A, status derivado) e os casos por advogado (atribuições +
 * trabalho jurídico). Sem a fonte, a resposta continua honestamente "não
 * disponível" — jamais inventada.
 */
export interface AdminIntelligenceSources {
  readonly clientes?: () => Promise<ReadonlyArray<{ readonly status: string; readonly quem: string }>>;
  readonly porAdvogado?: () => Promise<
    ReadonlyArray<{ readonly nome: string; readonly casos: number; readonly ultimaAtividadeAt: Date | null }>
  >;
}

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
    private readonly sources: AdminIntelligenceSources = {},
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
    // GO-LIVE-03: cobertura ampliada — perícia, fila do sócio, documentos e advogados.
    if (q.includes('pericia')) return 'clients_awaiting_expertise';
    if (q.includes('socio')) return 'clients_awaiting_lawyer';
    if (q.includes('documento')) return 'document_count';
    if (q.includes('advogado')) return 'lawyer_count';
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
      case 'document_count':
        return this.numeric(kind, metrics.documentCount, `${String(metrics.documentCount)} documentos reconhecidos no total`, src);

      // ── GO-LIVE-03: fontes REAIS (lista única + atribuições) quando ligadas ───
      case 'clients_awaiting_lawyer': {
        const lista = await this.sources.clientes?.();
        if (lista === undefined) return this.notCaptured(kind, src);
        const fila = lista.filter((c) => c.status === 'AGUARDANDO_SOCIO');
        return {
          kind,
          available: true,
          value: fila.length,
          items: fila.map((c) => c.quem),
          fact: `${String(fila.length)} clientes na fila do sócio (aguardando advogado)`,
          provenance: 'read-model:clientes-list',
        };
      }
      case 'clients_awaiting_expertise': {
        const lista = await this.sources.clientes?.();
        if (lista === undefined) return this.notCaptured(kind, src);
        const fila = lista.filter((c) => c.status === 'PRONTO_AGUARDANDO_PERICIA');
        return {
          kind,
          available: true,
          value: fila.length,
          items: fila.map((c) => c.quem),
          fact: `${String(fila.length)} clientes aguardando perícia`,
          provenance: 'read-model:clientes-list',
        };
      }
      case 'lawyer_count': {
        const advogados = await this.sources.porAdvogado?.();
        if (advogados === undefined) return this.notCaptured(kind, src);
        return {
          kind,
          available: true,
          value: advogados.length,
          items: advogados.map((a) => `${a.nome} (${String(a.casos)} casos)`),
          fact: `${String(advogados.length)} advogados ativos`,
          provenance: 'read-model:staff+assignments',
        };
      }
      case 'lawyer_most_processes': {
        const advogados = await this.sources.porAdvogado?.();
        if (advogados === undefined || advogados.length === 0) return this.notCaptured(kind, src);
        const top = [...advogados].sort((a, b) => b.casos - a.casos)[0];
        if (top === undefined) return this.notCaptured(kind, src);
        return {
          kind,
          available: true,
          value: top.casos,
          items: [top.nome],
          fact: `${top.nome} tem mais processos: ${String(top.casos)}`,
          provenance: 'read-model:staff+assignments',
        };
      }
      case 'lawyer_stalest': {
        const advogados = await this.sources.porAdvogado?.();
        const comCasos = (advogados ?? []).filter((a) => a.casos > 0);
        if (advogados === undefined || comCasos.length === 0) return this.notCaptured(kind, src);
        const stalest = [...comCasos].sort(
          (a, b) => (a.ultimaAtividadeAt?.getTime() ?? 0) - (b.ultimaAtividadeAt?.getTime() ?? 0),
        )[0];
        if (stalest === undefined) return this.notCaptured(kind, src);
        return {
          kind,
          available: true,
          value: stalest.casos,
          items: [stalest.nome],
          fact:
            stalest.ultimaAtividadeAt === null
              ? `${stalest.nome} está há mais tempo sem movimentação (nenhuma atividade registrada)`
              : `${stalest.nome} está há mais tempo sem movimentação (última em ${stalest.ultimaAtividadeAt.toISOString().slice(0, 10)})`,
          provenance: 'read-model:staff+juridical',
        };
      }

      // ── Dados não capturados no domínio → NÃO DISPONÍVEL (jamais inventado) ───
      case 'financial_under_administration':
      case 'best_campaign':
      case 'roi':
        return this.notCaptured(kind, src);
    }
  }

  private notCaptured(kind: AdminQueryKind, provenance: string): AdminAnswer {
    return { kind, available: false, value: null, items: [], fact: NOT_CAPTURED, provenance };
  }

  private numeric(kind: AdminQueryKind, value: number, fact: string, provenance: string): AdminAnswer {
    return { kind, available: true, value, items: [], fact, provenance };
  }
}
