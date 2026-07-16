// ─────────────────────────────────────────────────────────────────────────────
// InMemoryMediaStore — MediaStorePort em memória (mesma semântica), para testes.
// ─────────────────────────────────────────────────────────────────────────────
import type { MediaStorePort, StoredBlob } from './media-store-port.js';

export class InMemoryMediaStore implements MediaStorePort {
  private readonly blobs = new Map<string, StoredBlob>();

  has(sha256: string): Promise<boolean> {
    return Promise.resolve(this.blobs.has(sha256));
  }

  put(blob: StoredBlob): Promise<void> {
    if (!this.blobs.has(blob.sha256)) this.blobs.set(blob.sha256, blob);
    return Promise.resolve();
  }

  read(sha256: string): Promise<StoredBlob | null> {
    return Promise.resolve(this.blobs.get(sha256) ?? null);
  }

  /** Somente para testes/inspeção. */
  get(sha256: string): StoredBlob | undefined {
    return this.blobs.get(sha256);
  }

  /** Somente para testes/inspeção. */
  count(): number {
    return this.blobs.size;
  }
}
