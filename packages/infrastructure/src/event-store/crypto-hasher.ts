// ─────────────────────────────────────────────────────────────────────────────
// CryptoHasher — implementação do port Hasher com SHA-256 (node:crypto). Vive na
// infraestrutura (tecnologia permitida aqui; o domínio jamais importa crypto).
// Suporta o encadeamento verificável dos eventos (R9; Lei 4).
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { Hasher } from '@reconstrua/application';

export class CryptoHasher implements Hasher {
  hash(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }
}
