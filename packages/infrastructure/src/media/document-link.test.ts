// ─────────────────────────────────────────────────────────────────────────────
// Testes CAT-02B — o vínculo definitivo blob↔mensagem↔documento.
//  • a captura grava messageId → sha256 (MediaReference);
//  • o subscriber, ao reconhecer o documento, materializa documentId → link;
//  • corrida (blob ainda não capturado) ⇒ lança (dispatcher re-tenta);
//  • idempotência do vínculo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { InMemoryJsonStore } from '../production/json-store.js';
import { MediaCaptureRuntime } from './media-capture-runtime.js';
import { InMemoryMediaStore } from './in-memory-media-store.js';
import { JsonMediaReferenceStore } from './media-reference-store.js';
import { JsonDocumentLinkStore } from './document-link-store.js';
import { DocumentLinkSubscriber } from './document-link-subscriber.js';
import type { FetchedMedia, MediaGatewayPort } from './media-gateway-port.js';

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const shaPdf = createHash('sha256').update(Uint8Array.from(PDF_BYTES)).digest('hex');

class FakeGateway implements MediaGatewayPort {
  fetch(): Promise<FetchedMedia | null> {
    return Promise.resolve({
      base64: Buffer.from(Uint8Array.from(PDF_BYTES)).toString('base64'),
      mime: 'application/pdf',
      fileName: 'HISCON.pdf',
    });
  }
}

const rawMessage = (messageId: string): unknown => ({
  data: { key: { id: messageId, remoteJid: '5541@x', fromMe: false } },
});

function eventDocRecognized(
  documentId: string,
  messageId: string,
  mime = 'application/pdf',
): {
  streamId: string;
  eventType: string;
  provenance: { factRef: string };
  payload: Record<string, unknown>;
} {
  return {
    streamId: documentId,
    eventType: 'document.recognized',
    provenance: { factRef: messageId },
    payload: { mimeType: mime },
  };
}

describe('CAT-02B · captura grava a referência messageId → sha256', () => {
  it('capture com references ligado persiste MediaReference', async () => {
    const json = new InMemoryJsonStore();
    const references = new JsonMediaReferenceStore(json);
    await new MediaCaptureRuntime({
      gateway: new FakeGateway(),
      store: new InMemoryMediaStore(),
      references,
    }).capture(rawMessage('MSG-1'));
    const ref = await references.byMessageId('MSG-1');
    expect(ref).toMatchObject({
      messageId: 'MSG-1',
      sha256: shaPdf,
      mime: 'application/pdf',
      size: PDF_BYTES.length,
    });
  });
});

describe('CAT-02B · subscriber materializa o vínculo definitivo', () => {
  it('reconhecimento após captura ⇒ documentId → { messageId, sha256, mime }', async () => {
    const json = new InMemoryJsonStore();
    const references = new JsonMediaReferenceStore(json);
    const links = new JsonDocumentLinkStore(json);
    await references.save({
      messageId: 'MSG-2',
      sha256: shaPdf,
      mime: 'application/pdf',
      size: PDF_BYTES.length,
    });

    const sub = new DocumentLinkSubscriber(references, links);
    await sub.handle(
      eventDocRecognized('DOC-2', 'MSG-2') as unknown as Parameters<typeof sub.handle>[0],
    );

    expect(await links.byDocumentId('DOC-2')).toEqual({
      documentId: 'DOC-2',
      messageId: 'MSG-2',
      sha256: shaPdf,
      mime: 'application/pdf',
    });
  });

  it('corrida: blob ainda não capturado ⇒ LANÇA (dispatcher re-tenta)', async () => {
    const json = new InMemoryJsonStore();
    const sub = new DocumentLinkSubscriber(
      new JsonMediaReferenceStore(json),
      new JsonDocumentLinkStore(json),
    );
    await expect(
      sub.handle(
        eventDocRecognized('DOC-3', 'MSG-3') as unknown as Parameters<typeof sub.handle>[0],
      ),
    ).rejects.toThrow(/ainda nao capturado/);
  });

  it('idempotente: re-processar o mesmo evento mantém o mesmo vínculo', async () => {
    const json = new InMemoryJsonStore();
    const references = new JsonMediaReferenceStore(json);
    const links = new JsonDocumentLinkStore(json);
    await references.save({
      messageId: 'MSG-4',
      sha256: shaPdf,
      mime: 'application/pdf',
      size: PDF_BYTES.length,
    });
    const sub = new DocumentLinkSubscriber(references, links);
    const ev = eventDocRecognized('DOC-4', 'MSG-4') as unknown as Parameters<typeof sub.handle>[0];
    await sub.handle(ev);
    await sub.handle(ev);
    expect(await links.byDocumentId('DOC-4')).toMatchObject({
      documentId: 'DOC-4',
      sha256: shaPdf,
    });
  });

  it('evento sem messageId ⇒ no-op (não lança, não liga)', async () => {
    const json = new InMemoryJsonStore();
    const links = new JsonDocumentLinkStore(json);
    const sub = new DocumentLinkSubscriber(new JsonMediaReferenceStore(json), links);
    await sub.handle({
      streamId: 'DOC-5',
      eventType: 'document.recognized',
      provenance: { factRef: null },
      payload: {},
    } as unknown as Parameters<typeof sub.handle>[0]);
    expect(await links.byDocumentId('DOC-5')).toBeNull();
  });

  it('fim-a-fim: captura grava a referência e o subscriber liga o documento', async () => {
    const json = new InMemoryJsonStore();
    const references = new JsonMediaReferenceStore(json);
    const links = new JsonDocumentLinkStore(json);
    await new MediaCaptureRuntime({
      gateway: new FakeGateway(),
      store: new InMemoryMediaStore(),
      references,
    }).capture(rawMessage('MSG-6'));
    await new DocumentLinkSubscriber(references, links).handle(
      eventDocRecognized('DOC-6', 'MSG-6') as unknown as Parameters<
        InstanceType<typeof DocumentLinkSubscriber>['handle']
      >[0],
    );
    expect(await links.byDocumentId('DOC-6')).toEqual({
      documentId: 'DOC-6',
      messageId: 'MSG-6',
      sha256: shaPdf,
      mime: 'application/pdf',
    });
  });
});
