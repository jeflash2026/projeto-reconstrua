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
      { model: this.model, max_tokens: 4096, messages: [{ role: 'user', content: [block, { type: 'text', text: TRANSCRIBE_PROMPT }] }] },
    );
    if (response.status !== 200) return null;

    const first = asArray(asRecord(response.body)?.['content'])?.[0];
    const text = asString(asRecord(first)?.['text']);
    return text !== null && text !== '' ? text : null;
  }
}
