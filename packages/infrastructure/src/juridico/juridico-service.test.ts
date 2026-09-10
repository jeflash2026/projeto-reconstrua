// PROCESSOS DISTRIBUÍDOS NO DIA (2026-09-10) — o card do dashboard jurídico:
// processo = nº CNJ, conta no dia (Brasília) do PRIMEIRO contrato cadastrado.
import { describe, it, expect } from 'vitest';
import { diaEmBrasilia, distribuidosNoDia, type ContratoJuridico } from './juridico-service.js';

function contrato(p: Partial<ContratoJuridico>): ContratoJuridico {
  return {
    id: 'jt-1',
    clienteId: 'jc-1',
    processoNumero: '4002387-95.2026.8.26.0619',
    banco: 'PICPAY BANK',
    numero: 's/nº',
    valor: null,
    assinatura: null,
    inicio: null,
    fimPrevisto: null,
    observacoes: '',
    status: 'ativo',
    encerramento: null,
    exclusao: null,
    anexos: [],
    historico: [],
    criadoPor: 'AHRI (Jarvis)',
    em: '2026-09-10T20:40:00.000Z',
    atualizadoEm: '2026-09-10T20:40:00.000Z',
    ...p,
  };
}

describe('diaEmBrasilia', () => {
  it('01:30 UTC ainda é o dia ANTERIOR em Brasília; 03:30 UTC já é o seguinte', () => {
    expect(diaEmBrasilia(new Date('2026-09-11T01:30:00.000Z'))).toBe('2026-09-10');
    expect(diaEmBrasilia(new Date('2026-09-11T03:30:00.000Z'))).toBe('2026-09-11');
  });
});

describe('distribuidosNoDia', () => {
  it('conta processos (não contratos) do dia, pelo PRIMEIRO cadastro, sem os excluídos', () => {
    const agora = new Date('2026-09-11T02:00:00.000Z'); // 23:00 de 10/09 em Brasília
    const nomes = new Map([
      ['jc-1', 'Gildete dos Santos Teixeira'],
      ['jc-2', 'Jose Rodrigues'],
    ]);
    const r = distribuidosNoDia(
      [
        // Hoje: conta.
        contrato({ id: 'a', processoNumero: '4002387-95.2026.8.26.0619' }),
        // Hoje, DOIS contratos no mesmo processo: conta UMA vez.
        contrato({ id: 'b1', clienteId: 'jc-2', processoNumero: '4002412-11.2026.8.26.0619' }),
        contrato({
          id: 'b2',
          clienteId: 'jc-2',
          processoNumero: '4002412-11.2026.8.26.0619',
          em: '2026-09-10T20:41:00.000Z',
        }),
        // 22:00 de 10/09 em Brasília (já 11/09 em UTC): conta.
        contrato({
          id: 'f',
          processoNumero: '4002386-13.2026.8.26.0619',
          banco: 'PARANÁ BANCO',
          em: '2026-09-11T01:00:00.000Z',
        }),
        // Ontem em Brasília (23:00 de 09/09): não conta.
        contrato({
          id: 'c',
          processoNumero: '4002385-28.2026.8.26.0619',
          em: '2026-09-10T02:00:00.000Z',
        }),
        // Processo que nasceu ontem e ganhou contrato hoje: não conta de novo.
        contrato({
          id: 'd1',
          processoNumero: '4002400-94.2026.8.26.0619',
          em: '2026-09-09T15:00:00.000Z',
        }),
        contrato({ id: 'd2', processoNumero: '4002400-94.2026.8.26.0619' }),
        // Excluído hoje: fora.
        contrato({ id: 'e', processoNumero: '4002401-79.2026.8.26.0619', status: 'excluido' }),
      ],
      nomes,
      agora,
    );
    expect(r.dia).toBe('2026-09-10');
    expect(r.processos).toBe(3);
    expect(r.clientes).toBe(2);
    // Mais recente primeiro; nome do cliente resolvido.
    expect(r.itens.map((i) => i.processo)).toEqual([
      '4002386-13.2026.8.26.0619',
      '4002387-95.2026.8.26.0619',
      '4002412-11.2026.8.26.0619',
    ]);
    expect(r.itens[0]).toMatchObject({
      banco: 'PARANÁ BANCO',
      clienteNome: 'Gildete dos Santos Teixeira',
    });
  });

  it('dia sem cadastro ⇒ zero, lista vazia', () => {
    const r = distribuidosNoDia([], new Map(), new Date('2026-09-10T15:00:00.000Z'));
    expect(r).toEqual({ dia: '2026-09-10', processos: 0, clientes: 0, itens: [] });
  });
});
