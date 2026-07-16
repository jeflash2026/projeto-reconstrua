// ─────────────────────────────────────────────────────────────────────────────
// EvolutionMediaClient — implementa MediaGatewayPort via a Evolution API
// (POST /chat/getBase64FromMediaMessage/{instance}), REUTILIZANDO o HttpClient e o
// EvolutionConfig existentes. NÃO altera o EvolutionGateway (apenas importa o tipo
// de config). Extrai a `key` da mensagem do payload cru e devolve o base64.
// ─────────────────────────────────────────────────────────────────────────────
import type { HttpClient } from '../conversation/evolution/http-client.js';
import type { EvolutionConfig } from '../conversation/evolution/evolution-gateway.js';
import type { FetchedMedia, MediaGatewayPort } from './media-gateway-port.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export class EvolutionMediaClient implements MediaGatewayPort {
  constructor(
    private readonly http: HttpClient,
    private readonly config: EvolutionConfig,
  ) {}

  private url(): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return `${base}/chat/getBase64FromMediaMessage/${this.config.instance}`;
  }

  async fetch(rawMessage: unknown): Promise<FetchedMedia | null> {
    const root = asRecord(rawMessage);
    const data = root ? asRecord(root['data']) : null;
    const key = data ? asRecord(data['key']) : null;
    if (!key) return null;

    const response = await this.http.postJson(this.url(), { apikey: this.config.apiKey }, { message: { key }, convertToMp4: false });
    if (response.status !== 200) return null;

    const body = asRecord(response.body);
    if (!body) return null;
    const base64 = asString(body['base64']) ?? asString(body['media']);
    if (base64 === null || base64 === '') return null;
    const mime = asString(body['mimetype']) ?? asString(body['mimeType']) ?? 'application/octet-stream';
    const fileName = asString(body['fileName']);
    return { base64, mime, fileName };
  }
}
