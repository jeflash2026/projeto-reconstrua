// ─────────────────────────────────────────────────────────────────────────────
// CHAMAMENTO NÃO É NOME (2026-09-22) — caso real do próprio dono: ele escreveu
// "Alguem ai" enquanto esperava resposta, o texto caiu na etapa de
// identificação e virou o NOME. A AHRI passou a tratá-lo por "Alguem ai"
// ("Claro que sei, Alguem ai…"). Quem escreve isso está chamando atenção, não
// se apresentando.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { capturarIdentificacao, ehChamamento, pareceNome } from './jornada-comercial.js';

const vazio = { nome: null, cidade: null };

describe('ehChamamento', () => {
  it('reconhece quem está chamando atenção', () => {
    for (const texto of [
      'Alguem ai',
      'alguém aí?',
      'tem alguém aí',
      'alô',
      'cadê vocês',
      'me responde',
      'atende',
      'socorro',
      'urgente',
      'preciso de ajuda',
      'gente',
    ])
      expect(ehChamamento(texto), texto).toBe(true);
  });

  it('reconhece cortesia e concordância soltas', () => {
    for (const texto of ['obrigado', 'obrigada', 'por favor', 'ok', 'blz', 'sim', 'valeu'])
      expect(ehChamamento(texto), texto).toBe(true);
  });

  it('NÃO confunde com nome de pessoa', () => {
    for (const texto of [
      'Maria Aparecida da Silva',
      'João',
      'Gentil Pereira',
      'Boaventura Lima',
      'Sidnei',
    ])
      expect(ehChamamento(texto), texto).toBe(false);
  });
});

describe('capturarIdentificacao — chamamento nunca vira nome', () => {
  it('"Alguem ai" não registra nome (o caso que gerou a correção)', () => {
    expect(capturarIdentificacao('Alguem ai', vazio)).toEqual({ nome: null, cidade: null });
    expect(pareceNome('Alguem ai')).toBe(false);
  });

  it('o nome de verdade continua sendo capturado', () => {
    expect(capturarIdentificacao('Maria Aparecida', vazio).nome).toBe('Maria Aparecida');
    expect(capturarIdentificacao('meu nome é João Batista', vazio).nome).toBe('João Batista');
  });
});
