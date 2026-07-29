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
): { jarvis: JarvisRuntime; json: InMemoryJsonStore } {
  const json = new InMemoryJsonStore();
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
    narrar: null,
  };
  return { jarvis: new JarvisRuntime(deps), json };
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
