// ─────────────────────────────────────────────────────────────────────────────
// Testes do MAPPER do webhook oficial (Meta Cloud API): payload real → o MESMO
// InboundEnvelope da Evolution (identidade JID compartilhada), media ID exposto
// para download posterior, recibos (statuses) ignorados.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { mapMetaWebhook } from './meta-webhook-mapper.js';

function payloadCom(messages: unknown[], value: Record<string, unknown> = {}): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '5516996369934', phone_number_id: '111' },
              contacts: [{ profile: { name: 'Humberto' }, wa_id: '5511988887777' }],
              messages,
              ...value,
            },
          },
        ],
      },
    ],
  };
}

describe('mapMetaWebhook', () => {
  it('texto vira envelope kind=text com o MESMO JID da Evolution (mesma conversa)', () => {
    const r = mapMetaWebhook(
      payloadCom([
        {
          from: '5511988887777',
          id: 'wamid.ABC',
          timestamp: '1753900000',
          type: 'text',
          text: { body: 'oi, quero a análise' },
        },
      ]),
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.envelope).toMatchObject({
      messageId: 'wamid.ABC',
      chatId: '5511988887777@s.whatsapp.net',
      from: '5511988887777@s.whatsapp.net',
      kind: 'text',
      text: 'oi, quero a análise',
    });
    expect(r[0]?.envelope.timestamp.toISOString()).toBe(new Date(1753900000 * 1000).toISOString());
    expect(r[0]?.mediaId).toBe(null);
  });

  it('documento PDF vira kind=pdf com fileName e media ID (o HISCON continua fluindo)', () => {
    const r = mapMetaWebhook(
      payloadCom([
        {
          from: '5511988887777',
          id: 'wamid.DOC',
          timestamp: '1753900001',
          type: 'document',
          document: {
            id: 'MEDIA-42',
            mime_type: 'application/pdf',
            filename: 'hiscon_completo.pdf',
            caption: 'segue o documento',
          },
        },
      ]),
    );
    expect(r[0]?.envelope).toMatchObject({
      kind: 'pdf',
      fileName: 'hiscon_completo.pdf',
      mediaMimeType: 'application/pdf',
      text: 'segue o documento',
    });
    expect(r[0]?.mediaId).toBe('MEDIA-42');
  });

  it('imagem e reação mapeiam; recibos (statuses) e tipos sem tratamento são ignorados', () => {
    const r = mapMetaWebhook(
      payloadCom(
        [
          {
            from: '5511988887777',
            id: 'wamid.IMG',
            timestamp: '1753900002',
            type: 'image',
            image: { id: 'MEDIA-7', mime_type: 'image/jpeg', caption: null },
          },
          {
            from: '5511988887777',
            id: 'wamid.REACT',
            timestamp: '1753900003',
            type: 'reaction',
            reaction: { message_id: 'wamid.ABC', emoji: '👍' },
          },
          { from: '5511988887777', id: 'wamid.STICKER', timestamp: '1753900004', type: 'sticker' },
        ],
        { statuses: [{ id: 'wamid.OUT', status: 'delivered' }] },
      ),
    );
    expect(r).toHaveLength(2);
    expect(r[0]?.envelope.kind).toBe('image');
    expect(r[0]?.mediaId).toBe('MEDIA-7');
    expect(r[1]?.envelope).toMatchObject({
      kind: 'reaction',
      reactionEmoji: '👍',
      reactionToMessageId: 'wamid.ABC',
    });
  });

  it('payload só de recibos (sem messages) ou irreconhecível ⇒ lista vazia', () => {
    expect(mapMetaWebhook(payloadCom([], { statuses: [{ status: 'read' }] }))).toEqual([]);
    expect(mapMetaWebhook(null)).toEqual([]);
    expect(mapMetaWebhook({ object: 'page' })).toEqual([]);
  });
});
