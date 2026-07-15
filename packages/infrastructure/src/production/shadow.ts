// ─────────────────────────────────────────────────────────────────────────────
// SHADOW MODE (Sprint 4D) — observabilidade operacional TOTAL, zero funcionalidade
// nova. O ShadowRecorder envolve a ENTRADA ÚNICA (4C): a AHRI atende/conversa/
// coleta/executa NORMALMENTE, e cada turno gera um SHADOW REPORT auditável
// (percept, contexto, estado/etapa/verdade, ROs, intenções, tempos, resposta,
// LLM/tokens, resultado, feedback humano). Detectores automáticos derivam achados
// dos reports. Nada aqui decide; nada aqui muta domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { InboundEnvelope, TurnResult } from '@reconstrua/application';
import { similarity } from '@reconstrua/application';
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { JsonStore } from './json-store.js';
import { reviveDates } from './json-store.js';
import type { ProductionIngress } from './production-ingress.js';
import type { TokensMeter } from './llm-adapters.js';

// ── Report ────────────────────────────────────────────────────────────────────
export interface ShadowLlmUsage {
  readonly provider: string;
  readonly calls: number;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
}

export interface ShadowReport {
  readonly id: string;
  readonly at: Date;
  readonly chatId: string;
  readonly origin: 'inbound' | 'temporal';
  // Percept
  readonly perceptKind: string;
  readonly messageId: string;
  readonly sentiment: string | null;
  readonly urgency: string | null;
  // Contexto / Estado / Etapa / Verdade (read models no instante)
  readonly turnCount: number | null;
  readonly missionId: string | null;
  readonly workflowSteps: readonly string[];
  readonly truthCount: number;
  readonly stateCount: number;
  readonly stageCount: number;
  // Decisão
  readonly rulesApplied: readonly string[];
  readonly intents: readonly string[]; // directive[ref]
  readonly decisionTimeMs: number; // tempo real de processamento do turno
  // Resposta
  readonly responses: readonly string[];
  readonly latencyMs: number; // = decisionTimeMs (turno completo, sem esperas humanizadas simuladas)
  // LLM
  readonly llm: ShadowLlmUsage;
  // Resultado
  readonly outcome: 'delivered' | 'silent' | 'skipped' | 'error';
  readonly error: string | null;
  // Feedback humano (preenchível depois)
  readonly humanFeedback: string | null;
}

export interface ShadowStore {
  save(report: ShadowReport): Promise<void>;
  byId(id: string): Promise<ShadowReport | null>;
  all(): Promise<readonly ShadowReport[]>;
  byChat(chatId: string): Promise<readonly ShadowReport[]>;
}

const DATE_KEYS = ['at'] as const;

export class JsonShadowStore implements ShadowStore {
  private seq = 0;
  constructor(private readonly store: JsonStore) {}
  async save(report: ShadowReport): Promise<void> {
    this.seq += 1;
    await this.store.put('shadow', `${report.at.toISOString()}|${String(this.seq).padStart(8, '0')}|${report.id}`, report);
    await this.store.put('shadow-by-id', report.id, report);
  }
  async byId(id: string): Promise<ShadowReport | null> {
    const raw = await this.store.get('shadow-by-id', id);
    return raw === null ? null : reviveDates<ShadowReport>(raw, DATE_KEYS);
  }
  async all(): Promise<readonly ShadowReport[]> {
    return (await this.store.list('shadow')).map((r) => reviveDates<ShadowReport>(r, DATE_KEYS));
  }
  async byChat(chatId: string): Promise<readonly ShadowReport[]> {
    return (await this.all()).filter((r) => r.chatId === chatId);
  }
}

// ── Recorder (envolve a entrada única; comportamento INALTERADO) ──────────────
export interface TurnIngress {
  receive(envelope: InboundEnvelope): Promise<TurnResult>;
  tick(now: Date): Promise<readonly TurnResult[]>;
}

export interface ShadowContextSources {
  readonly missionsOf: (chatId: string) => readonly string[];
  readonly timelineCounts: (missionId: string) => { truth: number; state: number; stage: number };
  readonly workflowSteps: (missionId: string) => Promise<readonly string[]>;
  readonly turnCount: (chatId: string) => Promise<number | null>;
  readonly refreshProjector: () => Promise<void>;
}

