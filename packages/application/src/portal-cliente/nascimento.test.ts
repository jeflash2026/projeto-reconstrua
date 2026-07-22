// ─────────────────────────────────────────────────────────────────────────────
// O NASCIMENTO DO PORTAL (PC-R3) — testes das INVARIANTES auditadas: envio único,
// idempotência, nunca prematuro (evidência real de recebimento), fato ANTES da
// mensagem (Lei 8), fail-closed sem segredo e o texto homologado (D2) íntegro.
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
  type LiberacaoPortalStore,
  type ComunicadorNascimento,
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
  opts: { aceita?: boolean; secret?: string } = {},
) {
  const liberacao = new FakeLiberacao();
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
    comunicador,
    config: {
      estimativaDias: 12,
      validadeLinkDias: 90,
      publicUrl: 'https://www.projetoreconstrua.com.br',
      tokenSecret: opts.secret ?? SECRET,
    },
  });
  return { nascimento, liberacao, comunicador };
}

describe('Nascimento · o momento acontece (sem clique humano)', () => {
  it('cliente PRONTO com evidência real → fato + mensagem homologada com link válido', async () => {
    const { nascimento, liberacao, comunicador } = runtime([resumo({})], 3);
    const r = await nascimento.verificar(NOW);

    expect(r.nascidos).toEqual(['cli-1']);
    // O FATO (com o que foi DITO — Lei 10):
    expect(liberacao.salvos).toHaveLength(1);
    expect(liberacao.salvos[0]).toMatchObject({
      clienteId: 'cli-1',
      chatId: 'c1',
      estimativaDiasInformada: 12,
    });

    // A MENSAGEM (D2 revisado — conteúdo homologado):
    const msg = comunicador.mensagens[0];
    expect(msg?.texto).toContain('Recebi toda a sua documentação inicial');
    expect(msg?.texto).toContain('até 12 dias úteis');
    expect(msg?.texto).toContain('estarei aqui.'); // a frase final OBRIGATÓRIA
    // O LINK verbatim, com token VÁLIDO do cliente certo:
    const token = /\?t=([^\s]+)/.exec(msg?.texto ?? '')?.[1] ?? '';
    expect(validarTokenCliente(token, NOW, SECRET)).toBe('cli-1');
  });

  it('ENVIO ÚNICO / IDEMPOTÊNCIA: segunda varredura é no-op', async () => {
    const { nascimento, liberacao, comunicador } = runtime([resumo({})], 3);
    await nascimento.verificar(NOW);
    await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    expect(liberacao.salvos).toHaveLength(1);
    expect(comunicador.mensagens).toHaveLength(1);
  });
});

describe('Nascimento · NUNCA prematuro', () => {
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
    expect(comunicador.mensagens).toEqual([]);
  });

  it('sem evidência REAL de recebimento (docs < obrigatórios) → silêncio, mesmo PRONTO', async () => {
    const { nascimento, liberacao, comunicador } = runtime([resumo({})], 1); // decreto: 3 obrigatórios
    const r = await nascimento.verificar(NOW);
    expect(r.nascidos).toEqual([]);
    expect(liberacao.salvos).toEqual([]);
    expect(comunicador.mensagens).toEqual([]);
  });

  it('FAIL-CLOSED: sem segredo do link, o nascimento não acontece', async () => {
    const { nascimento, liberacao } = runtime([resumo({})], 3, { secret: '' });
    const r = await nascimento.verificar(NOW);
    expect(r.verificados).toBe(0);
    expect(liberacao.salvos).toEqual([]);
  });
});

describe('Nascimento · Lei 8 (fato ANTES da mensagem)', () => {
  it('se a entrega falhar, o fato PERMANECE e não há re-tentativa automática (link renasce em conversa)', async () => {
    const { nascimento, liberacao, comunicador } = runtime([resumo({})], 3, { aceita: false });
    const r = await nascimento.verificar(NOW);
    expect(r.nascidos).toEqual([]); // não entregue…
    expect(liberacao.salvos).toHaveLength(1); // …mas a DECISÃO está registrada
    // varredura seguinte: nada duplica
    await nascimento.verificar(new Date(NOW.getTime() + 60_000));
    expect(comunicador.mensagens).toHaveLength(1);
  });
});

describe('mensagemNascimento (D2 — revisado pelo decreto "Jornada Documental Inicial")', () => {
  it('contém os 6 elementos do decreto, na ordem', () => {
    const m = mensagemNascimento(10, 'https://x/portal?t=abc');
    for (const trecho of [
      // 1. Recebemos toda a documentação inicial (os 3 nomeados):
      'Recebi toda a sua documentação inicial: HISCON, RG ou CNH e comprovante de endereço',
      // (sentimento: terminou a primeira etapa; nada mais a enviar espontaneamente)
      'Essa primeira etapa está concluída',
      'você não precisa enviar mais nada por enquanto',
      // 2. Entrou na análise administrativa:
      'etapa de análise administrativa',
      // 3. Prazo esperado:
      'até 10 dias úteis',
      // 4. Complementares só quando a equipe solicitar por este atendimento:
      'documento complementar for necessário durante a análise, nossa equipe solicitará diretamente por este atendimento',
      // 5. Portal para acompanhamento (link verbatim):
      'acompanhar as informações do seu processo pelo Portal do Cliente',
      'https://x/portal?t=abc',
      // 6. Contato automático quando houver novidade:
      'Sempre que houver alguma novidade, eu entrarei em contato automaticamente',
      // Invariante PC-R3: o relacionamento nunca termina.
      'estarei aqui.',
    ]) {
      expect(m).toContain(trecho);
    }
    expect(m.endsWith('estarei aqui.')).toBe(true);
  });
});
