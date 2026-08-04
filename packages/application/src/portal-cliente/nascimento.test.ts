// ─────────────────────────────────────────────────────────────────────────────
// O NASCIMENTO DO PORTAL (PC-R3, reformado pelo decreto 2026-07-31 "funil com
// confirmação") — testes das INVARIANTES auditadas nas DUAS fases:
//  • fase 1 completa ⇒ PARECER (dossiê + pedido de confirmação) — envio único,
//    fato ANTES da mensagem, nunca prematuro, nada sem leitura do HISCON;
//  • SIM do cliente ⇒ CADASTRO (liberação + Portal + fase 2 anunciada) —
//    mesmas invariantes; sem SIM, sem cadastro (o filtro do decreto).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ClientesList, ClienteResumo } from '../clientes/clientes-list.js';
import type { MemoryStore } from '../living-memory/ports.js';
import { emptyMemory, type ClientMemory } from '../living-memory/client-memory.js';
import { validarTokenCliente } from './token.js';
import type { LiberacaoPortal } from './acompanhamento.js';
import {
  NascimentoPortalRuntime,
  mensagemNascimento,
  mensagemParecer,
  type LiberacaoPortalStore,
  type ComunicadorNascimento,
  type ParecerEnviado,
  type ParecerStore,
} from './nascimento.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');
const SECRET = 'segredo-portal';

function resumo(over: Partial<ClienteResumo>): ClienteResumo {
  return {
    clienteId: 'cli-1',
    chatId: 'c1',
    missionId: 'm1',
    quem: 'Maria',
    status: 'PRONTO_AGUARDANDO_MODALIDADE',
    modalidade: null,
    pronto: true,
    faltando: [],
    saude: 'GREEN',
    ultimoContatoAt: NOW,
    pedidosConfirmadosEm: null,
    ...over,
  };
}

class FakeLiberacao implements LiberacaoPortalStore {
  public salvos: LiberacaoPortal[] = [];
  load(clienteId: string): Promise<LiberacaoPortal | null> {
    return Promise.resolve(this.salvos.find((l) => l.clienteId === clienteId) ?? null);
  }
  save(record: LiberacaoPortal): Promise<void> {
    this.salvos.push(record);
    return Promise.resolve();
  }
}

class FakeParecer implements ParecerStore {
  public salvos: ParecerEnviado[] = [];
  public gravacoes = 0;
  load(clienteId: string): Promise<ParecerEnviado | null> {
    return Promise.resolve(this.salvos.find((p) => p.clienteId === clienteId) ?? null);
  }
  save(record: ParecerEnviado): Promise<void> {
    this.gravacoes += 1;
    // UPSERT (mesma semântica do JsonStore): a confirmação ATUALIZA o fato.
    this.salvos = [...this.salvos.filter((p) => p.clienteId !== record.clienteId), record];
    return Promise.resolve();
  }
}

class FakeComunicador implements ComunicadorNascimento {
  public mensagens: Array<{ chatId: string; clienteId: string; texto: string }> = [];
  constructor(private readonly aceita = true) {}
  comunicar(chatId: string, clienteId: string, texto: string): Promise<boolean> {
    this.mensagens.push({ chatId, clienteId, texto });
    return Promise.resolve(this.aceita);
  }
}

function runtime(
  clientes: readonly ClienteResumo[],
  documentosRecebidos: number,
  opts: {
    aceita?: boolean;
    secret?: string;
    /** null = HISCON ilegível (o parecer não sai). */
    resumoParecer?: { contratos: number; indicios: number } | null;
    confirmou?: boolean;
  } = {},
) {
  const liberacao = new FakeLiberacao();
  const parecer = new FakeParecer();
  const comunicador = new FakeComunicador(opts.aceita ?? true);
  const memory: MemoryStore = {
    load: (chatId: string): Promise<ClientMemory | null> =>
      Promise.resolve({
        ...emptyMemory(chatId),
        documentsSent: Array.from({ length: documentosRecebidos }, (_v, i) => ({
          ref: `d${String(i)}`,
          label: `Documento ${String(i + 1)}`,
          source: { kind: 'domain_event' as const, ref: 'e', at: NOW },
        })),
      }),
    save: () => Promise.resolve(),
    all: () => Promise.resolve([]),
  };
  const nascimento = new NascimentoPortalRuntime({
    clientes: { list: () => Promise.resolve(clientes) } as unknown as ClientesList,
    memory,
    liberacao,
    parecer,
    resumoParecer: () =>
      Promise.resolve(
        opts.resumoParecer === undefined ? { contratos: 4, indicios: 2 } : opts.resumoParecer,
      ),
    confirmouApos: () => Promise.resolve(opts.confirmou ?? false),
    comunicador,
    config: {
      estimativaDias: 12,
      validadeLinkDias: 90,
      publicUrl: 'https://www.projetoreconstrua.com.br',
      tokenSecret: opts.secret ?? SECRET,
    },
  });
  return { nascimento, liberacao, parecer, comunicador };
}

