// ─────────────────────────────────────────────────────────────────────────────
// EvolutionMediaClient — implementa MediaGatewayPort via a Evolution API
// (POST /chat/getBase64FromMediaMessage/{instance}), REUTILIZANDO o HttpClient e o
// EvolutionConfig existentes. NÃO altera o EvolutionGateway (apenas importa o tipo
// de config). Extrai a `key` da mensagem do payload cru e devolve o base64.
// ─────────────────────────────────────────────────────────────────────────────
import type { HttpClient } from '../conversation/evolution/http-client.js';
import type { EvolutionConfig } from '../conversation/evolution/evolution-gateway.js';
import { asRecord, asString } from './raw.js';
import type { FetchedMedia, MediaGatewayPort } from './media-gateway-port.js';

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
    const embutida = embeddedMedia(data);
    if (embutida !== null) return embutida;
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

// Com o webhook configurado com base64:true a Evolution entrega o conteúdo da
// mídia DENTRO do próprio evento. É o único caminho quando a instância não
// persiste mensagens recebidas — nesse cenário getBase64FromMediaMessage nunca
// encontra a mensagem. O NÍVEL onde o campo "base64" aparece varia entre versões
// da Evolution (data.message.base64, data.base64, dentro do *Message…), então a
// busca é PROFUNDA por nome de chave, não por caminho fixo.
function embeddedMedia(data: Record<string, unknown> | null): FetchedMedia | null {
  if (data === null) return null;
  const base64 = deepFindString(data, 'base64', 5);
  if (base64 === null || base64 === '') return null;
  const mime = deepFindString(data, 'mimetype', 6) ?? 'application/octet-stream';
  const fileName = deepFindString(data, 'fileName', 6);
  return { base64, mime, fileName };
}

/** Primeira string não-vazia sob a chave `key`, em qualquer nível até `depth`. */
function deepFindString(value: unknown, key: string, depth: number): string | null {
  if (depth < 0) return null;
  const rec = asRecord(value);
  if (rec === null) return null;
  const direct = asString(rec[key]);
  if (direct !== null && direct !== '') return direct;
  for (const k of Object.keys(rec)) {
    const found = deepFindString(rec[k], key, depth - 1);
    if (found !== null) return found;
  }
  return null;
}
