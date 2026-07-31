// ─────────────────────────────────────────────────────────────────────────────
// JARVIS · COBRANÇA DE CPF (decreto 2026-07-29, caso real: "consegue disparar
// mensagem solicitando o cpf para esses 28 clientes?") — o comando gera um
// PLANO com a lista nominal; NADA é enviado sem a confirmação; a execução usa
// a MESMA rotina cobrarCpf (trava de 24h reportada como "pulado", nunca erro
// fatal) e o plano morre depois (confirmar duas vezes não duplica).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JarvisRuntime, type JarvisDeps, type PendenteCpf } from './jarvis-runtime.js';

function runtime(
  pendentes: readonly PendenteCpf[],
  cobrados: string[],
  falhaEm: Record<string, string> = {},
): {
  jarvis: JarvisRuntime;
  json: InMemoryJsonStore;
  enviadas: { chatId: string; texto: string }[];
} {
  const json = new InMemoryJsonStore();
  const enviadas: { chatId: string; texto: string }[] = [];
  const deps: JarvisDeps = {
    json,
    clock: { now: () => new Date('2026-07-29T20:00:00Z') },
    elegiveis: () => Promise.resolve([]),
    dossier: () => Promise.resolve({}),
    advogados: () => Promise.resolve([]),
    fichaPorTermo: () => Promise.resolve(null),
    atribuir: () => Promise.resolve({ ok: true }),
    pendentesCpf: () => Promise.resolve(pendentes),
    cobrarCpf: (chatId) => {
      const erro = falhaEm[chatId];
      if (erro !== undefined) return Promise.resolve({ ok: false, error: erro });
      cobrados.push(chatId);
      return Promise.resolve({ ok: true });
    },
    // Cadastro fake para a MENSAGEM DITADA: só a Maria existe.
    resolverDestinatario: (termo) =>
      Promise.resolve(
        /maria/i.test(termo) || termo.replace(/\D/g, '').includes('551199')
          ? { chatId: '551199@s.whatsapp.net', nome: 'Maria' }
          : null,
      ),
    // RELATÓRIO NOMINAL fake: 2 clientes de SP fase 1 (o caso real dos 25).
    relatorioClientes: (recorte, uf) =>
      Promise.resolve(
        recorte === 'fase1' && uf === 'SP'
          ? [
              { nome: 'Ana Souza', telefone: '5511988887777', uf: 'SP', contratos: 12 },
              { nome: 'Bruno Lima', telefone: '5515977776666', uf: 'SP', contratos: 5 },
            ]
          : [],
      ),
    enviarAoCliente: (chatId, texto) => {
      enviadas.push({ chatId, texto });
      return Promise.resolve();
    },
    narrar: null,
  };
  return { jarvis: new JarvisRuntime(deps), json, enviadas };
}

const MARIA: PendenteCpf = { chatId: '551199@s.whatsapp.net', nome: 'Maria', telefone: '551199' };
const JOAO: PendenteCpf = { chatId: '552188@s.whatsapp.net', nome: 'João', telefone: '552188' };

describe('JarvisRuntime · cobrança de CPF', () => {
  it('o comando gera o plano com a lista nominal e NÃO envia nada', async () => {
    const cobrados: string[] = [];
    const { jarvis } = runtime([MARIA, JOAO], cobrados);
    const r = await jarvis.perguntar('consegue disparar mensagem solicitando o cpf para eles?');
    expect(r.cobranca?.itens).toHaveLength(2);
    expect(r.resposta).toContain('Maria');
    expect(r.resposta).toContain('confirmação');
    expect(cobrados).toHaveLength(0); // sem clique, nenhum WhatsApp sai
  });

  it('confirmar executa a MESMA rotina cobrarCpf e reporta os pulados (trava 24h)', async () => {
    const cobrados: string[] = [];
    const { jarvis } = runtime([MARIA, JOAO], cobrados, {
      [JOAO.chatId]: 'CPF já cobrado nas últimas 24h',
    });
    const plano = (await jarvis.perguntar('cobre o cpf dos clientes que faltam')).cobranca;
    expect(plano).toBeDefined();
    const r = await jarvis.cobrar(plano?.id ?? '');
    expect(r).toMatchObject({ ok: true, enviados: 1, pulados: 1 });
    expect(r.erros[0]).toContain('João');
    expect(cobrados).toEqual([MARIA.chatId]);
    // O plano morreu: confirmar de novo não duplica nenhum envio.
    const deNovo = await jarvis.cobrar(plano?.id ?? '');
    expect(deNovo.ok).toBe(false);
    expect(cobrados).toHaveLength(1);
  });

  it('sem pendentes, responde a boa notícia sem criar plano', async () => {
    const { jarvis } = runtime([], []);
    const r = await jarvis.perguntar('cobre o cpf de quem falta');
    expect(r.cobranca).toBeUndefined();
    expect(r.resposta).toContain('já têm o CPF');
  });

  it('o executar da DISTRIBUIÇÃO recusa um plano de cobrança (e vice-versa)', async () => {
    const { jarvis } = runtime([MARIA], []);
    const plano = (await jarvis.perguntar('cobre o cpf dos que faltam')).cobranca;
    const r = await jarvis.executar(plano?.id ?? '', 'adv-1', 'founder');
    expect(r.ok).toBe(false);
    // Cobrar um id inexistente também falha limpo.
    expect((await jarvis.cobrar('plano-que-nao-existe')).ok).toBe(false);
  });
});

