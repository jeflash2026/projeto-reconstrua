// ─────────────────────────────────────────────────────────────────────────────
// Decreto 2026-07-29 (caso REAL Luana, 63 9224-8805): a neta queria a análise
// para a AVÓ e a AHRI a dispensou ("não dá para fazer com os dados da sua
// avó"). A regra é o CONTRÁRIO: o familiar PODE representar — a documentação
// (CPF + HISCON) vem em nome do TITULAR do benefício, e o familiar acompanha
// tudo pelo próprio WhatsApp. A AHRI JAMAIS dispensa quem procura pelo idoso.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { MENSAGENS_JORNADA, ehSobreFamiliar, vaiReceberCobranca } from './jornada-comercial.js';
import { condutaDeFamiliar } from '../conversation/sales-conversation-policy.js';
import type { ConversationContextView } from '../conversation/ports.js';

function ctx(texto: string): ConversationContextView {
  return { lastPercept: { envelope: { text: texto } } } as ConversationContextView;
}

describe('análise para FAMILIAR — resposta canônica', () => {
  it('reconhece as formas reais (inclusive a da Luana)', () => {
    for (const t of [
      'Mais dá minha avó', // a mensagem REAL do caso
      'é para minha mãe',
      'quero fazer pro meu pai',
      'a análise seria da minha vó',
      'posso fazer em nome da minha sogra? tenho o benefício dela',
      'meu marido é aposentado, era para ele',
    ]) {
      expect(ehSobreFamiliar(t), t).toBe(true);
    }
  });

  it('não confunde menção casual a parente com pedido de análise', () => {
    for (const t of [
      'minha mãe me indicou vocês',
      'moro com meu marido em Fortaleza',
      'obrigada',
      'já mandei o hiscon',
    ]) {
      expect(ehSobreFamiliar(t), t).toBe(false);
    }
  });

  it('a mensagem ACOLHE: documentação em nome do TITULAR, jamais dispensa', () => {
    const m = MENSAGENS_JORNADA.analiseParaFamiliar;
    expect(m).toMatch(/pode sim/i);
    expect(m).toMatch(/titular/i);
    expect(m).toMatch(/cpf/i);
    expect(m).toMatch(/hiscon/i);
    expect(m).toMatch(/gratuita/i);
    // Nunca as frases da dispensa real.
    expect(m).not.toMatch(/n[ãa]o d[áa] para fazer|precisa ser o titular|ela mesma/i);
  });

  it('mensagem sobre familiar NÃO conta como cobrança de documento', () => {
    expect(vaiReceberCobranca('Mais dá minha avó')).toBe(false);
  });

  it('o prompt do LLM recebe o FATO quando um parente é mencionado', () => {
    const conduta = condutaDeFamiliar(ctx('mas é da minha avó'));
    expect(conduta).toMatch(/titular/i);
    expect(conduta).toMatch(/nunca dispense/i);
    // Sem menção a parente, nada é injetado (prompt não incha).
    expect(condutaDeFamiliar(ctx('já enviei o documento'))).toBe('');
  });
});