export class ShadowRecorder implements TurnIngress {
  constructor(
    private readonly inner: ProductionIngress,
    private readonly store: ShadowStore,
    private readonly sources: ShadowContextSources,
    private readonly meter: TokensMeter,
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
    private readonly enabled: () => boolean,
  ) {}

  private async record(origin: 'inbound' | 'temporal', envelope: InboundEnvelope, run: () => Promise<TurnResult>): Promise<TurnResult> {
    if (!this.enabled()) return run();
    const t0 = Date.now();
    const llmBefore = this.meter.snapshot();
    let result: TurnResult | null = null;
    let error: string | null = null;
    try {
      result = await run();
    } catch (e) {
      error = e instanceof Error ? e.message : 'erro desconhecido';
    }
    const decisionTimeMs = Date.now() - t0;
    const llmAfter = this.meter.snapshot();

    await this.sources.refreshProjector();
    const missionId = this.sources.missionsOf(envelope.chatId)[0] ?? null;
    const counts = missionId ? this.sources.timelineCounts(missionId) : { truth: 0, state: 0, stage: 0 };
    const steps = missionId ? await this.sources.workflowSteps(missionId) : [];

    const report: ShadowReport = {
      id: this.uuid.next(),
      at: this.clock.now(),
      chatId: envelope.chatId,
      origin,
      perceptKind: envelope.kind,
      messageId: envelope.messageId,
      sentiment: result?.percept?.enrichment?.sentiment ?? null,
      urgency: result?.percept?.enrichment?.urgency ?? null,
      turnCount: await this.sources.turnCount(envelope.chatId),
      missionId,
      workflowSteps: steps,
      truthCount: counts.truth,
      stateCount: counts.state,
      stageCount: counts.stage,
      rulesApplied: result ? [...new Set(result.intents.map((i) => i.operationalRuleRef ?? '-'))] : [],
      intents: result ? result.intents.map((i) => `${i.directive}[${i.operationalRuleRef ?? '-'}]`) : [],
      decisionTimeMs,
      responses: result ? result.delivered.map((d) => d.text) : [],
      latencyMs: decisionTimeMs,
      llm: {
        provider: llmAfter.provider,
        calls: llmAfter.calls - llmBefore.calls,
        tokensIn: llmAfter.tokensIn === null ? null : llmAfter.tokensIn - (llmBefore.tokensIn ?? 0),
        tokensOut: llmAfter.tokensOut === null ? null : llmAfter.tokensOut - (llmBefore.tokensOut ?? 0),
      },
      outcome: error !== null ? 'error' : result?.skipped ? 'skipped' : (result?.delivered.length ?? 0) > 0 ? 'delivered' : 'silent',
      error,
      humanFeedback: null,
    };
    await this.store.save(report);
    if (error !== null) throw new Error(error);
    return result as TurnResult;
  }

  receive(envelope: InboundEnvelope): Promise<TurnResult> {
    return this.record('inbound', envelope, () => this.inner.receive(envelope));
  }

  async tick(now: Date): Promise<readonly TurnResult[]> {
    if (!this.enabled()) return this.inner.tick(now);
    // Cada disparo temporal vira um report próprio: interceptamos via fireDue → não
    // temos acesso às tarefas aqui; delegamos e registramos por resultado.
    const results = await this.inner.tick(now);
    for (const r of results) {
      const pseudo: InboundEnvelope = {
        messageId: `temporal:${r.chatId}:${String(now.getTime())}`,
        chatId: r.chatId, from: r.chatId, kind: r.percept?.envelope.kind ?? 'timeout',
        text: null, mediaUrl: null, mediaMimeType: null, fileName: null, location: null, contact: null,
        reactionEmoji: null, reactionToMessageId: null, editedText: null, deletedMessageId: null,
        silenceMs: r.percept?.envelope.silenceMs ?? null, timestamp: now,
      };
      await this.record('temporal', pseudo, () => Promise.resolve(r));
    }
    return results;
  }

  async addFeedback(reportId: string, feedback: string): Promise<ShadowReport | null> {
    const report = await this.store.byId(reportId);
    if (!report) return null;
    const updated: ShadowReport = { ...report, humanFeedback: feedback };
    await this.store.save(updated);
    return updated;
  }
}

