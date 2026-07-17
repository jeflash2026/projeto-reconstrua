// ─────────────────────────────────────────────────────────────────────────────
// Rota interna de conteúdo (CAT-02C) — GET /admin/documents/:documentId/content
// no servidor admin. Prova: 200 + bytes + content-type quando há vínculo/blob;
// 404 quando não há.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import {
  assembleAdminOperation,
  DocumentContentService,
  FakeSleeper,
  InMemoryJsonStore,
  InMemoryMediaStore,
  JsonDocumentLinkStore,
  type AssembledAdminOperation,
} from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

class TestClock implements Clock {
  private t = new Date('2026-07-16T00:00:00.000Z').getTime();
  now(): Date {
    return new Date(this.t);
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const CONTENT_SECRET = 'TEST-ADMIN-SECRET';

async function appWithContent(): Promise<ReturnType<typeof buildAdminServer>> {
  const clock = new TestClock();
  const json = new InMemoryJsonStore();
  const links = new JsonDocumentLinkStore(json);
  const store = new InMemoryMediaStore();
  await store.put({ sha256: 'S1', mime: 'application/pdf', size: bytes.length, bytes });
  await links.save({ documentId: 'DOC-1', messageId: 'M1', sha256: 'S1', mime: 'application/pdf' });
  const op: AssembledAdminOperation = {
    ...assembleAdminOperation({ clock, uuid: new SeqUuid(), sleeper: new FakeSleeper(clock) }),
    documentContent: new DocumentContentService(links, store),
  };
  return buildAdminServer(op, { accessSecret: CONTENT_SECRET });
}

describe('CAT-02C · GET /admin/documents/:documentId/content', () => {
  it('documento com conteúdo ⇒ 200 + bytes + content-type', async () => {
    const app = await appWithContent();
    const res = await app.inject({ method: 'GET', url: '/admin/documents/DOC-1/content', headers: { authorization: `Bearer ${CONTENT_SECRET}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(new Uint8Array(res.rawPayload)).toEqual(bytes);
  });

  it('documento sem conteúdo ⇒ 404', async () => {
    const app = await appWithContent();
    const res = await app.inject({ method: 'GET', url: '/admin/documents/DESCONHECIDO/content', headers: { authorization: `Bearer ${CONTENT_SECRET}` } });
    expect(res.statusCode).toBe(404);
  });
});
