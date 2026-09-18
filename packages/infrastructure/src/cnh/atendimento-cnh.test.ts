// ─────────────────────────────────────────────────────────────────────────────
// ATENDIMENTO CNH — o ciclo inteiro sem rede: mensagem do cliente → AHRI →
// resposta validada no WhatsApp; proposta com o valor da tabela; aceite passa
// para a equipe; morno entra na fila de follow-up, que SÓ sai pelo painel;
// IA fora do ar ⇒ a próxima pergunta do roteiro (o lead nunca fica sem resposta).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { AtendimentoCnh, type EntradaCnh } from './atendimento-cnh.js';

const CHAT = '5511988887777@s.whatsapp.net';

function montar(respostasIa: (string | Error)[] = []): {
  svc: AtendimentoCnh;
  enviadas: string[];
  modelos: string[];
  relogio: { t: Date };
  chamadasIa: number[];
} {
  const enviadas: string[] = [];
  const modelos: string[] = [];
  const relogio = { t: new Date('2026-09-18T12:00:00.000Z') };
  const chamadasIa: number[] = [];
  const svc = new AtendimentoCnh({
    json: new InMemoryJsonStore(),
    clock: { now: () => relogio.t },
    enviar: (_chat, texto) => {
      enviadas.push(texto);
      return Promise.resolve();
    },
    enviarTemplateFollowup: (_chat, nome) => {
      modelos.push(nome);
      return Promise.resolve();
    },
    completar: () => {
      chamadasIa.push(1);
      const r = respostasIa.shift();
      if (r === undefined) return Promise.reject(new Error('sem resposta roteirizada'));
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  });
  return { svc, enviadas, modelos, relogio, chamadasIa };
}

let n = 0;
const msg = (texto: string, em = new Date('2026-09-18T12:00:00.000Z')): EntradaCnh => ({
  messageId: `wamid.${String((n += 1))}`,
  chatId: CHAT,
  texto,
  tipo: 'texto',
  mediaId: null,
  nomeArquivo: null,
  em,
});
const ia = (o: Record<string, unknown>): string => JSON.stringify(o);

describe('AtendimentoCnh — conversa com a AHRI', () => {
  it('primeiro contato: grava, a AHRI responde e a ficha começa', async () => {
    const { svc, enviadas } = montar([
      ia({
        mensagens: [
          'Olá, bom dia! Aqui é o assistente virtual do escritório do Dr. Glauco Voigt, advogado com atuação em Direito de Trânsito.',
          'Prazer, João. Antes de tudo: você já tem algum advogado cuidando do seu caso da CNH?',
        ],
        ficha: { nome: 'João Pereira', cidade: 'Campinas' },
        etapa: 'recepcao',
        acao: 'conversar',
      }),
    ]);
    const r = await svc.receber(msg('oi, sou o João de Campinas, minha cnh vai ser suspensa'));
    expect(r).toEqual({ responder: true, leadId: '5511988887777' });
    await svc.responder(r.leadId);
    expect(enviadas).toHaveLength(2);
    const lead = await svc.obter('5511988887777');
    expect(lead?.ficha.nome).toBe('João Pereira');
    expect(lead?.conversa.map((m) => m.de)).toEqual(['cliente', 'ahri', 'ahri']);
    // Mensagem repetida (mesmo id do WhatsApp) não duplica.
    expect((await svc.receber({ ...msg('x'), messageId: 'wamid.1' })).responder).toBe(false);
  });

  it('IA fora do ar ⇒ a próxima pergunta do roteiro, e o painel fica avisado', async () => {
    const { svc, enviadas } = montar([new Error('HTTP 529'), new Error('HTTP 529')]);
    const r = await svc.receber(msg('oi'));
    await svc.responder(r.leadId);
    expect(enviadas[1]).toBe('Para começarmos, poderia me passar seu nome e a cidade onde mora?');
    expect((await svc.obter(r.leadId))?.atencao).toContain('reserva do roteiro');
  });

  it('turno inválido (preço inventado) volta para a IA uma vez', async () => {
    const { svc, enviadas, chamadasIa } = montar([
      ia({ mensagens: ['Custa R$ 900,00.'], acao: 'conversar' }),
      ia({ mensagens: ['Me conta: o que está acontecendo com a sua CNH?'], acao: 'conversar' }),
    ]);
    const r = await svc.receber(msg('quanto custa?'));
    await svc.responder(r.leadId);
    expect(chamadasIa).toHaveLength(2);
    expect(enviadas).toEqual(['Me conta: o que está acontecendo com a sua CNH?']);
  });

  it('proposta com o valor da tabela → aceite passa para a equipe', async () => {
    const qualificado = {
      nome: 'João Pereira',
      jaTemAdvogado: false,
      situacao: 'aviso-suspensao',
      cartaDetran: 'recente',
      motoristaProfissional: true,
      notificacoesAnteriores: 'nenhuma-ou-poucas',
      temDocumentos: true,
      tipoCaso: 'suspensao',
    };
    const { svc, enviadas } = montar([
      ia({
        mensagens: ['Resumo do caso.'],
        ficha: qualificado,
        etapa: 'qualificacao',
        acao: 'conversar',
      }),
      ia({ mensagens: ['Viabilidade.'], etapa: 'viabilidade', acao: 'conversar' }),
      ia({ acao: 'proposta' }),
      ia({ acao: 'aceite' }),
    ]);
    for (const texto of ['oi', 'resposta', 'pode mandar a proposta', 'fechado']) {
      const r = await svc.receber(msg(texto));
      await svc.responder(r.leadId);
    }
    expect(enviadas.some((t) => t.includes('R$ 1.500,00'))).toBe(true);
    const lead = await svc.obter('5511988887777');
    expect(lead?.etapa).toBe('aceito');
    expect(lead?.modo).toBe('humano');
    expect(lead?.atencao).toContain('enviar contrato');
    // Com a equipe, a AHRI não responde mais.
    const depois = await svc.receber(msg('e agora?'));
    expect(depois.responder).toBe(false);
  });

  it('urgência transfere para o advogado e marca como urgente', async () => {
    const { svc } = montar([ia({ acao: 'transferir', urgente: true })]);
    const r = await svc.receber(msg('fui parado agora pela polícia'));
    await svc.responder(r.leadId);
    const lead = await svc.obter(r.leadId);
    expect(lead).toMatchObject({ etapa: 'transferido', modo: 'humano', urgente: true });
    expect((await svc.resumo()).urgentes).toBe(1);
  });
});

describe('AtendimentoCnh — painel', () => {
  async function leadMorno(): Promise<ReturnType<typeof montar>> {
    const m = montar([
      ia({
        mensagens: ['Resumo.'],
        ficha: { nome: 'Ana', situacao: 'cassacao', tipoCaso: 'cassacao', jaTemAdvogado: false },
        etapa: 'qualificacao',
        acao: 'conversar',
      }),
      ia({ mensagens: ['Viabilidade.'], etapa: 'viabilidade', acao: 'conversar' }),
      ia({ mensagens: ['Sem problema, Ana.'], acao: 'morno' }),
    ]);
    for (const texto of ['oi', 'resposta', 'vou pensar']) {
      const r = await m.svc.receber(msg(texto));
      await m.svc.responder(r.leadId);
    }
    return m;
  }

  it('lead morno: follow-up devido em 24h e SÓ sai quando o painel aprova', async () => {
    const { svc, enviadas, relogio } = await leadMorno();
    expect((await svc.obter('5511988887777'))?.etapa).toBe('morno');
    expect(await svc.followupsDevidos()).toHaveLength(0);
    const antes = enviadas.length;
    relogio.t = new Date('2026-09-19T12:30:00.000Z');
    const devidos = await svc.followupsDevidos();
    expect(devidos).toHaveLength(1);
    expect(enviadas).toHaveLength(antes); // nada saiu sozinho
    const r = await svc.enviarFollowups(['5511988887777'], 'Jessé');
    expect(r[0]).toMatchObject({ ok: true });
    expect(await svc.followupsDevidos()).toHaveLength(0);
  });

  it('follow-up fora da janela de 24h usa o modelo aprovado', async () => {
    const { svc, modelos, relogio } = await leadMorno();
    relogio.t = new Date('2026-09-21T12:00:00.000Z');
    const r = await svc.enviarFollowups(['5511988887777'], 'Jessé');
    expect(r[0]).toMatchObject({ ok: true, detalhe: 'modelo' });
    expect(modelos).toEqual(['Ana']);
  });

  it('mensagem da equipe só dentro da janela de 24h; assumir e devolver', async () => {
    const { svc, enviadas, relogio } = await leadMorno();
    expect(await svc.assumir('5511988887777', 'Jessé')).toEqual({ ok: true });
    expect((await svc.receber(msg('oi de novo', relogio.t))).responder).toBe(false);
    expect(
      await svc.mensagemDaEquipe('5511988887777', 'Oi Ana, aqui é da equipe.', 'Jessé'),
    ).toEqual({ ok: true });
    expect(enviadas[enviadas.length - 1]).toBe('Oi Ana, aqui é da equipe.');
    relogio.t = new Date('2026-09-25T12:00:00.000Z');
    const fora = await svc.mensagemDaEquipe('5511988887777', 'oi', 'Jessé');
    expect(fora.ok).toBe(false);
    expect(await svc.devolverParaAhri('5511988887777', 'Jessé')).toEqual({ ok: true });
    expect((await svc.obter('5511988887777'))?.modo).toBe('ahri');
  });

  it('resumo, contrato, pagamento, descarte e reabrir ficam no histórico', async () => {
    const { svc } = await leadMorno();
    await svc.marcarContratoEnviado('5511988887777', 'Jessé');
    await svc.marcarPagamento('5511988887777', 'Jessé');
    await svc.descartar('5511988887777', 'sem-condicao', 'Jessé');
    let lead = await svc.obter('5511988887777');
    expect(lead?.etapa).toBe('descartado');
    expect(lead?.historico.map((h) => h.texto)).toEqual(
      expect.arrayContaining([
        'Contrato e link de pagamento enviados.',
        'Pagamento confirmado.',
        'Descartado no painel: Sem condição de pagar.',
      ]),
    );
    await svc.reabrir('5511988887777', 'Jessé');
    lead = await svc.obter('5511988887777');
    expect(lead).toMatchObject({ etapa: 'qualificacao', modo: 'ahri' });
    const resumo = await svc.resumo();
    expect(resumo.total).toBe(1);
    expect(resumo.porEtapa.qualificacao).toBe(1);
    expect((await svc.listar())[0]).toMatchObject({ nome: 'Ana', etapa: 'qualificacao' });
  });
});