// ── Shadow Center (agregações) ────────────────────────────────────────────────
export interface ShadowCenterSummary {
  readonly totalTurns: number;
  readonly conversations: number;
  readonly decisions: number;
  readonly delivered: number;
  readonly silent: number;
  readonly errors: number;
  readonly escalations: number;
  readonly followUps: number;
  readonly blocks: number; // decisões de espera (wait)
  readonly ruleUsage: Readonly<Record<string, number>>;
  readonly latency: { avgMs: number; p95Ms: number; maxMs: number };
  readonly llm: { calls: number; tokensIn: number | null; tokensOut: number | null };
}

export function summarize(reports: readonly ShadowReport[]): ShadowCenterSummary {
  const latencies = reports.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p = (q: number): number => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] ?? 0;
  const ruleUsage: Record<string, number> = {};
  let escalations = 0;
  let followUps = 0;
  let blocks = 0;
  for (const r of reports) {
    for (const ref of r.rulesApplied) ruleUsage[ref] = (ruleUsage[ref] ?? 0) + 1;
    if (r.intents.some((i) => i.startsWith('handoff'))) escalations += 1;
    if (r.rulesApplied.some((ref) => ref.includes('FOLLOWUP') || ref.includes('SILENCE'))) followUps += 1;
    if (r.intents.some((i) => i.startsWith('wait'))) blocks += 1;
  }
  const tokensIn = reports.reduce<number | null>((s, r) => (r.llm.tokensIn === null ? s : (s ?? 0) + r.llm.tokensIn), null);
  const tokensOut = reports.reduce<number | null>((s, r) => (r.llm.tokensOut === null ? s : (s ?? 0) + r.llm.tokensOut), null);
  return {
    totalTurns: reports.length,
    conversations: new Set(reports.map((r) => r.chatId)).size,
    decisions: reports.reduce((s, r) => s + r.intents.length, 0),
    delivered: reports.filter((r) => r.outcome === 'delivered').length,
    silent: reports.filter((r) => r.outcome === 'silent').length,
    errors: reports.filter((r) => r.outcome === 'error').length,
    escalations,
    followUps,
    blocks,
    ruleUsage,
    latency: {
      avgMs: latencies.length === 0 ? 0 : latencies.reduce((s, l) => s + l, 0) / latencies.length,
      p95Ms: p(0.95),
      maxMs: latencies[latencies.length - 1] ?? 0,
    },
    llm: { calls: reports.reduce((s, r) => s + r.llm.calls, 0), tokensIn, tokensOut },
  };
}

// ── Detecção automática ───────────────────────────────────────────────────────
export type ShadowSeverity = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';

export interface ShadowDetection {
  readonly kind: string;
  readonly severity: ShadowSeverity;
  readonly detail: string;
}

export interface DetectionThresholds {
  readonly loopTurnsPerChatHour: number;
  readonly spamOutboundPerChatHour: number;
  readonly repeatSimilarity: number;
  readonly latencyP95Ms: number;
  readonly escalationRate: number; // fração de turnos
  readonly followUpPerChat: number;
  readonly ruleShareOverused: number; // fração do uso total
}

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
  loopTurnsPerChatHour: 30,
  spamOutboundPerChatHour: 10,
  repeatSimilarity: 0.9,
  latencyP95Ms: 15_000,
  escalationRate: 0.3,
  followUpPerChat: 5,
  ruleShareOverused: 0.6,
};

