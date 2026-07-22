// ─────────────────────────────────────────────────────────────────────────────
// Testes do DocumentContentService (CAT-02C) — documentId → conteúdo real, via
// DocumentLink (CAT-02B) + MediaStore.read (CAT-02A). null quando falta vínculo/blob.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonDocumentLinkStore } from './document-link-store.js';
import { InMemoryMediaStore } from './in-memory-media-store.js';
import { DocumentContentService } from './document-content-service.js';

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

describe('DocumentContentService (CAT-02C)', () => {
  it('documentId com vínculo e blob ⇒ devolve conteúdo (bytes, mime, size)', async () => {
    const json = new InMemoryJsonStore();
    const links = new JsonDocumentLinkStore(json);
    const store = new InMemoryMediaStore();
    await store.put({ sha256: 'S1', mime: 'application/pdf', size: bytes.length, bytes });
    await links.save({
      documentId: 'DOC-1',
      messageId: 'M1',
      sha256: 'S1',
      mime: 'application/pdf',
    });

    const content = await new DocumentContentService(links, store).byDocumentId('DOC-1');
    expect(content).toEqual({ bytes, mime: 'application/pdf', size: bytes.length });
  });

  it('sem vínculo ⇒ null', async () => {
    const json = new InMemoryJsonStore();
    const svc = new DocumentContentService(
      new JsonDocumentLinkStore(json),
      new InMemoryMediaStore(),
    );
    expect(await svc.byDocumentId('DESCONHECIDO')).toBeNull();
  });

  it('vínculo aponta para blob inexistente ⇒ null', async () => {
    const json = new InMemoryJsonStore();
    const links = new JsonDocumentLinkStore(json);
    await links.save({
      documentId: 'DOC-2',
      messageId: 'M2',
      sha256: 'AUSENTE',
      mime: 'application/pdf',
    });
    expect(
      await new DocumentContentService(links, new InMemoryMediaStore()).byDocumentId('DOC-2'),
    ).toBeNull();
  });
});
