// ─────────────────────────────────────────────────────────────────────────────
// CORVO SERVICE — as garantias que valem dinheiro e sigilo:
//   • webhook: assinatura válida/ inválida / replay velho / entrega duplicada;
//   • cada tipo de evento grava o que deve (e a senha NUNCA fica em claro);
//   • envio: idempotency key estável, retry com a MESMA key, 409 troca a key,
//     4xx permanente para, conteúdo igual não reenvia;
//   • reconciliação processa só o que o webhook perdeu (senha null não apaga).
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import type { CorvoClient, ResultadoEnvio } from './corvo-client.js';
import {
  CorvoService,
  verificarAssinaturaCorvo,
  type CorvoDeps,
  type DocumentoColetado,
  type ImportacaoCorvo,
  type PedidoDeEnvio,
} from './corvo-service.js';
import type { ContratoDoLead } from './corvo-zip.js';

const SEGREDO = 'whsec-teste';
const AGORA = new Date('2026-08-25T12:00:00.000Z');
const clock = { now: (): Date => AGORA };

function assinar(corpo: string, tsSeg: number, segredo = SEGREDO): Record<string, string> {
  const hex = createHmac('sha256', segredo)
    .update(`${String(tsSeg)}.${corpo}`)
    .digest('hex');
  return { 'x-corvo-timestamp': String(tsSeg), 'x-corvo-signature': `v1=${hex}` };
}

const obs = { event: (): void => undefined, error: (): void => undefined };

const CONTRATO: ContratoDoLead = {
  bancoCodigo: '033',
  bancoNome: 'SANTANDER',
  contrato: 'C1',
  modalidade: 'EMPRÉSTIMO CONSIGNADO',
  valorEmprestado: 1000,
  qtdeParcelas: 84,
  valorParcela: 50,
  inicio: '01/2024',
  fim: '12/2030',
  situacao: 'ATIVO',
};
const DOC: DocumentoColetado = {
  categoria: 'HISCON',
  mime: 'application/pdf',
  bytes: new Uint8Array([1]),
  ref: 'doc-1',
};
const O_PEDIDO: PedidoDeEnvio = {
  clienteId: 'cli-1',
  chatId: '5531999@c.us',
  nome: 'JOSÉ',
};
const agendar = (svc: CorvoService): Promise<void> =>
  svc.agendarEnvio(O_PEDIDO.clienteId, O_PEDIDO.chatId, O_PEDIDO.nome);

/** Cliente falso: grava cada envio e devolve o roteiro programado. */
function clienteFalso(roteiro: ResultadoEnvio[]): {
  client: CorvoClient;
  envios: { key: string }[];
} {
  const envios: { key: string }[] = [];
  const client = {
    enviarZip: (_zip: Buffer, key: string): Promise<ResultadoEnvio> => {
      envios.push({ key });
      return Promise.resolve(
        roteiro.shift() ?? {
          ok: true,
          corpo: {
            importacaoId: 'imp-1',
            modo: 'mesclar',
            clientes: [
              {
                nome: 'JOSÉ',
                cpf: '01795790881',
                bancos: [{ codigo: '033', nome: 'SANTANDER', email: 'x@b', contratos: 1 }],
                documentos: ['HISCON'],
                caixa: { status: 'PENDENTE' },
              },
            ],
            contratos_novos: 1,
            ignorados: [],
            leitura_hiscon: { status: 'OK' },
          },
        },
      );
    },
    reenviarCredencial: () => Promise.resolve({ ok: true }),
    listarEventos: () => Promise.resolve(null),
    baixarAnexo: () => Promise.resolve(null),
  } as unknown as CorvoClient;
  return { client, envios };
}

function servico(over: Partial<CorvoDeps> = {}): { svc: CorvoService; json: InMemoryJsonStore } {
  const json = new InMemoryJsonStore();
  const svc = new CorvoService({
    json,
    clock,
    client: null,
    webhookSecret: SEGREDO,
    chaveCredencial: 'chave-de-teste',
    observability: obs,
    cpfDe: () => Promise.resolve('01795790881'),
    contratosDe: () => Promise.resolve([CONTRATO]),
    documentosDe: () => Promise.resolve([DOC]),
    ...over,
  });
  return { svc, json };
}

