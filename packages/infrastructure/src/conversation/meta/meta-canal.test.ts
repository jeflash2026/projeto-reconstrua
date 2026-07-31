// ─────────────────────────────────────────────────────────────────────────────
// Testes do CANAL OFICIAL (Meta Cloud API): gateway (corpo/URL/headers certos),
// runtime do webhook (texto → entrada única; PDF → referência+blob ANTES do
// turno) e roteador de saída (canal do último contato decide o carteiro).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import type { InboundEnvelope } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import { InMemoryJsonStore } from '../../production/json-store.js';
import { InMemoryMediaStore } from '../../media/in-memory-media-store.js';
import { JsonMediaReferenceStore } from '../../media/media-reference-store.js';
import { InMemoryConversationGateway } from '../in-memory-conversation-gateway.js';
import { MetaCloudGateway, type MetaHttp, type MetaHttpResponse } from './meta-cloud-gateway.js';
import { CanalDoChatStore, MetaCanalRuntime } from './meta-canal.js';
import { MetaGatewayRouter } from './meta-gateway-router.js';

class TestClock implements Clock {
  now(): Date {
    return new Date('2026-07-31T12:00:00.000Z');
  }
}

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

interface Chamada {
  readonly metodo: string;
  readonly url: string;
  readonly body?: unknown;
}

function fakeHttp(respostas?: Partial<Record<string, MetaHttpResponse>>): {
  http: MetaHttp;
  chamadas: Chamada[];
} {
  const chamadas: Chamada[] = [];
  const http: MetaHttp = {
    postJson(url, _headers, body) {
      chamadas.push({ metodo: 'POST', url, body });
      return Promise.resolve(
        respostas?.[url] ?? { status: 200, body: { messages: [{ id: 'wamid.SAIDA' }] } },
      );
    },
    getJson(url) {
      chamadas.push({ metodo: 'GET', url });
      return Promise.resolve(
        respostas?.[url] ?? {
          status: 200,
          body: { url: 'https://lookaside.meta.com/m/42', mime_type: 'application/pdf' },
        },
      );
    },
    getBytes(url) {
      chamadas.push({ metodo: 'GET-BYTES', url });
      return Promise.resolve({ status: 200, bytes: PDF_BYTES });
    },
    postForm(url, _headers, _file, _fields) {
      chamadas.push({ metodo: 'POST-FORM', url });
      return Promise.resolve({ status: 200, body: { id: 'MEDIA-UP-1' } });
    },
  };
  return { http, chamadas };
}

function gatewayCom(http: MetaHttp): MetaCloudGateway {
  return new MetaCloudGateway(http, { token: 'T', phoneNumberId: '111' }, new TestClock());
}

describe('MetaCloudGateway', () => {
  it('sendText fala o dialeto da Cloud API e devolve o wamid', async () => {
    const { http, chamadas } = fakeHttp();
    const receipt = await gatewayCom(http).sendText('5511988887777@s.whatsapp.net', 'olá!');
    expect(chamadas[0]?.url).toBe('https://graph.facebook.com/v23.0/111/messages');
    expect(chamadas[0]?.body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '5511988887777',
      type: 'text',
      text: { body: 'olá!' },
    });
    expect(receipt.providerMessageId).toBe('wamid.SAIDA');
  });

  it('sendDocument sobe a mídia e envia a mensagem de documento', async () => {
    const { http, chamadas } = fakeHttp();
    await gatewayCom(http).sendDocument(
      '5511988887777@s.whatsapp.net',
      { fileName: 'procuracao.pdf', mimeType: 'application/pdf', base64: 'JVBERi0xLjQ=' },
      'segue para assinatura',
    );
    expect(chamadas[0]).toMatchObject({
      metodo: 'POST-FORM',
      url: 'https://graph.facebook.com/v23.0/111/media',
    });
    expect(chamadas[1]?.body).toMatchObject({
      type: 'document',
      document: { id: 'MEDIA-UP-1', filename: 'procuracao.pdf', caption: 'segue para assinatura' },
    });
  });

  it('markRead envia o read receipt; setPresence é no-op seguro', async () => {
    const { http, chamadas } = fakeHttp();
    const g = gatewayCom(http);
    await g.setPresence('5511988887777@s.whatsapp.net', 'composing');
    await g.markRead('5511988887777@s.whatsapp.net', 'wamid.IN');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.body).toMatchObject({ status: 'read', message_id: 'wamid.IN' });
  });
});