describe('Fase do PARECER · fase 1 completa manda o dossiê e ESPERA o sim', () => {
  it('cliente PRONTO com evidência real → fato do parecer + mensagem com link /parecer válido', async () => {
    const { nascimento, liberacao, parecer, comunicador } = runtime([resumo({})], 3);
    const r = await nascimento.verificar(NOW);

    expect(r.pareceres).toEqual(['cli-1']);
    expect(r.nascidos).toEqual([]); // o CADASTRO espera a confirmação
    expect(liberacao.salvos).toEqual([]); // nada de liberação ainda
    // O FATO do parecer (com os números DITOS — Lei 10):
    expect(parecer.salvos[0]).toMatchObject({
      clienteId: 'cli-1',
      chatId: 'c1',
      contratos: 4,
      indicios: 2,
    });
    // A MENSAGEM: números reais + link do PARECER com token do CHAT (pré-cadastro):
    const msg = comunicador.mensagens[0];
    expect(msg?.texto).toContain('4 contrato(s)');
    expect(msg?.texto).toContain('2 indício(s)');
    expect(msg?.texto).toContain('/parecer?t=');
    expect(msg?.texto).toContain('responder SIM');
    const token = /\?t=([^\s]+)/.exec(msg?.texto ?? '')?.[1] ?? '';
    expect(validarTokenCliente(token, NOW, SECRET)).toBe('c1');
  });

  it('ENVIO ÚNICO: sem confirmação, as varreduras seguintes não repetem o parecer', async () => {
    const { nascimento, comunicador } = runtime([resumo({})], 3);
    await nascimento.verificar(NOW);
    await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    expect(comunicador.mensagens).toHaveLength(1);
  });

  it('HISCON ilegível/sem contratos ⇒ o parecer NÃO sai (nada é prometido sem fato)', async () => {
    const { nascimento, parecer, comunicador } = runtime([resumo({})], 3, { resumoParecer: null });
    const r = await nascimento.verificar(NOW);
    expect(r.pareceres).toEqual([]);
    expect(parecer.salvos).toEqual([]);
    expect(comunicador.mensagens).toEqual([]);
  });

  it('Lei 8 no parecer: entrega vetada ⇒ o FATO permanece e nada re-envia', async () => {
    const { nascimento, parecer, comunicador } = runtime([resumo({})], 3, { aceita: false });
    const r = await nascimento.verificar(NOW);
    expect(r.pareceres).toEqual([]); // não entregue…
    expect(parecer.salvos).toHaveLength(1); // …mas a DECISÃO está registrada
    await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    expect(comunicador.mensagens).toHaveLength(1);
  });
});

describe('Fase da CONFIRMAÇÃO · o SIM gera o cadastro; sem SIM, nada', () => {
  it('parecer enviado + SIM depois ⇒ confirmação registrada + liberação + Portal válido', async () => {
    const { nascimento, liberacao, parecer, comunicador } = runtime([resumo({})], 3, {
      confirmou: true,
    });
    await nascimento.verificar(NOW); // 1ª varredura: o parecer sai
    const r = await nascimento.verificar(new Date(NOW.getTime() + 60_000)); // 2ª: o sim vale

    expect(r.nascidos).toEqual(['cli-1']);
    // Onda 3: o FATO da confirmação (a régua da mesa do Humanizado):
    expect(parecer.salvos[0]?.confirmadoEm).toBeInstanceOf(Date);
    expect(liberacao.salvos[0]).toMatchObject({
      clienteId: 'cli-1',
      chatId: 'c1',
      estimativaDiasInformada: 12,
    });
    const msg = comunicador.mensagens[1];
    expect(msg?.texto).toContain('cadastro foi gerado');
    expect(msg?.texto).toContain('/portal?t=');
    expect(msg?.texto).toContain('(41) 99802-8530');
    const token = /portal\?t=([^\s]+)/.exec(msg?.texto ?? '')?.[1] ?? '';
    expect(validarTokenCliente(token, NOW, SECRET)).toBe('cli-1');

    // Idempotência: a varredura seguinte é no-op.
    await nascimento.verificar(new Date(NOW.getTime() + 120_000));
    expect(liberacao.salvos).toHaveLength(1);
    expect(comunicador.mensagens).toHaveLength(2);
  });

  it('SEM o sim, o cadastro NUNCA nasce (o filtro de interesse do decreto)', async () => {
    const { nascimento, liberacao } = runtime([resumo({})], 3, { confirmou: false });
    await nascimento.verificar(NOW);
    await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    await nascimento.verificar(new Date(NOW.getTime() + 120_000));
    expect(liberacao.salvos).toEqual([]);
  });
});

