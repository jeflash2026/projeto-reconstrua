// ─────────────────────────────────────────────────────────────────────────────
// EvolutionMediaClient — CAUSA RAIZ do "midia indisponivel na Evolution" (GO
// LIVE, rodada da foto do RG): a instância NÃO persiste mensagens recebidas,
// então getBase64FromMediaMessage nunca encontra a mídia. Com o webhook em
// base64:true o conteúdo vem DENTRO do evento — o cliente deve usá-lo SEM HTTP.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { HttpClient, HttpResponse } from '../conversation/evolution/http-client.js';
import { EvolutionMediaClient } from './evolution-media-client.js';

const CONFIG = { baseUrl: 'http://evolution:8080/', instance: 'INST', apiKey: 'k' };

function httpStub(responder: (url: string, body: unknown) => HttpResponse): {
  client: HttpClient;
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    client: {
      postJson: (url, _headers, body) => {
        calls.push(1);
        return Promise.resolve(responder(url, body));
      },
    },
  };
}

const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');

describe('EvolutionMediaClient · base64 embutido no webhook (base64:true)', () => {
  it('imagem com data.message.base64 ⇒ usa o conteúdo do evento SEM chamar a Evolution', async () => {
    const http = httpStub(() => {
      throw new Error('nao deveria chamar HTTP');
    });
    const client = new EvolutionMediaClient(http.client, CONFIG);
    const fetched = await client.fetch({
      data: {
        key: { id: 'MSG-1', remoteJid: '5517996332346@s.whatsapp.net', fromMe: false },
        message: { base64: JPEG_B64, imageMessage: { mimetype: 'image/jpeg' } },
      },
    });
    expect(http.calls).toHaveLength(0);
    expect(fetched).toEqual({ base64: JPEG_B64, mime: 'image/jpeg', fileName: null });
  });

  it('documento com base64 embutido ⇒ preserva mimetype e fileName do documentMessage', async () => {
    const http = httpStub(() => {
      throw new Error('nao deveria chamar HTTP');
    });
    const client = new EvolutionMediaClient(http.client, CONFIG);
    const fetched = await client.fetch({
      data: {
        key: { id: 'MSG-2' },
        message: {
          base64: 'QUJD',
          documentMessage: { mimetype: 'application/pdf', fileName: 'HISCON.pdf' },
        },
      },
    });
    expect(fetched).toEqual({ base64: 'QUJD', mime: 'application/pdf', fileName: 'HISCON.pdf' });
  });

  it('base64 em nível DIFERENTE (dentro do imageMessage — varia por versão da Evolution) ⇒ busca profunda encontra', async () => {
    const http = httpStub(() => {
      throw new Error('nao deveria chamar HTTP');
    });
    const client = new EvolutionMediaClient(http.client, CONFIG);
    const fetched = await client.fetch({
      data: {
        key: { id: 'MSG-N' },
        message: { imageMessage: { mimetype: 'image/jpeg', base64: JPEG_B64 } },
      },
    });
    expect(http.calls).toHaveLength(0);
    expect(fetched).toEqual({ base64: JPEG_B64, mime: 'image/jpeg', fileName: null });
  });

  it('SEM base64 embutido ⇒ fallback getBase64FromMediaMessage com key MÍNIMA {remoteJid,id,fromMe} — campos extras (senderLid/participant) NÃO viajam', async () => {
    const corpos: unknown[] = [];
    const http = httpStub((url, body) => {
      expect(url).toBe('http://evolution:8080/chat/getBase64FromMediaMessage/INST');
      corpos.push(body);
      return { status: 200, body: { base64: JPEG_B64, mimetype: 'image/jpeg' } };
    });
    const client = new EvolutionMediaClient(http.client, CONFIG);
    const fetched = await client.fetch({
      data: {
        key: {
          id: 'MSG-3',
          remoteJid: '5517996332346@s.whatsapp.net',
          fromMe: false,
          senderLid: '123@lid',
          participant: '',
        },
        message: { imageMessage: { mimetype: 'image/jpeg' } },
      },
    });
    expect(http.calls).toHaveLength(1);
    expect(corpos[0]).toEqual({
      message: { key: { remoteJid: '5517996332346@s.whatsapp.net', id: 'MSG-3', fromMe: false } },
      convertToMp4: false,
    });
    expect(fetched).toEqual({ base64: JPEG_B64, mime: 'image/jpeg', fileName: null });
  });

  it('PRODUÇÃO REAL (12ª rodada): Evolution responde HTTP 201 com o base64 ⇒ ACEITO (res.ok, não ===200)', async () => {
    const http = httpStub(() => ({
      status: 201,
      body: {
        mediaType: 'imageMessage',
        fileName: '3EB0.jpeg',
        mimetype: 'image/jpeg',
        base64: JPEG_B64,
      },
    }));
    const client = new EvolutionMediaClient(http.client, CONFIG);
    const fetched = await client.fetch({
      data: {
        key: { id: 'MSG-201', remoteJid: '5517996332346@s.whatsapp.net', fromMe: false },
        message: { imageMessage: { mimetype: 'image/jpeg' } },
      },
    });
    expect(fetched).toEqual({ base64: JPEG_B64, mime: 'image/jpeg', fileName: '3EB0.jpeg' });
  });

  it('fallback com Evolution sem a mensagem (o cenário real: 400/404) ⇒ null', async () => {
    const http = httpStub(() => ({ status: 400, body: { message: 'Message not found' } }));
    const client = new EvolutionMediaClient(http.client, CONFIG);
    const fetched = await client.fetch({
      data: {
        key: { id: 'MSG-4', remoteJid: '5517996332346@s.whatsapp.net', fromMe: false },
        message: {},
      },
    });
    expect(fetched).toBeNull();
  });

  it('payload sem key e sem base64 ⇒ null sem HTTP', async () => {
    const http = httpStub(() => ({ status: 200, body: {} }));
    const client = new EvolutionMediaClient(http.client, CONFIG);
    expect(await client.fetch({ data: { message: {} } })).toBeNull();
    expect(http.calls).toHaveLength(0);
  });
});