describe('verificarAssinaturaCorvo — a porta', () => {
  const corpo = Buffer.from('{"id":"evt_1"}');
  const ts = Math.floor(AGORA.getTime() / 1000);

  it('assinatura correta dentro da janela ⇒ ok', () => {
    const h = assinar(corpo.toString(), ts);
    expect(
      verificarAssinaturaCorvo(
        SEGREDO,
        corpo,
        h['x-corvo-timestamp'] ?? '',
        h['x-corvo-signature'] ?? '',
        AGORA.getTime(),
      ),
    ).toBe('ok');
  });

  it('segredo errado ⇒ assinatura-invalida', () => {
    const h = assinar(corpo.toString(), ts, 'outro-segredo');
    expect(
      verificarAssinaturaCorvo(
        SEGREDO,
        corpo,
        h['x-corvo-timestamp'] ?? '',
        h['x-corvo-signature'] ?? '',
        AGORA.getTime(),
      ),
    ).toBe('assinatura-invalida');
  });

  it('timestamp 6 minutos atrás ⇒ expirado (anti-replay)', () => {
    const velho = ts - 360;
    const h = assinar(corpo.toString(), velho);
    expect(
      verificarAssinaturaCorvo(
        SEGREDO,
        corpo,
        h['x-corvo-timestamp'] ?? '',
        h['x-corvo-signature'] ?? '',
        AGORA.getTime(),
      ),
    ).toBe('expirado');
  });

  it('sem segredo configurado ⇒ recusa SEMPRE (fail-closed)', () => {
    const h = assinar(corpo.toString(), ts, '');
    expect(
      verificarAssinaturaCorvo(
        '',
        corpo,
        h['x-corvo-timestamp'] ?? '',
        h['x-corvo-signature'] ?? '',
        AGORA.getTime(),
      ),
    ).toBe('assinatura-invalida');
  });
});

function eventoAssinado(evento: object): { corpo: Buffer; headers: Record<string, string> } {
  const corpo = Buffer.from(JSON.stringify(evento));
  return {
    corpo,
    headers: assinar(corpo.toString(), Math.floor(AGORA.getTime() / 1000)),
  };
}

describe('receberWebhook — transporte + dedupe', () => {
  it('assinatura inválida ⇒ 401 e NADA é gravado', async () => {
    const { svc, json } = servico();
    const { corpo } = eventoAssinado({
      id: 'evt_x',
      tipo: 'webhook.teste',
      ocorridoEm: '',
      dados: {},
    });
    const r = await svc.receberWebhook(corpo, {
      'x-corvo-timestamp': '1',
      'x-corvo-signature': 'v1=00',
    });
    expect(r.status).toBe(401);
    expect(await json.keys('corvo-webhook-entregas')).toHaveLength(0);
  });

  it('mesma entrega duas vezes ⇒ segunda responde 200 SEM reprocessar', async () => {
    const { svc, json } = servico();
    const evt = {
      id: 'evt_dup',
      tipo: 'banco.envio',
      ocorridoEm: '2026-08-25T11:00:00.000Z',
      dados: { envioId: 'env-1', cliente: { nome: 'JOSÉ', cpf: '01795790881' } },
    };
    const { corpo, headers } = eventoAssinado(evt);
    expect((await svc.receberWebhook(corpo, headers)).status).toBe(200);
    // Corrompe o registro: se reprocessasse, o valor seria reescrito.
    await json.put('corvo-envios', 'env-1', { envioId: 'env-1', cliente: 'MARCADOR' });
    const r2 = await svc.receberWebhook(corpo, headers);
    expect(r2.status).toBe(200);
    expect(r2.corpo).toEqual({ ok: true, repetido: true });
    expect(((await json.get('corvo-envios', 'env-1')) as { cliente: string }).cliente).toBe(
      'MARCADOR',
    );
  });

  it('evento desconhecido ⇒ 200 (nunca falha o webhook por tipo novo)', async () => {
    const { svc } = servico();
    const { corpo, headers } = eventoAssinado({
      id: 'evt_novo',
      tipo: 'coisa.nova',
      ocorridoEm: '',
      dados: {},
    });
    expect((await svc.receberWebhook(corpo, headers)).status).toBe(200);
  });
});

