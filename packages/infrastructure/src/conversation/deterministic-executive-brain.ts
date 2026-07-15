// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ REFERENCE / TEST DOUBLE — NÃO é o Executive Brain real (Sprint 2C).
//
// O Executive Brain verdadeiro é determinístico, RO-gated e vive na Camada 2, com
// Goal Selector → Priority → Legitimacy Gate (ADR-0002A §4.2). Este double NÃO
// contém motor de regras, NÃO acessa domínio e NÃO lê Verdade: apenas mapeia, de
// forma fixa, um Percept → uma Intenção plausível, para FECHAR e TESTAR o fluxo
// da Conversa ponta a ponta. Toda intenção sai com proveniência de referência.
//
// Existe só para provar que a Conversa EXECUTA intenções (não as cria). Trocar
// este double pelo Brain real não muda uma linha da Conversa (é um port).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  BrainInput,
  ConversationIntent,
  ExecutiveBrainPort,
  IntentDirective,
  IntentUrgency,
  SpeechAct,
} from '@reconstrua/application';

const RULE_REF = 'RO-REF-2B-DOUBLE';
const FUNDAMENTO = 'Regra Operacional (referência de teste — Sprint 2B)';

export class DeterministicExecutiveBrain implements ExecutiveBrainPort {
  constructor(
    private readonly clock: Clock,
    private readonly uuid: UuidGenerator,
  ) {}

  private make(
    chatId: string,
    directive: IntentDirective,
    speechAct: SpeechAct | null,
    topic: string | null,
    urgency: IntentUrgency,
    references: readonly string[],
  ): ConversationIntent {
    return {
      id: this.uuid.next(),
      chatId,
      directive,
      speechAct,
      topic,
      references,
      urgency,
      operationalRuleRef: RULE_REF,
      fundamento: FUNDAMENTO,
      timingHintMs: null,
      formedAt: this.clock.now(),
    };
  }

  decide(input: BrainInput): Promise<readonly ConversationIntent[]> {
    const { percept, context } = input;
    const chatId = percept.envelope.chatId;
    const text = (percept.envelope.text ?? percept.envelope.editedText ?? '').toLowerCase();
    const urgency: IntentUrgency = percept.enrichment?.urgency === 'high' ? 'high' : 'normal';

    switch (percept.envelope.kind) {
      case 'silence':
        return this.one(this.make(chatId, 'insist', 'follow_up', 'nosso último assunto', 'normal', []));
      case 'timeout':
        return this.one(this.make(chatId, 'accompany', null, null, 'low', []));
      case 'delete':
      case 'reaction':
        return this.one(this.make(chatId, 'accompany', null, null, 'low', []));
      case 'edit':
        return this.one(this.make(chatId, 'speak', 'follow_up', 'sua correção', 'normal', []));
      case 'pdf':
      case 'document':
      case 'image':
        return this.one(
          this.make(chatId, 'speak', 'inform', percept.envelope.fileName ?? 'o material recebido', 'normal', []),
        );
      case 'audio':
        return this.one(this.make(chatId, 'speak', 'explain', 'o que você enviou em áudio', 'normal', []));
      case 'location':
        return this.one(this.make(chatId, 'speak', 'inform', 'a localização recebida', 'normal', []));
      case 'contact':
        return this.one(this.make(chatId, 'speak', 'inform', 'o contato recebido', 'normal', []));
      case 'text':
      default:
        return this.decideText(chatId, text, context.session.turns, urgency);
    }
  }

  private decideText(
    chatId: string,
    text: string,
    turns: number,
    urgency: IntentUrgency,
  ): Promise<readonly ConversationIntent[]> {
    if (turns <= 1) {
      return this.one(this.make(chatId, 'speak', 'greet', 'seu primeiro contato', 'normal', []));
    }
    if (/(documento|anexo|comprovante|rg|cpf)/.test(text)) {
      return this.one(this.make(chatId, 'await_documents', 'request_document', 'os documentos', urgency, ['documento']));
    }
    if (/(prazo|vencimento|data limite)/.test(text)) {
      return this.one(this.make(chatId, 'notify_deadline', 'deadline_warning', 'o prazo', 'high', ['prazo']));
    }
    if (/(tchau|obrigad|valeu|at[eé] mais)/.test(text)) {
      return this.one(this.make(chatId, 'speak', 'reassure', 'nossa conversa', 'low', []));
    }
    return this.one(this.make(chatId, 'speak', 'explain', 'o que você trouxe', urgency, []));
  }

  private one(intent: ConversationIntent): Promise<readonly ConversationIntent[]> {
    return Promise.resolve([intent]);
  }
}
