// PASTAS POR ADVOGADO (2026-09-10) — entregas do Admin × cadastro do jurídico.
import { describe, it, expect } from 'vitest';
import type { ClienteJuridico, ContratoJuridico } from './juridico-service.js';
import { chaveDeNome, montarPastasPorAdvogado, type EntregaAoAdvogado } from './pastas-advogado.js';

const cliente = (id: string, nome: string): ClienteJuridico => ({ id, nome }) as ClienteJuridico;
const processo = (
  clienteId: string,
  numero: string,
  status: ContratoJuridico['status'] = 'ativo',
): ContratoJuridico => ({ clienteId, processoNumero: numero, status }) as ContratoJuridico;

describe('chaveDeNome', () => {
  it('ignora acento, caixa, pontuação e espaço duplo', () => {
    expect(chaveDeNome('TAÍS  Regina-Caetano da Silva')).toBe('tais regina caetano da silva');
  });
});

describe('montarPastasPorAdvogado', () => {
  const entregas: EntregaAoAdvogado[] = [
    {
      advogadoId: 'a-gra',
      advogado: 'Gracielle Ramos',
      chatId: 'c-tais',
      nome: 'TAIS REGINA CAETANO DA SILVA',
      entregueEm: '2026-08-20T10:00:00.000Z',
    },
    {
      advogadoId: 'a-gra',
      advogado: 'Gracielle Ramos',
      chatId: 'c-gil',
      nome: 'GILDETE DOS SANTOS TEIXEIRA',
      entregueEm: null,
    },
    // Mesma entrega repetida: não conta duas vezes.
    {
      advogadoId: 'a-gra',
      advogado: 'Gracielle Ramos',
      chatId: 'c-gil',
      nome: 'GILDETE DOS SANTOS TEIXEIRA',
      entregueEm: null,
    },
    {
      advogadoId: 'a-cor',
      advogado: 'Cornélio Figueiredo',
      chatId: 'c-ado',
      nome: 'ADONIRAM APARECIDA PAULINO VIEIRA',
      entregueEm: '2026-08-25T10:00:00.000Z',
    },
  ];
  const clientes = [
    cliente('j-tais', 'Taís Regina Caetano da Silva'),
    cliente('j-gil', 'Gildete dos Santos Teixeira'),
    cliente('j-fulano', 'Fulano Sem Entrega'),
  ];
  const contratos = [
    // Taís: 3 contratos, 2 processos distintos.
    processo('j-tais', '4005177-19.2026.8.26.0533'),
    processo('j-tais', '4005177-19.2026.8.26.0533'),
    processo('j-tais', '4005179-86.2026.8.26.0533'),
    // Gildete: 1 ativo + 1 excluído (não conta).
    processo('j-gil', '4002387-95.2026.8.26.0619'),
    processo('j-gil', '4002386-13.2026.8.26.0619', 'excluido'),
    processo('j-fulano', '4002400-94.2026.8.26.0619'),
  ];

  it('conta entregues, com processo e aguardando por advogado; casa o nome sem acento', () => {
    const r = montarPastasPorAdvogado(entregas, clientes, contratos);
    expect(r.pastas.map((p) => [p.advogado, p.entregues, p.comProcesso, p.aguardando])).toEqual([
      ['Cornélio Figueiredo', 1, 0, 1],
      ['Gracielle Ramos', 2, 2, 0],
    ]);
    const gracielle = r.pastas[1];
    expect(gracielle?.clientes.map((c) => [c.nome, c.processos, c.juridicoClienteId])).toEqual([
      ['Gildete dos Santos Teixeira', 1, 'j-gil'],
      ['Taís Regina Caetano da Silva', 2, 'j-tais'],
    ]);
    // Entregue e ainda sem cadastro aqui: aguardando o nº do processo.
    expect(r.pastas[0]?.clientes[0]).toMatchObject({
      nome: 'ADONIRAM APARECIDA PAULINO VIEIRA',
      juridicoClienteId: null,
      processos: 0,
      entregueEm: '2026-08-25T10:00:00.000Z',
    });
  });

  it('cliente do jurídico sem entrega no Admin vai para "sem advogado"', () => {
    const r = montarPastasPorAdvogado(entregas, clientes, contratos);
    expect(r.semAdvogado).toEqual([
      { clienteId: 'j-fulano', nome: 'Fulano Sem Entrega', processos: 1 },
    ]);
  });

  it('dentro da pasta, quem aguarda o nº vem primeiro', () => {
    const r = montarPastasPorAdvogado(
      [
        { ...entregas[0]!, chatId: 'c-1' },
        { ...entregas[3]!, advogadoId: 'a-gra', advogado: 'Gracielle Ramos', chatId: 'c-2' },
      ],
      clientes,
      contratos,
    );
    expect(r.pastas[0]?.clientes.map((c) => c.processos)).toEqual([0, 2]);
  });
});
