// ─────────────────────────────────────────────────────────────────────────────
// VOZ (2026-10-19) — ouvido e boca da AHRI, sobre a OpenAI.
//
// Pedido do dono: "um link onde eu acesse por PC ou celular e consiga conversar
// por áudio com a AHRI". O cérebro já existe (o Jarvis responde pergunta livre
// fundamentada nos read models); o que faltava eram as duas pontas.
//
//   transcrever()  áudio do microfone → texto   (Whisper)
//   falar()        texto da resposta  → áudio   (TTS)
//
// Por que `fetch` direto e não o HttpClient do projeto: ele só sabe postJson, e
// aqui um lado precisa de multipart/form-data e o outro devolve binário. O que
// se mantém dele é a disciplina que importa — TETO DE ESPERA em toda chamada,
// porque uma requisição pendurada trava o turno inteiro.
//
// NUNCA LANÇA: falha devolve null e quem chamou decide o que dizer ao usuário.
// Voz é conforto, não função crítica — se faltar, a conversa segue por texto.
// ─────────────────────────────────────────────────────────────────────────────

export interface AudioFalado {
  readonly mime: string;
  readonly bytes: Uint8Array;
}

export interface VozDeps {
  readonly apiKey: string;
  /** Modelo de transcrição. Padrão `whisper-1` (estável e barato). */
  readonly modeloOuvido?: string;
  /** Modelo de síntese. Padrão `tts-1`; `tts-1-hd` soa melhor e custa mais. */
  readonly modeloFala?: string;
  /** Timbre. `nova` é feminino, claro e sem sotaque marcado em pt-BR. */
  readonly voz?: string;
  readonly timeoutMs?: number;
  readonly aoFalhar?: (etapa: string, mensagem: string) => void;
}

/** Teto de 1 minuto: áudio de pergunta é curto; acima disso algo travou. */
const TIMEOUT_PADRAO = 60_000;

/** A resposta falada é cortada: TTS cobra por caractere e ninguém ouve com
 *  atenção um parágrafo gigante. O texto completo continua na tela. */
const MAX_CARACTERES_FALADOS = 2_000;

export class VozOpenAi {
  constructor(private readonly deps: VozDeps) {}

  private get timeout(): number {
    return this.deps.timeoutMs ?? TIMEOUT_PADRAO;
  }

  private falhou(etapa: string, erro: unknown): null {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    this.deps.aoFalhar?.(etapa, mensagem);
    return null;
  }

  /** Áudio do microfone → texto. null quando não dá para transcrever. */
  async transcrever(bytes: Uint8Array, mime: string): Promise<string | null> {
    if (this.deps.apiKey === '') return this.falhou('ouvir', 'sem OPENAI_API_KEY');
    if (bytes.length === 0) return this.falhou('ouvir', 'áudio vazio');
    try {
      // A extensão importa para a OpenAI reconhecer o container; o mime do
      // MediaRecorder vem como 'audio/webm;codecs=opus'.
      const extensao = /mp4|m4a/.test(mime) ? 'mp4' : /ogg/.test(mime) ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: mime }), `fala.${extensao}`);
      form.append('model', this.deps.modeloOuvido ?? 'whisper-1');
      // Declarar o idioma melhora muito a precisão com nome próprio brasileiro.
      form.append('language', 'pt');
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.deps.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(this.timeout),
      });
      if (!res.ok) return this.falhou('ouvir', `HTTP ${String(res.status)}: ${await res.text()}`);
      const corpo = (await res.json()) as { text?: unknown };
      const texto = typeof corpo.text === 'string' ? corpo.text.trim() : '';
      return texto === '' ? null : texto;
    } catch (erro) {
      return this.falhou('ouvir', erro);
    }
  }

  /** Texto da resposta → áudio MP3. null quando não dá para sintetizar. */
  async falar(texto: string): Promise<AudioFalado | null> {
    if (this.deps.apiKey === '') return this.falhou('falar', 'sem OPENAI_API_KEY');
    const limpo = texto.trim();
    if (limpo === '') return this.falhou('falar', 'texto vazio');
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.deps.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.deps.modeloFala ?? 'tts-1',
          voice: this.deps.voz ?? 'nova',
          input: limpo.slice(0, MAX_CARACTERES_FALADOS),
          response_format: 'mp3',
        }),
        signal: AbortSignal.timeout(this.timeout),
      });
      if (!res.ok) return this.falhou('falar', `HTTP ${String(res.status)}: ${await res.text()}`);
      return { mime: 'audio/mpeg', bytes: new Uint8Array(await res.arrayBuffer()) };
    } catch (erro) {
      return this.falhou('falar', erro);
    }
  }
}
