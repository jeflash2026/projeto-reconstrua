// ─────────────────────────────────────────────────────────────────────────────
// Testes das rotas de CONEXÃO WHATSAPP do Portal Admin (B_WA). Provam: auth BL-2.1
// (401 sem Bearer), gate FOUNDER nas destrutivas (403 sem x-founder-secret),
// confirmação explícita no descarte, validação do número (via fake) e ausência de
// segredos nas respostas. O runtime de conexão é FALSO (sem Evolution/rede).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AssembledAdminOperation } from '@reconstrua/infrastructure';
import { buildAdminServer } from './admin-server.js';

const ADMIN = 'ADMIN-SECRET';
const FOUNDER = 'FOUNDER-SECRET';
const OFFICIAL = '554137989737';

class FakeWhatsApp {
  readonly calls: string[] = [];
  getStatus() {
    this.calls.push('status');
    return Promise.resolve({
      active: { instance: 'velha', number: '5511989904824' },
      pending: { instance: 'reconstrua-prod', number: OFFICIAL },
      hasPendingApply: true,
      live: { state: 'open', ownerJid: `${OFFICIAL}@s.whatsapp.net`, number: OFFICIAL },
      matchesOfficial: true,
      officialNumber: OFFICIAL,
      webhookUrl: 'https://x/webhook/evolution',
      lastSyncAt: '2026-07-17T12:00:00.000Z',
    });
  }
  getQr(_i: string) {
    this.calls.push('qr');
    return Promise.resolve({ base64: 'QR', pairingCode: null });
  }
  createNew(name: string) {
    this.calls.push(`create:${name}`);
    return Promise.resolve({ instanceName: name, qr: { base64: 'QR', pairingCode: null } });
  }
  confirm(_name: string) {
    this.calls.push('confirm');
    return Promise.resolve({ connected: false, ownerJid: '5511989904824@s.whatsapp.net', number: '5511989904824', matchesOfficial: false, error: 'O número conectado não corresponde ao número oficial da empresa.' });
  }
  discard(name: string) {
    this.calls.push(`discard:${name}`);
    return Promise.resolve();
  }
}

function harness() {
  const wa = new FakeWhatsApp();
  const op = { whatsapp: wa } as unknown as AssembledAdminOperation;
  const app: FastifyInstance = buildAdminServer(op, { accessSecret: ADMIN, founderSecret: FOUNDER });
  const admin = (opts: { method: 'GET' | 'POST'; url: string; payload?: object; founder?: boolean }) =>
    app.inject({
      method: opts.method,
      url: opts.url,
      ...(opts.payload !== undefined ? { payload: opts.payload } : {}),
      headers: { authorization: `Bearer ${ADMIN}`, ...(opts.founder ? { 'x-founder-secret': FOUNDER } : {}) },
    });
  return { app, wa, admin };
}

describe('Conexão WhatsApp — rotas admin', () => {
  it('status sem Bearer ⇒ 401 (BL-2.1)', async () => {
    const { app } = harness();
    expect((await app.inject({ method: 'GET', url: '/admin/whatsapp/status' })).statusCode).toBe(401);
  });

  it('status com Bearer ⇒ 200 e SEM segredos', async () => {
    const { admin } = harness();
    const res = await admin({ method: 'GET', url: '/admin/whatsapp/status' });
    expect(res.statusCode).toBe(200);
    const body: { hasPendingApply: boolean; matchesOfficial: boolean } = res.json();
    expect(body.hasPendingApply).toBe(true);
    expect(body.matchesOfficial).toBe(true);
    expect(res.body).not.toContain('FOUNDER-SECRET');
    expect(res.body).not.toContain('apiKey');
  });

  it('criar instância SEM x-founder-secret ⇒ 403', async () => {
    const { admin } = harness();
    const res = await admin({ method: 'POST', url: '/admin/whatsapp/instances', payload: { instanceName: 'reconstrua-prod' } });
    expect(res.statusCode).toBe(403);
  });

  it('criar instância COM perfil Founder ⇒ 200', async () => {
    const { admin, wa } = harness();
    const res = await admin({ method: 'POST', url: '/admin/whatsapp/instances', payload: { instanceName: 'reconstrua-prod' }, founder: true });
    expect(res.statusCode).toBe(200);
    expect(wa.calls).toContain('create:reconstrua-prod');
  });

  it('confirmar número DIVERGENTE ⇒ 200 com connected:false e o erro exato', async () => {
    const { admin } = harness();
    const res = await admin({ method: 'POST', url: '/admin/whatsapp/confirm', payload: { instanceName: 'x' } });
    expect(res.statusCode).toBe(200);
    const body: { connected: boolean; error: string } = res.json();
    expect(body.connected).toBe(false);
    expect(body.error).toBe('O número conectado não corresponde ao número oficial da empresa.');
  });

  it('descartar SEM confirmação explícita ⇒ 400; COM Founder+confirm ⇒ 200', async () => {
    const { admin, wa } = harness();
    const semConfirm = await admin({ method: 'POST', url: '/admin/whatsapp/discard', payload: { instanceName: 'velha' }, founder: true });
    expect(semConfirm.statusCode).toBe(400);
    const ok = await admin({ method: 'POST', url: '/admin/whatsapp/discard', payload: { instanceName: 'velha', confirm: true }, founder: true });
    expect(ok.statusCode).toBe(200);
    expect(wa.calls).toContain('discard:velha');
  });

  it('descartar SEM Founder ⇒ 403 (mesmo com confirm)', async () => {
    const { admin } = harness();
    const res = await admin({ method: 'POST', url: '/admin/whatsapp/discard', payload: { instanceName: 'velha', confirm: true } });
    expect(res.statusCode).toBe(403);
  });
});
