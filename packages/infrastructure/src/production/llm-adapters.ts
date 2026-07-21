// ─────────────────────────────────────────────────────────────────────────────
// LLM ADAPTERS REAIS — OpenAI / Anthropic / Gemini, via HTTP puro (fetch),
// implementando EXCLUSIVAMENTE os quatro ports congelados de linguagem:
//   • LlmPerceptionPort (entende)      • LlmExpressionPort (frasea)
//   • AdminNarrationPort (narra fatos) • MemoryAttributeExtractorPort (extrai)
// NENHUMA decisão passa por aqui. Prompts vêm da configuração persistida.
// Uso registrado na observabilidade. Falha de LLM → degrade explícito (nunca
// inventa): percepção neutra, fraseado mínimo factual, narração determinística.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AdminNarrationPort,
  InboundEnvelope,
  LlmExpressionPort,
  LlmPerceptionPort,
  MemoryAttributeExtractorPort,
  NarrationInput,
  ObservabilityRuntime,
  PerceptEnrichment,
  PerceptionContext,
  PhrasingRequest,
  ProductionConfig,
  ProposedAttribute,
} from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { HttpClient } from '../conversation/evolution/http-client.js';
import { FakeLlmPerception, VaryingLlmExpression } from '../conversation/fake-llm.js';
import { asArray, asNumber, asRecord, asString, dig } from '../conversation/json.js';

/** Medidor de uso de LLM (Shadow Mode 4D): chamadas e tokens acumulados. */
export class TokensMeter {
  private calls = 0;
  private tokensIn: number | null = null;
  private tokensOut: number | null = null;
  constructor(private readonly provider: string) {}
  record(tokensIn: number | null, tokensOut: number | null): void {
    this.calls += 1;
    if (tokensIn !== null) this.tokensIn = (this.tokensIn ?? 0) + tokensIn;
    if (tokensOut !== null) this.tokensOut = (this.tokensOut ?? 0) + tokensOut;
  }
  snapshot(): { provider: string; calls: number; tokensIn: number | null; tokensOut: number | null } {
    return { provider: this.provider, calls: this.calls, tokensIn: this.tokensIn, tokensOut: this.tokensOut };
  }
}

export interface CompletionResult {
  readonly text: string;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
}

/** Chamada de completamento única (system+user → texto + uso). */
export interface LlmCompletion {
  complete(system: string, user: string): Promise<CompletionResult>;
  readonly name: string;
}

/** Erro HTTP com causa LITERAL (status + excerto do corpo). Sem isso, um 429/529
 *  virava texto vazio e o log dizia só "parse falhou; resposta=''" — o mesmo
 *  silêncio que escondeu o HTTP 201 da mídia por 12 rodadas. */
function exigir2xx(provider: string, status: number, body: unknown): void {
  if (status >= 200 && status < 300) return;
  let excerto = '';
  try {
    excerto = JSON.stringify(body).replace(/\s+/g, ' ').slice(0, 200);
  } catch {
    excerto = String(body).slice(0, 200);
  }
  throw new Error(`${provider} HTTP ${String(status)}: ${excerto}`);
}

export class OpenAiCompletion implements LlmCompletion {
  readonly name = 'openai';
  constructor(private readonly http: HttpClient, private readonly apiKey: string, private readonly model: string) {}
  async complete(system: string, user: string): Promise<CompletionResult> {
    const res = await this.http.postJson(
      'https://api.openai.com/v1/chat/completions',
      { authorization: `Bearer ${this.apiKey}` },
      { model: this.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7 },
    );
    exigir2xx(this.name, res.status, res.body);
    const text = asString(dig(asArray(dig(res.body, ['choices']))?.[0], ['message', 'content'])) ?? '';
    return {
      text,
      tokensIn: asNumber(dig(res.body, ['usage', 'prompt_tokens'])),
      tokensOut: asNumber(dig(res.body, ['usage', 'completion_tokens'])),
    };
  }
}