describe('processarEvento — cada tipo grava o que deve', () => {
  it('caixa.criada: senha guardada CIFRADA; revelar decifra; lista não vaza', async () => {
    const { svc, json } = servico();
    await svc.processarEvento({
      id: 'evt_cx',
      tipo: 'caixa.criada',
      ocorridoEm: '2026-08-25T11:00:00.000Z',
      dados: {
        cliente: { nome: 'JOSÉ', cpf: '017.957.908-81' },
        email: 'jose@corvo.mail',
        senha: 'S3nh@-secreta',
        imap: { host: 'i', port: 993, secure: true },
        smtp: { host: 's', port: 465, secure: true },
        webmail: 'https://mail',
        criadaEm: '2026-08-25T11:00:00.000Z',
      },
    });
    const bruto = JSON.stringify(await json.get('corvo-caixas', '01795790881'));
    expect(bruto).not.toContain('S3nh@-secreta'); // NUNCA em claro no armazenamento
    const revelada = await svc.revelarSenha('01795790881', 'dono');
    expect(revelada).toEqual({ email: 'jose@corvo.mail', senha: 'S3nh@-secreta' });
  });

  it('caixa.criada com senha null (reconciliação) NÃO apaga a senha guardada', async () => {
    const { svc } = servico();
    const base = {
      cliente: { cpf: '01795790881' },
      email: 'jose@corvo.mail',
      imap: null,
      smtp: null,
      webmail: null,
      criadaEm: null,
    };
    await svc.processarEvento({
      id: 'e1',
      tipo: 'caixa.criada',
      ocorridoEm: '',
      dados: { ...base, senha: 'primeira' },
    });
    await svc.processarEvento({
      id: 'e2',
      tipo: 'caixa.criada',
      ocorridoEm: '',
      dados: { ...base, senha: null },
    });
    expect((await svc.revelarSenha('01795790881', 'dono'))?.senha).toBe('primeira');
  });

  it('banco.envio + banco.resposta compõem a timeline do cliente enviado', async () => {
    const { client } = clienteFalso([]);
    const { svc } = servico({ client });
    await agendar(svc);
    await svc.varrerEEnviar(); // cria a importação (cpf ligado ao clienteId)
    await svc.processarEvento({
      id: 'e-env',
      tipo: 'banco.envio',
      ocorridoEm: '2026-08-25T11:00:00.000Z',
      dados: {
        envioId: 'env-1',
        cliente: { nome: 'JOSÉ', cpf: '01795790881' },
        banco: { codigo: '033', nome: 'SANTANDER' },
        para: 'sac@santander',
        assunto: 'Notificação',
        caixaEmail: 'jose@corvo.mail',
        enviadoEm: '2026-08-25T11:00:00.000Z',
        messageId: '<m1>',
      },
    });
    await svc.processarEvento({
      id: 'e-resp',
      tipo: 'banco.resposta',
      ocorridoEm: '2026-08-25T13:00:00.000Z',
      dados: {
        respostaId: 'resp-1',
        envioId: 'env-1',
        tipo: 'RESPOSTA',
        cliente: { nome: 'JOSÉ', cpf: '01795790881' },
        banco: { codigo: '033', nome: 'SANTANDER' },
        de: 'sac@santander',
        assunto: 'RE: Notificação',
        recebidaEm: '2026-08-25T13:00:00.000Z',
        caixaEmail: 'jose@corvo.mail',
        corpoTexto: 'Recebido, prazo de 10 dias.',
        anexos: [{ nome: 'resposta.pdf', tipo: 'application/pdf', tamanho: 10, url: 'https://x' }],
      },
    });
    const t = await svc.timelineDoCliente('cli-1');
    expect(t?.envios.map((e) => e.envioId)).toEqual(['env-1']);
    expect(t?.respostas[0]?.corpoTexto).toBe('Recebido, prazo de 10 dias.');
    expect(t?.respostas[0]?.anexos).toHaveLength(1);
  });
});

