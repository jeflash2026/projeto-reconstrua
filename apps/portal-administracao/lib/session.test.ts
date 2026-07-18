// SESSÃO (auth do portal) — token determinístico por segredo; comparação fail-closed.
import { describe, it, expect } from 'vitest';
import { adminSessionToken, secretsMatch } from './session';

describe('sessão do portal admin', () => {
  it('token é determinístico e muda com o segredo', () => {
    expect(adminSessionToken('abc')).toBe(adminSessionToken('abc'));
    expect(adminSessionToken('abc')).not.toBe(adminSessionToken('outro'));
    expect(adminSessionToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('secretsMatch é fail-closed (vazios e tamanhos diferentes nunca passam)', () => {
    expect(secretsMatch('', '')).toBe(false);
    expect(secretsMatch('x', '')).toBe(false);
    expect(secretsMatch('', 'x')).toBe(false);
    expect(secretsMatch('curto', 'segredo-mais-longo')).toBe(false);
    expect(secretsMatch('segredo', 'segredo')).toBe(true);
    expect(secretsMatch('segredoX', 'segredoY')).toBe(false);
  });
});