export class AnthropicCompletion implements LlmCompletion {
  readonly name = 'anthropic';
  constructor(private readonly http: HttpClient, private readonly apiKey: string, private readonly model: string) {}
  async complete(system: string, user: string): Promise<CompletionResult> {
    const res = await this.http.postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      { model: this.model, max_tokens: 1024, system, messages: [{ role: 'user', content: user }] },
    );
    exigir2xx(this.name, res.status, res.body);
    const first = asArray(dig(res.body, ['content']))?.[0];
    return {
      text: asString(asRecord(first)?.['text']) ?? '',
      tokensIn: asNumber(dig(res.body, ['usage', 'input_tokens'])),
      tokensOut: asNumber(dig(res.body, ['usage', 'output_tokens'])),
    };
  }
}

export class GeminiCompletion implements LlmCompletion {
  readonly name = 'gemini';
  constructor(private readonly http: HttpClient, private readonly apiKey: string, private readonly model: string) {}
  async complete(system: string, user: string): Promise<CompletionResult> {
    const res = await this.http.postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {},
      { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }] },
    );
    exigir2xx(this.name, res.status, res.body);
    const candidate = asArray(dig(res.body, ['candidates']))?.[0];
    const part = asArray(dig(candidate, ['content', 'parts']))?.[0];
    return {
      text: asString(asRecord(part)?.['text']) ?? '',
      tokensIn: asNumber(dig(res.body, ['usageMetadata', 'promptTokenCount'])),
      tokensOut: asNumber(dig(res.body, ['usageMetadata', 'candidatesTokenCount'])),
    };
  }
}

// ── Bundle: os quatro ports sobre um LlmCompletion ────────────────────────────
export interface LlmBundle {
  /** GO-LIVE-02 (aditivo): o completamento cru — usado pela tradução humanizada
   *  das anotações do advogado. null = offline (tradução fica pendente). */
  readonly completion: LlmCompletion | null;
  readonly provider: string;
  readonly perception: LlmPerceptionPort;
  readonly expression: LlmExpressionPort;
  /** null em offline: usa a narração/extração determinística congelada (2E). */
  readonly narration: AdminNarrationPort | null;
  readonly extractor: MemoryAttributeExtractorPort | null;
  /** Uso acumulado (Shadow Mode): chamadas e tokens. */
  readonly meter: TokensMeter;
}

const SENTIMENTS = new Set(['positive', 'neutral', 'negative', 'anxious', 'confused', 'unknown']);
const URGENCIES = new Set(['low', 'normal', 'high', 'unknown']);
// RFC-0044: vocabulário FECHADO de relevância de evento (DF-14). Fora dele ⇒ ausência.
const RELEVANCES = new Set(['RELEVANT', 'INFORMATIVE']);
// GO-LIVE 9C: vocabulário FECHADO do propósito percebido (gate do onboarding).
const PURPOSES = new Set(['greeting', 'smalltalk', 'question', 'service_request', 'unknown']);

export function parseEnrichment(raw: string): PerceptEnrichment | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    const record = asRecord(parsed);
    if (!record) return null;
    const sentiment = asString(record['sentiment']) ?? 'unknown';
    const urgency = asString(record['urgency']) ?? 'unknown';
    const relevance = asString(record['perceivedRelevance']) ?? '';
    const purpose = asString(record['perceivedPurpose']) ?? 'unknown';
    const artifacts = (asArray(record['detectedArtifacts']) ?? []).map((a) => asString(a) ?? '').filter((a) => a !== '');
    return {
      summary: asString(record['summary']) ?? '',
      sentiment: (SENTIMENTS.has(sentiment) ? sentiment : 'unknown') as PerceptEnrichment['sentiment'],
      urgency: (URGENCIES.has(urgency) ? urgency : 'unknown') as PerceptEnrichment['urgency'],
      detectedIntentSignal: asString(record['detectedIntentSignal']),
      detectedArtifacts: artifacts,
      language: asString(record['language']),
      // GO-LIVE 9C: propósito só entra se pertencer ao vocabulário FECHADO.
      perceivedPurpose: (PURPOSES.has(purpose) ? purpose : 'unknown') as NonNullable<PerceptEnrichment['perceivedPurpose']>,
      // RFC-0044: só cruza se pertencer ao vocabulário fechado; caso contrário, AUSENTE.
      ...(RELEVANCES.has(relevance)
        ? { perceivedRelevance: relevance as NonNullable<PerceptEnrichment['perceivedRelevance']> }
        : {}),
    };
  } catch {
    return null;
  }
}

