// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DO CLIENTE (PC-R1) — testes: validade, expiração, assinatura, lixo,
// fail-closed e PRODUÇÃO FRIA (Lei 13: determinístico dado o mesmo segredo —
// nenhum estado de processo envolvido).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { emitirTokenCliente, validarTokenCliente } from './token.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');
const SECRET = 'segredo-do-portal';

describe('token do cliente (link mágico)', () => {
  it('emite e valida: devolve o clienteId', () => {
    const token = emitirTokenCliente('cli-1', 90, NOW, SECRET);
    expect(validarTokenCliente(token, NOW, SECRET)).toBe('cli-1');
    // ainda válido no dia 89
    const dia89 = new Date(NOW.getTime() + 89 * 24 * 60 * 60 * 1000);
    expect(validarTokenCliente(token, dia89, SECRET)).toBe('cli-1');
  });

  it('expira: dia 91 → null (peça novo link à AHRI)', () => {
    const token = emitirTokenCliente('cli-1', 90, NOW, SECRET);
    const dia91 = new Date(NOW.getTime() + 91 * 24 * 60 * 60 * 1000);
    expect(validarTokenCliente(token, dia91, SECRET)).toBeNull();
  });

  it('assinatura de outro segredo → null; payload adulterado → null', () => {
    const token = emitirTokenCliente('cli-1', 90, NOW, 'outro-segredo');
    expect(validarTokenCliente(token, NOW, SECRET)).toBeNull();

    const legit = emitirTokenCliente('cli-1', 90, NOW, SECRET);
    const [payload] = legit.split('.');
    const adulterado = `${Buffer.from(JSON.stringify({ c: 'cli-2', exp: 9999999999999 })).toString('base64url')}.${legit.split('.')[1] ?? ''}`;
    expect(validarTokenCliente(adulterado, NOW, SECRET)).toBeNull();
    expect(payload).toBeDefined();
  });

  it('lixo e formas inválidas → null, sem lançar', () => {
    for (const junk of ['', 'abc', 'a.b', '..', 'x'.repeat(500), `${Buffer.from('nao-json').toString('base64url')}.deadbeef`]) {
      expect(validarTokenCliente(junk, NOW, SECRET)).toBeNull();
    }
  });

  it('FAIL-CLOSED: segredo vazio ⇒ nenhum token é válido', () => {
    const token = emitirTokenCliente('cli-1', 90, NOW, SECRET);
    expect(validarTokenCliente(token, NOW, '')).toBeNull();
  });

  it('PRODUÇÃO FRIA (Lei 13): mesmo insumo ⇒ mesmo token — validação independe de estado', () => {
    const a = emitirTokenCliente('cli-1', 90, NOW, SECRET);
    const b = emitirTokenCliente('cli-1', 90, NOW, SECRET);
    expect(a).toBe(b); // nada em memória/processo participa
  });
});