export function detect(
  reports: readonly ShadowReport[],
  catalogRefs: readonly string[],
  thresholds: DetectionThresholds = DEFAULT_THRESHOLDS,
): readonly ShadowDetection[] {
  const detections: ShadowDetection[] = [];
  const summary = summarize(reports);
  const byChat = new Map<string, ShadowReport[]>();
  for (const r of reports) {
    const list = byChat.get(r.chatId) ?? [];
    list.push(r);
    byChat.set(r.chatId, list);
  }

  for (const [chatId, list] of byChat) {
    // Loop: muitos turnos na mesma hora.
    const byHour = new Map<string, number>();
    for (const r of list) {
      const h = r.at.toISOString().slice(0, 13);
      byHour.set(h, (byHour.get(h) ?? 0) + 1);
    }
    for (const [hour, count] of byHour) {
      if (count > thresholds.loopTurnsPerChatHour) {
        detections.push({ kind: 'loop', severity: 'CRITICO', detail: `${chatId}: ${String(count)} turnos em ${hour}h` });
      }
    }
    // Spam: muitas mensagens ENVIADAS na mesma hora.
    const outByHour = new Map<string, number>();
    for (const r of list) {
      const h = r.at.toISOString().slice(0, 13);
      outByHour.set(h, (outByHour.get(h) ?? 0) + r.responses.length);
    }
    for (const [hour, count] of outByHour) {
      if (count > thresholds.spamOutboundPerChatHour) {
        detections.push({ kind: 'spam', severity: 'CRITICO', detail: `${chatId}: ${String(count)} mensagens enviadas em ${hour}h` });
      }
    }
    // Mensagens repetidas (para o MESMO cliente).
    const texts = list.flatMap((r) => r.responses);
    for (let i = 0; i < texts.length; i += 1) {
      for (let j = i + 1; j < texts.length; j += 1) {
        const a = texts[i];
        const b = texts[j];
        if (a !== undefined && b !== undefined && similarity(a, b) >= thresholds.repeatSimilarity) {
          detections.push({ kind: 'mensagem-repetida', severity: 'ALTO', detail: `${chatId}: "${a.slice(0, 60)}…" repetida` });
          i = texts.length; // um achado por chat basta
          break;
        }
      }
    }
    // Cliente confuso / irritado (sinais percebidos recorrentes).
    const confused = list.filter((r) => r.sentiment === 'confused').length;
    const negative = list.filter((r) => r.sentiment === 'negative' || r.sentiment === 'anxious').length;
    if (confused >= 3) detections.push({ kind: 'cliente-confuso', severity: 'MEDIO', detail: `${chatId}: confusão percebida ${String(confused)}×` });
    if (negative >= 3) detections.push({ kind: 'cliente-irritado', severity: 'ALTO', detail: `${chatId}: sinal negativo/ansioso ${String(negative)}×` });
    // Follow-up excessivo.
    const fu = list.filter((r) => r.rulesApplied.some((ref) => ref.includes('FOLLOWUP'))).length;
    if (fu > thresholds.followUpPerChat) {
      detections.push({ kind: 'followup-excessivo', severity: 'ALTO', detail: `${chatId}: ${String(fu)} follow-ups` });
    }
  }

  // Latência excessiva.
  if (summary.latency.p95Ms > thresholds.latencyP95Ms) {
    detections.push({ kind: 'latencia', severity: 'ALTO', detail: `p95=${String(Math.round(summary.latency.p95Ms))}ms > ${String(thresholds.latencyP95Ms)}ms` });
  }
  // Escalada excessiva.
  if (summary.totalTurns > 0 && summary.escalations / summary.totalTurns > thresholds.escalationRate) {
    detections.push({ kind: 'escalada-excessiva', severity: 'ALTO', detail: `${String(summary.escalations)}/${String(summary.totalTurns)} turnos escalaram` });
  }
  // RO muito utilizada / nunca utilizada.
  const totalUsage = Object.values(summary.ruleUsage).reduce((s, n) => s + n, 0);
  for (const [ref, count] of Object.entries(summary.ruleUsage)) {
    if (ref !== '-' && totalUsage > 20 && count / totalUsage > thresholds.ruleShareOverused) {
      detections.push({ kind: 'ro-muito-usada', severity: 'MEDIO', detail: `${ref}: ${String(count)}/${String(totalUsage)} usos (${String(Math.round((100 * count) / totalUsage))}%)` });
    }
  }
  const used = new Set(Object.keys(summary.ruleUsage));
  for (const ref of catalogRefs) {
    if (!used.has(ref)) detections.push({ kind: 'ro-nunca-usada', severity: 'BAIXO', detail: ref });
  }
  // Erros.
  if (summary.errors > 0) detections.push({ kind: 'erros', severity: 'CRITICO', detail: `${String(summary.errors)} turnos com erro` });

  return detections;
}