describe('fila de envio (gatilho: perícia iniciada) — idempotência e retry', () => {
  it('agendado ⇒ envia e sai da fila; RE-agendado idêntico ⇒ POSTa de novo com key :rN', async () => {
    // O POST é o SINAL de disparo do Corvo: entrar na fila é evento deliberado
    // (perícia iniciada / Reenviar) e SEMPRE sai — pacote idêntico ganha :rN
    // para não cair na janela de replay de 24h (incidente 2026-08-27).
    const { client, envios } = clienteFalso([]);
    const { svc, json } = servico({ client });
    await agendar(svc);
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 1, erros: 0 });
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 0 }); // fila vazia
    await agendar(svc); // mesmo conteúdo, novo evento
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 1, erros: 0 });
    expect(envios).toHaveLength(2);
    expect(envios[1]?.key).toBe(envios[0]?.key + ':r1'); // mesma base, sal novo
    const imp = (await json.get('corvo-importacoes', 'cli-1')) as ImportacaoCorvo;
    expect(imp.estado).toBe('ENVIADO');
    expect(imp.importacaoId).toBe('imp-1');
  });

  it('documento NOVO muda a assinatura ⇒ reenvia (modo mesclar) com key nova', async () => {
    const { client, envios } = clienteFalso([]);
    const docs = [[DOC], [DOC, { ...DOC, categoria: 'PROCURACAO' as const, ref: 'doc-2' }]];
    let vez = 0;
    const { svc } = servico({
      client,
      documentosDe: () => Promise.resolve(docs[Math.min(vez++, 1)] ?? []),
    });
    await agendar(svc);
    await svc.varrerEEnviar();
    await agendar(svc); // ex.: Reenviar manual após documento novo
    await svc.varrerEEnviar();
    expect(envios).toHaveLength(2);
    expect(envios[0]?.key).not.toBe(envios[1]?.key); // conteúdo novo, key nova
  });

  it('falha 5xx agenda retry com a MESMA key; sucesso depois zera o backoff', async () => {
    const { client, envios } = clienteFalso([
      { ok: false, status: 500, erro: 'instável', permanente: false, conflitoDeChave: false },
    ]);
    const { svc, json } = servico({ client });
    await agendar(svc);
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 1 });
    const imp = (await json.get('corvo-importacoes', 'cli-1')) as ImportacaoCorvo;
    expect(imp.estado).toBe('PENDENTE');
    expect(imp.proximaTentativaEm).not.toBe(null); // backoff agendado
    // Dentro do backoff, o cliente PERMANECE na fila e nada tenta de novo.
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 0 });
    // Backoff vencido: tenta com a MESMA key e desta vez entra.
    await json.put('corvo-importacoes', 'cli-1', { ...imp, proximaTentativaEm: null });
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 1, erros: 0 });
    expect(envios).toHaveLength(2);
    expect(envios[0]?.key).toBe(envios[1]?.key); // retry NUNCA muda a key
  });

  it('409 (key reusada com conteúdo diferente) gera key NOVA na tentativa seguinte', async () => {
    const { client, envios } = clienteFalso([
      { ok: false, status: 409, erro: 'conflito', permanente: false, conflitoDeChave: true },
    ]);
    const { svc, json } = servico({ client });
    await agendar(svc);
    await svc.varrerEEnviar();
    const imp = (await json.get('corvo-importacoes', 'cli-1')) as ImportacaoCorvo;
    await json.put('corvo-importacoes', 'cli-1', { ...imp, proximaTentativaEm: null });
    await svc.varrerEEnviar();
    expect(envios).toHaveLength(2);
    expect(envios[0]?.key).not.toBe(envios[1]?.key);
  });

  it('400 permanente ⇒ ERRO, não tenta de novo sozinho; forçar reenvio destrava', async () => {
    const { client, envios } = clienteFalso([
      { ok: false, status: 400, erro: 'zip inválido', permanente: true, conflitoDeChave: false },
    ]);
    const { svc, json } = servico({ client });
    await agendar(svc);
    await svc.varrerEEnviar();
    expect(((await json.get('corvo-importacoes', 'cli-1')) as ImportacaoCorvo).estado).toBe('ERRO');
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 0 }); // parado
    await svc.forcarReenvio('cli-1');
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 1, erros: 0 });
    expect(envios).toHaveLength(2);
  });

  it('sem CPF de 11 dígitos ⇒ SEM_CPF, nada sai', async () => {
    const { client, envios } = clienteFalso([]);
    const { svc, json } = servico({ client, cpfDe: () => Promise.resolve(null) });
    await agendar(svc);
    await svc.varrerEEnviar();
    expect(envios).toHaveLength(0);
    expect(((await json.get('corvo-importacoes', 'cli-1')) as ImportacaoCorvo).estado).toBe(
      'SEM_CPF',
    );
  });

  it('integração desligada (client null) ⇒ inerte', async () => {
    const { svc } = servico();
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 0 });
    expect(svc.ativa).toBe(false);
  });
});

// ── DOSSIÊ DE INTEGRIDADE (2026-08-26) ───────────────────────────────────────
import { createHash } from 'node:crypto';
import { zipStore } from '../util/zip.js';