class LlmPerception implements LlmPerceptionPort {
  constructor(
    private readonly llm: LlmCompletion,
    private readonly config: ProductionConfig,
    private readonly track: (op: string, ms: number, ok: boolean, detalhe?: string) => void,
    private readonly clock: Clock,
  ) {}
  async understand(envelope: InboundEnvelope, context: PerceptionContext): Promise<PerceptEnrichment> {
    const t0 = this.clock.now().getTime();
    const system = `${this.config.prompts.global}\n\nTAREFA DE PERCEPÇÃO: analise a mensagem e responda APENAS um JSON: {"summary":string,"sentiment":"positive|neutral|negative|anxious|confused|unknown","urgency":"low|normal|high|unknown","detectedIntentSignal":string|null,"detectedArtifacts":string[],"language":string|null,"perceivedRelevance":"RELEVANT|INFORMATIVE|null","perceivedPurpose":"greeting|smalltalk|question|service_request|unknown"}. perceivedPurpose: greeting=saudação/apresentação sem pedido; smalltalk=conversa social; question=dúvida genérica; service_request=a pessoa PEDE atendimento/serviço (ex.: quer dar entrada, resolver aposentadoria/benefício); unknown=incerto. Você PERCEBE; nunca decide.`;
    const user = `Tipo: ${envelope.kind}\nTexto: ${envelope.text ?? envelope.editedText ?? '(sem texto)'}\nArquivo: ${envelope.fileName ?? '-'}\nContexto recente: ${context.recentSummary ?? '-'}`;
    // 5ª rodada: as falhas intermitentes derrubavam o turno inteiro — UMA
    // retentativa imediata resolve a maioria dos transientes (parse/vazio/erro).
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      try {
        const raw = (await this.llm.complete(system, user)).text;
        const parsed = parseEnrichment(raw);
        this.track('perception', this.clock.now().getTime() - t0, parsed !== null, parsed === null ? `parse falhou (tentativa ${String(tentativa)}); resposta="${raw.slice(0, 200)}"` : undefined);
        if (parsed) return parsed;
      } catch (e) {
        this.track('perception', this.clock.now().getTime() - t0, false, `${e instanceof Error ? e.message : String(e)} (tentativa ${String(tentativa)})`);
      }
    }
    // Degrade explícito: percepção neutra factual (nunca inventa). GO-LIVE 9C:
    // purpose 'unknown' = FAIL-SAFE — sem entendimento, nenhum onboarding nasce.
    return {
      summary: `entrada percebida: ${envelope.kind}`,
      sentiment: 'unknown',
      urgency: 'unknown',
      detectedIntentSignal: null,
      detectedArtifacts: envelope.fileName !== null ? [`artefato documental: ${envelope.fileName}`] : [],
      language: null,
      perceivedPurpose: 'unknown',
    };
  }
}

