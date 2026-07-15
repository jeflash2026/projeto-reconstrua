// ─────────────────────────────────────────────────────────────────────────────
// LLM doubles DETERMINÍSTICOS (para testes e modo offline). Respeitam a fronteira:
//  • FakeLlmPerception ENTENDE (produz resumo/emoção/urgência) — nunca decide.
//  • VaryingLlmExpression FRASEIA — e VARIA a cada chamada (prova "nunca repetir"),
//    incorporando as frases a evitar. Nunca inventa fato/regra/estado.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  InboundEnvelope,
  LlmExpressionPort,
  LlmPerceptionPort,
  PerceptEnrichment,
  PerceptionContext,
  PhrasingRequest,
} from '@reconstrua/application';

export class FakeLlmPerception implements LlmPerceptionPort {
  understand(envelope: InboundEnvelope, _context: PerceptionContext): Promise<PerceptEnrichment> {
    const text = (envelope.text ?? envelope.editedText ?? '').toLowerCase();
    const sentiment = text.includes('?')
      ? 'confused'
      : /(urgente|preciso|socorro|ajuda)/.test(text)
        ? 'anxious'
        : 'neutral';
    const urgency = /(urgente|hoje|agora|prazo)/.test(text) ? 'high' : 'normal';
    const artifacts: string[] = [];
    if (envelope.kind === 'pdf' || envelope.kind === 'document') {
      artifacts.push(`artefato documental percebido: ${envelope.fileName ?? 'documento'}`);
    }
    return Promise.resolve({
      summary: text !== '' ? `cliente comunicou: ${text.slice(0, 80)}` : `entrada percebida: ${envelope.kind}`,
      sentiment,
      urgency,
      detectedIntentSignal: null,
      detectedArtifacts: artifacts,
      language: text !== '' ? 'pt-BR' : null,
    });
  }
}

const OPENERS = [
  'Oi',
  'Olha',
  'Então',
  'Perfeito',
  'Entendi',
  'Certo',
  'Veja bem',
  'Pois é',
  'Show',
  'Beleza',
  'Bom',
  'Combinado',
] as const;

const MIDDLES = [
  'vamos seguir com',
  'sobre',
  'a respeito de',
  'quanto a',
  'no ponto de',
  'tratando de',
  'seguindo em',
  'olhando para',
  'pensando em',
  'a partir de',
  'com foco em',
  'retomando',
] as const;

const CLOSERS = [
  'pode me confirmar?',
  'como podemos avançar?',
  'me conta um pouco mais.',
  'fico no aguardo.',
  'qualquer dúvida, estou aqui.',
  'seguimos juntos nisso.',
  'me diz o que achou.',
  'vamos resolver isso.',
  'estou acompanhando.',
  'conte comigo.',
  'que tal?',
  'fica tranquilo(a).',
] as const;

/** Frasea de forma determinística mas SEMPRE diferente: rotaciona três eixos. */
export class VaryingLlmExpression implements LlmExpressionPort {
  private counter = 0;

  phrase(request: PhrasingRequest): Promise<string> {
    const i = this.counter % OPENERS.length;
    this.counter += 1;
    const topic = request.intent.topic ?? request.intent.references[0] ?? 'sua solicitação';
    const opener = OPENERS[i] ?? 'Oi';
    const middle = MIDDLES[i] ?? 'sobre';
    const closer = CLOSERS[i] ?? 'como posso ajudar?';
    return Promise.resolve(`${opener}, ${middle} ${topic}, ${closer}`);
  }
}
