// ─────────────────────────────────────────────────────────────────────────────
// Testes do REAQUECIMENTO — estágio derivado dos fatos, guardrails anti-spam e
// mensagens por estágio (profissionais, sem emoji — decreto caso Lucas).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { novaJornada, type FatosDaJornada, type JornadaRecord } from './jornada-comercial.js';
import {
  REAQUECIMENTO_MAX_TENTATIVAS,
  derivarEstagioLead,
  mensagemDeReaquecimento,
  podeReaquecer,
} from './reaquecimento.js';

const NOW = new Date('2026-07-22T12:00:00.000Z');

function fatos(
  over: Partial<JornadaRecord> = {},
  docs: Partial<Omit<FatosDaJornada, 'registro'>> = {},
): FatosDaJornada {
  return {
    registro: { ...novaJornada('c@s.whatsapp.net', NOW), ...over },
    docsRecebidos: docs.docsRecebidos ?? 0,
    docsCompletos: docs.docsCompletos ?? false,
    proximoDocumento: docs.proximoDocumento ?? 'RG (frente e verso) ou CNH',
    ultimoRegistrado: null,
    ultimoRegistroEm: null,
  };
}

describe('derivarEstagioLead', () => {
  it('cobre a régua inteira: só contato → identificado → consentiu → docs parciais → desistiu; concluída não reaquece', () => {
    expect(derivarEstagioLead(fatos())).toBe('SO_CONTATO');
    expect(derivarEstagioLead(fatos({ nome: 'Lucas' }))).toBe('IDENTIFICADO');
    expect(derivarEstagioLead(fatos({ nome: 'L', cidade: 'X', consentiu: true }))).toBe(
      'CONSENTIU_SEM_DOCS',
    );
    expect(derivarEstagioLead(fatos({ nome: 'L' }, { docsRecebidos: 2 }))).toBe('DOCS_PARCIAIS');
    expect(derivarEstagioLead(fatos({ nome: 'L', desistiu: true }))).toBe('DESISTIU');
    expect(derivarEstagioLead(fatos({}, { docsCompletos: true }))).toBeNull();
  });
});

describe('podeReaquecer (guardrails anti-spam)', () => {
  it('sem tentativas ⇒ pode; última há menos de 24h ⇒ bloqueia; 24h+ ⇒ pode', () => {
    expect(podeReaquecer([], NOW).pode).toBe(true);
    const haDuasHoras = new Date(NOW.getTime() - 2 * 3_600_000);
    expect(podeReaquecer([haDuasHoras], NOW)).toMatchObject({ pode: false });
    const ontem = new Date(NOW.getTime() - 25 * 3_600_000);
    expect(podeReaquecer([ontem], NOW).pode).toBe(true);
  });
  it('teto de tentativas: na 3ª registrada, bloqueia para sempre', () => {
    const antigas = [1, 2, 3].map((d) => new Date(NOW.getTime() - d * 48 * 3_600_000));
    expect(antigas).toHaveLength(REAQUECIMENTO_MAX_TENTATIVAS);
    expect(podeReaquecer(antigas, NOW)).toMatchObject({ pode: false });
  });
});

describe('mensagemDeReaquecimento', () => {
  const dados = {
    nome: 'Denise Rondora',
    proximoDocumento: 'comprovante de endereço',
    docsRecebidos: 2,
  };

  it('cada estágio ganha a mensagem certa (nunca genérica)', () => {
    expect(mensagemDeReaquecimento('SO_CONTATO', { ...dados, nome: null })).toContain(
      'análise gratuita',
    );
    expect(mensagemDeReaquecimento('IDENTIFICADO', dados)).toContain('Olá, Denise!');
    expect(mensagemDeReaquecimento('CONSENTIU_SEM_DOCS', dados)).toContain(
      'comprovante de endereço',
    );
    const parcial = mensagemDeReaquecimento('DOCS_PARCIAIS', dados);
    expect(parcial).toContain('2 documento(s)');
    expect(parcial).toContain('comprovante de endereço');
    expect(mensagemDeReaquecimento('DESISTIU', dados)).toContain(
      'decisão está totalmente respeitada',
    );
  });

  it('nenhuma mensagem de reaquecimento contém emoji (tom consultora)', () => {
    for (const estagio of [
      'SO_CONTATO',
      'IDENTIFICADO',
      'CONSENTIU_SEM_DOCS',
      'DOCS_PARCIAIS',
      'DESISTIU',
    ] as const) {
      const m = mensagemDeReaquecimento(estagio, dados);
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(m)).toBe(false);
    }
  });
});

describe('mensagemDeRetomada (conversa caída — a culpa é NOSSA)', () => {
  it('continua do ponto exato: docs em curso pede o próximo; identificado pede interesse; sem nada pede identificação', async () => {
    const { mensagemDeRetomada } = await import('./reaquecimento.js');
    const base = {
      nome: 'Maria Silva',
      cidade: 'Campinas',
      consentiu: false,
      proximoDocumento: 'o VERSO do RG (a parte de trás do documento)',
      docsRecebidos: 1,
    };
    const comDocs = mensagemDeRetomada(base);
    expect(comDocs).toContain('Desculpe a demora');
    expect(comDocs).toContain('o VERSO do RG');
    const identificada = mensagemDeRetomada({ ...base, docsRecebidos: 0 });
    expect(identificada).toContain('interesse em fazer essa análise?');
    const soNome = mensagemDeRetomada({ ...base, docsRecebidos: 0, cidade: null });
    expect(soNome).toContain('qual cidade');
    expect(soNome).toContain('Maria');
    const semNada = mensagemDeRetomada({
      nome: null,
      cidade: null,
      consentiu: false,
      proximoDocumento: null,
      docsRecebidos: 0,
    });
    expect(semNada).toContain('nome completo e a cidade');
  });
});
