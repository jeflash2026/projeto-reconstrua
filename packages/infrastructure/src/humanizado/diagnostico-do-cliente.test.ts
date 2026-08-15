// POR QUE ESTE CLIENTE NÃO ESTÁ NA MESA — o teste guarda a regra que mais
// importa: o veredito é o PRIMEIRO elo quebrado. Apontar um elo posterior manda
// a equipe consertar o que é consequência, não causa.
import { describe, expect, it } from 'vitest';
import { diagnosticar, type FatosDoCliente } from './diagnostico-do-cliente.js';

function fatos(over: Partial<FatosDoCliente> = {}): FatosDoCliente {
  return {
    chatId: '5515996269280@s.whatsapp.net',
    clienteId: 'cli-1',
    nome: 'CANDIDA APARECIDA DE LIMA',
    mensagens: 40,
    cpf: '12345678901',
    hisconRecebido: true,
    contratosLidos: 5,
    parecerEnviadoEm: '2026-08-05T10:00:00.000Z',
    confirmadoEm: '2026-08-06T10:00:00.000Z',
    disseSim: true,
    naMesa: true,
    descartado: false,
    ...over,
  };
}

describe('diagnosticar', () => {
  it('corrente inteira ⇒ sem bloqueio', () => {
    const d = diagnosticar(fatos());
    expect(d.bloqueio).toBeNull();
    expect(d.elos.every((e) => e.ok)).toBe(true);
    expect(d.oQueFazer).toContain('Nada a fazer');
  });

  it('aponta o PRIMEIRO elo quebrado, não o último', () => {
    // Sem CPF, tudo depois cai junto — mas a causa é o CPF.
    const d = diagnosticar(
      fatos({
        cpf: null,
        parecerEnviadoEm: null,
        confirmadoEm: null,
        disseSim: false,
        naMesa: false,
      }),
    );
    expect(d.bloqueio).toBe('CPF registrado');
    expect(d.oQueFazer).toContain('Cobre o CPF');
  });

  it('HISCON ilegível é problema NOSSO — nunca cobrança ao cliente', () => {
    const d = diagnosticar(
      fatos({
        contratosLidos: 0,
        parecerEnviadoEm: null,
        confirmadoEm: null,
        disseSim: false,
        naMesa: false,
      }),
    );
    expect(d.bloqueio).toBe('HISCON legível');
    expect(d.oQueFazer).toContain('problema NOSSO');
    expect(d.oQueFazer).toContain('não cobre nada do cliente');
  });

  it('disse SIM sem registro manda para a varredura, não para a cobrança', () => {
    const d = diagnosticar(fatos({ confirmadoEm: null, disseSim: true, naMesa: false }));
    expect(d.bloqueio).toBe('Confirmação registrada');
    expect(d.elos.find((e) => e.id === 'sim')?.detalhe).toContain('o sistema não registrou');
    expect(d.oQueFazer).toContain('Varredura da fase 2');
  });

  it('recebeu o dossiê e ficou calado ⇒ pedir a confirmação', () => {
    const d = diagnosticar(fatos({ confirmadoEm: null, disseSim: false, naMesa: false }));
    expect(d.oQueFazer).toContain('pedir a confirmação');
  });

  it('descarte prevalece — não faz sentido cobrar quem saiu', () => {
    const d = diagnosticar(fatos({ descartado: true, naMesa: false }));
    expect(d.bloqueio).toBe('Descartado por desinteresse');
    expect(d.oQueFazer).toContain('reative na mesa');
  });

  it('cada elo diz o que o sistema TEM, nunca só "não"', () => {
    const d = diagnosticar(fatos({ contratosLidos: 7 }));
    expect(d.elos.find((e) => e.id === 'leitura')?.detalhe).toBe('7 contrato(s) lidos');
    expect(d.elos.find((e) => e.id === 'dossie')?.detalhe).toContain('enviado em');
  });
});
