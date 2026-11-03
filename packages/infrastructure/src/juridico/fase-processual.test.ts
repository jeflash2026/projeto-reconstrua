// ─────────────────────────────────────────────────────────────────────────────
// FASE PROCESSUAL — testes. A regra que importa: processo anda para a FRENTE,
// e o que não anda há tempo demais precisa aparecer.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { faseProcessualDe, contarPorFase, ESCADA_PROCESSUAL } from './fase-processual.js';
import type { AndamentoProcesso } from './juridico-service.js';

const HOJE = '2026-11-03T12:00:00.000Z';

function andamento(
  movimentos: ReadonlyArray<[string, string]>,
  over: Partial<AndamentoProcesso> = {},
): AndamentoProcesso {
  const mapeados = movimentos.map(([nome, dataHora]) => ({ nome, dataHora }));
  const ultimo = [...mapeados].sort((a, b) => b.dataHora.localeCompare(a.dataHora))[0] ?? null;
  return {
    numero: '4001405-24.2026.8.26.0153',
    tribunal: 'TJSP',
    classe: 'PROCEDIMENTO COMUM CÍVEL',
    orgaoJulgador: '1ª Vara Cível',
    assunto: '',
    grau: 'G1',
    dataAjuizamento: '2026-06-01',
    ultimoMovimento: ultimo,
    movimentos: mapeados,
    emExecucao: false,
    novidade: false,
    consultadoEm: HOJE,
    erro: null,
    ...over,
  };
}

describe('faseProcessualDe', () => {
  it('sem movimento reconhecível fica em Distribuído, contado da data de ajuizamento', () => {
    const f = faseProcessualDe(
      andamento([['Conclusos para despacho', '2026-10-30T12:00:00.000Z']]),
      HOJE,
    );
    expect(f.fase).toBe('distribuido');
    expect(f.desde).toBe('2026-06-01');
    expect(f.diasSemMovimento).toBe(4);
    expect(f.parado).toBe(false);
  });

  it('classifica pelo movimento mais ADIANTADO, não pelo último', () => {
    // Sentença em agosto e um despacho ordinário depois: continua em Sentença.
    const f = faseProcessualDe(
      andamento([
        ['Citação', '2026-07-01T12:00:00.000Z'],
        ['Julgado procedente o pedido', '2026-08-28T12:00:00.000Z'],
        ['Conclusos para despacho', '2026-10-30T12:00:00.000Z'],
      ]),
      HOJE,
    );
    expect(f.fase).toBe('sentenca');
    expect(f.desde).toBe('2026-08-28T12:00:00.000Z');
  });

  it('a escada vai até o dinheiro: alvará leva a Pagamento', () => {
    const f = faseProcessualDe(
      andamento([
        ['Julgado procedente o pedido', '2026-07-10T12:00:00.000Z'],
        ['Trânsito em julgado', '2026-08-10T12:00:00.000Z'],
        ['Cumprimento de sentença', '2026-09-10T12:00:00.000Z'],
        ['Expedição de alvará', '2026-10-20T12:00:00.000Z'],
      ]),
      HOJE,
    );
    expect(f.fase).toBe('pagamento');
    expect(f.ordem).toBe(6);
  });

  it('a CLASSE de execução vence o texto quando nenhum movimento diz isso', () => {
    const f = faseProcessualDe(
      andamento([['Conclusos para despacho', '2026-10-01T12:00:00.000Z']], {
        classe: 'CUMPRIMENTO DE SENTENÇA',
        emExecucao: true,
      }),
      HOJE,
    );
    expect(f.fase).toBe('execucao');
  });

  it('a classe NÃO rebaixa um processo que já foi mais longe', () => {
    const f = faseProcessualDe(
      andamento([['Expedição de alvará', '2026-10-20T12:00:00.000Z']], { emExecucao: true }),
      HOJE,
    );
    expect(f.fase).toBe('pagamento');
  });

  it('PARADO: passou do limite da fase sem nenhum movimento', () => {
    // Sentença tolera 45 dias; este está sem andar desde agosto.
    const f = faseProcessualDe(
      andamento([['Julgado procedente o pedido', '2026-08-01T12:00:00.000Z']]),
      HOJE,
    );
    expect(f.diasSemMovimento).toBe(94);
    expect(f.limiteParado).toBe(45);
    expect(f.parado).toBe(true);
  });

  it('cada fase tem a própria tolerância — instrução aguenta mais que sentença', () => {
    // 94 dias sem andar: em instrução (limite 90) está parado por pouco.
    const instrucao = faseProcessualDe(andamento([['Citação', '2026-08-01T12:00:00.000Z']]), HOJE);
    expect(instrucao.fase).toBe('instrucao');
    expect(instrucao.limiteParado).toBe(90);
    expect(instrucao.parado).toBe(true);
    // O mesmo intervalo logo após a distribuição (limite 45) também.
    const distribuido = faseProcessualDe(
      andamento([['Conclusos para despacho', '2026-08-01T12:00:00.000Z']]),
      HOJE,
    );
    expect(distribuido.limiteParado).toBe(45);
    expect(distribuido.parado).toBe(true);
  });

  it('processo sem movimento nenhum não inventa dias nem alerta', () => {
    const f = faseProcessualDe(andamento([]), HOJE);
    expect(f.diasSemMovimento).toBeNull();
    expect(f.parado).toBe(false);
  });

  it('encerrado nunca aparece como parado', () => {
    const f = faseProcessualDe(
      andamento([['Arquivamento definitivo', '2025-01-10T12:00:00.000Z']]),
      HOJE,
    );
    expect(f.fase).toBe('encerrado');
    expect(f.parado).toBe(false);
  });
});

describe('contarPorFase', () => {
  it('devolve TODAS as fases na ordem, mesmo as vazias, com os parados à parte', () => {
    const linhas = contarPorFase(
      [
        andamento([['Citação', '2026-10-25T12:00:00.000Z']]),
        andamento([['Citação', '2026-01-10T12:00:00.000Z']]), // parado
        andamento([['Julgado procedente o pedido', '2026-10-28T12:00:00.000Z']]),
      ],
      HOJE,
    );
    expect(linhas).toHaveLength(ESCADA_PROCESSUAL.length);
    expect(linhas.map((l) => l.ordem)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const instrucao = linhas.find((l) => l.fase === 'instrucao');
    expect(instrucao).toMatchObject({ total: 2, parados: 1 });
    expect(linhas.find((l) => l.fase === 'sentenca')).toMatchObject({ total: 1, parados: 0 });
    expect(linhas.find((l) => l.fase === 'pagamento')).toMatchObject({ total: 0, parados: 0 });
  });
});
