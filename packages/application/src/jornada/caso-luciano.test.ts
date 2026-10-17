// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Luciano (32 8488-6907, 17/10/2026) — o dono, vendo o atendimento:
// "a AHRI tá muito burra, cliente fez uma pergunta e ela falou coisa nada a
// ver; depois falou 'estou aqui sim', cliente nem perguntou isso".
//
// A conversa, no consentimento:
//   10:10 cliente  "Mas vocês vão ver o que o cartão consignado"
//   10:11 AHRI     "Só para eu confirmar: você tem interesse…"   ← ignorou
//   10:11 cliente  "Esse desconto é o que o cartão Master"
//   10:11 AHRI     "Estou aqui, sim. Como você quer seguir?"     ← devolução
//
// UMA causa, dois sintomas. O detector de pergunta exigia "?" ou a palavra
// interrogativa no INÍCIO; as duas frases têm "o que" no meio e nenhum "?".
// Não sendo pergunta, a etapa repetiu a cobrança — e na segunda vez o guarda
// anti-repetição trocou a cobrança pela devolução genérica.
//
// A correção tem duas camadas: reconhecer a pergunta E ter resposta autorada
// para ela, que é a dúvida nº 1 deste público e a nossa especialidade.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ehPerguntaLivre, ehDuvidaSobreEscopo, MENSAGENS_JORNADA } from './jornada-comercial.js';

describe('caso Luciano · pergunta sem "?" no consentimento', () => {
  it('as duas frases REAIS do cliente são reconhecidas como pergunta', () => {
    expect(ehPerguntaLivre('Mas vocês vão ver o que o cartão consignado')).toBe(true);
    expect(ehPerguntaLivre('Esse desconto é o que o cartão Master')).toBe(true);
  });

  it('e as duas pedem a resposta de ESCOPO, não a cobrança de interesse', () => {
    expect(ehDuvidaSobreEscopo('Mas vocês vão ver o que o cartão consignado')).toBe(true);
    expect(ehDuvidaSobreEscopo('Esse desconto é o que o cartão Master')).toBe(true);
    expect(ehDuvidaSobreEscopo('vocês analisam cartão consignado')).toBe(true);
    expect(ehDuvidaSobreEscopo('entra o RMC também')).toBe(true);
  });

  it('a resposta autorada diz que o cartão entra E repõe o funil', () => {
    const m = MENSAGENS_JORNADA.explicaOQueEntraNaAnalise;
    expect(m).toMatch(/cart[ãa]o consignado/i);
    expect(m).toMatch(/reserva de margem/i);
    // Sem repor a pergunta, responder bem custaria o fluxo — o pedido do dono
    // foi "melhora a qualidade sem perder o fluxo".
    expect(m).toMatch(/an[áa]lise gratuita\?$/i);
    // E nunca promete resultado.
    expect(m).not.toMatch(/vai receber|garantido|com certeza vai|indeniza/i);
  });

  it('afirmação comum NÃO vira pergunta — o funil não pode desviar à toa', () => {
    for (const frase of [
      'LUCIANO DA CRUZ lopes',
      'Juiz de fora  MG',
      'Sim',
      'ok obrigado',
      // A armadilha deste alargamento: "o que" seguido de "você" aparece em
      // afirmação comum. Por isso o padrão novo exige VERBO depois do "vocês",
      // e não apenas o pronome.
      'já mandei o que você pediu',
      'vou enviar hoje à noite',
    ])
      expect(ehPerguntaLivre(frase)).toBe(false);
  });

  it('recusa não é dúvida de escopo — quem diz não, não é respondido com oferta', () => {
    expect(ehDuvidaSobreEscopo('não quero, pode cancelar')).toBe(false);
    expect(ehDuvidaSobreEscopo('não tenho interesse no cartão')).toBe(false);
  });
});
