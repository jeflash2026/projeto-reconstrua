// ─────────────────────────────────────────────────────────────────────────────
// A DESPEDIDA (GO-LIVE-02) — testes das MESMAS invariantes do nascimento:
// envio único (fato ANTES da mensagem — Lei 8), idempotência, nunca prematura
// (só VENDIDO + reconhecido), e o texto homologado que devolve a promessa.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ClientesList, ClienteResumo } from '../clientes/clientes-list.js';
import {
  DespedidaRuntime,
  mensagemDespedida,
  type DespedidaRegistro,
  type DespedidaStore,
} from './despedida.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function resumo(over: Partial<ClienteResumo>): ClienteResumo {
  return {
    clienteId: 'cli-1',
    chatId: 'c1',
    missionId: 'm1',
    quem: 'Maria',
    status: 'VENDIDO',
    modalidade: 'VENDA',
    pronto: true,
    faltando: [],
    saude: 'GREEN',
    ultimoContatoAt: NOW,
    pedidosConfirmadosEm: null,
    ...over,
  };
}

function harness(clientes: readonly ClienteResumo[], entregue = true) {
  const fatos = new Map<string, DespedidaRegistro>();
  const enviadas: Array<{ chatId: string; texto: string }> = [];
  const ordem: string[] = [];
  const store: DespedidaStore = {
    load: (clienteId) => Promise.resolve(fatos.get(clienteId) ?? null),
    save: (r) => {
      ordem.push('fato');
      fatos.set(r.clienteId, r);
      return Promise.resolve();
    },
  };
  const runtime = new DespedidaRuntime({
    clientes: { list: () => Promise.resolve(clientes) } as unknown as ClientesList,
    despedida: store,
    comunicador: {
      comunicar: (chatId, _clienteId, texto) => {
        ordem.push('mensagem');
        enviadas.push({ chatId, texto });
        return Promise.resolve(entregue);
      },
    },
  });
  return { runtime, fatos, enviadas, ordem };
}

describe('DespedidaRuntime · a relação se encerra como começou: conversando', () => {
  it('VENDIDO reconhecido → fato ANTES da mensagem (Lei 8) e texto homologado', async () => {
    const h = harness([resumo({})]);
    const r = await h.runtime.verificar(NOW);
    expect(r.despedidos).toEqual(['cli-1']);
    expect(h.ordem).toEqual(['fato', 'mensagem']); // o fato é a decisão; a mensagem, consequência
    expect(h.fatos.get('cli-1')?.comunicadaEm).toEqual(NOW);
    expect(h.enviadas[0]?.chatId).toBe('c1');
    expect(h.enviadas[0]?.texto).toBe(mensagemDespedida('Maria'));
  });

  it('a despedida devolve a promessa do nascimento — nunca fria', () => {
    const texto = mensagemDespedida('Maria');
    expect(texto).toContain('Oi, Maria!');
    expect(texto).toContain('Foi um prazer acompanhar você até aqui');
    expect(texto).toContain('estarei por aqui'); // o círculo se fecha
    expect(texto).not.toContain('sistema'); // despedida, não aviso
  });

  it('IDEMPOTÊNCIA: segunda varredura é no-op (fato existente ⇒ nunca reenvia)', async () => {
    const h = harness([resumo({})]);
    await h.runtime.verificar(NOW);
    const r2 = await h.runtime.verificar(new Date(NOW.getTime() + 60_000));
    expect(r2.despedidos).toEqual([]);
    expect(h.enviadas).toHaveLength(1);
  });

  it('NUNCA PREMATURA: só VENDIDO se despede — EM_PROCESSO/ENCERRADO não', async () => {
    const h = harness([
      resumo({ status: 'EM_PROCESSO' }),
      resumo({ clienteId: 'cli-2', chatId: 'c2', status: 'ENCERRADO' }),
    ]);
    const r = await h.runtime.verificar(NOW);
    expect(r.despedidos).toEqual([]);
    expect(h.enviadas).toHaveLength(0);
  });

  it('só cliente RECONHECIDO (contato provisório nunca recebe despedida)', async () => {
    const h = harness([resumo({ clienteId: 'novo@c.us', chatId: 'novo@c.us' })]);
    const r = await h.runtime.verificar(NOW);
    expect(r.verificados).toBe(0);
    expect(h.enviadas).toHaveLength(0);
  });

  it('Brain vetou/canal falhou: o FATO permanece — nunca reenvio em loop', async () => {
    const h = harness([resumo({})], false);
    const r = await h.runtime.verificar(NOW);
    expect(r.despedidos).toEqual([]); // não entregue nesta varredura
    expect(h.fatos.has('cli-1')).toBe(true); // decisão tomada (Lei 8)
    const r2 = await h.runtime.verificar(new Date(NOW.getTime() + 60_000));
    expect(r2.despedidos).toEqual([]);
    expect(h.enviadas).toHaveLength(1); // nenhuma nova tentativa automática
  });
});
