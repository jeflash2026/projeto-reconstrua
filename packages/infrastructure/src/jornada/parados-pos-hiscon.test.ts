// PARADOS DEPOIS DO HISCON — quem entregou o extrato e ficou sem dossiê. A
// separação por MOTIVO é o que importa: cada um pede um remédio diferente, e
// mandar mensagem para quem tem problema de leitura só piora.
import { describe, expect, it } from 'vitest';
import { ParadosPosHiscon, type ParadosPosHisconDeps } from './parados-pos-hiscon.js';

const AGORA = new Date('2026-08-13T12:00:00.000Z');
const clock = { now: () => AGORA };
const hAtras = (h: number): string => new Date(AGORA.getTime() - h * 3600_000).toISOString();

function deps(over: Partial<ParadosPosHisconDeps> = {}): ParadosPosHisconDeps {
  return {
    clock,
    comHiscon: () => Promise.resolve([]),
    comDossie: () => Promise.resolve(new Set()),
    ultimaEntrada: () => Promise.resolve(null),
    ultimasFalas: () => Promise.resolve([]),
    pediuConfirmacao: (t) => /responda sim/i.test(t),
    ...over,
  };
}

const base = deps({
  comHiscon: () =>
    Promise.resolve([
      { chatId: 'a@x', clienteId: 'cli-a', nome: 'Ana', temCpf: true, totalContratos: 5 },
      { chatId: 'b@x', clienteId: 'cli-b', nome: 'Bruno', temCpf: false, totalContratos: 3 },
      { chatId: 'c@x', clienteId: 'cli-c', nome: 'Carla', temCpf: true, totalContratos: 0 },
      { chatId: 'd@x', clienteId: 'cli-d', nome: 'Davi', temCpf: true, totalContratos: 9 },
    ]),
  // Davi já recebeu o dossiê: está fora.
  comDossie: () => Promise.resolve(new Set(['cli-d'])),
  ultimaEntrada: (chatId) =>
    Promise.resolve(chatId === 'c@x' ? hAtras(30) : hAtras(chatId === 'a@x' ? 3 : 10)),
  ultimasFalas: (chatId) =>
    Promise.resolve(chatId === 'a@x' ? ['Para darmos andamento, responda SIM aqui.'] : ['oi']),
});

describe('ParadosPosHiscon', () => {
  it('acha quem entregou o HISCON e ficou sem dossiê', async () => {
    const r = await new ParadosPosHiscon(base).varrer();
    expect(r.clientes.map((c) => c.nome)).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(r.clientes.some((c) => c.nome === 'Davi')).toBe(false);
    expect(r.total).toBe(3);
  });

  it('separa por MOTIVO — cada um pede um remédio diferente', async () => {
    const r = await new ParadosPosHiscon(base).varrer();
    const por = new Map(r.clientes.map((c) => [c.nome, c.situacao]));
    expect(por.get('Ana')).toBe('pronto-sem-dossie');
    expect(por.get('Bruno')).toBe('falta-cpf');
    expect(por.get('Carla')).toBe('hiscon-ilegivel');
  });

  it('marca a janela de 24h da Meta pela última fala DO CLIENTE', async () => {
    const r = await new ParadosPosHiscon(base).varrer();
    const por = new Map(r.clientes.map((c) => [c.nome, c.dentroDaJanela24h]));
    expect(por.get('Ana')).toBe(true); // falou há 3h
    expect(por.get('Bruno')).toBe(true); // há 10h
    expect(por.get('Carla')).toBe(false); // há 30h — só template
    expect(r.dentroDaJanela24h).toBe(2);
  });

  it('flagra quem ouviu "responda SIM" sem ter recebido o dossiê', async () => {
    const r = await new ParadosPosHiscon(base).varrer();
    expect(r.pediramSimSemDossie).toBe(1);
    expect(r.clientes[0]?.nome).toBe('Ana'); // vem primeiro: foi o enganado
    expect(r.clientes[0]?.pediuSimSemDossie).toBe(true);
  });

  it('ignora quem está parado há mais tempo que a janela pedida', async () => {
    const r = await new ParadosPosHiscon(
      deps({
        comHiscon: () =>
          Promise.resolve([
            { chatId: 'v@x', clienteId: 'cli-v', nome: 'Velho', temCpf: true, totalContratos: 2 },
          ]),
        ultimaEntrada: () => Promise.resolve(hAtras(24 * 30)),
      }),
    ).varrer();
    expect(r.total).toBe(0); // caso de reaquecimento, não deste defeito
  });
});
