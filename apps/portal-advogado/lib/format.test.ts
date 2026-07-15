import { describe, it, expect } from 'vitest';
import { formatDate, kindLabel, shortId } from './format.js';

describe('format (advogado)', () => {
  it('kindLabel traduz tipos jurídicos e preserva desconhecidos', () => {
    expect(kindLabel('despacho')).toBe('Despacho');
    expect(kindLabel('observacao')).toBe('Observação jurídica');
    expect(kindLabel('outro')).toBe('outro');
  });
  it('shortId e formatDate', () => {
    expect(shortId('1234567890abc')).toBe('1234567890…');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('invalida')).toBe('—');
  });
});