describe('Onda 3 · a base LEGADA (cadastro do fluxo antigo, sem parecer)', () => {
  it('a varredura NUNCA manda parecer a quem já tem cadastro (anti-spam) — só o lote do Admin', async () => {
    const { nascimento, liberacao, parecer, comunicador } = runtime([resumo({})], 3, {
      confirmou: true,
    });
    // Cadastro do fluxo ANTIGO já existe:
    await liberacao.save({
      clienteId: 'cli-1',
      chatId: 'c1',
      comunicadoEm: new Date(NOW.getTime() - 86_400_000),
      estimativaDiasInformada: 12,
    });
    await nascimento.verificar(NOW);
    expect(parecer.salvos).toEqual([]); // nada automático para o legado
    expect(comunicador.mensagens).toEqual([]);

    // O ADMIN dispara o parecer (lote) — o fato nasce e a mensagem sai:
    const envio = await nascimento.enviarParecer('cli-1', NOW);
    expect(envio.ok).toBe(true);
    expect(parecer.salvos[0]).toMatchObject({ clienteId: 'cli-1', contratos: 4 });
    expect(comunicador.mensagens[0]?.texto).toContain('/parecer?t=');
    // Repetir o lote NÃO duplica (o fato é o claim):
    expect((await nascimento.enviarParecer('cli-1', NOW)).ok).toBe(false);
    expect(comunicador.mensagens).toHaveLength(1);

    // O cliente confirma ⇒ a confirmação é registrada SEM duplicar a liberação:
    const r = await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    expect(r.nascidos).toEqual(['cli-1']);
    expect(parecer.salvos[0]?.confirmadoEm).toBeInstanceOf(Date);
    expect(liberacao.salvos).toHaveLength(1); // a antiga permanece; nada duplica
  });

  it('enviarParecer recusa cliente sem HISCON legível (nada é prometido sem fato)', async () => {
    const { nascimento, parecer } = runtime([resumo({})], 3, { resumoParecer: null });
    const r = await nascimento.enviarParecer('cli-1', NOW);
    expect(r.ok).toBe(false);
    expect(parecer.salvos).toEqual([]);
  });
});

describe('Nascimento · NUNCA prematuro (invariantes preservadas)', () => {
  it('não pronto → silêncio; contato não reconhecido → nem candidato', async () => {
    const { nascimento, comunicador } = runtime(
      [
        resumo({ pronto: false, status: 'COLETANDO_DOCUMENTOS' }),
        resumo({ clienteId: 'novo@c.us', chatId: 'novo@c.us' }),
      ],
      2,
    );
    const r = await nascimento.verificar(NOW);
    expect(r.nascidos).toEqual([]);
    expect(r.pareceres).toEqual([]);
    expect(comunicador.mensagens).toEqual([]);
  });

  it('sem evidência REAL de recebimento → silêncio, mesmo PRONTO', async () => {
    const { nascimento, liberacao, parecer, comunicador } = runtime([resumo({})], 0);
    const r = await nascimento.verificar(NOW);
    expect(r.pareceres).toEqual([]);
    expect(liberacao.salvos).toEqual([]);
    expect(parecer.salvos).toEqual([]);
    expect(comunicador.mensagens).toEqual([]);
  });

  it('FAIL-CLOSED: sem segredo do link, nada acontece', async () => {
    const { nascimento, liberacao, parecer } = runtime([resumo({})], 3, { secret: '' });
    const r = await nascimento.verificar(NOW);
    expect(r.verificados).toBe(0);
    expect(liberacao.salvos).toEqual([]);
    expect(parecer.salvos).toEqual([]);
  });
});

describe('as mensagens homologadas (decreto 2026-07-31)', () => {
  it('mensagemParecer: números reais + dossiê + pedido de confirmação', () => {
    const m = mensagemParecer(9, 3, 'https://x/parecer?t=abc');
    for (const trecho of [
      'Concluí a análise do seu HISCON',
      '9 contrato(s)',
      '3 indício(s)',
      'APTO',
      'DOSSIÊ JURÍDICO',
      'https://x/parecer?t=abc',
      'CONFIRMAÇÃO',
      'responder SIM',
      'estou à disposição.',
    ]) {
      expect(m).toContain(trecho);
    }
  });

  it('mensagemNascimento: cadastro gerado + Portal + fase 2 da equipe humana', () => {
    const m = mensagemNascimento('https://x/portal?t=abc');
    for (const trecho of [
      'Confirmação registrada',
      'cadastro foi gerado',
      'https://x/portal?t=abc',
      'a nossa equipe vai entrar em contato',
      'a procuração, o RG (frente e verso) e o comprovante de endereço',
      'entraremos em contato por ligação no WhatsApp, pelo número (41) 99802-8530',
      'estou à disposição.',
    ]) {
      expect(m).toContain(trecho);
    }
    expect(m.endsWith('estou à disposição.')).toBe(true);
  });
});
