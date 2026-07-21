// ─────────────────────────────────────────────────────────────────────────────
// AnthropicVisionClient — DocumentReaderPort via Anthropic Vision
// (POST /v1/messages com bloco de conteúdo image/document em base64). Adapter
// SEPARADO do AnthropicCompletion de texto (não mistura texto e visão; não o
// altera). Reutiliza o HttpClient e a chave/modelo já existentes.
// ─────────────────────────────────────────────────────────────────────────────
import type { HttpClient } from '../conversation/evolution/http-client.js';
import { asArray, asRecord, asString } from '../conversation/json.js';
import type { DocumentReaderPort } from './document-reader-port.js';

const TRANSCRIBE_PROMPT =
  'Transcreva integralmente, em texto puro, todo o conteúdo textual deste documento, na ordem em que aparece. Não resuma, não interprete e não adicione comentários.';

/** Monta o bloco de conteúdo (image ou document) para a Anthropic; null se mime não suportado. */
function mediaBlock(bytes: Uint8Array, mime: string): Record<string, unknown> | null {
  const data = Buffer.from(bytes).toString('base64');
  if (mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: mime, data } };
  }
  if (mime === 'image/jpeg' || mime === 'image/png') {
    return { type: 'image', source: { type: 'base64', media_type: mime, data } };
  }
  return null;
}

export class AnthropicVisionClient implements DocumentReaderPort {
  constructor(
    private readonly http: HttpClient,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async read(bytes: Uint8Array, mime: string): Promise<string | null> {
    const block = mediaBlock(bytes, mime);
    if (block === null) return null;

    const response = await this.http.postJson(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      // 17ª rodada: 4096 truncava o HISCON de 13 páginas em ~6k chars — os
      // contratos excluídos/encerrados e as seções RMC/RCC ficavam de fora.
      {
        model: this.model,
        max_tokens: 32000,
        messages: [{ role: 'user', content: [block, { type: 'text', text: TRANSCRIBE_PROMPT }] }],
      },
    );
    // 2xx completo + erro LITERAL (mesma lição do HTTP 201 da mídia e do 429 do
    // LLM): status fora de 2xx lança com o corpo — o DocumentReaderService
    // captura e loga a causa real em vez de um null mudo.
    if (response.status < 200 || response.status >= 300) {
      let excerto = '';
      try {
        excerto = JSON.stringify(response.body).replace(/\s+/g, ' ').slice(0, 200);
      } catch {
        excerto = String(response.body).slice(0, 200);
      }
      throw new Error(`anthropic-vision HTTP ${String(response.status)}: ${excerto}`);
    }

    // 15ª rodada (verso do RG): mesmo defeito do adapter de texto — ler só o
    // content[0] perdia respostas em múltiplos blocos. Concatena TODOS os blocos
    // de texto; se ainda assim vier vazio, LANÇA com o corpo real (stop_reason/
    // recusa/formato aparecem no log em vez de "visao nao retornou texto" mudo.
    const blocos = asArray(asRecord(response.body)?.['content']) ?? [];
    const texto = blocos
      .map((b) => asString(asRecord(b)?.['text']) ?? '')
      .filter((t) => t !== '')
      .join('\n');
    if (texto === '') {
      let excerto = '';
      try {
        excerto = JSON.stringify(response.body).replace(/\s+/g, ' ').slice(0, 300);
      } catch {
        excerto = String(response.body).slice(0, 300);
      }
      throw new Error(`anthropic-vision 2xx sem texto no content :: ${excerto}`);
    }
    return texto;
  }
}
