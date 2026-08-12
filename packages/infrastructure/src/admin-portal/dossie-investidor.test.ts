// DOSSIÊ DE INVESTIDOR — o relatório que sai da empresa. Errar aqui é pior que
// errar numa tela: o número vai para a mesa de negociação. Os testes fixam as
// três disciplinas: taxa do degrau ANTERIOR (não do topo), MEDIANA (não média)
// e ZERO dado pessoal no que sai.
import { describe, expect, it } from 'vitest';
import { DossieInvestidor, type DossieInvestidorDeps } from './dossie-investidor.js';

const clock = { now: () => new Date('2026-08-12T12:00:00.000Z') };

function deps(over: Partial<DossieInvestidorDeps> = {}): DossieInvestidorDeps {
  return {
    clock,
    sessoes: () => Promise.resolve([]),
    comHiscon: () => Promise.resolve([]),
    pareceres: () => Promise.resolve([]),
    mesa: () => Promise.resolve([]),
    custos: () => Promise.resolve([]),
    ...over,
  };
}

/** 10 contatos; 4 entregam HISCON; 3 têm CPF; 2 recebem dossiê; 1 confirma e fecha. */
function baseReal(): DossieInvestidorDeps {
  const sessoes = Array.from({ length: 10 }, (_, i) => ({
    chatId: `c${i}@s.whatsapp.net`,
    openedAt: new Date('2026-06-01T10:00:00.000Z'),
  }));
  return deps({
    sessoes: () => Promise.resolve(sessoes),
    comHiscon: () =>
      Promise.resolve([
        { clienteId: 'cli-0', chatId: 'c0@s.whatsapp.net', temCpf: true, totalContratos: 5 },
        { clienteId: 'cli-1', chatId: 'c1@s.whatsapp.net', temCpf: true, totalContratos: 3 },
        { clienteId: 'cli-2', chatId: 'c2@s.whatsapp.net', temCpf: true, totalContratos: 0 },
        { clienteId: 'cli-3', chatId: 'c3@s.whatsapp.net', temCpf: false, totalContratos: 2 },
      ]),
    pareceres: () =>
      Promise.resolve([
        {
          clienteId: 'cli-0',
          enviadoEm: new Date('2026-06-03T10:00:00.000Z'),
          confirmadoEm: new Date('2026-06-05T10:00:00.000Z'),
        },
        {
          clienteId: 'cli-1',
          enviadoEm: new Date('2026-06-11T10:00:00.000Z'),
          confirmadoEm: null,
        },
      ]),
    mesa: () =>
      Promise.resolve([
        {
          clienteId: 'cli-0',
          chatId: 'c0@s.whatsapp.net',
          uf: 'MG',
          potencial: 12000,
          completo: true,
          descartado: false,
        },
      ]),
    custos: () => Promise.resolve([{ custoUsd: 1 }, { custoUsd: 2 }, { custoUsd: null }]),
  });
}

describe('DossieInvestidor', () => {
  it('mede cada degrau contra o ANTERIOR e contra o topo', async () => {
    const d = await new DossieInvestidor(baseReal()).gerar();
    const por = new Map(d.funil.map((e) => [e.id, e]));

    expect(por.get('contatos')?.quantidade).toBe(10);
    expect(por.get('contatos')?.taxaDaAnterior).toBeNull(); // o topo não tem anterior
    expect(por.get('hiscon')?.quantidade).toBe(4);
    expect(por.get('hiscon')?.taxaDaAnterior).toBe(40); // 4 de 10
    expect(por.get('fase1')?.quantidade).toBe(3);
    expect(por.get('fase1')?.taxaDaAnterior).toBe(75); // 3 de 4 — não 30
    expect(por.get('fase1')?.taxaDoTopo).toBe(30);
    expect(por.get('elegiveis')?.quantidade).toBe(2); // cli-2 tem CPF mas 0 contrato
    expect(por.get('confirmados')?.quantidade).toBe(1);
    expect(por.get('fechados')?.quantidade).toBe(1);
  });

  it('calcula o custo de IA por cliente fechado (a métrica-chave)', async () => {
    const d = await new DossieInvestidor(baseReal()).gerar();
    expect(d.economia.custoIaUsd).toBe(3); // o registro sem preço não vira zero mentiroso
    expect(d.economia.chamadasDeIa).toBe(3);
    expect(d.economia.custoIaPorLeadUsd).toBe(0.3);
    expect(d.economia.custoIaPorClienteFechadoUsd).toBe(3);
  });

  it('mede velocidade em dias, do contato ao dossiê e do dossiê ao SIM', async () => {
    const d = await new DossieInvestidor(baseReal()).gerar();
    // cli-0: 01/06 → 03/06 = 2 dias; cli-1: 01/06 → 11/06 = 10 dias ⇒ mediana 6.
    expect(d.velocidade.diasAteParecer).toBe(6);
    expect(d.velocidade.diasParaConfirmar).toBe(2);
  });

  it('usa mediana, não média (um outlier não vira a régua)', async () => {
    const d = await new DossieInvestidor(
      deps({
        mesa: () =>
          Promise.resolve(
            [1000, 2000, 300000].map((potencial, i) => ({
              clienteId: `cli-${i}`,
              chatId: `c${i}@s.whatsapp.net`,
              uf: 'SP',
              potencial,
              completo: true,
              descartado: false,
            })),
          ),
      }),
    ).gerar();
    // Média seria ~101.000 — a mediana conta a verdade do caso típico.
    expect(d.carteira.potencialMedianoPorClienteFechado).toBe(2000);
    expect(d.carteira.potencialConfirmado).toBe(303000);
  });

  it('agrupa a coorte pelo mês do primeiro contato', async () => {
    const d = await new DossieInvestidor(
      deps({
        sessoes: () =>
          Promise.resolve([
            { chatId: 'a@s.whatsapp.net', openedAt: new Date('2026-06-10T10:00:00.000Z') },
            { chatId: 'b@s.whatsapp.net', openedAt: new Date('2026-07-02T10:00:00.000Z') },
            { chatId: 'c@s.whatsapp.net', openedAt: new Date('2026-07-20T10:00:00.000Z') },
          ]),
      }),
    ).gerar();
    expect(d.coortes.map((c) => [c.mes, c.leads])).toEqual([
      ['2026-06', 1],
      ['2026-07', 2],
    ]);
  });

  it('não deixa escapar nome, CPF nem telefone do cliente', async () => {
    const d = await new DossieInvestidor(baseReal()).gerar();
    const texto = JSON.stringify(d);
    expect(texto).not.toContain('@s.whatsapp.net');
    expect(texto).not.toContain('cli-0');
  });

  it('não divide por zero numa base vazia', async () => {
    const d = await new DossieInvestidor(deps()).gerar();
    expect(d.economia.custoIaPorLeadUsd).toBeNull();
    expect(d.economia.custoIaPorClienteFechadoUsd).toBeNull();
    expect(d.carteira.potencialMedianoPorClienteFechado).toBeNull();
    expect(d.velocidade.diasAteParecer).toBeNull();
    expect(d.funil.every((e) => e.taxaDoTopo === 0)).toBe(true);
  });
});
