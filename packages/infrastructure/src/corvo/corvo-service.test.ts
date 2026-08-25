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
  type MesaParaCorvo,
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
const NA_MESA: MesaParaCorvo = {
  clienteId: 'cli-1',
  chatId: '5531999@c.us',
  nome: 'JOSÉ',
  completo: true,
  descartado: false,
};

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
    mesa: () => Promise.resolve([NA_MESA]),
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

describe('varrerEEnviar — idempotência e retry do envio', () => {
  it('envia o completo, guarda ENVIADO e NÃO reenvia sem conteúdo novo', async () => {
    const { client, envios } = clienteFalso([]);
    const { svc, json } = servico({ client });
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 1, erros: 0 });
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 0 }); // nada novo
    expect(envios).toHaveLength(1);
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
    await svc.varrerEEnviar();
    await svc.varrerEEnviar();
    expect(envios).toHaveLength(2);
    expect(envios[0]?.key).not.toBe(envios[1]?.key); // conteúdo novo, key nova
  });

  it('falha 5xx agenda retry com a MESMA key; sucesso depois zera o backoff', async () => {
    const { client, envios } = clienteFalso([
      { ok: false, status: 500, erro: 'instável', permanente: false, conflitoDeChave: false },
    ]);
    const { svc, json } = servico({ client });
    expect(await svc.varrerEEnviar()).toEqual({ enviados: 0, erros: 1 });
    const imp = (await json.get('corvo-importacoes', 'cli-1')) as ImportacaoCorvo;
    expect(imp.estado).toBe('PENDENTE');
    expect(imp.proximaTentativaEm).not.toBe(null); // backoff agendado
    // Dentro do backoff a varredura NÃO tenta de novo.
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
