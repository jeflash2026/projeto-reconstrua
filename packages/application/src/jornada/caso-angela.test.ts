// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Angela Maria Pereira (11 95707-5533, 24/09/2026) — ela se
// apresentou com o nome completo e, na pergunta seguinte, respondeu a CIDADE
// assim: "São Paulo, capital". A vírgula ali é de complemento — "capital" diz
// qual São Paulo —, mas a regra lia toda vírgula como separação nome/cidade:
// "São Paulo" virou o NOME, "Angela Maria Pereira" foi apagada e a cliente
// passou a ser tratada por "São" pelo resto do atendimento.
//
// Regra: nome JÁ registrado não se troca por dedução. Só muda com marcador
// explícito ("meu nome é…").
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { capturarIdentificacao, interpretarInteresse } from './jornada-comercial.js';

describe('capturarIdentificacao — a vírgula da cidade não apaga o nome', () => {
  const angela = { nome: 'Angela Maria Pereira', cidade: null };

  it('"São Paulo, capital" é CIDADE, não nome novo', () => {
    expect(capturarIdentificacao('São Paulo, capital', angela)).toEqual({
      nome: null,
      cidade: 'São Paulo',
    });
  });

  it('outras respostas com complemento seguem a mesma regra', () => {
    for (const texto of ['Rio de Janeiro, zona norte', 'Armazém, interior de SC']) {
      expect(capturarIdentificacao(texto, angela).nome, texto).toBe(null);
      expect(capturarIdentificacao(texto, angela).cidade, texto).not.toBe(null);
    }
  });

  it('o marcador explícito continua podendo corrigir o nome', () => {
    expect(capturarIdentificacao('meu nome é Angela Maria Pereira, de São Paulo', angela)).toEqual({
      nome: 'Angela Maria Pereira',
      cidade: 'São Paulo',
    });
  });

  it('sem nome registrado, "Nome, Cidade" continua valendo (caso Isabel)', () => {
    expect(capturarIdentificacao('Isabel, Santa Ernestina', { nome: null, cidade: null })).toEqual({
      nome: 'Isabel',
      cidade: 'Santa Ernestina',
    });
  });
});

// "Segue comigo" (18:13) foi a CONFIRMAÇÃO da Angela — e ela recebeu de volta a
// análise inteira, com o pedido de SIM outra vez. A leitura do interesse já
// aceitava esse jeito de falar; o que falhava era a janela de busca da
// confirmação na memória da conversa (corrigida no build de produção). Aqui
// fica travado o que a régua precisa aceitar.
describe('interpretarInteresse — o SIM que não vem escrito "sim"', () => {
  it('as formas naturais de confirmar valem como sim', () => {
    for (const texto of [
      'Segue comigo',
      'pode seguir',
      'vamos seguir',
      'quero seguir',
      'pode continuar',
      'pode prosseguir',
      'com certeza',
      'claro',
      'aceito',
      'confirmo',
      'isso mesmo',
      'Simq',
    ])
      expect(interpretarInteresse(texto), texto).toBe('sim');
  });

  it('e a recusa continua sendo recusa', () => {
    for (const texto of ['não quero', 'sem interesse', 'agora não', 'desisto'])
      expect(interpretarInteresse(texto), texto).toBe('nao');
  });
});
