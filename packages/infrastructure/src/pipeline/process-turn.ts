// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS EXECUTION PIPELINE (GO-LIVE 10D) — o ÚNICO ponto de entrada oficial
// de um turno de produção. Elimina a orquestração manual da cadeia estratégica:
//
//   Truth Layer → Strategic Facts → Strategic Reasoning → Executive Mind →
//   StrategicDecision → Planner → Mission Runtime → Conversation → Resposta
//
// Nenhuma camada nova, nenhum conceito novo: `processTurn` apenas COMPÕE peças
// que já existem (Truth/Reasoning/Mind 10A-C, Brain, Mission, Conversation).
// Nenhuma etapa pode ser chamada por fora deste método no fluxo novo; nenhuma
// pula outra; não há execução parcial. Cada etapa é medida e registrada
// (tempo/resultado), com decisionId, missionId e correlationId do turno —
// permitindo reconstruir qualquer atendimento do início ao fim.
//
// COMPATIBILIDADE: o fluxo legado (FullLoopBrainAdapter/ConversationRuntime)
// continua funcionando; este pipeline é adotado progressivamente. Não altera o
// comportamento conversacional — a Conversa é chamada por um port estreito.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type {
  BrainIntent,
  BrainMemoryView,
  CatalogoDeConhecimento,
  CatalogoDeEstrategias,
  ConversationContextView,
  ExecutiveBrainRuntime,
  MissionFacts,
  MissionRuntime,
  MissionSnapshotPort,
  PerceptView,
  RuleCatalogPort,
  StrategicDecision,
  UseCaseOutcome,
} from '@reconstrua/application';
import {
  aprenderDaConversa,
  buildFacts,
  deliberar,
  emptySnapshot,
  fatosEstrategicos,
  raciocinar,
} from '@reconstrua/application';
import { toMissionUseCaseIntents } from '../mission-runtime/mission-brain-intents.js';

/** A cauda conversacional (Conversation Intelligence → Prompt Builder → Expression),
 *  chamada por um port ESTREITO para não tocar o comportamento conversacional. */
export interface TurnConversationPort {
  respond(intents: readonly BrainIntent[], context: ConversationContextView): Promise<readonly string[]>;
}

export interface ProcessTurnDeps {
  readonly truth: MissionSnapshotPort; // Truth Layer (read model)
  readonly rules: RuleCatalogPort;
  readonly brain: ExecutiveBrainRuntime; // Planner (decide → intenções)
  readonly mission: MissionRuntime; // Mission Runtime (executa)
  readonly conversation: TurnConversationPort; // Conversa (comunica)
  readonly strategyCatalog: CatalogoDeEstrategias; // domínio (10A)
  readonly knowledgeCatalog: CatalogoDeConhecimento; // domínio (9G)
  readonly clock: Clock;
}

export interface TurnInput {
  readonly correlationId: string;
  readonly chatId: string;
  readonly percept: PerceptView;
  readonly missionFacts: MissionFacts;
  readonly memory: BrainMemoryView;
  readonly context: ConversationContextView;
  /** Documentos já recebidos (domínio) — entram nos Strategic Facts. */
  readonly documentosRecebidos?: readonly string[];
}

export interface TurnStep {
  readonly step: string;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly detail: string | null;
}

export interface TurnOutcome {
  readonly correlationId: string;
  readonly strategicDecision: StrategicDecision | null;
  readonly decisionId: string | null;
  readonly missionId: string | null;
  readonly response: readonly string[];
  readonly steps: readonly TurnStep[];
  /** As intenções do Planner (para os consumidores de produção: conversa,
   *  notificação, escalação). Cruas — o mapeamento fica com o consumidor. */
  readonly intents: readonly BrainIntent[];
  /** Outcomes da missão (para a Memória Viva ingerir os fatos do turno). */
  readonly missionOutcomes: readonly UseCaseOutcome[];
}

/** Mede uma etapa (tempo real de parede) e registra o resultado na trilha. */
async function medir<T>(steps: TurnStep[], step: string, run: () => Promise<T> | T, detail?: (r: T) => string | null): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await run();
    steps.push({ step, ok: true, durationMs: Date.now() - t0, detail: detail ? detail(r) : null });
    return r;
  } catch (e) {
    steps.push({ step, ok: false, durationMs: Date.now() - t0, detail: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/**
 * O pipeline autônomo. Um turno real percorre OBRIGATORIAMENTE todas as etapas,
 * na ordem, sem chamadas manuais entre elas. Produz decisão (ou null), missão
 * (ou nenhuma) e resposta — tudo derivado automaticamente e auditado.
 */
export class AutonomousTurnPipeline {
  constructor(private readonly deps: ProcessTurnDeps) {}

  async processTurn(input: TurnInput): Promise<TurnOutcome> {
    const d = this.deps;
    const now = d.clock.now();
    const steps: TurnStep[] = [];

    // 1) TRUTH LAYER — a verdade do caso (read model). Nada decide fora daqui.
    const snapshot = await medir(steps, 'truth', async () => (await d.truth.load(input.chatId)) ?? emptySnapshot(input.chatId));

    // 2) STRATEGIC FACTS — Truth ⊕ Conversation Knowledge ⊕ documentos (um só formato).
    const facts = await medir(
      steps,
      'strategic-facts',
      () => {
        const truthFacts = buildFacts(input.percept, snapshot, input.memory);
        const conhecimento = aprenderDaConversa(input.context, d.knowledgeCatalog);
        return fatosEstrategicos({
          truthFacts,
          conhecimento,
          ...(input.documentosRecebidos ? { documentosRecebidos: input.documentosRecebidos } : {}),
        });
      },
      (f) => `${String(Object.keys(f).length)} fatos`,
    );

    // 3) STRATEGIC REASONING — PENSA: produz possibilidades (nunca decide).
    const raciocinio = await medir(steps, 'strategic-reasoning', () => raciocinar(facts, d.strategyCatalog), (r) => `${String(r.hipoteses.length)} hipóteses`);

    // 4) EXECUTIVE MIND — DECIDE: UMA StrategicDecision (ou null).
    const decision = await medir(steps, 'executive-mind', () => deliberar(raciocinio), (r) => (r ? `${r.strategyRef} (${r.confidence})` : 'sem decisão'));

    // 5) PLANNER — EXECUTA: o Brain produz as intenções (não compara estratégias).
    const outcome = await medir(
      steps,
      'planner',
      async () => d.brain.decide({ percept: input.percept, snapshot, memory: input.memory, rules: await d.rules.all(), chatId: input.chatId, now }),
      (o) => `${String(o.intents.length)} intenções`,
    );

    // 6) MISSION RUNTIME — a StrategicDecision é carimbada nas missões (10C).
    const missionResult = await medir(
      steps,
      'mission-runtime',
      async () => {
        const missionIntents = toMissionUseCaseIntents(outcome.intents, decision);
        return missionIntents.length > 0 ? d.mission.execute(input.missionFacts, missionIntents) : null;
      },
      (m) => (m?.identity.missionId ? `mission ${m.identity.missionId}` : 'sem missão'),
    );

    // 7) CONVERSATION — COMUNICA: a resposta (comportamento conversacional intocado).
    const response = await medir(steps, 'conversation', () => d.conversation.respond(outcome.intents, input.context), (r) => `${String(r.length)} mensagem(ns)`);

    return {
      correlationId: input.correlationId,
      strategicDecision: decision,
      decisionId: decision?.decisionId ?? null,
      missionId: missionResult?.identity.missionId ?? null,
      response,
      steps,
      intents: outcome.intents,
      missionOutcomes: missionResult?.outcomes ?? [],
    };
  }
}
