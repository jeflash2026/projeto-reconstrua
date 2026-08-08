// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Rosemeire (08/08/2026, 09:37–09:45) — a cliente informou o CPF às
// 09:41 ("CPF registrado, obrigada"), recebeu o lembrete correto do HISCON às
// 09:44 e respondeu "Tá". A resposta das 09:45 REGREDIU: "Perfeito. Ainda
// preciso do número do seu CPF para dar continuidade à análise."
//
// A máquina de estados estava CERTA (o "Tá" ganha o socialCurto) — quem errou
// foi o HUMANIZADOR: socialCurto não é roteiro de coleta, ia para a reescrita
// do LLM, e o prompt da fase 1 não carregava o estado do CPF (o reforcoCpf só
// existia na ANÁLISE). Duas travas:
//   1. roteiro CURTO (≤160 chars) sai VERBATIM — cortesia já é humana;
//   2. o reforcoCpf entra na CONDUTA de LEAD/ONBOARDING (fase 1).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  MENSAGENS_JORNADA,
  derivarEtapa,
  ehAgradecimentoPuro,
  ehRoteiroDeColeta,
  novaJornada,
  responderTurno,
  type FatosDaJornada,
} from './jornada-comercial.js';

const NOW = new Date('2026-08-08T12:44:00.000Z');
const CHAT = '5511999990000@s.whatsapp.net';

// O estado EXATO da Rosemeire às 09:44: identificada, consentiu, CPF dado,
// aguardando o HISCON (uma cobrança já feita — o lembrete das 09:44).
function fatosRosemeire(): FatosDaJornada {
  return {
    registro: {
      ...novaJornada(CHAT, NOW),
      nome: 'Rosemeire Silva',
      cidade: 'São Paulo',
      estado: 'SP',
      cpf: '26477039818',
      consentiu: true,
      cobrancasSeguidas: 1,
    },
    docsRecebidos: 0,
    docsCompletos: false,
    proximoDocumento: 'HISCON (histórico de empréstimos consignados do INSS)',
    ultimoRegistrado: null,
    ultimoRegistroEm: null,
  };
}

const texto = (t: string) => ({
  tipo: 'texto' as const,
  texto: t,
  primeiroContato: false,
  timestamp: NOW,
});

describe('caso REAL Rosemeire — "Tá" depois do CPF registrado', () => {
  it('a etapa é TRIAGEM e o "Tá" é agradecimento puro ⇒ socialCurto (nunca CPF)', () => {
    const f = fatosRosemeire();
    expect(derivarEtapa(f)).toBe('TRIAGEM');
    expect(ehAgradecimentoPuro('Tá')).toBe(true);
    const r = responderTurno(f, texto('Tá'));
    expect(r).toBe(MENSAGENS_JORNADA.socialCurto);
    expect(r).not.toMatch(/CPF/i);
  });

  it('cortesia CURTA sai VERBATIM — o humanizador nunca a reescreve', () => {
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.socialCurto)).toBe(true);
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.adiamentoOkCurto)).toBe(true);
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.adiamentoFecho('Rosemeire Silva'))).toBe(true);
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.recusaAgradecimento('Rosemeire Silva'))).toBe(true);
  });

  it('explicação LONGA sem termos de coleta continua humanizável', () => {
    // localizacao é longa e não contém CPF/HISCON/"análise gratuita" — a
    // humanização segue valendo para explicações e acolhimento.
    expect(ehRoteiroDeColeta(MENSAGENS_JORNADA.localizacao)).toBe(false);
  });
});
