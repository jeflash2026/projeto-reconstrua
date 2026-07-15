// ─────────────────────────────────────────────────────────────────────────────
// SystemClock / UuidV4Generator — implementações dos ports de tempo e identidade
// do kernel. Vivem na infraestrutura (o domínio recebe estes ports; nunca lê o
// relógio nem gera UUID por conta própria).
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class UuidV4Generator implements UuidGenerator {
  next(): Uuid {
    return toUuid(randomUUID());
  }
}
