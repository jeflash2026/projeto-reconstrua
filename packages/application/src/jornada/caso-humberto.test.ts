// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Humberto (16 99747-7435, 2026-07-30) — o cliente respondeu a
// cidade e o estado em DUAS bolhas ("Ribeirão preto" e depois "São Paulo"),
// por extenso. Três defeitos, um por bloco:
//   1. estado POR EXTENSO não era reconhecido ("Ribeirão Preto São Paulo");
//   2. a bolha que é SÓ um estado não completava o registro (capturarEstado);
//   3. o humanizador reescreveu o roteiro do CONSENTIMENTO (derrubou os
//      honorários por êxito e inventou cobrança de cidade) — o roteiro da
//      "análise gratuita" agora sai verbatim (ehRoteiroDeColeta).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  MENSAGENS_JORNADA,
  capturarEstado,
  ehRoteiroDeColeta,
  separarCidadeEstado,
} from './jornada-comercial.js';

describe('estado POR EXTENSO na mesma mensagem', () => {
  it('reconhece o nome do estado no fim e separa a cidade', () => {
    expect(separarCidadeEstado('Ribeirão Preto São Paulo')).toEqual({
      cidade: 'Ribeirão Preto',
      estado: 'SP',
    });
    expect(separarCidadeEstado('Armazém - Santa Catarina')).toEqual({
      cidade: 'Armazém',
      estado: 'SC',
    });
    expect(separarCidadeEstado('Campo Grande Mato Grosso do Sul')).toEqual({
      cidade: 'Campo Grande',
      estado: 'MS',
    });
  });
  it('SÓ o nome do estado nunca vira cidade+estado (São Paulo capital existe)', () => {
    expect(separarCidadeEstado('São Paulo')).toEqual({ cidade: 'São Paulo', estado: null });
    expect(separarCidadeEstado('Mato Grosso')).toEqual({ cidade: 'Mato Grosso', estado: null });
  });
});

describe('capturarEstado — a bolha que é SÓ um estado', () => {
  it('UF e nome por extenso (com e sem acento) viram a UF', () => {
    expect(capturarEstado('São Paulo')).toBe('SP');
    expect(capturarEstado('sao paulo')).toBe('SP');
    expect(capturarEstado('SP')).toBe('SP');
    expect(capturarEstado('sc.')).toBe('SC');
    expect(capturarEstado('Santa Catarina')).toBe('SC');
    expect(capturarEstado('Pará')).toBe('PA');
  });
  it('o que não é estado nunca captura (cidade, resposta, frase)', () => {
    expect(capturarEstado('Ribeirão Preto')).toBe(null);
    expect(capturarEstado('sim')).toBe(null);
    expect(capturarEstado('tenho interesse')).toBe(null);
    expect(capturarEstado('Ribeirão Preto São Paulo')).toBe(null); // não é SÓ o estado
  });
});

describe('roteiro do CONSENTIMENTO sai verbatim (humanizador proibido)', () => {
  it('explicação e reforço do interesse são roteiros de coleta', () => {
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.explicacaoConsentimento('Humberto'))).toBe(true);
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.reforcoConsentimento)).toBe(true);
    // A explicação REAL continua carregando os honorários por êxito.
    expect(MENSAGENS_JORNADA.explicacaoConsentimento('Humberto')).toContain('êxito');
  });
});
