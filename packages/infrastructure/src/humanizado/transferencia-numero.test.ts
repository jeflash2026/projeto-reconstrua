// TRANSFERÊNCIA DE ATENDIMENTO ENTRE NÚMEROS — o caso real: a cliente troca de
// chip e quer continuar do outro número. Tudo o que era do JID antigo tem de
// passar a ser do novo, incluindo o que só cita o JID DENTRO do documento (o
// parecer e a liberação do portal, que são chaveados pelo clienteId).
import { describe, expect, it } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { TransferenciaDeNumero, comoJid } from './transferencia-numero.js';

const ANTIGO = '553182232880@s.whatsapp.net';
const NOVO = '553189566173@s.whatsapp.net';
const clock = { now: () => new Date('2026-08-11T12:00:00.000Z') };

async function baseComCliente(): Promise<InMemoryJsonStore> {
  const json = new InMemoryJsonStore();
  await json.put('client-memory', ANTIGO, { chatId: ANTIGO, nome: 'MARIA DA PIEDADE ROZA' });
  await json.put('identities', ANTIGO, { chatId: ANTIGO, clienteId: 'cli-1', missionId: 'm-1' });
  await json.put('jornada', ANTIGO, { chatId: ANTIGO, cpf: '12345678901' });
  await json.put(`conv:${ANTIGO}`, '2026-08-01T10:00:00.000Z|000001|e1', {
    chatId: ANTIGO,
    kind: 'inbound',
    text: 'oi',
  });
  await json.put(`conv-idx:${ANTIGO}`, 'wamid.X', true);
  // Chaveado pelo clienteId — só CITA o chat lá dentro.
  await json.put('parecer-enviado', 'cli-1', {
    clienteId: 'cli-1',
    chatId: ANTIGO,
    confirmadoEm: '2026-08-05T10:00:00.000Z',
  });
  return json;
}

