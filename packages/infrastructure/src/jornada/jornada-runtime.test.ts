// ─────────────────────────────────────────────────────────────────────────────
// JORNADA COMERCIAL RUNTIME + EXPRESSÃO GOVERNADA — o FUNIL INTEIRO, ponta a
// ponta e determinístico, reproduzindo a conversa real das rodadas de teste:
//   "Boa noite" → boas-vindas → "Isabel" → pede a CIDADE → "Santa Ernestina" →
//   explicação+interesse → "sim" → triagem RG → docs → CONCLUIDA (LLM volta).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { Clock } from '@reconstrua/domain';
import type { PhrasingRequest } from '@reconstrua/application';
import {
  MENSAGENS_JORNADA,
  ObservabilityRuntime,
  OnboardingDocumentalRuntime,
} from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import { JsonOnboardingDocumentalStore } from '../onboarding/json-onboarding-store.js';
import { JornadaComercialRuntime, type JornadaRuntimeDeps } from './jornada-runtime.js';
import { JourneyGovernedExpression } from './journey-governed-expression.js';

const NOW = new Date('2026-07-20T21:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';
class TestClock implements Clock {
  now(): Date {
    return NOW;
  }
}

/** Relógio que anda — os casos de JANELA (lote de anexos) precisam de tempo. */
class RelogioMovel implements Clock {
  constructor(private t: Date = NOW) {}
  now(): Date {
    return new Date(this.t.getTime());
  }
  avancar(ms: number): void {
    this.t = new Date(this.t.getTime() + ms);
  }
}

function harness(extras: Partial<JornadaRuntimeDeps> = {}) {
  const json = new InMemoryJsonStore();
  const textos: Record<string, string | null> = {};
  const onboarding = new OnboardingDocumentalRuntime({
    store: new JsonOnboardingDocumentalStore(json),
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: null,
  });
  const jornada = new JornadaComercialRuntime({
    json,
    onboarding,
    observability: new ObservabilityRuntime(),
    clock: new TestClock(),
    ...extras,
  });
  const expression = new JourneyGovernedExpression(jornada, {
    phrase: () => Promise.resolve('RESPOSTA-DO-LLM'),
  });

  const request = (
    texto: string | null,
    opts: { turns?: number; arquivo?: boolean } = {},
  ): PhrasingRequest =>
    ({
      intent: {
        id: 'i1',
        chatId: CHAT,
        directive: 'speak',
        speechAct: 'inform',
        topic: 't',
        references: [],
        urgency: 'normal',
        operationalRuleRef: 'RO',
        fundamento: 'f',
        timingHintMs: null,
        formedAt: NOW,
      },
      context: {
        chatId: CHAT,
        session: {
          chatId: CHAT,
          turns: opts.turns ?? 3,
          lastInboundAt: null,
          lastOutboundAt: null,
        },
        recentEntries: [],
        recentOutboundTexts: [],
        lastPercept: {
          envelope: {
            text: texto,
            fileName: opts.arquivo ? 'IMG_1.jpg' : null,
            mediaUrl: opts.arquivo ? 'https://wa/m' : null,
          },
        },
        silenceMs: null,
      },
      avoidPhrases: [],
      styleGuidance: 'qualquer',
    }) as unknown as PhrasingRequest;

  /** Um turno completo: captura (pré-hook) + resposta (expressão governada). */
  const turno = async (texto: string, opts: { turns?: number } = {}): Promise<string> => {
    await jornada.aoReceberTexto(CHAT, texto, NOW);
    return expression.phrase(request(texto, opts));
  };

  return { json, textos, onboarding, jornada, expression, request, turno };
}

describe('o FUNIL REAL, determinístico de ponta a ponta', () => {
  it('reproduz a conversa das rodadas de teste — sem nenhuma decisão de LLM', async () => {
    const h = harness();

    // "Boa noite" (primeiro contato) ⇒ boas-vindas completas.
    expect(await h.turno('Boa noite', { turns: 1 })).toBe(MENSAGENS_JORNADA.boasVindas);
    expect(await h.jornada.etapa(CHAT)).toBe('IDENTIFICACAO');

    // "Isabel" ⇒ a resposta DO DECRETO: "Prazer, Isabel! E de qual cidade você fala?"
    expect(await h.turno('Isabel')).toBe(MENSAGENS_JORNADA.pedirCidade('Isabel'));

    // "Santa Ernestina" ⇒ identificação completa ⇒ explicação + pergunta de interesse.
    const explicacao = await h.turno('Santa Ernestina');
    expect(explicacao).toContain('interesse em fazer essa análise');
    expect(await h.jornada.etapa(CHAT)).toBe('CONSENTIMENTO');

    // "sim" ⇒ consentimento registrado ⇒ a triagem abre anunciando as DUAS
    // coisas (decreto CPF 2026-07-26) e pedindo o CPF primeiro.
    const inicio = await h.turno('sim');
    expect(inicio).toContain('duas coisas');
    expect(inicio).toContain('CPF');
    expect(await h.jornada.etapa(CHAT)).toBe('TRIAGEM');

    // CPF informado ⇒ capturado, confirmado, e o HISCON é pedido na sequência.
    const aposCpf = await h.turno('529.982.247-25');
    expect(aposCpf).toContain('CPF registrado');
    expect(aposCpf).toContain('HISCON (histórico de empréstimos consignados do INSS)');

    // Documento chega ⇒ ack autorado (a progressão automática pede o próximo).
    expect(await h.expression.phrase(h.request(null, { arquivo: true }))).toBe(
      MENSAGENS_JORNADA.ackDocumento,
    );

    // Registra CNH + comprovante + HISCON (a contabilidade real) ⇒ CONCLUIDA.
    h.textos['d1'] = 'carteira nacional de habilitação';
    h.textos['d2'] = 'fatura de energia elétrica';
    h.textos['d3'] = 'histórico de empréstimo consignado';
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'a.jpg', NOW);
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd2', 'b.jpg', NOW);
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd3', 'c.pdf', NOW);
    expect(await h.jornada.etapa(CHAT)).toBe('CONCLUIDA');

    // CONCLUIDA ⇒ a expressão DELEGA ao LLM (análise/pós-venda humanizados).
    expect(await h.expression.phrase(h.request('obrigada'))).toBe('RESPOSTA-DO-LLM');
  });

  it('"Isabel, sou de santa ernestina- SP" numa mensagem só ⇒ pula direto para a explicação', async () => {
    const h = harness();
    await h.turno('Boa noite', { turns: 1 });
    const r = await h.turno('Isabel, sou de santa ernestina- SP');
    expect(r).toContain('interesse em fazer essa análise');
  });

  it('caso REAL 51 9109-4367: CPF enviado na CONCLUIDA ganha confirmação AUTORADA', async () => {
    // Cliente antigo: HISCON entregue (CONCLUIDA), SEM cpf — recebeu o
    // follow-up das 09:00 e respondeu com o número. Antes, o atalho da
    // CONCLUIDA entregava a voz ao LLM (que negava o próprio pedido).
    const h = harness();
    h.textos['d1'] = 'histórico de empréstimo consignado';
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'hiscon.pdf', NOW);
    expect(await h.jornada.etapa(CHAT)).toBe('CONCLUIDA');

    const r = await h.turno('033.842.399-03'); // CPF real (dígitos verificadores válidos)
    expect(r).toContain('CPF recebido e registrado');
    expect((await h.jornada.fatos(CHAT)).registro.cpf).toBe('03384239903');
    // E o turno seguinte volta ao normal (LLM), sem eco da confirmação.
    expect(await h.turno('obrigado')).toBe('RESPOSTA-DO-LLM');
  });

  it('recusa ⇒ despedida gentil; novo "sim" depois reativa a triagem', async () => {
    const h = harness();
    await h.turno('Boa noite', { turns: 1 });
    await h.turno('Isabel, de Santa Ernestina');
    expect(await h.turno('não quero agora')).toBe(MENSAGENS_JORNADA.recusa);
    const r = await h.turno('pensei melhor, quero sim');
    expect(r).toContain('duas coisas'); // triagem reativada: CPF + HISCON
  });

  it('falha do store da jornada JAMAIS silencia: delega ao LLM', async () => {
    const json = new InMemoryJsonStore();
    const onboarding = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(json),
      leitor: null,
      pendencias: null,
    });
    const quebrada = new JornadaComercialRuntime({
      json: {
        get: () => Promise.reject(new Error('pg down')),
        put: () => Promise.reject(new Error('pg down')),
        del: () => Promise.reject(new Error('pg down')),
        list: () => Promise.reject(new Error('pg down')),
        keys: () => Promise.reject(new Error('pg down')),
      },
      onboarding,
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
    });
    const expression = new JourneyGovernedExpression(quebrada, {
      phrase: () => Promise.resolve('LLM-FALLBACK'),
    });
    const h = harness();
    expect(await expression.phrase(h.request('oi'))).toBe('LLM-FALLBACK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Paulo Roberto (2026-08-09): parecer enviado 31/07 pedindo o SIM;
// nove dias depois, "Eu estou aguardando o retorno sobre análise" recebeu
// "está em análise, conclusão estimada até 9 de agosto" (análise JÁ pronta e
// data inventada pelo LLM). A pergunta de ANDAMENTO pós-parecer agora tem
// resposta AUTORADA: análise pronta + dossiê + pedido do SIM. Quem já
// confirmou (mesa do humanizado) fica de fora.
// ─────────────────────────────────────────────────────────────────────────────
describe('caso REAL Paulo Roberto — andamento pós-parecer pede o SIM', () => {
  function montar(confirmado: boolean) {
    const json = new InMemoryJsonStore();
    const textos: Record<string, string | null> = { d1: 'histórico de empréstimo consignado' };
    const onboarding = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(json),
      leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
      pendencias: null,
    });
    const jornada = new JornadaComercialRuntime({
      json,
      onboarding,
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
      parecerDoCliente: () =>
        Promise.resolve({ link: 'https://x/parecer?t=abc', contratos: 11, indicios: 1 }),
      jaConfirmou: () => Promise.resolve(confirmado),
    });
    return { jornada, onboarding };
  }

  const entrada = {
    tipo: 'texto' as const,
    texto: 'Eu estou aguardando o retorno sobre análise',
    primeiroContato: false,
    timestamp: NOW,
  };

  it('sem confirmação ⇒ análise PRONTA + dossiê + pedido do SIM (nunca "em análise")', async () => {
    const { jornada, onboarding } = montar(false);
    await onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'hiscon.pdf', NOW);
    const r = await jornada.responder(CHAT, entrada);
    expect(r).toContain('análise já está PRONTA');
    expect(r).toContain('https://x/parecer?t=abc');
    expect(r).toContain('responder SIM');
    expect(r).not.toMatch(/em an[áa]lise\b.*prazo/i);
  });

  it('quem JÁ confirmou não recebe pedido de SIM — segue para a conversa normal', async () => {
    const { jornada, onboarding } = montar(true);
    await onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'hiscon.pdf', NOW);
    const r = await jornada.responder(CHAT, entrada);
    expect(r).toBe(''); // CONCLUIDA delega ao LLM (comportamento existente)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Candida (22/07→11/08/2026) — o "patinar": o HISCON chegou às 22:09
// e a AHRI ensinou o passo a passo do HISCON às 22:09, às 22:11 ("Ok" do
// cliente) e DE NOVO três dias depois; 20 dias depois ainda prometia "até 10
// dias úteis". A rede pós-HISCON troca a fala por uma que CONDUZ o funil.
// ─────────────────────────────────────────────────────────────────────────────
describe('caso REAL Candida — nunca mais reensinar o HISCON já recebido', () => {
  // A fala REAL da AHRI (LLM) que repetiu a aula com o documento na mão.
  const AULA_INDEVIDA =
    'Combinado. Então vamos por partes: abre o Meu INSS, entra no menu de serviços e procura ' +
    'por "Extrato de Empréstimos Consignados". Assim que aparecer a opção de baixar em PDF, é ' +
    'só clicar e me mandar aqui.';

  async function comHiscon(opts: {
    cpf?: string | null;
    parecer?: boolean;
    confirmado?: boolean;
    pedidoAtivo?: boolean;
    /** O dossiê JÁ foi anunciado nesta conversa (caso REAL Vivian). */
    jaAnunciado?: boolean;
  }) {
    const json = new InMemoryJsonStore();
    const textos: Record<string, string | null> = { d1: 'histórico de empréstimo consignado' };
    const onboarding = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(json),
      leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
      pendencias: null,
    });
    const jornada = new JornadaComercialRuntime({
      json,
      onboarding,
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
      parecerDoCliente: () =>
        Promise.resolve(
          opts.parecer === true
            ? { link: 'https://x/parecer?t=abc', contratos: 7, indicios: 2 }
            : null,
        ),
      jaConfirmou: () => Promise.resolve(opts.confirmado === true),
      temPedidoAtivo: () => Promise.resolve(opts.pedidoAtivo === true),
      dossieAnunciadoHaPouco: () => Promise.resolve(opts.jaAnunciado === true),
    });
    await onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'hiscon.pdf', NOW);
    if (opts.cpf !== undefined && opts.cpf !== null) {
      await jornada.aoReceberTexto(CHAT, opts.cpf, NOW);
    }
    return jornada;
  }

  it('HISCON recebido e SEM CPF ⇒ a aula vira o pedido do CPF (o passo real)', async () => {
    const jornada = await comHiscon({});
    const r = await jornada.revisarFalaPosHiscon(CHAT, AULA_INDEVIDA);
    expect(r).toBe(MENSAGENS_JORNADA.hisconRecebidoFaltaCpf);
    expect(r).toContain('já está aqui comigo');
    expect(r).not.toMatch(/Meu INSS/i);
  });

  it('HISCON + CPF + parecer pronto ⇒ conduz para a FASE 2 pedindo o SIM', async () => {
    const jornada = await comHiscon({ cpf: '033.842.399-03', parecer: true });
    const r = await jornada.revisarFalaPosHiscon(CHAT, AULA_INDEVIDA);
    expect(r).toContain('análise já está PRONTA');
    expect(r).toContain('responder SIM');
    expect(r).not.toMatch(/Meu INSS/i);
  });

  // CASO REAL Vivian (11 96924-8200, 2026-09-22): ela recebeu o anúncio
  // INTEIRO do dossiê quatro vezes — duas seguidas no mesmo minuto e mais duas
  // no dia seguinte, inclusive depois do "Sim". Anúncio grande é uma vez só.
  it('dossiê JÁ anunciado ⇒ lembrete curto, sem repetir o anúncio inteiro', async () => {
    const jornada = await comHiscon({ cpf: '033.842.399-03', parecer: true, jaAnunciado: true });
    const r = await jornada.revisarFalaPosHiscon(CHAT, AULA_INDEVIDA);
    expect(r).toContain('já está aqui na nossa conversa');
    expect(r).toContain('SIM');
    // O que NÃO pode voltar: o anúncio inteiro, com números e link de novo.
    expect(r).not.toContain('análise já está PRONTA');
    expect(r).not.toContain('/parecer?t=');
  });

  it('HISCON + CPF sem parecer ⇒ andamento honesto, sem reabrir prazo', async () => {
    const jornada = await comHiscon({ cpf: '033.842.399-03' });
    const r = await jornada.revisarFalaPosHiscon(CHAT, AULA_INDEVIDA);
    expect(r).toBe(MENSAGENS_JORNADA.andamentoSemPrometerPrazo);
    expect(r).not.toMatch(/10 dias|prazo de at[ée]/i);
  });

  it('pedido ATIVO do advogado (fase 2) ⇒ cobrar é legítimo, a rede não mexe', async () => {
    const jornada = await comHiscon({ cpf: '033.842.399-03', pedidoAtivo: true });
    expect(await jornada.revisarFalaPosHiscon(CHAT, AULA_INDEVIDA)).toBe(AULA_INDEVIDA);
  });

  it('fala que NÃO é cobrança de documento passa intacta', async () => {
    const jornada = await comHiscon({ cpf: '033.842.399-03' });
    const conversa = 'Que bom saber! Fico à disposição para qualquer dúvida.';
    expect(await jornada.revisarFalaPosHiscon(CHAT, conversa)).toBe(conversa);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Oracio (11/08/2026, 12:48→12:50) — UM MINUTO depois de mandar o
// DOSSIÊ pedindo o SIM, a AHRI disse "seu caso está em análise, dentro do
// prazo de até 10 dias úteis"; e DEPOIS do cliente confirmar, repetiu
// "seguimos para a análise... previsão até 21 de agosto". Prazo é proibido: com
// o dossiê na mão a missão é UMA — converter no SIM (fase 2).
// ─────────────────────────────────────────────────────────────────────────────
describe('caso REAL Oracio — prazo proibido; a missão é converter no SIM', () => {
  const FALA_EM_ANALISE =
    'Perfeito, Oracio. Seu caso está em análise, dentro do prazo de até 10 dias úteis. Assim que ' +
    'tivermos qualquer novidade, eu aviso você por aqui.';
  const FALA_POS_SIM =
    'Que bom que confirmou! Agora é com a nossa equipe: seguimos para a análise, dentro do prazo ' +
    'de até 10 dias, previsão até 21 de agosto.';

  async function montar(opts: { parecer?: boolean; confirmado?: boolean }) {
    const json = new InMemoryJsonStore();
    const textos: Record<string, string | null> = { d1: 'histórico de empréstimo consignado' };
    const onboarding = new OnboardingDocumentalRuntime({
      store: new JsonOnboardingDocumentalStore(json),
      leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
      pendencias: null,
    });
    const jornada = new JornadaComercialRuntime({
      json,
      onboarding,
      observability: new ObservabilityRuntime(),
      clock: new TestClock(),
      parecerDoCliente: () =>
        Promise.resolve(
          opts.parecer === true
            ? { link: 'https://x/parecer?t=abc', contratos: 10, indicios: 3 }
            : null,
        ),
      jaConfirmou: () => Promise.resolve(opts.confirmado === true),
    });
    await onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'hiscon.pdf', NOW);
    await jornada.aoReceberTexto(CHAT, '972.735.628-15', NOW); // CPF registrado
    return jornada;
  }

  it('dossiê enviado e SEM o SIM ⇒ "em análise/10 dias" vira o pedido de CONFIRMAÇÃO', async () => {
    const jornada = await montar({ parecer: true });
    const r = await jornada.revisarFalaPosHiscon(CHAT, FALA_EM_ANALISE);
    expect(r).toContain('análise já está PRONTA');
    expect(r).toContain('responder SIM');
    expect(r).not.toMatch(/10 dias|dias [úu]teis|em an[áa]lise/i);
  });

  it('DEPOIS do SIM ⇒ nada de prazo: quem fala com ele agora é a equipe', async () => {
    const jornada = await montar({ parecer: true, confirmado: true });
    const r = await jornada.revisarFalaPosHiscon(CHAT, FALA_POS_SIM);
    expect(r).toBe(MENSAGENS_JORNADA.confirmadoAguardeEquipe);
    // 2026-09-23: sem número morto na fala — quem procura o cliente é a Layara.
    expect(r).toContain('Layara');
    expect(r).not.toContain('99802-8530');
    expect(r).not.toMatch(/10 dias|previs[ãa]o|prazo/i);
  });

  it('sem parecer ainda ⇒ andamento honesto, jamais com prazo', async () => {
    const jornada = await montar({});
    const r = await jornada.revisarFalaPosHiscon(CHAT, FALA_EM_ANALISE);
    expect(r).toBe(MENSAGENS_JORNADA.andamentoSemPrometerPrazo);
    expect(r).not.toMatch(/10 dias|dias [úu]teis|prazo/i);
  });

  it('conversa normal (sem prazo e sem cobrança) continua passando intacta', async () => {
    const jornada = await montar({ parecer: true });
    const boa = 'Ótima pergunta! Os honorários só existem em caso de êxito, ao final.';
    expect(await jornada.revisarFalaPosHiscon(CHAT, boa)).toBe(boa);
  });
});

// ── Caso REAL Geisebel (2026-08-28): tudo numa mensagem; "mais" virou nome;
// CPF registrado foi repedido; "tudo certo, em análise" sem HISCON nenhum. ────
describe('caso Geisebel — captura completa da 1ª mensagem e triagem sem repedir CPF', () => {
  const APRESENTACAO =
    'Oi boa tarde me chamo Geisebel Amancio dos Santos, sou de Santa ernestina, meu cpf é 331.510.938-92 e quero fazer';

  it('1ª mensagem com nome+cidade+CPF ⇒ captura os TRÊS e não mente "em análise"', async () => {
    const h = harness();
    const r1 = await h.turno(APRESENTACAO, { turns: 1 });
    const fatos = await h.jornada.fatos(CHAT);
    expect(fatos.registro.nome).toBe('Geisebel Amancio dos Santos');
    expect((fatos.registro.cidade ?? '').toLowerCase()).toBe('santa ernestina');
    expect(fatos.registro.cpf).toBe('33151093892');
    // A resposta segue o funil (explicação + interesse) — nunca "seu caso
    // segue em análise" (não existe análise sem HISCON).
    expect(r1).toContain('interesse');
    expect(r1).not.toContain('segue em análise');
  });

  it('"mais ainda n mandei o hiscon" JAMAIS vira nome', async () => {
    const h = harness();
    await h.turno('Boa tarde', { turns: 1 });
    await h.turno('mais ainda n mandei o hiscon');
    expect((await h.jornada.fatos(CHAT)).registro.nome).toBe(null);
  });

  it('"meu nome é …" corrige o nome mesmo FORA da identificação', async () => {
    const h = harness();
    await h.turno('Boa tarde', { turns: 1 });
    await h.turno('Isabel');
    await h.turno('Santa Ernestina - SP'); // identificação completa ⇒ consentimento
    await h.turno('meu nome é Geisebel Amancio dos Santos');
    expect((await h.jornada.fatos(CHAT)).registro.nome).toBe('Geisebel Amancio dos Santos');
  });

  it('CPF adiantado ⇒ o SIM abre a triagem DIRETO no HISCON (sem repedir CPF)', async () => {
    const h = harness();
    await h.turno(APRESENTACAO, { turns: 1 });
    const inicio = await h.turno('sim');
    expect(inicio).toContain('CPF eu já tenho registrado');
    expect(inicio).toContain('HISCON');
    expect(inicio).not.toContain('pode me informar o número do seu CPF');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso REAL Angela (11 95707-5533, 24/09/2026, 18:11→18:13) — ela mandou o
// HISCON e, atrás dele, os contratos que tinha dos bancos. A coleta já estava
// completa, a jornada não governava mais o turno e cada arquivo virava uma fala
// do LLM igual à anterior; o guard anti-eco matava a repetição e no lugar dela
// saía a devolução genérica. Resultado: QUATRO mensagens seguidas — "Tô aqui
// com você", "Me diz o que você precisa agora", "Pode falar comigo", "Sigo com
// você por aqui" — para uma cliente que estava, justamente, mandando o que foi
// pedido. Anexo extra agora tem fala própria: um recibo por LOTE.
// ─────────────────────────────────────────────────────────────────────────────
describe('caso REAL Angela — os contratos que chegam atrás do HISCON', () => {
  const CPF_DE_TESTE = '529.982.247-25';

  async function comHisconEDossie(relogio: RelogioMovel, extras: Partial<JornadaRuntimeDeps> = {}) {
    const h = harness({
      clock: relogio,
      parecerDoCliente: () =>
        Promise.resolve({ link: 'https://x/parecer?t=abc', contratos: 17, indicios: 4 }),
      jaConfirmou: () => Promise.resolve(false),
      dossieAnunciadoHaPouco: () => Promise.resolve(true),
      ...extras,
    });
    h.textos['d1'] = 'histórico de empréstimo consignado';
    await h.onboarding.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'hiscon.pdf', NOW);
    return h;
  }

  it('UM recibo no primeiro anexo extra e SILÊNCIO no resto do lote', async () => {
    const relogio = new RelogioMovel();
    const h = await comHisconEDossie(relogio);
    await h.jornada.aoReceberTexto(CHAT, CPF_DE_TESTE, relogio.now());

    const primeiro = await h.expression.phrase(h.request(null, { arquivo: true }));
    expect(primeiro).toContain('Recebi os arquivos');
    // E repõe o ÚNICO passo que falta: o SIM (o dossiê já está na conversa).
    expect(primeiro).toContain('dossiê já está aqui');

    // O resto do lote não fala NADA — nem roteiro, nem LLM, nem devolução.
    for (const _ of [1, 2, 3]) {
      relogio.avancar(20_000);
      expect(await h.expression.phrase(h.request(null, { arquivo: true }))).toBe('');
    }
  });

  it('passada a janela do lote, um anexo novo volta a ter resposta', async () => {
    const relogio = new RelogioMovel();
    const h = await comHisconEDossie(relogio);
    await h.jornada.aoReceberTexto(CHAT, CPF_DE_TESTE, relogio.now());

    expect(await h.expression.phrase(h.request(null, { arquivo: true }))).toContain(
      'Recebi os arquivos',
    );
    relogio.avancar(11 * 60_000);
    expect(await h.expression.phrase(h.request(null, { arquivo: true }))).toContain(
      'Recebi os arquivos',
    );
  });

  it('sem CPF registrado, o recibo repõe exatamente o que falta', async () => {
    const relogio = new RelogioMovel();
    const h = await comHisconEDossie(relogio);
    const r = await h.expression.phrase(h.request(null, { arquivo: true }));
    expect(r).toContain('Recebi os arquivos');
    expect(r).toContain('CPF');
  });

  it('pedido ATIVO do advogado (fase 2): a jornada não se intromete', async () => {
    const relogio = new RelogioMovel();
    const h = await comHisconEDossie(relogio, { temPedidoAtivo: () => Promise.resolve(true) });
    await h.jornada.aoReceberTexto(CHAT, CPF_DE_TESTE, relogio.now());
    expect(await h.expression.phrase(h.request(null, { arquivo: true }))).toBe('RESPOSTA-DO-LLM');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACOLHIMENTO ANTES DO PEDIDO (2026-09-24) — o dono, sobre o caso Angela: "a
// AHRI virou psicóloga, interrogadora". No meio da coleta a cliente escreveu
// "Tenho empréstimo consignado que eu fiz" e recebeu de volta, seca, a mesma
// cobrança do CPF. O roteiro continua saindo INTEIRO; o que muda é que ele pode
// vir precedido de UMA frase respondendo o que a pessoa disse.
// ─────────────────────────────────────────────────────────────────────────────
describe('acolhimento — responder o cliente sem tocar no roteiro', () => {
  const FALA_DA_CLIENTE = 'Tenho empréstimo consignado que eu fiz';
  const comVoz = (jornada: JornadaComercialRuntime, frase: string) =>
    new JourneyGovernedExpression(jornada, { phrase: () => Promise.resolve(frase) }, true);

  /** Leva a conversa até o pedido do CPF e devolve o roteiro verbatim do turno. */
  async function naTriagem() {
    const h = harness();
    await h.turno('Boa noite', { turns: 1 });
    await h.turno('Isabel');
    await h.turno('Santa Ernestina - SP');
    await h.turno('sim');
    await h.jornada.aoReceberTexto(CHAT, FALA_DA_CLIENTE, NOW);
    const roteiro = await h.expression.phrase(h.request(FALA_DA_CLIENTE));
    expect(roteiro).toContain('CPF');
    return { h, roteiro };
  }

  it('a frase vem ANTES e o roteiro sai palavra por palavra', async () => {
    const { h, roteiro } = await naTriagem();
    const ACOLHIMENTO = 'Entendi — é exatamente isso que a nossa análise verifica.';
    const fala = await comVoz(h.jornada, ACOLHIMENTO).phrase(h.request(FALA_DA_CLIENTE));
    expect(fala).toBe(`${ACOLHIMENTO}\n\n${roteiro}`);
  });

  it('frase reprovada pela peneira ⇒ o roteiro sai sozinho, como antes', async () => {
    const { h, roteiro } = await naTriagem();
    for (const ruim of [
      '', // o LLM não achou o que responder
      'Pode me mandar o seu CPF?', // invade o pedido do roteiro
      'Em até 10 dias úteis fica pronto.', // prazo
      'Garanto que você vai receber de volta o valor.', // promessa
    ])
      expect(await comVoz(h.jornada, ruim).phrase(h.request(FALA_DA_CLIENTE)), ruim).toBe(roteiro);
  });

  it('turno que CAPTUROU algo não ganha acolhimento (o roteiro já responde)', async () => {
    const h = harness();
    await h.turno('Boa noite', { turns: 1 });
    await h.jornada.aoReceberTexto(CHAT, 'Angela Maria Pereira', NOW); // captura o nome
    const fala = await comVoz(h.jornada, 'Que nome bonito.').phrase(
      h.request('Angela Maria Pereira'),
    );
    expect(fala).toBe(MENSAGENS_JORNADA.pedirCidade('Angela Maria Pereira'));
  });

  it('sem LLM real (offline), nada muda: roteiro verbatim', async () => {
    const { h, roteiro } = await naTriagem();
    expect(await h.expression.phrase(h.request(FALA_DA_CLIENTE))).toBe(roteiro);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A conversa da Angela, do começo (24/09/2026) — o dono: "estendeu demais, com
// perguntas desnecessárias". Aqui ficam travados os dois defeitos que a
// alongavam: o nome apagado pela resposta da cidade e o dado que chega numa
// bolha própria e é gravado em silêncio, como se ninguém tivesse lido.
// ─────────────────────────────────────────────────────────────────────────────
describe('caso REAL Angela — a identificação em duas bolhas', () => {
  it('o nome sobrevive à cidade, e o UF que chega depois é CONFIRMADO no mesmo turno', async () => {
    const h = harness();
    await h.turno('Olá! Posso ter mais informações sobre isso?', { turns: 1 });
    expect(await h.turno('Angela Maria Pereira')).toBe(
      MENSAGENS_JORNADA.pedirCidade('Angela Maria Pereira'),
    );

    // "São Paulo, capital" é a CIDADE — nunca um nome novo.
    expect(await h.turno('São Paulo, capital')).toContain('interesse em fazer essa análise');

    // O UF na bolha seguinte: confirmado E o funil continua na MESMA mensagem.
    const anotado = await h.turno('São Paulo -SP');
    expect(anotado).toContain('Anotado: São Paulo - SP');
    expect(anotado).toContain('interesse');

    const r = (await h.jornada.fatos(CHAT)).registro;
    expect(r.nome).toBe('Angela Maria Pereira'); // jamais "São Paulo"
    expect(r.cidade).toBe('São Paulo');
    expect(r.estado).toBe('SP');
  });

  it('cidade numa bolha e o estado na seguinte: o UF anotado é CONFIRMADO no mesmo turno', async () => {
    const h = harness();
    await h.turno('Boa tarde', { turns: 1 });
    await h.turno('Humberto Silva');
    expect(await h.turno('Ribeirão Preto')).toContain('interesse em fazer essa análise');
    // A segunda bolha traz só o estado: antes era gravada em SILÊNCIO e a
    // pessoa recebia de volta uma pergunta sem relação com o que escreveu.
    const anotado = await h.turno('São Paulo');
    expect(anotado).toContain('Anotado: Ribeirão Preto - SP');
    expect(anotado).toContain('interesse'); // o funil segue na MESMA mensagem
  });
});
