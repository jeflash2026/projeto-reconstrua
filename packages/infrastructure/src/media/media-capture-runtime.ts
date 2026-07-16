// ─────────────────────────────────────────────────────────────────────────────
// MediaCaptureRuntime — orquestra a captura dos BYTES reais (CAT-02A):
//   fetch (base64) → validar (allowlist MIME, tamanho, magic bytes) → sha256 →
//   deduplicar → persistir o blob. BEST-EFFORT: NUNCA lança; toda falha só gera
//   log. Não faz OCR, IA, reconhecimento, classificação nem toca no fluxo de conversa.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { MediaGatewayPort } from './media-gateway-port.js';
import type { MediaStorePort } from './media-store-port.js';

const DEFAULT_ALLOWLIST: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/** Assinatura de bytes iniciais (magic bytes) esperada por MIME. */
const MAGIC: Readonly<Record<string, readonly number[]>> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

export interface MediaCaptureDeps {
  readonly gateway: MediaGatewayPort;
  readonly store: MediaStorePort;
  readonly allowlist?: readonly string[];
  readonly maxBytes?: number;
  readonly log?: (message: string) => void;
}

export class MediaCaptureRuntime {
  private readonly allowlist: readonly string[];
  private readonly maxBytes: number;

  constructor(private readonly deps: MediaCaptureDeps) {
    this.allowlist = deps.allowlist ?? DEFAULT_ALLOWLIST;
    this.maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  /** Captura best-effort. NUNCA lança — toda falha apenas gera log. */
  async capture(rawMessage: unknown): Promise<void> {
    try {
      const fetched = await this.deps.gateway.fetch(rawMessage);
      if (fetched === null) {
        this.log('midia indisponivel na Evolution');
        return;
      }
      if (!this.allowlist.includes(fetched.mime)) {
        this.log(`mime nao permitido: ${fetched.mime}`);
        return;
      }
      const bytes = decodeBase64(fetched.base64);
      if (bytes === null || bytes.length === 0) {
        this.log('conteudo invalido ou vazio');
        return;
      }
      if (bytes.length > this.maxBytes) {
        this.log(`excede o limite de tamanho: ${String(bytes.length)} bytes`);
        return;
      }
      if (!matchesMagic(fetched.mime, bytes)) {
        this.log(`magic bytes nao conferem para ${fetched.mime}`);
        return;
      }
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (await this.deps.store.has(sha256)) {
        this.log(`dedup: ${sha256} ja armazenado`);
        return;
      }
      await this.deps.store.put({ sha256, mime: fetched.mime, size: bytes.length, bytes });
    } catch (error) {
      this.log(`falha na captura: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private log(message: string): void {
    if (this.deps.log) this.deps.log(message);
  }
}

function decodeBase64(base64: string): Uint8Array | null {
  try {
    const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    return new Uint8Array(Buffer.from(clean, 'base64'));
  } catch {
    return null;
  }
}

function matchesMagic(mime: string, bytes: Uint8Array): boolean {
  const magic = MAGIC[mime];
  if (!magic) return false;
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}
