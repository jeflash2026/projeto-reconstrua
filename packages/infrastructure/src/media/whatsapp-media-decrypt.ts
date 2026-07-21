// ─────────────────────────────────────────────────────────────────────────────
// Descriptografia de mídia do WhatsApp (protocolo padrão, o mesmo do Baileys):
// mediaKey (32 bytes) → HKDF-SHA256 (112 bytes, info por tipo) → iv(16) +
// cipherKey(32) + macKey(32); o arquivo baixado do CDN = ciphertext + MAC(10).
// Valida o HMAC-SHA256(iv+ciphertext) antes de decifrar AES-256-CBC.
// Função PURA: qualquer falha (chave inválida, MAC divergente, padding) ⇒ null.
// ─────────────────────────────────────────────────────────────────────────────
import { createDecipheriv, createHmac, hkdfSync } from 'node:crypto';

export type WhatsAppMediaType = 'image' | 'document';

const HKDF_INFO: Readonly<Record<WhatsAppMediaType, string>> = {
  image: 'WhatsApp Image Keys',
  document: 'WhatsApp Document Keys',
};

export function decryptWhatsAppMedia(
  encrypted: Uint8Array,
  mediaKeyBase64: string,
  type: WhatsAppMediaType,
): Uint8Array | null {
  try {
    const mediaKey = Buffer.from(mediaKeyBase64, 'base64');
    if (mediaKey.length !== 32) return null;
    if (encrypted.length <= 10) return null;
    const expanded = Buffer.from(
      hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(HKDF_INFO[type]), 112),
    );
    const iv = expanded.subarray(0, 16);
    const cipherKey = expanded.subarray(16, 48);
    const macKey = expanded.subarray(48, 80);
    const file = Buffer.from(encrypted);
    const ciphertext = file.subarray(0, file.length - 10);
    const mac = file.subarray(file.length - 10);
    const expectedMac = createHmac('sha256', macKey)
      .update(Buffer.concat([iv, ciphertext]))
      .digest()
      .subarray(0, 10);
    if (!expectedMac.equals(mac)) return null;
    const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}
