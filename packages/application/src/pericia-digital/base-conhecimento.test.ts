import { describe, it, expect } from 'vitest';
import {
  BASE_CONHECIMENTO,
  CATEGORIAS_CONHECIMENTO,
  listarConhecimento,
  buscarConhecimento,
} from './base-conhecimento.js';
import { textoSeguro } from './linguagem-segura.js';

describe('Base de Conhecimento Pericial — consulta do perito humano', () => {
  it('toda entrada tem id único e categoria válida', () => {
    const ids = new Set(BASE_CONHECIMENTO.map((e) => e.id));
    expect(ids.size).toBe(BASE_CONHECIMENTO.length);
    for (const e of BASE_CONHECIMENTO) {
      expect(CATEGORIAS_CONHECIMENTO).toContain(e.categoria);
      expect(e.titulo.length).toBeGreaterThan(0);
      expect(e.corpo.length).toBeGreaterThan(0);
    }
  });

  it('o conteúdo NÃO afirma conclusões proibidas por conta própria', () => {
    // As entradas explicam as fronteiras (podem citar os termos ao proibi-los),
    // mas nunca os usam como afirmação de fato. textoSeguro só passa quando o
    // termo aparece dentro do vocabulário de fronteira — validamos que o corpo
    // não contém uma AFIRMAÇÃO solta do tipo "é fraude"/"é falso".
    for (const e of BASE_CONHECIMENTO) {
      expect(e.corpo).not.toMatch(/\bé fraude\b/i);
      expect(e.corpo).not.toMatch(/\bé falso\b/i);
      expect(e.corpo).not.toMatch(/\bconfirma(?:-se)? a fraude\b/i);
    }
    // A entrada de fronteira legal existe e é o guardião do vocabulário.
    expect(listarConhecimento('FRONTEIRA_LEGAL').length).toBeGreaterThanOrEqual(2);
    // sanity: helper de linguagem segura disponível ao painel.
    expect(typeof textoSeguro).toBe('function');
  });

  it('filtra por categoria', () => {
    const modelos = listarConhecimento('MODELO_QUESITO');
    expect(modelos.length).toBeGreaterThan(0);
    expect(modelos.every((e) => e.categoria === 'MODELO_QUESITO')).toBe(true);
  });

  it('busca por termo no título/corpo; vazio devolve tudo', () => {
    expect(buscarConhecimento('')).toHaveLength(BASE_CONHECIMENTO.length);
    const custodia = buscarConhecimento('custódia');
    expect(custodia.length).toBeGreaterThan(0);
    expect(buscarConhecimento('xyzinexistente')).toHaveLength(0);
  });
});
