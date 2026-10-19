// ─────────────────────────────────────────────────────────────────────────────
// VOZ (2026-10-19) — as duas pontas do console falado do dono.
//
// O que estes testes travam é a DEGRADAÇÃO, que é onde isto pode machucar:
//   • sem chave da OpenAI, a montagem não tem voz ⇒ 503 explícito (nunca 500);
//   • áudio que o Whisper não entende ⇒ 502 com recado humano, não silêncio;
//   • TTS que falha ⇒ 200 com audioBase64 NULO — a resposta já está na tela e
//     a fala é conforto, não função crítica. Derrubar o turno porque a voz
//     falhou seria trocar um problema pequeno por um grande.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import {
  assembleAdminOperation,
  FakeSleeper,
  type AssembledAdminOperation,
} from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

const ADMIN_SECRET = 'segredo-de-teste';
const AGORA = new Date('2026-10-19T12:00:00.000Z');

class TestClock implements Clock {
  private t = new Date(AGORA.getTime());
  now(): Date {
    return new Date(this.t.getTime());
  }
  advance(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid {
    this.n += 1;
    return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`);
  }
}

function montar(voz?: {
  transcrever(bytes: Uint8Array, mime: string): Promise<string | null>;
  falar(texto: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
}) {
  const clock = new TestClock();
  const op: AssembledAdminOperation = assembleAdminOperation({
    clock,
    uuid: new SeqUuid(),
    sleeper: new FakeSleeper(clock),
  });
  return buildAdminServer(op, {
    accessSecret: ADMIN_SECRET,
    ...(voz !== undefined ? { voz } : {}),
  });
}

const cab = { authorization: `Bearer ${ADMIN_SECRET}` };

describe('rotas de voz', () => {
  it('sem voz na montagem ⇒ 503 explícito nas duas pontas', async () => {
    const app = montar();
    const a = await app.inject({
      method: 'POST',
      url: '/admin/voz/ouvir',
      payload: { audioBase64: 'AAAA', mime: 'audio/webm' },
      headers: cab,
    });
    expect(a.statusCode).toBe(503);
    const b = await app.inject({
      method: 'POST',
      url: '/admin/voz/falar',
      payload: { texto: 'oi' },
      headers: cab,
    });
    expect(b.statusCode).toBe(503);
  });

  it('áudio chega decodificado ao transcritor e o texto volta', async () => {
    let recebidos: Uint8Array | null = null;
    const app = montar({
      transcrever: (bytes) => {
        recebidos = bytes;
        return Promise.resolve('quantos clientes entraram hoje');
      },
      falar: () => Promise.resolve(null),
    });
    const esperado = Buffer.from('audio-cru');
    const res = await app.inject({
      method: 'POST',
      url: '/admin/voz/ouvir',
      // Com o prefixo data:, como o navegador produz — a rota precisa limpar.
      payload: {
        audioBase64: `data:audio/webm;base64,${esperado.toString('base64')}`,
        mime: 'audio/webm',
      },
      headers: cab,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ texto: 'quantos clientes entraram hoje' });
    expect(Buffer.from(recebidos as unknown as Uint8Array).toString()).toBe('audio-cru');
  });

  it('sem áudio ⇒ 400; áudio incompreensível ⇒ 502 com recado humano', async () => {
    const app = montar({
      transcrever: () => Promise.resolve(null),
      falar: () => Promise.resolve(null),
    });
    const vazio = await app.inject({
      method: 'POST',
      url: '/admin/voz/ouvir',
      payload: {},
      headers: cab,
    });
    expect(vazio.statusCode).toBe(400);

    const mudo = await app.inject({
      method: 'POST',
      url: '/admin/voz/ouvir',
      payload: { audioBase64: 'AAAA', mime: 'audio/webm' },
      headers: cab,
    });
    expect(mudo.statusCode).toBe(502);
    const recado: { error: string } = mudo.json();
    expect(recado.error).toMatch(/tente de novo/i);
  });

  it('TTS entrega o MP3 em base64', async () => {
    const app = montar({
      transcrever: () => Promise.resolve(null),
      falar: () => Promise.resolve({ mime: 'audio/mpeg', bytes: new Uint8Array([1, 2, 3]) }),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/admin/voz/falar',
      payload: { texto: 'entraram 46 pessoas hoje' },
      headers: cab,
    });
    expect(res.statusCode).toBe(200);
    const corpo: { audioBase64: string; mime: string } = res.json();
    expect(corpo.mime).toBe('audio/mpeg');
    expect([...Buffer.from(corpo.audioBase64, 'base64')]).toEqual([1, 2, 3]);
  });

  it('TTS falhando NÃO derruba o turno — 200 com áudio nulo', async () => {
    const app = montar({
      transcrever: () => Promise.resolve(null),
      falar: () => Promise.resolve(null),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/admin/voz/falar',
      payload: { texto: 'entraram 46 pessoas hoje' },
      headers: cab,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ audioBase64: null, mime: null });
  });
});
