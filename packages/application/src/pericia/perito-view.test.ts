// ─────────────────────────────────────────────────────────────────────────────
// PERITO VIEW (B-R2) — testes: fila derivada, merge de documentos (com ilegíveis
// DECLARADOS — Lei 9), planilha por cliente e lote com um arquivo POR CLIENTE.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ClientesList, ClienteResumo } from '../clientes/clientes-list.js';
import { PeritoView } from './perito-view.js';
import { CsvPlanilhaExporter } from './planilha.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function resumo(over: Partial<ClienteResumo>): ClienteResumo {
  return {
    clienteId: 'cli-1',
    chatId: 'c1',
    missionId: 'm1',
    quem: 'Maria',
    status: 'PRONTO_AGUARDANDO_PERICIA',
    modalidade: 'SOCIEDADE',
    pronto: true,
    faltando: [],
    saude: 'GREEN',
    ultimoContatoAt: NOW,
    pedidosConfirmadosEm: null,
    ...over,
  };
}

const HISCON = [
  'BANCO BMG S/A',
  'Contrato 000111222333 Inclusão 05/03/2024 Parcela R$ 45,30 ATIVO',
].join('\n');
const OUTRO_DOC = 'Comprovante de residência — Rua X, 123, Curitiba/PR';

function perito(
  clientes: readonly ClienteResumo[],
  textos: Record<string, string | null>,
  docsPorMissao: Record<string, string[]>,
) {
  const fakeList = { list: () => Promise.resolve(clientes) } as unknown as ClientesList;
  return new PeritoView({
    clientes: fakeList,
    documentosDaMissao: (missionId) => Promise.resolve(docsPorMissao[missionId] ?? []),
    textoDoDocumento: (id) => Promise.resolve(textos[id] ?? null),
    exporter: new CsvPlanilhaExporter(),
  });
}

describe('PeritoView · fila e contratos', () => {
  it('fila = apenas PRONTO_AGUARDANDO_PERICIA (derivada, sem estado próprio)', async () => {
    const view = perito(
      [
        resumo({}),
        resumo({ clienteId: 'cli-2', status: 'PRONTO_AGUARDANDO_VENDA' }),
        resumo({ clienteId: 'cli-3', status: 'ATENDIMENTO' }),
      ],
      {},
      {},
    );
    const fila = await view.fila(NOW);
    expect(fila).toHaveLength(1);
    expect(fila[0]?.clienteId).toBe('cli-1');
  });

  it('merge de documentos: HISCON parseia; outro doc não contribui; ilegível é CONTADO', async () => {
    const view = perito(
      [resumo({})],
      { d1: HISCON, d2: OUTRO_DOC, d3: null },
      { m1: ['d1', 'd2', 'd3'] },
    );
    const c = await view.contratos('cli-1', NOW);
    expect(c?.parse.contratos).toHaveLength(1);
    expect(c?.parse.contratos[0]?.banco).toBe('BANCO BMG S/A');
    expect(c?.documentosLidos).toBe(2);
    expect(c?.documentosSemTexto).toBe(1); // declarado, nunca omitido (Lei 9)
  });

  it('cliente inexistente → null; sem missão → parse vazio consistente', async () => {
    const view = perito([resumo({ missionId: null })], {}, {});
    expect(await view.contratos('nao-existe', NOW)).toBeNull();
    const semMissao = await view.contratos('cli-1', NOW);
    expect(semMissao?.parse.contratos).toEqual([]);
    expect(semMissao?.documentosLidos).toBe(0);
  });
});

describe('PeritoView · planilhas', () => {
  it('planilha de um cliente: nome do arquivo, mime e conteúdo CSV', async () => {
    const view = perito([resumo({})], { d1: HISCON }, { m1: ['d1'] });
    const p = await view.planilha('cli-1', NOW);
    expect(p?.nomeArquivo).toBe('contratos-cli-1.csv');
    expect(p?.mime).toContain('text/csv');
    expect(p?.conteudo).toContain('BANCO BMG S/A');
    expect(p?.conteudo).toContain('DENTRO_5_ANOS');
  });

  it('lote: um arquivo POR CLIENTE da fila (nunca misturado)', async () => {
    const view = perito(
      [resumo({}), resumo({ clienteId: 'cli-2', chatId: 'c2', missionId: 'm2', quem: 'João' })],
      { d1: HISCON, d2: HISCON.replace('BMG', 'PAN') },
      { m1: ['d1'], m2: ['d2'] },
    );
    const lote = await view.planilhasDaFila(NOW);
    expect(lote).toHaveLength(2);
    expect(lote.map((p) => p.nomeArquivo)).toEqual(['contratos-cli-1.csv', 'contratos-cli-2.csv']);
    expect(lote[0]?.conteudo).toContain('BMG');
    expect(lote[0]?.conteudo).not.toContain('PAN');
    expect(lote[1]?.conteudo).toContain('PAN');
  });
});
