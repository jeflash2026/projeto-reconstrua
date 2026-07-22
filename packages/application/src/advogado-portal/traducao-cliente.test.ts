// ─────────────────────────────────────────────────────────────────────────────
// TRADUÇÃO HUMANIZADA (GO-LIVE-02) — testes: a verdade permanece (original
// intocado, Lei 10), a linguagem muda (textoCliente persistido UMA vez),
// fail-closed (sem tradução ⇒ pendente; nunca texto cru), anti-invenção
// determinística (número novo ⇒ descartada) e reprocesso pelo tick.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { JuridicalEntry, JuridicalWorkStore } from './juridical-work.js';
import {
  TraducaoClienteRuntime,
  precisaTraducao,
  traducaoPreservaVerdade,
} from './traducao-cliente.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function entry(over: Partial<JuridicalEntry>): JuridicalEntry {
  return {
    id: 'j1',
    advogadoId: 'adv-1',
    missionId: 'm1',
    kind: 'movimentacao',
    text: 'Juntada de contestação da autarquia. Prazo de réplica em curso.',
    dueAt: null,
    attachmentRef: null,
    done: false,
    createdAt: NOW,
    ...over,
  };
}

function storeCom(entries: JuridicalEntry[]): {
  store: JuridicalWorkStore;
  salvos: JuridicalEntry[];
} {
  const salvos: JuridicalEntry[] = [];
  const store: JuridicalWorkStore = {
    save: (e) => {
      salvos.push(e);
      const i = entries.findIndex((x) => x.id === e.id);
      if (i >= 0) entries[i] = e;
      return Promise.resolve();
    },
    byId: (id) => Promise.resolve(entries.find((e) => e.id === id) ?? null),
    byAdvogado: () => Promise.resolve(entries),
    byMission: (missionId) => Promise.resolve(entries.filter((e) => e.missionId === missionId)),
  };
  return { store, salvos };
}

describe('traducaoPreservaVerdade · anti-invenção determinística', () => {
  it('aceita quando todos os números da tradução existem no original', () => {
    expect(
      traducaoPreservaVerdade(
        'Distribuído à 2ª Vara Federal.',
        'Seu processo chegou à 2ª Vara Federal — agora é oficial.',
      ),
    ).toBe(true);
    expect(traducaoPreservaVerdade('Sem números.', 'Também sem números.')).toBe(true);
  });
  it('REJEITA número inventado (prazo/valor/data que não está no original)', () => {
    expect(
      traducaoPreservaVerdade(
        'Juntada de contestação.',
        'O INSS respondeu — em 15 dias teremos novidade.',
      ),
    ).toBe(false);
  });
});

describe('TraducaoClienteRuntime · a verdade permanece; a linguagem muda', () => {
  it('traduz na escrita e persiste textoCliente — o original fica intocado (Lei 10)', async () => {
    const e = entry({});
    const { store, salvos } = storeCom([e]);
    const rt = new TraducaoClienteRuntime(
      store,
      {
        traduzir: () =>
          Promise.resolve(
            'O INSS apresentou a resposta dele — um passo normal do caminho. Agora é a nossa vez.',
          ),
      },
      () => Promise.resolve(['m1']),
    );
    const out = await rt.traduzir(e);
    expect(out.textoCliente).toContain('passo normal');
    expect(out.text).toBe(e.text); // o fato nunca muda
    expect(salvos).toHaveLength(1);
  });

  it('FAIL-CLOSED: LLM offline (null) ⇒ pendente; falha do LLM ⇒ pendente; nunca propaga erro', async () => {
    const e = entry({});
    const { store, salvos } = storeCom([e]);
    const offline = new TraducaoClienteRuntime(store, null, () => Promise.resolve(['m1']));
    expect((await offline.traduzir(e)).textoCliente).toBeUndefined();
    const falhando = new TraducaoClienteRuntime(
      store,
      { traduzir: () => Promise.reject(new Error('rede')) },
      () => Promise.resolve(['m1']),
    );
    expect((await falhando.traduzir(e)).textoCliente).toBeUndefined();
    expect(salvos).toHaveLength(0); // nada persistido
  });

  it('tradução que INVENTA números é descartada (permanece pendente)', async () => {
    const e = entry({});
    const { store, salvos } = storeCom([e]);
    const rt = new TraducaoClienteRuntime(
      store,
      { traduzir: () => Promise.resolve('Em 15 dias teremos a resposta.') },
      () => Promise.resolve(['m1']),
    );
    const out = await rt.traduzir(e);
    expect(out.textoCliente).toBeUndefined();
    expect(salvos).toHaveLength(0);
  });

  it('só o DIZÍVEL é traduzido: observacao/prazo/numero_processo nunca', () => {
    expect(precisaTraducao(entry({ kind: 'observacao' }))).toBe(false);
    expect(precisaTraducao(entry({ kind: 'prazo' }))).toBe(false);
    expect(precisaTraducao(entry({ kind: 'numero_processo' }))).toBe(false);
    expect(precisaTraducao(entry({ kind: 'movimentacao' }))).toBe(true);
    expect(precisaTraducao(entry({ textoCliente: 'já traduzida' }))).toBe(false); // UMA vez
  });

  it('o tick reprocessa pendentes — nenhum balão nasce cru, só atrasa', async () => {
    const pendente = entry({});
    const jaTraduzida = entry({ id: 'j2', textoCliente: 'já humana' });
    const interna = entry({ id: 'j3', kind: 'observacao' });
    const { store } = storeCom([pendente, jaTraduzida, interna]);
    const chamadas: string[] = [];
    const rt = new TraducaoClienteRuntime(
      store,
      {
        traduzir: (original) => {
          chamadas.push(original);
          return Promise.resolve('Novidade explicada com carinho.');
        },
      },
      () => Promise.resolve(['m1']),
    );
    const n = await rt.reprocessarPendentes();
    expect(n).toBe(1); // só a pendente dizível
    expect(chamadas).toEqual([pendente.text]);
    expect((await store.byId('j1'))?.textoCliente).toBe('Novidade explicada com carinho.');
  });
});
