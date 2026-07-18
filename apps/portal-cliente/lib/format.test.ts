// Formatação humana — datas como gente fala e saudação pelo relógio de Brasília.
import { describe, it, expect } from 'vitest';
import { dataHumana, saudacaoPorHora } from './format';

const AGORA = new Date('2026-07-18T12:00:00.000Z'); // 09:00 em Brasília

describe('dataHumana (fuso America/Sao_Paulo)', () => {
  it('hoje · ontem · dia do mês · outro ano', () => {
    expect(dataHumana('2026-07-18T13:00:00.000Z', AGORA)).toBe('hoje');
    expect(dataHumana('2026-07-17T23:00:00.000Z', AGORA)).toBe('ontem'); // 20h do dia 17 em BRT
    expect(dataHumana('2026-07-05T12:00:00.000Z', AGORA)).toBe('5 de julho');
    expect(dataHumana('2025-12-25T12:00:00.000Z', AGORA)).toBe('25 de dezembro de 2025');
  });

  it('respeita o fuso: 01:00 UTC do dia 18 ainda é dia 17 no Brasil → ontem', () => {
    expect(dataHumana('2026-07-18T01:00:00.000Z', AGORA)).toBe('ontem');
  });

  it('data inválida → vazio (nunca lança)', () => {
    expect(dataHumana('lixo', AGORA)).toBe('');
  });
});

describe('saudacaoPorHora (Brasília)', () => {
  it('manhã, tarde e noite', () => {
    expect(saudacaoPorHora(new Date('2026-07-18T12:00:00.000Z'))).toBe('Bom dia'); // 09:00
    expect(saudacaoPorHora(new Date('2026-07-18T18:00:00.000Z'))).toBe('Boa tarde'); // 15:00
    expect(saudacaoPorHora(new Date('2026-07-18T23:00:00.000Z'))).toBe('Boa noite'); // 20:00
    expect(saudacaoPorHora(new Date('2026-07-18T08:00:00.000Z'))).toBe('Bom dia'); // 05:00
  });
});
