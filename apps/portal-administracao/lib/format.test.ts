import { describe, it, expect } from 'vitest';
import { formatMs, formatMoney, shortId, healthBadgeClass, formatDate } from './format.js';

describe('format', () => {
  it('formatMs: ms, segundos e minutos; null = travessão', () => {
    expect(formatMs(null)).toBe('—');
    expect(formatMs(500)).toBe('500 ms');
    expect(formatMs(2500)).toBe('2.5 s');
    expect(formatMs(120_000)).toBe('2.0 min');
  });

  it('formatMoney: null = "sem fonte de dados" (nunca inventa)', () => {
    expect(formatMoney(null)).toBe('sem fonte de dados');
    expect(formatMoney(1500)).toContain('1.500');
  });

  it('shortId corta ids longos', () => {
    expect(shortId('12345678abcdef')).toBe('12345678…');
    expect(shortId('abc')).toBe('abc');
  });

  it('healthBadgeClass mapeia estados', () => {
    expect(healthBadgeClass('ONLINE')).toBe('ok');
    expect(healthBadgeClass('DEGRADED')).toBe('warn');
    expect(healthBadgeClass('FAILED')).toBe('bad');
  });

  it('formatDate: inválida/null = travessão', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('data-invalida')).toBe('—');
  });
});