function zipDossie(sums: string, relatorio?: object): { zip: Buffer; hashRaiz: string } {
  const arquivos = [
    { name: 'SHA256SUMS.txt', content: sums },
    { name: 'RELATORIO.html', content: '<html>ok</html>' },
    ...(relatorio !== undefined
      ? [{ name: 'relatorio.json', content: JSON.stringify(relatorio) }]
      : []),
  ];
  return {
    zip: zipStore(arquivos),
    hashRaiz: createHash('sha256').update(sums).digest('hex'),
  };
}

function mediaFake(): {
  has(s: string): Promise<boolean>;
  put(b: { sha256: string; mime: string; size: number; bytes: Uint8Array }): Promise<void>;
  read(
    s: string,
  ): Promise<{ sha256: string; mime: string; size: number; bytes: Uint8Array } | null>;
  guardados(): number;
} {
  const blobs = new Map<
    string,
    { sha256: string; mime: string; size: number; bytes: Uint8Array }
  >();
  return {
    has: (s) => Promise.resolve(blobs.has(s)),
    put: (b) => {
      blobs.set(b.sha256, b);
      return Promise.resolve();
    },
    read: (s) => Promise.resolve(blobs.get(s) ?? null),
    guardados: () => blobs.size,
  };
}

describe('dossiê de integridade — debounce, verificação e versões', () => {
  const CPF = '01795790881';

  function bancadaDossie(respostas: { zip: Buffer; hashRaiz: string }[]) {
    const json = new InMemoryJsonStore();
    let t = AGORA.getTime();
    const relogio = { now: (): Date => new Date(t) };
    const media = mediaFake();
    const { client } = clienteFalso([]);
    const clientComDossie = Object.assign(client, {
      baixarDossie: (cpf: string) => {
        const r = respostas.shift();
        if (r === undefined)
          return Promise.resolve({ ok: false as const, status: 404, erro: 'sem dossiê' });
        return Promise.resolve({
          ok: true as const,
          bytes: r.zip,
          hashRaiz: r.hashRaiz,
          cpf,
          geradoEm: relogio.now().toISOString(),
          nomeArquivo: `dossie-jose-${cpf}.zip`,
        });
      },
    });
    const svc = new CorvoService({
      json,
      clock: relogio,
      client: clientComDossie,
      webhookSecret: SEGREDO,
      chaveCredencial: 'chave-de-teste',
      observability: obs,
      cpfDe: () => Promise.resolve(CPF),
      contratosDe: () => Promise.resolve([CONTRATO]),
      documentosDe: () => Promise.resolve([DOC]),
      media,
    });
    return { svc, json, media, avancar: (ms: number) => (t += ms) };
  }

  it('evento com dados.dossie enfileira; o download espera a rajada ASSENTAR (2 min)', async () => {
    const { zip, hashRaiz } = zipDossie('abc  a.eml\n', { envios: [1, 2], respostas: [1] });
    const b = bancadaDossie([{ zip, hashRaiz }]);
    await b.svc.agendarEnvio('cli-1', '5531999@c.us', 'JOSÉ');
    await b.svc.varrerEEnviar(); // importação liga o CPF ao clienteId
    await b.svc.processarEvento({
      id: 'e-d1',
      tipo: 'banco.resposta',
      ocorridoEm: '',
      dados: {
        respostaId: 'r-d1',
        tipo: 'RESPOSTA',
        cliente: { nome: 'JOSÉ', cpf: CPF },
        dossie: { cpf: CPF, url: 'https://corvo/api/integracao/dossie/' + CPF },
      },
    });
    // Ainda dentro da rajada: NÃO baixa.
    expect(await b.svc.processarFilaDeDossies()).toEqual({ baixados: 0 });
    // 2 min de silêncio: baixa, verifica e grava LIGADO ao cliente.
    b.avancar(2 * 60_000 + 1);
    expect(await b.svc.processarFilaDeDossies()).toEqual({ baixados: 1 });
    const versoes = await b.svc.dossiesDe(CPF);
    expect(versoes).toHaveLength(1);
    expect(versoes[0]?.clienteId).toBe('cli-1');
    expect(versoes[0]?.hashRaiz).toBe(hashRaiz);
    expect(versoes[0]?.resumo).toEqual({ envios: 2, respostas: 1, bancos: [], documentos: null });
    expect(b.media.guardados()).toBe(1); // o ZIP está no storage privado
    // O ZIP volta ÍNTEGRO para o download autenticado.
    const baixado = await b.svc.zipDoDossie(CPF, hashRaiz);
    expect(baixado?.bytes.equals(zip)).toBe(true);
    // A fila esvaziou.
    expect(await b.svc.processarFilaDeDossies()).toEqual({ baixados: 0 });
  });

  it('hash-raiz divergente ⇒ dossiê DESCARTADO: nada gravado, nada no storage', async () => {
    const { zip } = zipDossie('conteudo-real\n');
    const b = bancadaDossie([{ zip, hashRaiz: 'f'.repeat(64) }]); // header mentiroso
    const r = await b.svc.baixarEGuardarDossie(CPF, null);
    expect(r.ok).toBe(false);
    expect(await b.svc.dossiesDe(CPF)).toHaveLength(0);
    expect(b.media.guardados()).toBe(0);
  });

  it('mesma versão de novo ⇒ 1 linha (idempotência por cpf+hash-raiz); versão nova ⇒ 2 linhas', async () => {
    const v1 = zipDossie('v1  a.eml\n');
    const v2 = zipDossie('v1  a.eml\nv2  b.eml\n');
    const b = bancadaDossie([v1, v1, v2]);
    expect((await b.svc.baixarEGuardarDossie(CPF, null)).novo).toBe(true);
    expect((await b.svc.baixarEGuardarDossie(CPF, null)).novo).toBe(false); // não mudou
    expect(await b.svc.dossiesDe(CPF)).toHaveLength(1);
    expect((await b.svc.baixarEGuardarDossie(CPF, null)).novo).toBe(true); // cresceu
    expect(await b.svc.dossiesDe(CPF)).toHaveLength(2); // histórico preservado
  });

  it('CPF sem cliente ⇒ grava mesmo assim com clienteId null (conciliação manual)', async () => {
    const v = zipDossie('x  a.eml\n');
    const b = bancadaDossie([v]);
    // SEM varrerEEnviar: nenhuma importação liga o CPF a um cliente.
    expect((await b.svc.baixarEGuardarDossie(CPF, null)).ok).toBe(true);
    expect((await b.svc.dossiesDe(CPF))[0]?.clienteId).toBe(null);
  });

  it('sem SHA256SUMS.txt no ZIP ⇒ descartado', async () => {
    const semSums = zipStore([{ name: 'RELATORIO.html', content: '<html>' }]);
    const b = bancadaDossie([{ zip: semSums, hashRaiz: 'a'.repeat(64) }]);
    expect((await b.svc.baixarEGuardarDossie(CPF, null)).ok).toBe(false);
    expect(await b.svc.dossiesDe(CPF)).toHaveLength(0);
  });
});