class LlmExpression implements LlmExpressionPort {
  constructor(
    private readonly llm: LlmCompletion,
    private readonly config: ProductionConfig,
    private readonly track: (op: string, ms: number, ok: boolean, detalhe?: string) => void,
    private readonly clock: Clock,
  ) {}
  async phrase(request: PhrasingRequest): Promise<string> {
    const t0 = this.clock.now().getTime();
    const intent = request.intent;
    const system = `${this.config.prompts.global}\n\n${this.config.prompts.conversation}`;
    // PC-R4 — continuidade da relação: a expressão vê a ÚLTIMA MENSAGEM da pessoa
    // (para responder o que foi de fato perguntado) e o PACOTE DE FATOS do caso
    // (a MESMA verdade do Portal — o teto do dizível). O Brain continua decidindo;
    // o pacote só dá fatos e limites à fala — nunca decide.
    const ultimaMensagem = request.context.lastPercept?.envelope.text ?? null;
    const casoFatos = request.context.casoFatos ?? null;
    // GO-LIVE 9F — o fio da conversa ativa: a resposta nasce da resposta anterior.
    const fio = request.context.fioDaConversa ?? null;
    // GO-LIVE 9G — o conhecimento aprendido: fato aprendido jamais é reperguntado.
    const conhecimento = request.context.conhecimentoDaConversa ?? null;
    const user = [
      `INTENÇÃO DECIDIDA (você apenas frasea): ${intent.directive}${intent.speechAct ? ` / ${intent.speechAct}` : ''}`,
      `Tópico: ${intent.topic ?? '-'}`,
      `Referências: ${intent.references.join(', ') || '-'}`,
      ...(ultimaMensagem !== null && ultimaMensagem !== '' ? [`Última mensagem da pessoa: "${ultimaMensagem}"`] : []),
      ...(fio !== null ? [`FIO DA CONVERSA: ${fio}`] : []),
      ...(conhecimento !== null
        ? [`CONHECIMENTO JÁ APRENDIDO NESTA CONVERSA (jamais pergunte isto de novo): ${conhecimento}`]
        : []),
      ...(casoFatos !== null ? [casoFatos] : []),
      `Tom: ${request.styleGuidance}`,
      `NUNCA repita estas frases: ${request.avoidPhrases.slice(0, 6).join(' | ') || '-'}`,
      'Responda APENAS a mensagem final ao cliente, sem aspas.',
    ].join('\n');
    // 5ª rodada: UMA retentativa imediata antes do degrade (transientes).
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      try {
        const raw = (await this.llm.complete(system, user)).text.trim();
        this.track('expression', this.clock.now().getTime() - t0, raw !== '', raw === '' ? `resposta vazia do modelo (tentativa ${String(tentativa)})` : undefined);
        if (raw !== '') return raw;
      } catch (e) {
        this.track('expression', this.clock.now().getTime() - t0, false, `${e instanceof Error ? e.message : String(e)} (tentativa ${String(tentativa)})`);
      }
    }
    // Degrade explícito (GO-LIVE 9B + correção do teste real de 2026-07-20):
    // o fallback antigo ("volto a falar em breve") criava um BECO SEM SAÍDA no
    // meio da triagem. Se a contabilidade da Jornada 1 conhece o PRÓXIMO
    // documento, o fallback CONTINUA a coleta — determinístico e autorado.
    // Nunca afirma "acompanhando" nem caso/processo (privilégio da Truth Layer).
    const proximoDoc = request.context.onboardingDocumental?.proximo ?? null;
    if (proximoDoc !== null) {
      return `Recebido! 👍 Agora me manda o próximo documento: ${proximoDoc}, por favor.`;
    }
    // Fora da triagem: pedir a repetição mantém a CONVERSA viva (o antigo
    // "volto a falar em breve" era uma promessa que ninguém cumpria).
    return 'Opa, tive uma instabilidade rapidinha aqui 😅 Pode me mandar sua última mensagem de novo, por favor? Já sigo com você.';
  }
}

class LlmNarration implements AdminNarrationPort {
  constructor(
    private readonly llm: LlmCompletion,
    private readonly config: ProductionConfig,
    private readonly track: (op: string, ms: number, ok: boolean, detalhe?: string) => void,
    private readonly clock: Clock,
  ) {}
  async narrate(input: NarrationInput): Promise<string> {
    const t0 = this.clock.now().getTime();
    const facts = Object.entries(input.facts)
      .map(([k, v]) => `${k}: ${v === null ? 'sem dado' : String(v)}`)
      .join('\n');
    const system = `${this.config.prompts.global}\n\n${this.config.prompts.founder}\n${this.config.prompts.admin}`;
    const user = `Tema: ${input.topic}\nDisponível: ${String(input.available)}\nFATOS (narre SOMENTE isto):\n${facts}`;
    try {
      const raw = (await this.llm.complete(system, user)).text.trim();
      this.track('narration', this.clock.now().getTime() - t0, raw !== '');
      if (raw !== '') return raw;
    } catch {
      this.track('narration', this.clock.now().getTime() - t0, false);
    }
    // Degrade determinístico HONESTO (GO-LIVE-03: nunca vazar slug interno tipo
    // "unknown"): sem LLM, fala o fato já calculado — ou declara a ausência.
    if (!input.available) return 'Ainda não tenho esse dado — não vou inventar. Posso capturá-lo quando a fonte existir.';
    const fact = input.facts['fact'];
    return typeof fact === 'string' && fact !== '' ? fact : 'Sem dados para esta pergunta.';
  }
}

