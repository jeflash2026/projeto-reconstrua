// ─────────────────────────────────────────────────────────────────────────────
// A PENEIRA do acolhimento (2026-09-24). O roteiro de coleta é intocável; o que
// vem antes dele é uma frase só, e só passa quem não faz pergunta, não pede
// documento, não promete e não repete o próprio roteiro.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { acolhimentoAceitavel, mereceAcolhimento } from './acolhimento.js';

const ROTEIRO =
  'Para eu registrar o seu atendimento e podermos solicitar os contratos junto aos bancos, preciso do número do seu CPF. Pode digitar aqui, por favor?';

describe('mereceAcolhimento', () => {
  it('uma fala de verdade do cliente merece resposta', () => {
    for (const texto of [
      'Tenho empréstimo consignado que eu fiz',
      'estou com dificuldade de mexer no celular',
      'meu marido faleceu e ficaram os descontos',
    ])
      expect(mereceAcolhimento(texto), texto).toBe(true);
  });

  it('saudação, chamamento, resposta curta e o próprio dado pedido: não', () => {
    for (const texto of [
      'bom dia',
      'alguém aí?',
      'ok',
      'sim',
      '529.982.247-25',
      'meu cpf é 529.982.247-25',
    ])
      expect(mereceAcolhimento(texto), texto).toBe(false);
  });
});

describe('acolhimentoAceitavel', () => {
  it('passa a frase que só responde', () => {
    for (const frase of [
      'Entendi — é exatamente isso que a nossa análise verifica.',
      'Imagino como isso é chato, e eu vou te ajudar com calma.',
      'Perfeito, obrigada por me contar.',
    ])
      expect(acolhimentoAceitavel(frase, ROTEIRO), frase).toBe(true);
  });

  it('reprova o que invade o roteiro ou promete', () => {
    for (const frase of [
      '', // o LLM não achou o que responder
      'Você pode me mandar o seu CPF?', // pergunta E assunto do roteiro
      'Me envie o extrato em PDF.', // cobrança de documento
      'Em até 10 dias úteis a sua análise fica pronta.', // prazo
      'Garanto que você vai receber esse dinheiro de volta.', // promessa
      'Qualquer coisa chama no 11999998888.', // número solto
      'Veja mais em https://exemplo.com.br', // link
      'Preciso do número do seu CPF para registrar o seu atendimento.', // eco do roteiro
      'x'.repeat(240), // parágrafo inteiro no lugar de uma frase
    ])
      expect(acolhimentoAceitavel(frase, ROTEIRO), frase).toBe(false);
  });
});