describe('JarvisRuntime · relatório nominal (decreto 2026-07-30)', () => {
  it('o pedido real: "relatório com nome e telefone dos clientes de são paulo" com cpf+hiscon', async () => {
    const { jarvis } = runtime([], []);
    const r = await jarvis.perguntar(
      'preciso que voce gere um relatorio contendo nome e telefone desses 25 clientes de são paulo com hiscon e cpf',
    );
    expect(r.resposta).toContain('fase 1 completa');
    expect(r.resposta).toContain('em SP');
    expect(r.resposta).toContain('1. Ana Souza — +55 (11) 98888-7777 — SP — 12 contrato(s)');
    expect(r.resposta).toContain('2. Bruno Lima — +55 (15) 97777-6666 — SP — 5 contrato(s)');
    expect(r.resposta).toContain('2 cliente(s), 17 contrato(s)');
  });
  it('recorte vazio responde limpo (nunca inventa)', async () => {
    const { jarvis } = runtime([], []);
    const r = await jarvis.perguntar('lista dos clientes sem cpf de sergipe');
    expect(r.resposta).toContain('nenhum cliente no recorte');
    expect(r.resposta).toContain('AINDA SEM CPF');
  });
});

describe('JarvisRuntime · mensagem ditada (decreto 2026-07-30)', () => {
  it('o comando gera o plano com o texto EXATO e nada é enviado sem confirmação', async () => {
    const { jarvis, enviadas } = runtime([], []);
    const r = await jarvis.perguntar('mande a mensagem para Maria: Bom dia! Seu estudo saiu.');
    expect(r.mensagem?.nome).toBe('Maria');
    expect(r.mensagem?.texto).toBe('Bom dia! Seu estudo saiu.');
    expect(enviadas).toHaveLength(0);
    // Confirmou ⇒ envia UMA vez, palavra por palavra; o plano morre depois.
    const envio = await jarvis.enviarMensagem(r.mensagem?.id ?? '');
    expect(envio.ok).toBe(true);
    expect(enviadas).toEqual([
      { chatId: '551199@s.whatsapp.net', texto: 'Bom dia! Seu estudo saiu.' },
    ]);
    expect((await jarvis.enviarMensagem(r.mensagem?.id ?? '')).ok).toBe(false);
    expect(enviadas).toHaveLength(1);
  });

  it('destinatário desconhecido: orienta e NÃO cria plano', async () => {
    const { jarvis, enviadas } = runtime([], []);
    const r = await jarvis.perguntar('mande a mensagem para Fulano: oi');
    expect(r.mensagem).toBeUndefined();
    expect(r.resposta).toContain('Não encontrei');
    expect(enviadas).toHaveLength(0);
  });

  it('texto com "20 contratos"/"cpf" continua MENSAGEM (nunca vira outro comando)', async () => {
    const { jarvis } = runtime([], []);
    const r = await jarvis.perguntar(
      'mande a mensagem para Maria: seus 20 contratos e o CPF já estão registrados',
    );
    expect(r.mensagem?.texto).toBe('seus 20 contratos e o CPF já estão registrados');
    expect(r.plano).toBeUndefined();
    expect(r.cobranca).toBeUndefined();
  });
});