class LlmExtractor implements MemoryAttributeExtractorPort {
  constructor(
    private readonly llm: LlmCompletion,
    private readonly config: ProductionConfig,
    private readonly track: (op: string, ms: number, ok: boolean, detalhe?: string) => void,
    private readonly clock: Clock,
  ) {}
  async extract(text: string): Promise<readonly ProposedAttribute[]> {
    const t0 = this.clock.now().getTime();
    const system = `${this.config.prompts.global}\n\n${this.config.prompts.memory}\nResponda APENAS JSON: {"attributes":[{"key":string,"value":string,"confidence":number}]}. Somente o que está LITERALMENTE no texto.`;
    try {
      const raw = (await this.llm.complete(system, `Texto do cliente: ${text}`)).text;
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const parsed: unknown = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) : null;
      const list = asArray(asRecord(parsed)?.['attributes']) ?? [];
      const attributes: ProposedAttribute[] = [];
      for (const item of list) {
        const record = asRecord(item);
        const key = record ? asString(record['key']) : null;
        const value = record ? asString(record['value']) : null;
        if (key !== null && value !== null && key !== '' && value !== '') {
          attributes.push({ key, value, confidence: (record ? asNumber(record['confidence']) : null) ?? 0.5 });
        }
      }
      this.track('extraction', this.clock.now().getTime() - t0, true);
      return attributes;
    } catch {
      this.track('extraction', this.clock.now().getTime() - t0, false);
      return []; // degrade: não extrai nada (nunca inventa)
    }
  }
}

export interface LlmFactoryDeps {
  readonly config: ProductionConfig;
  readonly http: HttpClient;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

/** Seleciona o provedor configurado; 'offline' usa os doubles determinísticos. */
export function createLlmBundle(deps: LlmFactoryDeps): LlmBundle {
  const { config, http, observability, clock } = deps;
  // Correção GO-LIVE (teste real 2026-07-20): 'falha/degrade' sem CAUSA deixou o
  // diagnóstico cego — agora cada degrade loga o MOTIVO literal (exceção, parse
  // ou resposta vazia, com excerto do que o modelo devolveu).
  const track = (op: string, ms: number, ok: boolean, detalhe?: string): void => {
    observability.latency('llm', op, ms, clock.now());
    if (!ok) observability.error('llm', op, clock.now(), detalhe !== undefined && detalhe !== '' ? `falha/degrade: ${detalhe}` : 'falha/degrade');
  };

  let completion: LlmCompletion | null = null;
  if (config.llm.provider === 'openai' && config.llm.openaiApiKey !== '') {
    completion = new OpenAiCompletion(http, config.llm.openaiApiKey, config.llm.openaiModel);
  } else if (config.llm.provider === 'anthropic' && config.llm.anthropicApiKey !== '') {
    completion = new AnthropicCompletion(http, config.llm.anthropicApiKey, config.llm.anthropicModel);
  } else if (config.llm.provider === 'gemini' && config.llm.geminiApiKey !== '') {
    completion = new GeminiCompletion(http, config.llm.geminiApiKey, config.llm.geminiModel);
  }

  if (completion === null) {
    // Offline: doubles determinísticos (nenhuma rede); narração/extração ficam com
    // os defaults determinísticos CONGELADOS de 2E (null = não injeta).
    return {
      completion: null,
      provider: 'offline',
      perception: new FakeLlmPerception(),
      expression: new VaryingLlmExpression(),
      narration: null,
      extractor: null,
      meter: new TokensMeter('offline'),
    };
  }

  // Mede TODO uso (chamadas + tokens) para o Shadow Mode, sem mudar comportamento.
  const meter = new TokensMeter(completion.name);
  const inner = completion;
  const metered: LlmCompletion = {
    name: inner.name,
    async complete(system: string, user: string): Promise<CompletionResult> {
      const result = await inner.complete(system, user);
      meter.record(result.tokensIn, result.tokensOut);
      return result;
    },
  };

  return {
    completion: metered,
    provider: metered.name,
    perception: new LlmPerception(metered, config, track, clock),
    expression: new LlmExpression(metered, config, track, clock),
    narration: new LlmNarration(metered, config, track, clock),
    extractor: new LlmExtractor(metered, config, track, clock),
    meter,
  };
}