// ── Perguntas do Fundador respondidas EXCLUSIVAMENTE dos Shadow Reports ───────
export interface ShadowOracleContext {
  readonly reports: readonly ShadowReport[];
  readonly detections: readonly ShadowDetection[];
  /** advogadoId → nº de processos atribuídos (read model 3B). */
  readonly lawyerLoad: Readonly<Record<string, number>>;
  /** chatId → documentos pendentes há mais tempo (memória viva). */
  readonly pendingDocs: ReadonlyArray<{ chatId: string; document: string; sinceDays: number | null }>;
}

export interface ShadowAnswer {
  readonly question: string;
  readonly answer: string;
  readonly provenance: 'shadow-reports';
  readonly available: boolean;
}

export function askShadow(question: string, ctx: ShadowOracleContext): ShadowAnswer {
  const q = question.toLowerCase();
  const reports = ctx.reports;
  const done = (answer: string, available = true): ShadowAnswer => ({ question, answer, provenance: 'shadow-reports', available });

  if (q.includes('mais difícil') || q.includes('mais dificil')) {
    const hardest = [...reports].sort((a, b) => b.decisionTimeMs - a.decisionTimeMs || b.intents.length - a.intents.length)[0];
    if (!hardest) return done('Nenhum turno registrado ainda.', false);
    return done(
      `O turno mais custoso foi na conversa ${hardest.chatId} (${hardest.perceptKind}): ${String(hardest.intents.length)} intenção(ões) [${hardest.rulesApplied.join(', ')}] em ${String(hardest.decisionTimeMs)}ms, resultado ${hardest.outcome}.`,
    );
  }
  if (q.includes('regras') && (q.includes('trabalh') || q.includes('mais us'))) {
    const s = summarize(reports);
    const top = Object.entries(s.ruleUsage).filter(([r]) => r !== '-').sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (top.length === 0) return done('Nenhuma regra registrada ainda.', false);
    return done(`Regras mais trabalhadas: ${top.map(([r, n]) => `${r} (${String(n)}×)`).join(', ')}.`);
  }
  if (q.includes('gargalo')) {
    const worst = [...ctx.detections].sort((a, b) => ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO'].indexOf(a.severity) - ['CRITICO', 'ALTO', 'MEDIO', 'BAIXO'].indexOf(b.severity))[0];
    if (!worst) return done('Nenhum gargalo detectado nos Shadow Reports.');
    return done(`Maior gargalo detectado: [${worst.severity}] ${worst.kind} — ${worst.detail}.`);
  }
  if (q.includes('esperando') || q.includes('aguardando')) {
    const waiting = reports.filter((r) => r.outcome === 'silent' && r.origin === 'inbound');
    const chats = [...new Set(waiting.map((r) => r.chatId))];
    return done(chats.length === 0 ? 'Nenhum cliente ficou sem resposta em turno de entrada.' : `Clientes com turno de entrada sem fala da AHRI (decisão de silêncio): ${chats.slice(0, 10).join(', ')}.`);
  }
  if (q.includes('sobrecarregado') || q.includes('advogado')) {
    const entries = Object.entries(ctx.lawyerLoad).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return done('Nenhum advogado com processos atribuídos ainda.', false);
    const [id, n] = entries[0] ?? ['-', 0];
    return done(`Advogado com maior carga: ${id} com ${String(n)} processo(s). Distribuição completa: ${entries.map(([a, c]) => `${a}=${String(c)}`).join(', ')}.`);
  }
  if (q.includes('documento') && (q.includes('atras') || q.includes('pendent'))) {
    if (ctx.pendingDocs.length === 0) return done('Nenhum documento pendente registrado na memória viva.');
    const top = ctx.pendingDocs.slice(0, 10).map((p) => `${p.document} (${p.chatId}${p.sinceDays !== null ? `, ${String(p.sinceDays)}d` : ''})`);
    return done(`Documentos atrasando: ${top.join('; ')}.`);
  }
  if (q.includes('estranho') || q.includes('anomal')) {
    const weird = ctx.detections.filter((d) => d.severity === 'CRITICO' || d.severity === 'ALTO');
    return done(weird.length === 0 ? 'Nenhum comportamento estranho (CRÍTICO/ALTO) detectado.' : `Comportamentos estranhos: ${weird.map((d) => `[${d.severity}] ${d.kind}: ${d.detail}`).join(' | ')}.`);
  }
  return done('Não tenho essa resposta nos Shadow Reports — não vou inventar.', false);
}