function runtimeHarness(): {
  runtime: MetaCanalRuntime;
  canais: CanalDoChatStore;
  recebidos: InboundEnvelope[];
  media: InMemoryMediaStore;
  references: JsonMediaReferenceStore;
  aguardar: () => Promise<void>;
} {
  const json = new InMemoryJsonStore();
  const canais = new CanalDoChatStore(json);
  const media = new InMemoryMediaStore();
  const references = new JsonMediaReferenceStore(json);
  const recebidos: InboundEnvelope[] = [];
  const { http } = fakeHttp();
  const runtime = new MetaCanalRuntime({
    gateway: gatewayCom(http),
    canais,
    ingress: () => ({
      receive: (envelope: InboundEnvelope) => {
        recebidos.push(envelope);
        return Promise.resolve();
      },
    }),
    media,
    references,
  });
  return {
    runtime,
    canais,
    recebidos,
    media,
    references,
    // turnos destacados: dois macrotask flushes bastam (fakes sem rede real).
    aguardar: async () => {
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

function webhookTexto(texto: string): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              messages: [
                {
                  from: '5511988887777',
                  id: `wamid.${texto}`,
                  timestamp: '1753900000',
                  type: 'text',
                  text: { body: texto },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('MetaCanalRuntime', () => {
  it('texto entra pela entrada única e registra o canal META do chat', async () => {
    const h = runtimeHarness();
    h.runtime.processar(webhookTexto('oi'));
    await h.aguardar();
    expect(h.recebidos).toHaveLength(1);
    expect(h.recebidos[0]?.chatId).toBe('5511988887777@s.whatsapp.net');
    expect(await h.canais.canalDe('5511988887777@s.whatsapp.net')).toBe('meta');
  });

  it('PDF: baixa a mídia, grava referência+blob ANTES do turno (mesma régua do webchat)', async () => {
    const h = runtimeHarness();
    h.runtime.processar({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '5511988887777',
                    id: 'wamid.PDF',
                    timestamp: '1753900001',
                    type: 'document',
                    document: {
                      id: 'MEDIA-42',
                      mime_type: 'application/pdf',
                      filename: 'hiscon.pdf',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    await h.aguardar();
    expect(h.recebidos[0]?.kind).toBe('pdf');
    const ref = await h.references.byMessageId('wamid.PDF');
    expect(ref?.mime).toBe('application/pdf');
    const sha = createHash('sha256').update(PDF_BYTES).digest('hex');
    expect(ref?.sha256).toBe(sha);
    expect(await h.media.has(sha)).toBe(true);
  });

  it('chegouPelaEvolution devolve o canal ao interno (last-write-wins)', async () => {
    const h = runtimeHarness();
    h.runtime.processar(webhookTexto('oi'));
    await h.aguardar();
    await h.runtime.chegouPelaEvolution('5511988887777@s.whatsapp.net');
    expect(await h.canais.canalDe('5511988887777@s.whatsapp.net')).toBe('evolution');
  });
});

describe('MetaGatewayRouter', () => {
  it('chat no canal META sai pela Cloud API; chat sem registro segue ao interno', async () => {
    const clock = new TestClock();
    const json = new InMemoryJsonStore();
    const canais = new CanalDoChatStore(json);
    const interno = new InMemoryConversationGateway(clock);
    const { http, chamadas } = fakeHttp();
    const router = new MetaGatewayRouter(interno, gatewayCom(http), canais);

    await canais.registrar('5511988887777@s.whatsapp.net', 'meta');
    await router.sendText('5511988887777@s.whatsapp.net', 'pela meta');
    await router.sendText('5548999990000@s.whatsapp.net', 'pela evolution');

    expect(chamadas).toHaveLength(1); // só o chat META foi ao Graph
    expect(chamadas[0]?.body).toMatchObject({ to: '5511988887777' });
    const internas = interno.actions().filter((a) => a.type === 'text');
    expect(internas.map((a) => a.chatId)).toEqual(['5548999990000@s.whatsapp.net']);
  });
});
