// ─────────────────────────────────────────────────────────────────────────────
// COMUNICADOR DA DESPEDIDA (GO-LIVE-02) — o ESPELHO do comunicador do nascimento:
// quem DECIDE é o BRAIN (RO própria, padrão RO-3B); quem ENTREGA é o pipeline
// canônico de conversa. O TEXTO é o homologado pelo Fundador — o fraseado LLM
// NÃO reescreve conteúdo do Fundador; a despedida nunca é fria nem automática.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type {
  ComunicadorNascimento,
  ConversationContextRuntime,
  ConversationIntent,
  ConversationMemoryRuntime,
  DeliveryRuntime,
  ExecutiveBrainRuntime,
  MessageQueueRuntime,
  ObservabilityRuntime,
  OperationalRuleSpec,
} from '@reconstrua/application';
import { emptySnapshot } from '@reconstrua/application';

/** RO da despedida — aditiva; o Brain decide; matéria humana bloqueia (veto). */
export const DESPEDIDA_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  {
    ref: 'RO-ETAPA-CONCLUIDA-001',
    title: 'Despedir-se pessoalmente ao concluir a etapa do caso (Modelo A)',
    priority: 80,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'etapa_concluida' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'inform',
      topic: 'despedida da etapa concluída',
      references: ['etapa-concluida', 'despedida'],
      urgency: 'normal',
    },
    fundamento: 'Art. 15º (assistiva) — a relação se encerra como começou: conversando; GO-LIVE-02 (texto homologado)',
  },
  {
    ref: 'RO-DESPEDIDA-WAIT',
    title: 'Silêncio ativo quando a despedida não pode ser comunicada',
    priority: 0,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'DESPEDIDA_AGUARDA', untilHintMs: null },
    fundamento: 'Art. 9º (INV-07) — espera legítima',
  },
];

export interface DespedidaComunicadorDeps {
  readonly brain: ExecutiveBrainRuntime;
  readonly memory: ConversationMemoryRuntime;
  readonly context: ConversationContextRuntime;
  readonly queue: MessageQueueRuntime;
  readonly delivery: DeliveryRuntime;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class BrainDespedidaComunicador implements ComunicadorNascimento {
  constructor(private readonly deps: DespedidaComunicadorDeps) {}

  async comunicar(chatId: string, clienteId: string, texto: string): Promise<boolean> {
    const d = this.deps;
    const now = d.clock.now();

    // 1) O BRAIN decide (mesmo desenho do nascimento — PC-R3).
    const outcome = await d.brain.decide({
      percept: {
        kind: 'etapa_concluida',
        sentiment: 'positive',
        urgency: 'normal',
        hasArtifacts: false,
        artifactCount: 0,
        silenceMs: null,
      },
      snapshot: emptySnapshot(clienteId),
      memory: { turnCount: 2, lastOutboundAgoMs: null },
      rules: DESPEDIDA_RULE_CATALOG,
      chatId,
      now,
    });
    const decided = outcome.intents.find((i) => i.kind === 'conversation');
    if (decided === undefined) {
      d.observability.degraded('despedida', 'brain-veto', now, `despedida sem fala para ${clienteId} (silêncio/veto do Brain)`);
      return false;
    }

    try {
      // 2) Proveniência registrada (INV-AH-02) com a decisão REAL do Brain.
      const intent: ConversationIntent = {
        id: decided.id,
        chatId,
        directive: decided.directive,
        speechAct: decided.speechAct,
        topic: decided.topic,
        references: [...decided.references],
        urgency: decided.urgency,
        operationalRuleRef: decided.provenance.operationalRuleRef,
        fundamento: decided.provenance.fundamento,
        timingHintMs: null,
        formedAt: decided.formedAt,
      };
      await d.memory.recordIntent(intent);

      // 3) Entrega pelo pipeline canônico — texto HOMOLOGADO, sem re-fraseio.
      const view = await d.context.build(chatId, null, now);
      await d.queue.enqueue(chatId, intent.id, texto);
      await d.delivery.drain(view); // cadência humana (nunca instantânea)
      return true;
    } catch (error) {
      d.observability.error('despedida', 'entrega', now, error instanceof Error ? error.message : 'falha na entrega');
      return false;
    }
  }
}
