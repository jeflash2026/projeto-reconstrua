// ─────────────────────────────────────────────────────────────────────────────
// DirectWhatsAppMediaClient — a mídia SEM Evolution (9ª rodada do GO LIVE):
// o webhook real traz imageMessage{url,mediaKey}; baixamos do CDN e
// descriptografamos localmente. O teste cifra com o MESMO protocolo (HKDF →
// AES-256-CBC + MAC) e prova o round-trip completo até o FetchedMedia.
// ─────────────────────────────────────────────────────────────────────────────
import { createCipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { ChainedMediaGateway, DirectWhatsAppMediaClient } from './direct-whatsapp-media-client.js';
import { decryptWhatsAppMedia, type WhatsAppMediaType } from './whatsapp-media-decrypt.js';
import type { FetchedMedia, MediaGatewayPort } from './media-gateway-port.js';

const INFO: Record<WhatsAppMediaType, string> = {
  image: 'WhatsApp Image Keys',
  document: 'WhatsApp Document Keys',
};

/** Cifra `plain` exatamente como o WhatsApp: AES-256-CBC + MAC de 10 bytes. */
function encryptLikeWhatsApp(plain: Buffer, mediaKey: Buffer, type: WhatsAppMediaType): Buffer {
  const expanded = Buffer.from(hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(INFO[type]), 112));
  const iv = expanded.subarray(0, 16);
  const cipherKey = expanded.subarray(16, 48);
  const macKey = expanded.subarray(48, 80);
  const cipher = createCipheriv('aes-256-cbc', cipherKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const mac = createHmac('sha256', macKey).update(Buffer.concat([iv, ciphertext])).digest().subarray(0, 10);
  return Buffer.concat([ciphertext, mac]);
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('foto-do-rg-frente')]);

describe('decryptWhatsAppMedia · protocolo padrão do WhatsApp', () => {
  it('round-trip: cifrado com HKDF/AES/MAC ⇒ decifra byte a byte', () => {
    const mediaKey = randomBytes(32);
    const encrypted = encryptLikeWhatsApp(JPEG, mediaKey, 'image');
    const decrypted = decryptWhatsAppMedia(encrypted, mediaKey.toString('base64'), 'image');
    expect(decrypted).not.toBeNull();
    expect(Buffer.from(decrypted as Uint8Array).equals(JPEG)).toBe(true);
  });

  it('MAC adulterado ⇒ null (nunca entrega bytes corrompidos)', () => {
    const mediaKey = randomBytes(32);
    const encrypted = encryptLikeWhatsApp(JPEG, mediaKey, 'image');
    const adulterado = Buffer.concat([
      encrypted.subarray(0, encrypted.length - 1),
      Buffer.from([encrypted.readUInt8(encrypted.length - 1) ^ 0xff]),
    ]);
    expect(decryptWhatsAppMedia(adulterado, mediaKey.toString('base64'), 'image')).toBeNull();
  });

  it('tipo errado (chaves de document para image) ⇒ null', () => {
    const mediaKey = randomBytes(32);
    const encrypted = encryptLikeWhatsApp(JPEG, mediaKey, 'image');
    expect(decryptWhatsAppMedia(encrypted, mediaKey.toString('base64'), 'document')).toBeNull();
  });
});

describe('DirectWhatsAppMediaClient · o payload REAL do webhook', () => {
  function webhook(media: Record<string, unknown>, campo = 'imageMessage'): unknown {
    return { data: { key: { id: 'MSG-RG' }, message: { [campo]: media }, messageType: campo } };
  }

  it('imageMessage{url,mediaKey} ⇒ baixa do CDN, decifra e entrega o FetchedMedia', async () => {
    const mediaKey = randomBytes(32);
    const encrypted = encryptLikeWhatsApp(JPEG, mediaKey, 'image');
    const urls: string[] = [];
    const client = new DirectWhatsAppMediaClient((url) => {
      urls.push(url);
      return Promise.resolve(new Uint8Array(encrypted));
    });
    const fetched = await client.fetch(
      webhook({ url: 'https://mmg.whatsapp.net/d/f/abc.enc', mediaKey: mediaKey.toString('base64'), mimetype: 'image/jpeg' }),
    );
    expect(urls).toEqual(['https://mmg.whatsapp.net/d/f/abc.enc']);
    expect(fetched).toEqual({ base64: JPEG.toString('base64'), mime: 'image/jpeg', fileName: null });
  });

  it('documentMessage preserva fileName e usa as chaves de documento', async () => {
    const mediaKey = randomBytes(32);
    const pdf = Buffer.concat([Buffer.from('%PDF'), Buffer.from('hiscon')]);
    const encrypted = encryptLikeWhatsApp(pdf, mediaKey, 'document');
    const client = new DirectWhatsAppMediaClient(() => Promise.resolve(new Uint8Array(encrypted)));
    const fetched = await client.fetch(
      webhook(
        { url: 'https://mmg.whatsapp.net/d/f/doc.enc', mediaKey: mediaKey.toString('base64'), mimetype: 'application/pdf', fileName: 'HISCON.pdf' },
        'documentMessage',
      ),
    );
    expect(fetched).toEqual({ base64: pdf.toString('base64'), mime: 'application/pdf', fileName: 'HISCON.pdf' });
  });

  it('sem url/mediaKey (texto puro) ⇒ null sem download', async () => {
    const client = new DirectWhatsAppMediaClient(() => {
      throw new Error('nao deveria baixar');
    });
    expect(await client.fetch({ data: { key: { id: 'M' }, message: { conversation: 'oi' } } })).toBeNull();
    expect(await client.fetch(webhook({ mimetype: 'image/jpeg' }))).toBeNull();
  });

  it('download falhou ⇒ null (a captura loga e a progressão tardia cobre)', async () => {
    const client = new DirectWhatsAppMediaClient(() => Promise.resolve(null));
    const fetched = await client.fetch(webhook({ url: 'https://mmg.whatsapp.net/x.enc', mediaKey: randomBytes(32).toString('base64') }));
    expect(fetched).toBeNull();
  });
});

describe('ChainedMediaGateway · ordem e curto-circuito', () => {
  const entrega = (m: FetchedMedia | null): MediaGatewayPort => ({ fetch: () => Promise.resolve(m) });

  it('primeiro null ⇒ tenta o próximo; primeiro conteúdo vence', async () => {
    const media: FetchedMedia = { base64: 'QUJD', mime: 'image/jpeg', fileName: null };
    const chain = new ChainedMediaGateway([entrega(null), entrega(media), entrega({ base64: 'X', mime: 'x', fileName: null })]);
    expect(await chain.fetch({})).toEqual(media);
  });

  it('todos null ⇒ null', async () => {
    const chain = new ChainedMediaGateway([entrega(null), entrega(null)]);
    expect(await chain.fetch({})).toBeNull();
  });
});