describe('TransferenciaDeNumero', () => {
  it('normaliza qualquer forma do número para o JID', () => {
    expect(comoJid('553189566173')).toBe(NOVO);
    expect(comoJid('+55 31 8956-6173')).toBe(NOVO);
    expect(comoJid(NOVO)).toBe(NOVO);
  });

  it('prevê o que vai se mover sem escrever nada', async () => {
    const json = await baseComCliente();
    const previa = await new TransferenciaDeNumero({ json, clock }).previa(ANTIGO, NOVO);

    expect(previa.podeTransferir).toBe(true);
    expect(previa.linhasOrigem).toBe(6);
    expect(previa.mensagens).toBe(1);
    expect(previa.linhasDestino).toBe(0);
    // Só leitura: o registro antigo continua exatamente onde estava.
    expect(await json.get('client-memory', ANTIGO)).not.toBeNull();
    expect(await json.get('client-memory', NOVO)).toBeNull();
  });

  it('recusa transferir para o mesmo número e número sem registro', async () => {
    const json = await baseComCliente();
    const t = new TransferenciaDeNumero({ json, clock });
    expect((await t.previa(ANTIGO, ANTIGO)).podeTransferir).toBe(false);
    expect((await t.previa('553100000000', NOVO)).podeTransferir).toBe(false);
    await expect(t.transferir('553100000000', NOVO)).rejects.toThrow(/nenhum registro/);
  });

  it('move tudo para o número novo e não deixa rastro no antigo', async () => {
    const json = await baseComCliente();
    const r = await new TransferenciaDeNumero({ json, clock }).transferir(ANTIGO, NOVO);

    expect(r.linhasMovidas).toBe(6);
    // A identidade e a memória viajam com a chave.
    expect(await json.get('client-memory', ANTIGO)).toBeNull();
    expect(await json.get('client-memory', NOVO)).toEqual({
      chatId: NOVO,
      nome: 'MARIA DA PIEDADE ROZA',
    });
    expect(await json.get('identities', NOVO)).toEqual({
      chatId: NOVO,
      clienteId: 'cli-1',
      missionId: 'm-1',
    });
    // A conversa migra inteira (namespace por chat).
    expect((await json.keys(`conv:${ANTIGO}`)).length).toBe(0);
    expect((await json.keys(`conv:${NOVO}`)).length).toBe(1);
    expect(await json.get(`conv-idx:${NOVO}`, 'wamid.X')).toBe(true);
    // O parecer NÃO muda de chave (é do clienteId) mas passa a apontar ao novo
    // número — é isso que mantém a cliente na mesa do Humanizado.
    expect(await json.get('parecer-enviado', 'cli-1')).toEqual({
      clienteId: 'cli-1',
      chatId: NOVO,
      confirmadoEm: '2026-08-05T10:00:00.000Z',
    });
  });

  // REGRESSÃO REAL (Maria da Piedade, 2026-08-11): o chat humanizado é UM
  // documento por número, com mensagens[] dentro. A primeira versão sobrescrevia
  // o do destino e as mensagens que a cliente já tinha mandado pelo número novo
  // sumiam. Conversa se FUNDE; estado (memória, cadastro) a origem vence.
  it('funde as conversas em vez de sobrescrever a do número novo', async () => {
    const json = await baseComCliente();
    await json.put('humanizado-chat', ANTIGO, {
      chatId: ANTIGO,
      lidoEm: null,
      mensagens: [{ id: 'a1', em: '2026-08-11T13:50:00.000Z', texto: 'pelo número antigo' }],
    });
    await json.put('humanizado-chat', NOVO, {
      chatId: NOVO,
      lidoEm: null,
      mensagens: [{ id: 'b1', em: '2026-08-11T14:10:00.000Z', texto: 'pelo número novo' }],
    });

    await new TransferenciaDeNumero({ json, clock }).transferir(ANTIGO, NOVO);

    const conversa = (await json.get('humanizado-chat', NOVO)) as {
      chatId: string;
      mensagens: { id: string; texto: string }[];
    };
    expect(conversa.chatId).toBe(NOVO);
    // As duas conversas, em ordem cronológica — nenhuma mensagem se perde.
    expect(conversa.mensagens.map((m) => m.id)).toEqual(['a1', 'b1']);
  });

  it('recupera do backup as conversas perdidas por uma transferência antiga', async () => {
    const json = await baseComCliente();
    const conversaPerdida = {
      chatId: NOVO,
      lidoEm: null,
      mensagens: [{ id: 'b1', em: '2026-08-11T14:10:00.000Z', texto: 'pelo número novo' }],
    };
    // Simula o estrago da versão antiga: o backup tem a conversa do destino, mas
    // o registro atual só tem a da origem.
    await json.put('transferencia-numero-backup', `${NOVO}|2026-08-11T12:00:00.000Z`, {
      origem: ANTIGO,
      destino: NOVO,
      em: '2026-08-11T12:00:00.000Z',
      linhas: [{ namespace: 'humanizado-chat', key: NOVO, value: conversaPerdida }],
    });
    await json.put('humanizado-chat', NOVO, {
      chatId: NOVO,
      lidoEm: null,
      mensagens: [{ id: 'a1', em: '2026-08-11T13:50:00.000Z', texto: 'pelo número antigo' }],
    });

    const t = new TransferenciaDeNumero({ json, clock });
    const r = await t.restaurarConversas(NOVO);
    expect(r.conversasRestauradas).toBe(1);
    expect(r.mensagensRecuperadas).toBe(1);

    const conversa = (await json.get('humanizado-chat', NOVO)) as {
      mensagens: { id: string }[];
    };
    expect(conversa.mensagens.map((m) => m.id)).toEqual(['a1', 'b1']);

    // Rodar de novo não duplica nada (dedup por id).
    const outra = await t.restaurarConversas(NOVO);
    expect(outra.mensagensRecuperadas).toBe(0);
  });

  it('guarda o estado anterior num backup antes de escrever', async () => {
    const json = await baseComCliente();
    await json.put('client-memory', NOVO, { chatId: NOVO, nome: 'contato novo' });
    const r = await new TransferenciaDeNumero({ json, clock }).transferir(ANTIGO, NOVO);

    const backup = (await json.get('transferencia-numero-backup', `${NOVO}|${r.backupEm}`)) as {
      linhas: { namespace: string; key: string }[];
    } | null;
    expect(backup).not.toBeNull();
    // Origem (6) + o que o destino já tinha (1).
    expect(backup?.linhas.length).toBe(7);
  });
});
