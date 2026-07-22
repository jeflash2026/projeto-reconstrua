// ─────────────────────────────────────────────────────────────────────────────
// COMUNICADOR DO NASCIMENTO (PC-R3) — quem DECIDE é o BRAIN (RO própria, padrão
// RO-3B); quem ENTREGA é o pipeline canônico de conversa (proveniência → fila →
// entrega humanizada). O TEXTO é o homologado pelo Fundador (D2): o fraseado LLM
// NÃO reescreve conteúdo do Fundador — link verbatim e frase final garantidos.
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

/** RO do nascimento — aditiva; o Brain decide; matéria humana bloqueia (veto). */
export const NASCIMENTO_RULE_CATALOG: readonly OperationalRuleSpec[] = [
  {
    ref: 'RO-CADASTRO-CONCLUIDO-001',
    title: 'Comunicar a conclusão do cadastro e a liberação do Portal do Cliente',
    priority: 80,
    preconditions: [{ fact: 'perceptKind', op: 'eq', value: 'documentacao_completa' }],
    blocks: [{ fact: 'matterRequiresHuman', op: 'truthy' }],
    action: {
      kind: 'conversation',
      directive: 'speak',
      speechAct: 'inform',
      topic: 'conclusão do cadastro e Portal do Cliente',
      references: ['cadastro-concluido', 'portal-do-cliente'],
      urgency: 'normal',
    },
    fundamento:
      'Art. 15º (assistiva) — o nascimento do Portal é um momento da jornada; D2 (mensagem homologada); RO-R7-001',
  },
  {
    ref: 'RO-NASCIMENTO-WAIT',
    title: 'Silêncio ativo quando o nascimento não pode ser comunicado',
    priority: 0,
    preconditions: [],
    blocks: [],
    action: { kind: 'wait', reasonCode: 'NASCIMENTO_AGUARDA', untilHintMs: null },
    fundamento: 'Art. 9º (INV-07) — espera legítima; RO-R7-001',
  },
];

export interface NascimentoComunicadorDeps {
  readonly brain: ExecutiveBrainRuntime;
  readonly memory: ConversationMemoryRuntime;
  readonly context: ConversationContextRuntime;
  readonly queue: MessageQueueRuntime;
  readonly delivery: DeliveryRuntime;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
  readonly uuid: () => string;
}

export class BrainNascimentoComunicador implements ComunicadorNascimento {
  constructor(private readonly deps: NascimentoComunicadorDeps) {}

  async comunicar(chatId: string, clienteId: string, texto: string): Promise<boolean> {
    const d = this.deps;
    const now = d.clock.now();

    // 1) O BRAIN decide (percept do momento; mesmo desenho da ponte do advogado).
    const outcome = await d.brain.decide({
      percept: {
        kind: 'documentacao_completa',
        sentiment: 'positive',
        urgency: 'normal',
        hasArtifacts: false,
        artifactCount: 0,
        silenceMs: null,
      },
      snapshot: emptySnapshot(clienteId),
      memory: { turnCount: 2, lastOutboundAgoMs: null },
      rules: NASCIMENTO_RULE_CATALOG,
      chatId,
      now,
    });
    const decided = outcome.intents.find((i) => i.kind === 'conversation');
    if (decided === undefined) {
      d.observability.degraded(
        'nascimento',
        'brain-veto',
        now,
        `nascimento sem fala para ${clienteId} (silêncio/veto do Brain)`,
      );
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

      // 3) Entrega pelo pipeline canônico — texto HOMOLOGADO (D2), sem re-fraseio.
      const view = await d.context.build(chatId, null, now);
      await d.queue.enqueue(chatId, intent.id, texto);
      await d.delivery.drain(view); // cadência humana (nunca instantânea)
      return true;
    } catch (error) {
      d.observability.error(
        'nascimento',
        'entrega',
        now,
        error instanceof Error ? error.message : 'falha na entrega',
      );
      return false;
    }
  }
}
