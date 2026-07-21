// ─────────────────────────────────────────────────────────────────────────────
// DirectWhatsAppMediaClient — obtém a mídia SEM depender da Evolution: o próprio
// evento do webhook carrega o descritor do WhatsApp (url do CDN + mediaKey).
// Baixa o arquivo cifrado do mmg.whatsapp.net e descriptografa localmente.
// Caminho definitivo quando a instância não persiste mensagens recebidas e o
// webhook não embute base64 (cenário real do GO LIVE, 8ª/9ª rodadas).
// ─────────────────────────────────────────────────────────────────────────────
import { asRecord, asString } from './raw.js';
import type { FetchedMedia, MediaGatewayPort } from './media-gateway-port.js';
import { decryptWhatsAppMedia, type WhatsAppMediaType } from './whatsapp-media-decrypt.js';

export type MediaDownloader = (url: string) => Promise<Uint8Array | null>;

const defaultDownload: MediaDownloader = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return new Uint8Array(await response.arrayBuffer());
};

interface Candidato {
  readonly tipo: WhatsAppMediaType;
  readonly media: Record<string, unknown>;
}

/** imageMessage/documentMessage do evento (inclui documentWithCaptionMessage). */
function candidato(message: Record<string, unknown>): Candidato | null {
  const image = asRecord(message['imageMessage']);
  if (image) return { tipo: 'image', media: image };
  const doc = asRecord(message['documentMessage']);
  if (doc) return { tipo: 'document', media: doc };
  const comLegenda = asRecord(message['documentWithCaptionMessage']);
  const interna = comLegenda ? asRecord(comLegenda['message']) : null;
  const docInterno = interna ? asRecord(interna['documentMessage']) : null;
  if (docInterno) return { tipo: 'document', media: docInterno };
  return null;
}

export class DirectWhatsAppMediaClient implements MediaGatewayPort {
  constructor(
    private readonly download: MediaDownloader = defaultDownload,
    private readonly log: (message: string) => void = () => undefined,
  ) {}

  async fetch(rawMessage: unknown): Promise<FetchedMedia | null> {
    const root = asRecord(rawMessage);
    const data = root ? asRecord(root['data']) : null;
    const message = data ? asRecord(data['message']) : null;
    if (!message) return null;
    const alvo = candidato(message);
    if (alvo === null) return null;
    const url = asString(alvo.media['url']);
    const mediaKey = asString(alvo.media['mediaKey']);
    if (url === null || url === '' || mediaKey === null || mediaKey === '') {
      this.log(`direct: sem url/mediaKey no ${alvo.tipo} (chaves=[${Object.keys(alvo.media).join(',')}])`);
      return null;
    }
    let encrypted: Uint8Array | null = null;
    try {
      encrypted = await this.download(url);
    } catch (erro) {
      this.log(`direct: download do CDN falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
      return null;
    }
    if (encrypted === null) {
      this.log(`direct: download do CDN vazio (${url.slice(0, 60)}…)`);
      return null;
    }
    const bytes = decryptWhatsAppMedia(encrypted, mediaKey, alvo.tipo);
    if (bytes === null) {
      this.log(`direct: descriptografia/MAC falhou (${String(encrypted.length)} bytes baixados)`);
      return null;
    }
    this.log(`direct: midia decifrada (${String(bytes.length)} bytes, ${asString(alvo.media['mimetype']) ?? '?'})`);
    return {
      base64: Buffer.from(bytes).toString('base64'),
      mime: asString(alvo.media['mimetype']) ?? 'application/octet-stream',
      fileName: asString(alvo.media['fileName']),
    };
  }
}

/** Tenta cada gateway em ordem; o primeiro que entregar conteúdo vence. */
export class ChainedMediaGateway implements MediaGatewayPort {
  constructor(private readonly gateways: readonly MediaGatewayPort[]) {}

  async fetch(rawMessage: unknown): Promise<FetchedMedia | null> {
    for (const gateway of this.gateways) {
      const fetched = await gateway.fetch(rawMessage);
      if (fetched !== null) return fetched;
    }
    return null;
  }
}
