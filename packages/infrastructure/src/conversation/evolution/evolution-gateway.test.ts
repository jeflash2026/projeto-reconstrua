// ─────────────────────────────────────────────────────────────────────────────
// Testes do EVOLUTION GATEWAY — as operações de saída chamam os endpoints certos
// com os payloads certos (HTTP injetado; sem rede).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import { EvolutionGateway } from './evolution-gateway.js';
import type { HttpClient, HttpResponse } from './http-client.js';

interface Call {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
}

class RecordingHttp implements HttpClient {
  readonly calls: Call[] = [];
  constructor(private readonly response: HttpResponse = { status: 200, body: { key: { id: 'srv-1' } } }) {}
  postJson(url: string, headers: Readonly<Record<string, string>>, body: unknown): Promise<HttpResponse> {
    this.calls.push({ url, headers, body });
    return Promise.resolve(this.response);
  }
}

const clock: Clock = { now: () => new Date('2026-07-14T00:00:00.000Z') };
const config = { baseUrl: 'https://evo.example.com/', instance: 'ahri', apiKey: 'secret' };

describe('EvolutionGateway', () => {
  it('sendText chama /message/sendText/{instance} com number e text, e devolve o id do provedor', async () => {
    const http = new RecordingHttp();
    const gw = new EvolutionGateway(http, config, clock);
    const receipt = await gw.sendText('5511999999999@s.whatsapp.net', 'olá');
    expect(http.calls[0]?.url).toBe('https://evo.example.com/message/sendText/ahri');
    expect(http.calls[0]?.headers).toEqual({ apikey: 'secret' });
    expect(http.calls[0]?.body).toEqual({ number: '5511999999999', text: 'olá' });
    expect(receipt.providerMessageId).toBe('srv-1');
  });

  it('setPresence chama /chat/sendPresence com o estado', async () => {
    const http = new RecordingHttp();
    const gw = new EvolutionGateway(http, config, clock);
    await gw.setPresence('5511999999999@s.whatsapp.net', 'composing');
    expect(http.calls[0]?.url).toBe('https://evo.example.com/chat/sendPresence/ahri');
    expect(http.calls[0]?.body).toMatchObject({ number: '5511999999999', presence: 'composing' });
  });

  it('sendReaction e markRead usam os endpoints e chaves corretos', async () => {
    const http = new RecordingHttp();
    const gw = new EvolutionGateway(http, config, clock);
    await gw.sendReaction('5511999999999@s.whatsapp.net', 'MSG9', '❤️');
    await gw.markRead('5511999999999@s.whatsapp.net', 'MSG9');
    expect(http.calls[0]?.url).toBe('https://evo.example.com/message/sendReaction/ahri');
    expect(http.calls[0]?.body).toMatchObject({ reaction: '❤️' });
    expect(http.calls[1]?.url).toBe('https://evo.example.com/chat/markMessageAsRead/ahri');
  });
});
