// ─────────────────────────────────────────────────────────────────────────────
// Decreto 2026-07-25 — "vocês são de onde?" tem resposta CANÔNICA, e a AHRI
// jamais improvisa geografia nem diz que não atende a região de alguém.
//
// 2026-09-24 (caso REAL Angela): ela perguntou DUAS vezes, a segunda com um
// "pode me responder, por favor" — a resposta falava de abrangência e nunca
// dizia ONDE ficamos. O dono ditou o lugar: a base principal é Ribeirão Preto -
// SP. Continua proibido inventar OUTRO endereço, filial ou nome de advogado.
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

  it('a mensagem diz ONDE ficamos, a abrangência e o parceiro mais próximo', () => {
    const m = MENSAGENS_JORNADA.localizacao;
    expect(m).toMatch(/Ribeir[ãa]o Preto - SP/i); // o lugar, que faltava
    expect(m).toMatch(/territ[óo]rio brasileiro/i);
    expect(m).toMatch(/mais pr[óo]ximo/i);
    // Nunca promete resultado nem inventa filial.
    expect(m).not.toMatch(/\bfilial\b|\bgarant/i);
  });

  it('pergunta de localização NÃO conta como cobrança de documento', () => {
    expect(vaiReceberCobranca('vocês são de onde?')).toBe(false);
    expect(vaiReceberCobranca('atendem em Salvador')).toBe(false);
  });

  it('o prompt do LLM recebe o FATO só quando perguntam de onde somos', () => {
    const comPergunta = condutaDeAbrangencia(ctx('vocês são de onde?'));
    expect(comPergunta).toMatch(/RIBEIR[ÃA]O PRETO - SP/i);
    expect(comPergunta).toMatch(/mais pr[óo]ximo/i);
    expect(comPergunta).toMatch(/nunca invente/i);
    // Sem a pergunta, nada é injetado (prompt não incha).
    expect(condutaDeAbrangencia(ctx('já enviei o documento'))).toBe('');
  });
});
