// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Maria Aparecida (48 8874-1409, 2026-07-29) — três defeitos no
// atendimento, um turno de cada:
//   1. "Armazém" (a CIDADE) virou o nome; o nome completo enviado depois seria
//      registrado como cidade — a captura agora CORRIGE os papéis;
//   2. a pergunta da cidade passou a pedir CIDADE E ESTADO (com exemplo), e a
//      UF é extraída e persistida ("Armazém - SC" ⇒ cidade + estado);
//   3. o humanizador do LLM reescreveu o roteiro da triagem e DERRUBOU o CPF —
//      roteiros de COLETA saem verbatim (ehRoteiroDeColeta).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  MENSAGENS_JORNADA,
  capturarIdentificacao,
  ehRoteiroDeColeta,
  pareceNomeCompletoDePessoa,
  separarCidadeEstado,
} from './jornada-comercial.js';

describe('correção nome↔cidade (a cidade veio primeiro)', () => {
  it('o transcript real: "Armazém" depois "Maria Aparecida de Souza Correa"', () => {
    // Turno 1: uma palavra ⇒ vira o nome (indistinguível neste momento).
    const t1 = capturarIdentificacao('Armazém', { nome: null, cidade: null });
    expect(t1).toEqual({ nome: 'Armazém', cidade: null });
    // Turno 2: o NOME COMPLETO chega — os papéis se corrigem sozinhos.
    const t2 = capturarIdentificacao('Maria Aparecida de Souza Correa', {
      nome: 'Armazém',
      cidade: null,
    });
    expect(t2).toEqual({ nome: 'Maria Aparecida de Souza Correa', cidade: 'Armazém' });
  });

  it('cidade LONGA nunca é confundida com nome de pessoa (a troca não dispara)', () => {
    for (const cidade of ['São José do Rio Preto', 'Venda Nova do Imigrante', 'Juiz de Fora']) {
      const r = capturarIdentificacao(cidade, { nome: 'João', cidade: null });
      expect(r.cidade, cidade).toBe(cidade);
      expect(r.nome, cidade).toBe(null);
    }
  });

  it('pareceNomeCompletoDePessoa: 4+ palavras sem termos de cidade', () => {
    expect(pareceNomeCompletoDePessoa('Maria Aparecida de Souza Correa')).toBe(true);
    expect(pareceNomeCompletoDePessoa('São José do Rio Preto')).toBe(false); // cidade
    expect(pareceNomeCompletoDePessoa('Juiz de Fora')).toBe(false); // 3 palavras: ambíguo
    expect(pareceNomeCompletoDePessoa('Ana')).toBe(false);
  });
});

describe('cidade + estado (decreto 2026-07-29)', () => {
  it('separa a UF quando informada, em todos os formatos comuns', () => {
    expect(separarCidadeEstado('Armazém - SC')).toEqual({ cidade: 'Armazém', estado: 'SC' });
    expect(separarCidadeEstado('Armazém/SC')).toEqual({ cidade: 'Armazém', estado: 'SC' });
    expect(separarCidadeEstado('Porto Alegre RS')).toEqual({
      cidade: 'Porto Alegre',
      estado: 'RS',
    });
    expect(separarCidadeEstado('Armazém, sc')).toEqual({ cidade: 'Armazém', estado: 'SC' });
  });
  it('sem UF reconhecível, a cidade fica inteira (estado null; jamais inventa)', () => {
    expect(separarCidadeEstado('Armazém')).toEqual({ cidade: 'Armazém', estado: null });
    expect(separarCidadeEstado('Juiz de Fora')).toEqual({ cidade: 'Juiz de Fora', estado: null });
  });
  it('a pergunta da cidade pede cidade E estado, com exemplo', () => {
    const m = MENSAGENS_JORNADA.pedirCidade('Maria Aparecida de Souza Correa');
    expect(m).toMatch(/cidade e estado/i);
    expect(m).toMatch(/Cidade - UF/);
    expect(m).toContain('Prazer, Maria,'); // só o primeiro nome, nunca o nome inteiro
  });
});

describe('roteiros de COLETA saem verbatim (o humanizador derrubava o CPF)', () => {
  it('coleta ⇒ verbatim: nome, cidade, CPF e HISCON', () => {
    for (const m of [
      MENSAGENS_JORNADA.boasVindas,
      MENSAGENS_JORNADA.pedirNome,
      MENSAGENS_JORNADA.pedirCidade('Maria'),
      MENSAGENS_JORNADA.iniciarTriagem(),
      MENSAGENS_JORNADA.pedirCpf('Maria'),
      MENSAGENS_JORNADA.cpfRegistradoPedirHiscon('o HISCON'),
      MENSAGENS_JORNADA.cpfNaoReconhecido,
      MENSAGENS_JORNADA.pedirHiscon('o HISCON'),
    ]) {
      expect(ehRoteiroDeColeta(m), m.slice(0, 40)).toBe(true);
    }
  });
  it('acolhimento continua humanizável (consentimento saiu da lista — caso Humberto 2026-07-30)', () => {
    // Caso Humberto: o humanizador reescreveu a explicação do consentimento
    // (derrubou os honorários por êxito) — ela virou roteiro VERBATIM também.
    for (const m of [
      MENSAGENS_JORNADA.recusa,
      MENSAGENS_JORNADA.socialCurto,
      MENSAGENS_JORNADA.adiamentoOkCurto,
    ]) {
      expect(ehRoteiroDeColeta(m), m.slice(0, 40)).toBe(false);
    }
  });
});
