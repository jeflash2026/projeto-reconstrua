// ─────────────────────────────────────────────────────────────────────────────
// Decreto 2026-07-26 (CPF): sem o CPF a perícia não protocola o pedido
// administrativo nos bancos. A triagem passa a ter DUAS partes — CPF primeiro,
// HISCON depois — e a captura valida os dígitos verificadores (um celular
// brasileiro também tem 11 dígitos e não pode virar CPF).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  MENSAGENS_JORNADA,
  capturarCpf,
  novaJornada,
  responderTurno,
  type FatosDaJornada,
  type JornadaRecord,
} from './jornada-comercial.js';

const NOW = new Date('2026-07-26T12:00:00.000Z');
const CHAT = '5511999999999@s.whatsapp.net';
// CPF sintético válido pelos dígitos verificadores (não pertence a ninguém).
const CPF_VALIDO = '52998224725';

function fatos(over: Partial<JornadaRecord> = {}, docs: Partial<FatosDaJornada> = {}) {
  const registro: JornadaRecord = {
    ...novaJornada(CHAT, NOW),
    nome: 'Maria Silva',
    cidade: 'Recife',
    consentiu: true,
    ...over,
  };
  return {
    registro,
    docsRecebidos: 0,
    docsCompletos: false,
    proximoDocumento: 'HISCON (histórico de empréstimos consignados do INSS)',
    ultimoRegistrado: null,
    ultimoRegistroEm: null,
    ...docs,
  } satisfies FatosDaJornada;
}
const turno = (texto: string) => ({
  tipo: 'texto' as const,
  texto,
  primeiroContato: false,
  timestamp: NOW,
});

describe('captura de CPF', () => {
  it('aceita formatado, com espaços e só dígitos', () => {
    expect(capturarCpf('529.982.247-25')).toBe(CPF_VALIDO);
    expect(capturarCpf('meu cpf é 52998224725, ok?')).toBe(CPF_VALIDO);
    expect(capturarCpf('529 982 247 25')).toBe(CPF_VALIDO);
  });

  it('RECUSA telefone de 11 dígitos (o motivo de validar dígito verificador)', () => {
    expect(capturarCpf('11987654321')).toBe(null);
    expect(capturarCpf('meu whats é (11) 98765-4321')).toBe(null);
  });

  it('recusa repetidos, curtos e texto sem número', () => {
    expect(capturarCpf('111.111.111-11')).toBe(null);
    expect(capturarCpf('12345')).toBe(null);
    expect(capturarCpf('não tenho aqui agora')).toBe(null);
  });
});

describe('triagem em duas partes: CPF e depois HISCON', () => {
  it('ao consentir, anuncia as DUAS coisas e pede o CPF', () => {
    const r = responderTurno(fatos({ ultimaCaptura: 'consentimento' }), turno('sim, quero'));
    expect(r).toContain('duas coisas');
    expect(r).toContain('CPF');
  });

  it('sem CPF, a cobrança da triagem é o CPF — nunca o HISCON', () => {
    const r = responderTurno(fatos({ cpf: null }), turno('oi'));
    expect(r).toContain('CPF');
    expect(r).not.toContain('Meu INSS');
  });

  it('capturado o CPF, confirma e emenda o pedido do HISCON', () => {
    const r = responderTurno(fatos({ cpf: CPF_VALIDO, ultimaCaptura: 'cpf' }), turno(CPF_VALIDO));
    expect(r).toContain('CPF registrado');
    expect(r).toContain('Extrato de Empréstimos Consignados');
  });

  it('com CPF já registrado, a cobrança volta a ser o HISCON', () => {
    const r = responderTurno(fatos({ cpf: CPF_VALIDO }), turno('oi'));
    expect(r).toContain('HISCON');
  });

  it('a mensagem do follow-up de CPF é a ditada pelo dono', () => {
    expect(MENSAGENS_JORNADA.followUpCpf).toContain('Já estamos em análise');
    expect(MENSAGENS_JORNADA.followUpCpf).toContain('CPF');
    expect(MENSAGENS_JORNADA.followUpCpf).toContain('contratos junto aos bancos');
  });
});
