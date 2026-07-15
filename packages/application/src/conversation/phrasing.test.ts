// ─────────────────────────────────────────────────────────────────────────────
// Testes do guard de linguagem — normalização, similaridade e detecção de
// repetição ("nunca repetir frases").
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { isRepetition, normalizeText, similarity } from './phrasing.js';

describe('phrasing', () => {
  it('normaliza acentos, caixa e pontuação', () => {
    expect(normalizeText('Olá, tudo BEM?!')).toBe('ola tudo bem');
  });

  it('similaridade: idênticos = 1, disjuntos = 0, simétrica', () => {
    expect(similarity('bom dia cliente', 'bom dia cliente')).toBe(1);
    expect(similarity('abacaxi manga', 'notebook teclado')).toBe(0);
    expect(similarity('a b c', 'a b')).toBe(similarity('a b', 'a b c'));
  });

  it('detecta repetição por identidade normalizada', () => {
    expect(isRepetition('Bom dia!', ['bom dia'], 0.8)).toBe(true);
  });

  it('detecta repetição por alta similaridade e libera fraseado diferente', () => {
    const previous = ['vamos seguir com sua solicitação agora'];
    expect(isRepetition('vamos seguir com sua solicitação agora mesmo', previous, 0.8)).toBe(true);
    expect(isRepetition('prefere conversar amanhã de manhã cedo', previous, 0.8)).toBe(false);
  });
});
