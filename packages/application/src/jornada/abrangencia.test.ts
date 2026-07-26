// ─────────────────────────────────────────────────────────────────────────────
// Decreto 2026-07-25 — "vocês são de onde?" tem resposta CANÔNICA: parcerias com
// advogados em TODOS os estados, análise em todo o território nacional e
// encaminhamento ao parceiro mais próximo DEPOIS da análise. A AHRI jamais
// improvisa geografia nem diz que não atende a região de alguém.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  MENSAGENS_JORNADA,
  ehPerguntaDeLocalizacao,
  vaiReceberCobranca,
} from './jornada-comercial.js';
import { condutaDeAbrangencia } from '../conversation/sales-conversation-policy.js';
import type { ConversationContextView } from '../conversation/ports.js';

function ctx(texto: string): ConversationContextView {
  return { lastPercept: { envelope: { text: texto } } } as ConversationContextView;
}

describe('abrangência nacional — resposta canônica', () => {
  it('reconhece as formas reais da pergunta', () => {
    for (const t of [
      'vocês são de onde?',
      'Vocês são de onde',
      'onde vocês ficam?',
      'de qual cidade vocês são?',
      'vocês atendem em Salvador?',
      'atendem no Ceará?',
      'qual o estado de vocês?',
    ]) {
      expect(ehPerguntaDeLocalizacao(t), t).toBe(true);
    }
  });

  it('não confunde com outras mensagens do funil', () => {
    for (const t of ['moro em Fortaleza', 'já mandei o hiscon', 'obrigada', 'tenho direito?']) {
      expect(ehPerguntaDeLocalizacao(t), t).toBe(false);
    }
  });

  it('a mensagem diz a verdade: todos os estados, nacional, parceiro mais próximo', () => {
    const m = MENSAGENS_JORNADA.localizacao;
    expect(m).toMatch(/todos os estados/i);
    expect(m).toMatch(/nacional/i);
    expect(m).toMatch(/mais pr[óo]ximo/i);
    // Nunca promete resultado nem inventa endereço/sede.
    expect(m).not.toMatch(/\bsede\b|\bfilial\b|\bgarant/i);
  });

  it('pergunta de localização NÃO conta como cobrança de documento', () => {
    expect(vaiReceberCobranca('vocês são de onde?')).toBe(false);
    expect(vaiReceberCobranca('atendem em Salvador')).toBe(false);
  });

  it('o prompt do LLM recebe o FATO só quando perguntam de onde somos', () => {
    const comPergunta = condutaDeAbrangencia(ctx('vocês são de onde?'));
    expect(comPergunta).toMatch(/todos os estados/i);
    expect(comPergunta).toMatch(/mais pr[óo]ximo/i);
    expect(comPergunta).toMatch(/nunca invente/i);
    // Sem a pergunta, nada é injetado (prompt não incha).
    expect(condutaDeAbrangencia(ctx('já enviei o documento'))).toBe('');
  });
});