// ── PONTE COM A PERÍCIA (2026-08-28): a credencial da caixa vai ao card ──────
describe('caixa.criada — ponte da credencial para o card do pedido', () => {
  it('cliente conhecido ⇒ propaga chatId + email + senha (em claro, para o card)', async () => {
    const { client } = clienteFalso([]);
    const propagadas: { chatId: string; email: string; senha: string }[] = [];
    const { svc } = servico({
      client,
      aoReceberCredencial: (chatId, cred) => {
        propagadas.push({ chatId, ...cred });
        return Promise.resolve();
      },
    });
    await agendar(svc);
    await svc.varrerEEnviar(); // a importação liga o CPF ao chatId
    await svc.processarEvento({
      id: 'e-cx-ponte',
      tipo: 'caixa.criada',
      ocorridoEm: '',
      dados: {
        cliente: { nome: 'JOSÉ', cpf: '01795790881' },
        email: 'jose@corvo.mail',
        senha: 'S3nh@-da-caixa',
      },
    });
    expect(propagadas).toEqual([
      { chatId: '5531999@c.us', email: 'jose@corvo.mail', senha: 'S3nh@-da-caixa' },
    ]);
    // E a leitura por CHAT (varredura retroativa) decifra a mesma credencial.
    expect(await svc.credencialDoChat('5531999@c.us')).toEqual({
      email: 'jose@corvo.mail',
      senha: 'S3nh@-da-caixa',
    });
  });

  it('sem senha guardada ⇒ credencialDoChat devolve null (nunca inventa)', async () => {
    const { svc } = servico();
    expect(await svc.credencialDoChat('5531999@c.us')).toBe(null);
  });
});
