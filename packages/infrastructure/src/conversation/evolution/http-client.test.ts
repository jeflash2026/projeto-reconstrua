// ─────────────────────────────────────────────────────────────────────────────
// TETO DE ESPERA do HTTP (2026-09-21, "a AHRI parou de responder"): uma chamada
// que fica pendurada (servidor aceita a conexão e nunca responde) travava o
// turno — e, como os turnos de uma conversa são sequenciais, a conversa
// emudecia até o processo reiniciar. Prova: a chamada FALHA no prazo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { FetchHttpClient } from './http-client.js';

async function servidorMudo(): Promise<{ porta: number; fechar: () => Promise<void> }> {
  const sockets = new Set<Socket>();
  const server: Server = createServer(() => {
    // nunca responde
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endereco = server.address();
  const porta = typeof endereco === 'object' && endereco !== null ? endereco.port : 0;
  return {
    porta,
    fechar: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe('FetchHttpClient — teto de espera', () => {
  it('chamada pendurada falha no prazo em vez de travar a conversa', async () => {
    const { porta, fechar } = await servidorMudo();
    try {
      const http = new FetchHttpClient(200);
      await expect(http.postJson(`http://127.0.0.1:${String(porta)}/`, {}, {})).rejects.toThrow();
    } finally {
      await fechar();
    }
  });
});
