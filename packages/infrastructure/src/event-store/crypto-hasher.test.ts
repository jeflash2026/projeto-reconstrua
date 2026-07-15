// ─────────────────────────────────────────────────────────────────────────────
// Testes do CryptoHasher (SHA-256) — determinismo, vetor conhecido e avalanche.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { CryptoHasher } from './crypto-hasher.js';

describe('CryptoHasher', () => {
  const hasher = new CryptoHasher();

  it('é determinístico', () => {
    expect(hasher.hash('reconstrua')).toBe(hasher.hash('reconstrua'));
  });

  it('corresponde ao vetor conhecido de SHA-256("abc")', () => {
    expect(hasher.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('avalanche: entradas diferentes produzem hashes diferentes', () => {
    expect(hasher.hash('a')).not.toBe(hasher.hash('b'));
  });
});
