// ─────────────────────────────────────────────────────────────────────────────
// FOUNDER CONSOLE RUNTIME — não é dashboard: é uma CONVERSA entre o fundador e a
// empresa ("Pergunte qualquer coisa..."). A AHRI pode INICIAR com um briefing
// ("Enquanto você esteve ausente: …"), responder perguntas (via Administration
// Intelligence, só de Read Models) e RECOMENDAR com fundamento.
//
// INVARIANTE: ela recomenda, fundamenta, explica — mas NUNCA decide (decidesNothing).
// Todo dado é auditável; nada é inventado. O LLM só narra.
// ─────────────────────────────────────────────────────────────────────────────
import { emptyMetrics, type AdminMetrics } from './admin-metrics.js';
import type { AdministrationIntelligenceRuntime } from './administration-intelligence-runtime.js';
import type { AdminMetricsStore, AdminNarrationPort } from './ports.js';
import { normalizeForMatch } from '../living-memory/index.js';

export interface FounderConsoleConfig {
  readonly founderName: string;
}

export interface FounderBriefing {
  readonly greeting: string; // narrado
  readonly newClients: number;
  readonly newDocuments: number;
  readonly newMissions: number;
  readonly newProcesses: number;
  readonly newStages: number;
  readonly provenance: string;
}

export interface FounderAnswer {
  readonly question: string;
  readonly answer: string; // narrado
  readonly available: boolean;
  readonly provenance: string;
  readonly isRecommendation: boolean;
  readonly decidesNothing: true; // a AHRI nunca decide administrativamente
}

const ADVISORY = ['recomenda', 'deveria', 'impacto', 'contrat', 'sugestao', 'sugere'];

export class FounderConsoleRuntime {
  constructor(
    private readonly admin: AdministrationIntelligenceRuntime,
    private readonly narration: AdminNarrationPort,
    private readonly metricsStore: AdminMetricsStore,
    private readonly config: FounderConsoleConfig,
  ) {}

  /** A AHRI inicia a conversa: o que mudou desde a última visita (deltas do Read Model). */
  async briefing(baseline: AdminMetrics | null, now: Date): Promise<FounderBriefing> {
    const metrics = (await this.metricsStore.load()) ?? emptyMetrics(now);
    const base = baseline ?? emptyMetrics(now);
    const delta = (a: number, b: number): number => Math.max(0, a - b);
    const newClients = delta(metrics.clientCount, base.clientCount);
    const newDocuments = delta(metrics.documentCount, base.documentCount);
    const newMissions = delta(metrics.missionCount, base.missionCount);
    const newProcesses = delta(metrics.processCount, base.processCount);
    const newStages = delta(metrics.stageRepresentations, base.stageRepresentations);

    const greeting = await this.narration.narrate({
      topic: 'briefing',
      available: true,
      facts: {
        founder: this.config.founderName,
        newClients,
        newDocuments,
        newMissions,
        newProcesses,
        newStages,
      },
    });
    return { greeting, newClients, newDocuments, newMissions, newProcesses, newStages, provenance: 'read-model:admin-metrics' };
  }

  /** "Pergunte qualquer coisa." Responde de Read Models, ou recomenda com fundamento. */
  async ask(question: string, now: Date): Promise<FounderAnswer> {
    const q = normalizeForMatch(question);
    if (ADVISORY.some((t) => q.includes(t))) {
      return this.recommend(question, now);
    }

    const kind = this.admin.route(question);
    if (kind === null) {
      const answer = await this.narration.narrate({ topic: 'unknown', available: false, facts: {} });
      return { question, answer, available: false, provenance: 'none', isRecommendation: false, decidesNothing: true };
    }
    const result = await this.admin.answer(kind, now);
    const answer = await this.narration.narrate({
      topic: kind,
      available: result.available,
      facts: { fact: result.fact, value: result.value, count: result.items.length },
    });
    return { question, answer, available: result.available, provenance: result.provenance, isRecommendation: false, decidesNothing: true };
  }

  /** Recomendação FUNDAMENTADA (nunca decisão): aponta onde os dados indicam impacto. */
  private async recommend(question: string, now: Date): Promise<FounderAnswer> {
    const bottlenecks = await this.admin.answer('bottlenecks', now);
    const sector = await this.admin.answer('sector_needing_attention', now);
    const answer = await this.narration.narrate({
      topic: 'recommendation',
      available: true,
      facts: {
        recomendacao: sector.items[0] ?? 'manter o ritmo atual',
        fundamento: bottlenecks.fact,
        gargalos: bottlenecks.value,
        aviso: 'recomendação — a decisão é sua',
      },
    });
    return {
      question,
      answer,
      available: true,
      provenance: 'read-model:living-memory',
      isRecommendation: true,
      decidesNothing: true,
    };
  }
}
