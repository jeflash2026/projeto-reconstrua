// ─────────────────────────────────────────────────────────────────────────────
// CORVO SERVICE (integração 2026-08-25) — o cérebro da integração com o Corvo,
// a operação de correspondência que notifica bancos a partir dos contratos
// consignados do cliente. Fluxo:
//
//   1. Cliente com documentação COMPLETA na mesa do Humanizado → a varredura
//      monta o ZIP (planilha + HISCON + procuração + RG + comprovante) e envia;
//   2. O Corvo cria a caixa de e-mail do cliente e devolve a credencial por
//      webhook; depois repassa cada envio a banco e cada resposta que chega.
//
// Disciplinas:
//   • IDEMPOTÊNCIA dos dois lados: envio com X-Idempotency-Key estável por
//     cliente+versão do conteúdo; webhook com dedupe por id de evento;
//   • a SENHA da caixa só existe cifrada (AES-256-GCM, chave derivada de env);
//     nunca em log; revelar é ação explícita com trilha na observabilidade;
//   • FAIL-CLOSED: sem segredo de webhook, tudo é 401; sem API key, a varredura
//     não envia nada (a tela do Admin mostra "integração desligada");
//   • retry com backoff (1m, 5m, 30m; máx. 5) na MESMA key; 409 gera key nova;
//     erro 4xx permanente para e espera ação do operador (ou conteúdo novo);
//   • RECONCILIAÇÃO: GET /eventos reprocessa qualquer evento perdido com o
//     MESMO handler do webhook (nada tem dois caminhos de escrita).
// ─────────────────────────────────────────────────────────────────────────────
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import { lerArquivoDoZip } from '../util/zip.js';
import type { CorvoClient, BancoDoLead, EventoCorvo } from './corvo-client.js';
import { montarZipDoLead, type ContratoDoLead, type DocumentoDoLead } from './corvo-zip.js';

const NS_IMPORTACOES = 'corvo-importacoes'; // chave: clienteId
const NS_CAIXAS = 'corvo-caixas'; // chave: cpf (11 dígitos)
const NS_ENVIOS = 'corvo-envios'; // chave: envioId
const NS_RESPOSTAS = 'corvo-respostas'; // chave: respostaId
const NS_ENTREGAS = 'corvo-webhook-entregas'; // chave: id do evento (dedupe)
const NS_ANEXOS = 'corvo-anexos'; // chave: `${respostaId}:${indice}`
const NS_ESTADO = 'corvo-estado'; // chave: 'reconciliacao'
const NS_DOSSIES = 'corvo-dossies'; // chave: `${cpf}:${hashRaiz}` (uma linha por VERSÃO)
const NS_DOSSIE_FILA = 'corvo-dossie-fila'; // chave: cpf (debounce do download)
const NS_ENVIO_FILA = 'corvo-envio-fila'; // chave: clienteId (gatilho: perícia iniciada)

/** Debounce do dossiê: vários eventos do mesmo CPF em sequência ⇒ UM download
 *  ao final da rajada (2 min de silêncio) — com teto de 10 min de espera. */
const DOSSIE_SILENCIO_MS = 2 * 60_000;
const DOSSIE_TETO_ESPERA_MS = 10 * 60_000;

/** Backoff dos envios transitórios (a partir daí, repete o último). */
const BACKOFF_MS = [60_000, 300_000, 1_800_000] as const;
const MAX_TENTATIVAS = 5;
/** Anexo maior que isto não é guardado em base (fica o proxy sob demanda). */
const TETO_ANEXO_BYTES = 8 * 1024 * 1024;
const TETO_ZIP_BYTES = 100 * 1024 * 1024;
/** Tolerância do anti-replay do webhook (contrato: 300s). */
const TOLERANCIA_REPLAY_S = 300;

// ── Verificação da assinatura do webhook (pura — testável isolada) ────────────

export type VereditoAssinatura = 'ok' | 'assinatura-invalida' | 'expirado';

export function verificarAssinaturaCorvo(
  segredo: string,
  corpoBruto: Buffer,
  timestampSeg: string,
  assinatura: string,
  agoraMs: number,
): VereditoAssinatura {
  if (segredo === '') return 'assinatura-invalida'; // fail-closed
  const ts = Number(timestampSeg);
  if (!Number.isFinite(ts) || Math.abs(agoraMs / 1000 - ts) > TOLERANCIA_REPLAY_S)
    return 'expirado';
  const esperado = createHmac('sha256', segredo)
    .update(`${timestampSeg}.`)
    .update(corpoBruto)
    .digest('hex');
  const recebido = assinatura.startsWith('v1=') ? assinatura.slice(3) : '';
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(recebido, 'utf8');
  // Comparação em tempo constante sem vazar o tamanho (compara sempre).
  if (a.length !== b.length) return 'assinatura-invalida';
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0 ? 'ok' : 'assinatura-invalida';
}

// ── Tipos persistidos ─────────────────────────────────────────────────────────

export type EstadoImportacao =
  'PENDENTE' | 'ENVIADO' | 'ERRO' | 'SEM_CPF' | 'SEM_CONTRATOS' | 'SEM_DOCUMENTOS';

export interface ImportacaoCorvo {
  readonly clienteId: string;
  readonly chatId: string;
  readonly nome: string;
  readonly cpf: string | null;
  /** Hash do conteúdo (docs + contratos): mudou ⇒ reenvia em modo mesclar. */
  readonly assinatura: string;
  readonly idempotencyKey: string;
  /** Sal incrementado quando o Corvo devolve 409 (key reusada c/ conteúdo novo). */
  readonly salDaChave: number;
  readonly estado: EstadoImportacao;
  readonly tentativas: number;
  readonly proximaTentativaEm: string | null;
  readonly ultimoErro: string | null;
  readonly enviadoEm: string | null;
  readonly importacaoId: string | null;
  readonly bancos: readonly BancoDoLead[];
  readonly caixaStatus: string | null;
  readonly recebidoPeloCorvoEm: string | null;
}

interface SenhaCifrada {
  readonly iv: string;
  readonly tag: string;
  readonly dados: string;
}

export interface CaixaCorvo {
  readonly cpf: string;
  readonly nome: string | null;
  readonly email: string;
  readonly senha: SenhaCifrada | null;
  readonly imap: unknown;
  readonly smtp: unknown;
  readonly webmail: string | null;
  readonly criadaEm: string | null;
}

export interface EnvioCorvo {
  readonly envioId: string;
  readonly cpf: string | null;
  readonly cliente: string | null;
  readonly banco: { readonly codigo: string; readonly nome: string } | null;
  readonly para: string | null;
  readonly assunto: string | null;
  readonly caixaEmail: string | null;
  readonly enviadoEm: string | null;
  readonly messageId: string | null;
}

export interface AnexoResposta {
  readonly nome: string;
  readonly tipo: string;
  readonly tamanho: number;
  readonly url: string;
}

export interface RespostaCorvo {
  readonly respostaId: string;
  readonly envioId: string | null;
  /** 'RESPOSTA' | 'BOUNCE' | 'BACEN' — aberto para tipos futuros do Corvo. */
  readonly tipo: string;
  readonly cpf: string | null;
  readonly cliente: string | null;
  readonly banco: { readonly codigo: string; readonly nome: string } | null;
  readonly de: string | null;
  readonly assunto: string | null;
  readonly recebidaEm: string | null;
  readonly caixaEmail: string | null;
  readonly corpoTexto: string | null;
  readonly anexos: readonly AnexoResposta[];
}

/** Uma VERSÃO do dossiê de integridade — nunca sobrescrita (histórico probatório). */
export interface DossieCorvo {
  readonly cpf: string;
  /** Resolvido pelo CPF na hora do download; null = conciliação manual. */
  readonly clienteId: string | null;
  readonly hashRaiz: string;
  readonly hashZip: string;
  readonly geradoEm: string;
  readonly nomeArquivo: string;
  readonly tamanho: number;
  readonly resumo: {
    readonly envios: number | null;
    readonly respostas: number | null;
    readonly bancos: readonly string[];
    readonly documentos: number | null;
  };
  readonly eventoOrigemId: string | null;
  readonly baixadoEm: string;
}

// ── Dependências (o build-production liga cada uma às fontes reais) ───────────

/** Um pedido de envio na fila — nasce no gatilho (perícia iniciada) ou no
 *  botão Reenviar do Admin. Nunca mais uma varredura da base inteira. */
export interface PedidoDeEnvio {
  readonly clienteId: string;
  readonly chatId: string;
  readonly nome: string;
}

/** Documento coletado com uma referência ESTÁVEL (id/sha) — é o que entra na
 *  assinatura de conteúdo, para detectar "documento novo" sem re-hashear bytes. */
export interface DocumentoColetado extends DocumentoDoLead {
  readonly ref: string;
}

export interface CorvoObservabilidade {
  event(component: string, name: string, at: Date, detail?: string | null): void;
  error(component: string, name: string, at: Date, detail: string): void;
}

export interface CorvoDeps {
  readonly json: JsonStore;
  readonly clock: Clock;
  /** null = integração desligada (sem CORVO_API_KEY) — nada sai, tela avisa. */
  readonly client: CorvoClient | null;
  readonly webhookSecret: string;
  /** Base da chave AES da credencial (env dedicada; derivada por sha256). */
  readonly chaveCredencial: string;
  readonly observability: CorvoObservabilidade;
  readonly cpfDe: (chatId: string) => Promise<string | null>;
  /** Contratos SELECIONADOS pelo guia (os que viram processo). null = ilegível. */
  readonly contratosDe: (chatId: string) => Promise<readonly ContratoDoLead[] | null>;
  readonly documentosDe: (chatId: string) => Promise<readonly DocumentoColetado[]>;
  /** PONTE COM A PERÍCIA (2026-08-28): a credencial da caixa recém-chegada é
   *  propagada ao registro do fluxo (o card "Credenciais do pedido" do perito
   *  e do advogado) — só preenche quando vazio; falha nunca derruba o webhook. */
  readonly aoReceberCredencial?: (
    chatId: string,
    cred: { email: string; senha: string },
  ) => Promise<void>;
  /** Storage PRIVADO dos ZIPs do dossiê (content-addressed por sha256) — o
   *  media store da produção. Ausente ⇒ dossiês desligados (metadata nunca
   *  aponta para um blob que não existe). */
  readonly media?: {
    has(sha256: string): Promise<boolean>;
    put(blob: { sha256: string; mime: string; size: number; bytes: Uint8Array }): Promise<void>;
    read(
      sha256: string,
    ): Promise<{ sha256: string; mime: string; size: number; bytes: Uint8Array } | null>;
  };
}

export class CorvoService {
  private readonly chaveAes: Buffer;

  constructor(private readonly deps: CorvoDeps) {
    this.chaveAes = createHash('sha256').update(deps.chaveCredencial).digest();
  }

  get ativa(): boolean {
    return this.deps.client !== null && this.deps.webhookSecret !== '';
  }

  // ── A. Envio do lead ────────────────────────────────────────────────────────
  // GATILHO NOVO (2026-08-27, acerto com o Corvo): o lead sai quando a PERÍCIA
  // INICIA (Aguardando → Em perícia) — a notificação extrajudicial É o pedido
  // administrativo, e o Corvo agora dispara sozinho ao receber. Nada de varrer
  // a base inteira: só a FILA, alimentada pelo gatilho e pelo Reenviar manual.

  /** Entra na fila de envio (idempotente por clienteId). */
  async agendarEnvio(clienteId: string, chatId: string, nome: string): Promise<void> {
    await this.deps.json.put(NS_ENVIO_FILA, clienteId, {
      clienteId,
      chatId,
      nome,
      pedidoEm: this.deps.clock.now().toISOString(),
    });
  }

  /** Processa a fila (job de 5 min). Sequencial de propósito (single-thread).
   *  Fica na fila só quem AGUARDA (backoff de transitório); estados de bloqueio
   *  (sem CPF/contratos/docs) saem — aparecem na tela e voltam pelo Reenviar. */
  async varrerEEnviar(): Promise<{ enviados: number; erros: number }> {
    if (this.deps.client === null) return { enviados: 0, erros: 0 };
    const agora = this.deps.clock.now();
    let enviados = 0;
    let erros = 0;
    const fila = (await this.deps.json.list(NS_ENVIO_FILA)) as readonly PedidoDeEnvio[];
    for (const m of fila) {
      try {
        const r = await this.enviarCliente(m, agora);
        if (r === 'enviado') enviados += 1;
        if (r === 'erro-permanente' || r === 'erro-transitorio') erros += 1;
        if (r !== 'aguarda' && r !== 'erro-transitorio')
          await this.deps.json.del(NS_ENVIO_FILA, m.clienteId);
      } catch (e) {
        erros += 1;
        this.deps.observability.error(
          'corvo',
          'envio',
          agora,
          `cliente=${m.clienteId} ${e instanceof Error ? e.message : 'falha'}`,
        );
      }
    }
    return { enviados, erros };
  }

  private async enviarCliente(
    m: PedidoDeEnvio,
    agora: Date,
  ): Promise<'enviado' | 'erro-permanente' | 'erro-transitorio' | 'aguarda' | 'nada'> {
    if (this.deps.client === null) return 'nada';
    const anterior = (await this.deps.json.get(NS_IMPORTACOES, m.clienteId)) as
      (ImportacaoCorvo & { salDaChave?: number }) | null;
    // Backoff em andamento: respeita a agenda (fica na fila até a hora).
    if (
      anterior !== null &&
      anterior.proximaTentativaEm !== null &&
      new Date(anterior.proximaTentativaEm).getTime() > agora.getTime()
    )
      return 'aguarda';

    const cpf = ((await this.deps.cpfDe(m.chatId)) ?? '').replace(/\D/g, '');
    if (cpf.length !== 11) {
      await this.salvarEstado(m, anterior, { estado: 'SEM_CPF', cpf: null }, agora);
      return 'nada';
    }
    const contratos = await this.deps.contratosDe(m.chatId);
    if (contratos === null || contratos.length === 0) {
      await this.salvarEstado(m, anterior, { estado: 'SEM_CONTRATOS', cpf }, agora);
      return 'nada';
    }
    const documentos = await this.deps.documentosDe(m.chatId);
    if (documentos.length === 0) {
      await this.salvarEstado(m, anterior, { estado: 'SEM_DOCUMENTOS', cpf }, agora);
      return 'nada';
    }

    // Assinatura de conteúdo — registro do QUE foi enviado. Entrar na fila é um
    // EVENTO deliberado (perícia iniciada / Reenviar): o POST sai SEMPRE — para
    // o Corvo ele é o sinal de disparo das notificações, não só sincronização.
    // (Incidente 2026-08-27: os 7 aguardando-perícia já estavam ENVIADO da
    // remessa anterior e a trava de "conteúdo igual" engolia o POST do gatilho.)
    const assinatura = createHash('sha256')
      .update(
        JSON.stringify({
          versao: 3,
          cpf,
          contratos: contratos
            .map((c) => `${c.contrato}|${c.bancoCodigo ?? ''}|${c.situacao ?? ''}`)
            .sort(),
          documentos: documentos.map((d) => `${d.categoria}:${d.ref}`).sort(),
        }),
      )
      .digest('hex');

    const zip = montarZipDoLead(m.nome, cpf, contratos, documentos);
    if (zip.length > TETO_ZIP_BYTES) {
      await this.salvarEstado(
        m,
        anterior,
        { estado: 'ERRO', cpf, assinatura, ultimoErro: 'ZIP acima de 100 MB' },
        agora,
      );
      return 'erro-permanente';
    }
    // Chave de idempotência no FORMATO ACORDADO com o Corvo (2026-08-27):
    // lead:<cpf>:<sha256 dos bytes do zip, 16 hex>.
    //   • RETRY de falha (estado != ENVIADO) reusa a MESMA chave — replay
    //     inofensivo lá;
    //   • REENVIO deliberado de pacote IDÊNTICO ao último ENVIADO ganha sufixo
    //     :rN — sem isso a chave repetida cairia na janela de replay de 24h e o
    //     Corvo NÃO dispararia nada (o POST-sinal viraria silêncio);
    //   • 409 (chave reusada com conteúdo diferente) também incrementa o sal.
    const hashZip16 = createHash('sha256').update(zip).digest('hex').slice(0, 16);
    const base = `lead:${cpf}:${hashZip16}`;
    const baseAnterior = anterior?.idempotencyKey.replace(/:r\d+$/, '') ?? null;
    let sal = anterior?.salDaChave ?? 0;
    if (baseAnterior === base && anterior?.estado === 'ENVIADO') sal += 1;
    const idempotencyKey = sal > 0 ? `${base}:r${String(sal)}` : base;
    const resultado = await this.deps.client.enviarZip(zip, idempotencyKey);
    if (resultado.ok) {
      const cliente = resultado.corpo.clientes[0] ?? null;
      await this.deps.json.put(NS_IMPORTACOES, m.clienteId, {
        clienteId: m.clienteId,
        chatId: m.chatId,
        nome: m.nome,
        cpf,
        assinatura,
        idempotencyKey,
        salDaChave: sal,
        estado: 'ENVIADO',
        tentativas: 0,
        proximaTentativaEm: null,
        ultimoErro: null,
        enviadoEm: agora.toISOString(),
        importacaoId: resultado.corpo.importacaoId,
        bancos: cliente?.bancos ?? [],
        caixaStatus: cliente?.caixa.status ?? null,
        recebidoPeloCorvoEm: anterior?.recebidoPeloCorvoEm ?? null,
      } satisfies ImportacaoCorvo);
      this.deps.observability.event(
        'corvo',
        'lead-enviado',
        agora,
        `cliente=${m.nome} bancos=${String(cliente?.bancos.length ?? 0)} contratos=${String(contratos.length)}`,
      );
      return 'enviado';
    }

    // Falhou: 409 troca a chave; 4xx permanente para; transitório agenda retry.
    const tentativas = (anterior?.tentativas ?? 0) + 1;
    const esgotou = tentativas >= MAX_TENTATIVAS;
    const permanente = resultado.permanente || (esgotou && !resultado.conflitoDeChave);
    const backoff = BACKOFF_MS[Math.min(tentativas - 1, BACKOFF_MS.length - 1)] ?? 1_800_000;
    await this.deps.json.put(NS_IMPORTACOES, m.clienteId, {
      clienteId: m.clienteId,
      chatId: m.chatId,
      nome: m.nome,
      cpf,
      assinatura,
      idempotencyKey,
      salDaChave: resultado.conflitoDeChave ? sal + 1 : sal,
      estado: permanente ? 'ERRO' : 'PENDENTE',
      tentativas,
      proximaTentativaEm: permanente ? null : new Date(agora.getTime() + backoff).toISOString(),
      ultimoErro: `HTTP ${String(resultado.status ?? 'rede')}: ${resultado.erro}`,
      enviadoEm: anterior?.enviadoEm ?? null,
      importacaoId: anterior?.importacaoId ?? null,
      bancos: anterior?.bancos ?? [],
      caixaStatus: anterior?.caixaStatus ?? null,
      recebidoPeloCorvoEm: anterior?.recebidoPeloCorvoEm ?? null,
    } satisfies ImportacaoCorvo);
    this.deps.observability.error(
      'corvo',
      'envio',
      agora,
      `cliente=${m.nome} tentativa=${String(tentativas)} ${resultado.erro.slice(0, 120)}`,
    );
    return permanente ? 'erro-permanente' : 'erro-transitorio';
  }

  private async salvarEstado(
    m: PedidoDeEnvio,
    anterior: ImportacaoCorvo | null,
    mudanca: Partial<ImportacaoCorvo> & { estado: EstadoImportacao },
    agora: Date,
  ): Promise<void> {
    // Estados de bloqueio (sem CPF/contratos/docs) não apagam um envio que já
    // aconteceu — só aparecem quando o cliente nunca foi enviado.
    if (anterior !== null && anterior.estado === 'ENVIADO' && mudanca.estado !== 'ERRO') return;
    await this.deps.json.put(NS_IMPORTACOES, m.clienteId, {
      clienteId: m.clienteId,
      chatId: m.chatId,
      nome: m.nome,
      cpf: anterior?.cpf ?? null,
      assinatura: anterior?.assinatura ?? '',
      idempotencyKey: anterior?.idempotencyKey ?? '',
      salDaChave: anterior?.salDaChave ?? 0,
      tentativas: anterior?.tentativas ?? 0,
      proximaTentativaEm: null,
      ultimoErro: null,
      enviadoEm: anterior?.enviadoEm ?? null,
      importacaoId: anterior?.importacaoId ?? null,
      bancos: anterior?.bancos ?? [],
      caixaStatus: anterior?.caixaStatus ?? null,
      recebidoPeloCorvoEm: anterior?.recebidoPeloCorvoEm ?? null,
      ...mudanca,
    } satisfies ImportacaoCorvo);
    void agora;
  }

  /** Ação do Admin: zera a assinatura E recoloca o cliente na fila — o próximo
   *  ciclo reenvia do zero (gatilho manual; a fila não anda sozinha). */
  async forcarReenvio(clienteId: string): Promise<{ ok: boolean }> {
    const imp = (await this.deps.json.get(NS_IMPORTACOES, clienteId)) as ImportacaoCorvo | null;
    if (imp === null) return { ok: false };
    await this.deps.json.put(NS_IMPORTACOES, clienteId, {
      ...imp,
      assinatura: '',
      estado: 'PENDENTE',
      tentativas: 0,
      proximaTentativaEm: null,
      ultimoErro: null,
    } satisfies ImportacaoCorvo);
    await this.agendarEnvio(clienteId, imp.chatId, imp.nome);
    return { ok: true };
  }

  // ── B. Webhook (Corvo → cá) ─────────────────────────────────────────────────

  /** Verificação + dedupe + processamento. O corpo chega BRUTO (bytes). */
  async receberWebhook(
    corpoBruto: Buffer,
    headers: Readonly<Record<string, unknown>>,
  ): Promise<{ status: number; corpo: unknown }> {
    const agora = this.deps.clock.now();
    const timestamp =
      typeof headers['x-corvo-timestamp'] === 'string' ? headers['x-corvo-timestamp'] : '';
    const assinatura =
      typeof headers['x-corvo-signature'] === 'string' ? headers['x-corvo-signature'] : '';
    const veredito = verificarAssinaturaCorvo(
      this.deps.webhookSecret,
      corpoBruto,
      timestamp,
      assinatura,
      agora.getTime(),
    );
    if (veredito !== 'ok') {
      this.deps.observability.error('corvo', 'webhook-recusado', agora, veredito);
      return { status: 401, corpo: { error: veredito } };
    }
    let evento: EventoCorvo;
    try {
      evento = JSON.parse(corpoBruto.toString('utf8')) as EventoCorvo;
    } catch {
      return { status: 400, corpo: { error: 'JSON inválido' } };
    }
    if (typeof evento.id !== 'string' || evento.id === '')
      return { status: 400, corpo: { error: 'evento sem id' } };

    // Idempotência: entrega já processada responde 200 sem reprocessar.
    const entregue = await this.deps.json.get(NS_ENTREGAS, evento.id);
    if (entregue !== null) return { status: 200, corpo: { ok: true, repetido: true } };

    try {
      await this.processarEvento(evento);
    } catch (e) {
      // Não marca a entrega: o retry do Corvo (1m…24h) reprocessa.
      this.deps.observability.error(
        'corvo',
        'webhook-falhou',
        agora,
        `${evento.tipo} ${e instanceof Error ? e.message : 'falha'}`,
      );
      return { status: 500, corpo: { error: 'falha ao processar' } };
    }
    await this.deps.json.put(NS_ENTREGAS, evento.id, {
      id: evento.id,
      tipo: evento.tipo,
      ocorridoEm: evento.ocorridoEm,
      processadoEm: agora.toISOString(),
    });
    // Anexos descem DEPOIS do 200 (o contrato pede resposta < 5s); falha aqui
    // não perde nada — o download por demanda cobre.
    if (evento.tipo === 'banco.resposta') void this.baixarAnexosEmFundo(evento);
    return { status: 200, corpo: { ok: true } };
  }

  /** Um único handler para webhook E reconciliação — nunca dois caminhos. */
  async processarEvento(evento: EventoCorvo): Promise<void> {
    const agora = this.deps.clock.now();
    const dados = (evento.dados ?? {}) as Record<string, unknown>;
    switch (evento.tipo) {
      case 'lead.recebido': {
        const cliente = (dados['cliente'] ?? {}) as { nome?: string; cpf?: string };
        const caixa = (dados['caixa'] ?? {}) as { status?: string };
        const imp = await this.importacaoPorCpf(cliente.cpf ?? '');
        if (imp !== null) {
          await this.deps.json.put(NS_IMPORTACOES, imp.clienteId, {
            ...imp,
            recebidoPeloCorvoEm: evento.ocorridoEm,
            bancos: (dados['bancos'] as readonly BancoDoLead[] | undefined) ?? imp.bancos,
            caixaStatus: caixa.status ?? imp.caixaStatus,
          } satisfies ImportacaoCorvo);
        }
        if (caixa.status === 'SEM_PROCURACAO')
          this.deps.observability.error(
            'corvo',
            'sem-procuracao',
            agora,
            `cliente=${cliente.nome ?? '?'} — o Corvo não achou a procuração no ZIP`,
          );
        break;
      }
      case 'caixa.criada': {
        const cliente = (dados['cliente'] ?? {}) as { nome?: string; cpf?: string };
        const cpf = (cliente.cpf ?? '').replace(/\D/g, '');
        if (cpf === '') break;
        const anterior = (await this.deps.json.get(NS_CAIXAS, cpf)) as CaixaCorvo | null;
        const senhaCrua = typeof dados['senha'] === 'string' ? dados['senha'] : null;
        await this.deps.json.put(NS_CAIXAS, cpf, {
          cpf,
          nome: cliente.nome ?? anterior?.nome ?? null,
          email: (dados['email'] as string | undefined) ?? anterior?.email ?? '',
          // A ÚNICA vez que a senha chega é aqui; na reconciliação vem null —
          // nunca sobrescrever uma senha guardada com nada.
          senha: senhaCrua !== null ? this.cifrar(senhaCrua) : (anterior?.senha ?? null),
          imap: dados['imap'] ?? anterior?.imap ?? null,
          smtp: dados['smtp'] ?? anterior?.smtp ?? null,
          webmail: (dados['webmail'] as string | undefined) ?? anterior?.webmail ?? null,
          criadaEm: (dados['criadaEm'] as string | undefined) ?? anterior?.criadaEm ?? null,
        } satisfies CaixaCorvo);
        const imp = await this.importacaoPorCpf(cpf);
        if (imp !== null) {
          await this.deps.json.put(NS_IMPORTACOES, imp.clienteId, {
            ...imp,
            caixaStatus: 'CRIADA',
          } satisfies ImportacaoCorvo);
          // PONTE COM A PERÍCIA (2026-08-28): a credencial vai NA HORA ao card
          // do perito/advogado quando o cliente já está em perícia (o caso
          // caixa-depois-da-perícia). Best-effort; a varredura de 5 min cobre
          // a ordem inversa e o retroativo.
          const senhaParaPericia =
            senhaCrua ??
            (anterior?.senha !== null && anterior !== null ? this.decifrar(anterior.senha) : null);
          const emailCaixa = (dados['email'] as string | undefined) ?? anterior?.email ?? '';
          if (senhaParaPericia !== null && emailCaixa !== '') {
            await this.deps
              .aoReceberCredencial?.(imp.chatId, { email: emailCaixa, senha: senhaParaPericia })
              .catch(() => undefined);
          }
        }
        this.deps.observability.event('corvo', 'caixa-criada', agora, `cpf=***${cpf.slice(-4)}`);
        break;
      }
      case 'banco.envio': {
        const envioId = dados['envioId'] as string | undefined;
        if (envioId === undefined) break;
        const cliente = (dados['cliente'] ?? {}) as { nome?: string; cpf?: string };
        await this.deps.json.put(NS_ENVIOS, envioId, {
          envioId,
          cpf: cliente.cpf?.replace(/\D/g, '') ?? null,
          cliente: cliente.nome ?? null,
          banco: (dados['banco'] as EnvioCorvo['banco']) ?? null,
          para: (dados['para'] as string | undefined) ?? null,
          assunto: (dados['assunto'] as string | undefined) ?? null,
          caixaEmail: (dados['caixaEmail'] as string | undefined) ?? null,
          enviadoEm: (dados['enviadoEm'] as string | undefined) ?? evento.ocorridoEm,
          messageId: (dados['messageId'] as string | undefined) ?? null,
        } satisfies EnvioCorvo);
        await this.agendarDossie(dados['dossie'], evento.id);
        break;
      }
      case 'banco.resposta': {
        const respostaId = dados['respostaId'] as string | undefined;
        if (respostaId === undefined) break;
        const cliente = dados['cliente'] as { nome?: string; cpf?: string } | null | undefined;
        await this.deps.json.put(NS_RESPOSTAS, respostaId, {
          respostaId,
          envioId: (dados['envioId'] as string | undefined) ?? null,
          tipo: (dados['tipo'] as string | undefined) ?? 'RESPOSTA',
          cpf: cliente?.cpf?.replace(/\D/g, '') ?? null,
          cliente: cliente?.nome ?? null,
          banco: (dados['banco'] as RespostaCorvo['banco']) ?? null,
          de: (dados['de'] as string | undefined) ?? null,
          assunto: (dados['assunto'] as string | undefined) ?? null,
          recebidaEm: (dados['recebidaEm'] as string | undefined) ?? evento.ocorridoEm,
          caixaEmail: (dados['caixaEmail'] as string | undefined) ?? null,
          corpoTexto: (dados['corpoTexto'] as string | undefined) ?? null,
          anexos: (dados['anexos'] as readonly AnexoResposta[] | undefined) ?? [],
        } satisfies RespostaCorvo);
        await this.agendarDossie(dados['dossie'], evento.id);
        const tipo = (dados['tipo'] as string | undefined) ?? 'RESPOSTA';
        if (tipo === 'BOUNCE')
          this.deps.observability.error(
            'corvo',
            'bounce',
            agora,
            `banco=${JSON.stringify(dados['banco'] ?? null)} — e-mail não entregue, trocar endereço`,
          );
        else this.deps.observability.event('corvo', `resposta-${tipo.toLowerCase()}`, agora);
        break;
      }
      case 'webhook.teste': {
        this.deps.observability.event('corvo', 'webhook-teste', agora);
        break;
      }
      default:
        // Evento desconhecido: aceita e registra (o contrato manda não falhar).
        this.deps.observability.event('corvo', 'evento-desconhecido', agora, evento.tipo);
    }
  }

  private async importacaoPorCpf(cpfBruto: string): Promise<ImportacaoCorvo | null> {
    const cpf = cpfBruto.replace(/\D/g, '');
    if (cpf === '') return null;
    const todas = (await this.deps.json.list(NS_IMPORTACOES)) as readonly ImportacaoCorvo[];
    return todas.find((i) => i.cpf === cpf) ?? null;
  }

  private async baixarAnexosEmFundo(evento: EventoCorvo): Promise<void> {
    if (this.deps.client === null) return;
    const dados = (evento.dados ?? {}) as Record<string, unknown>;
    const respostaId = dados['respostaId'] as string | undefined;
    const anexos = (dados['anexos'] as readonly AnexoResposta[] | undefined) ?? [];
    if (respostaId === undefined) return;
    for (const [i, a] of anexos.entries()) {
      try {
        if (a.tamanho > TETO_ANEXO_BYTES) continue; // fica no proxy sob demanda
        const baixado = await this.deps.client.baixarAnexo(a.url);
        if (baixado === null || baixado.bytes.length > TETO_ANEXO_BYTES) continue;
        await this.deps.json.put(NS_ANEXOS, `${respostaId}:${String(i)}`, {
          respostaId,
          indice: i,
          nome: a.nome,
          mime: baixado.mime,
          base64: baixado.bytes.toString('base64'),
        });
      } catch {
        // Sob demanda cobre; nada a fazer aqui.
      }
    }
  }

  /** Anexo de resposta: do nosso guardado; se não desceu ainda, busca no Corvo. */
  async anexoDaResposta(
    respostaId: string,
    indice: number,
  ): Promise<{ nome: string; mime: string; bytes: Buffer } | null> {
    const guardado = (await this.deps.json.get(NS_ANEXOS, `${respostaId}:${String(indice)}`)) as {
      nome: string;
      mime: string;
      base64: string;
    } | null;
    if (guardado !== null)
      return {
        nome: guardado.nome,
        mime: guardado.mime,
        bytes: Buffer.from(guardado.base64, 'base64'),
      };
    if (this.deps.client === null) return null;
    const resposta = (await this.deps.json.get(NS_RESPOSTAS, respostaId)) as RespostaCorvo | null;
    const anexo = resposta?.anexos[indice];
    if (anexo === undefined) return null;
    const baixado = await this.deps.client.baixarAnexo(anexo.url);
    if (baixado === null) return null;
    return { nome: anexo.nome, mime: baixado.mime, bytes: baixado.bytes };
  }

  // ── C. Reconciliação ────────────────────────────────────────────────────────

  /** Job de 15 min: repassa o feed de eventos e processa o que o webhook perdeu. */
  async reconciliar(): Promise<{ processados: number }> {
    if (this.deps.client === null) return { processados: 0 };
    const agora = this.deps.clock.now();
    const estado = (await this.deps.json.get(NS_ESTADO, 'reconciliacao')) as {
      ultimoOcorridoEm?: string;
    } | null;
    const ultimo =
      estado?.ultimoOcorridoEm ?? new Date(agora.getTime() - 24 * 3600_000).toISOString();
    const desde = new Date(new Date(ultimo).getTime() - 3600_000).toISOString();
    let cursor: string | null = null;
    let processados = 0;
    let maisRecente = ultimo;
    for (let pagina = 0; pagina < 10; pagina++) {
      const lote = await this.deps.client.listarEventos(desde, cursor);
      if (lote === null) break;
      for (const evento of lote.eventos) {
        if (evento.ocorridoEm > maisRecente) maisRecente = evento.ocorridoEm;
        if ((await this.deps.json.get(NS_ENTREGAS, evento.id)) !== null) continue;
        try {
          await this.processarEvento(evento);
          await this.deps.json.put(NS_ENTREGAS, evento.id, {
            id: evento.id,
            tipo: evento.tipo,
            ocorridoEm: evento.ocorridoEm,
            processadoEm: agora.toISOString(),
            viaReconciliacao: true,
          });
          processados += 1;
        } catch (e) {
          this.deps.observability.error(
            'corvo',
            'reconciliacao',
            agora,
            `${evento.tipo} ${e instanceof Error ? e.message : 'falha'}`,
          );
        }
      }
      cursor = lote.cursor;
      if (cursor === null || lote.eventos.length === 0) break;
    }
    await this.deps.json.put(NS_ESTADO, 'reconciliacao', { ultimoOcorridoEm: maisRecente });
    if (processados > 0)
      this.deps.observability.event(
        'corvo',
        'reconciliado',
        agora,
        `${String(processados)} evento(s) recuperado(s)`,
      );
    return { processados };
  }

  // ── D. Leituras do Admin (tela) + credencial ────────────────────────────────

  async visaoAdmin(): Promise<{
    ativa: boolean;
    importacoes: readonly ImportacaoCorvo[];
    totais: {
      enviados: number;
      pendentes: number;
      erros: number;
      caixas: number;
      respostas: number;
    };
  }> {
    const [importacoes, caixas, respostas] = await Promise.all([
      this.deps.json.list(NS_IMPORTACOES) as Promise<readonly ImportacaoCorvo[]>,
      this.deps.json.keys(NS_CAIXAS),
      this.deps.json.keys(NS_RESPOSTAS),
    ]);
    const ordenadas = [...importacoes].sort((a, b) =>
      (b.enviadoEm ?? '').localeCompare(a.enviadoEm ?? ''),
    );
    return {
      ativa: this.ativa,
      importacoes: ordenadas,
      totais: {
        enviados: importacoes.filter((i) => i.estado === 'ENVIADO').length,
        pendentes: importacoes.filter((i) => i.estado === 'PENDENTE').length,
        erros: importacoes.filter(
          (i) => i.estado === 'ERRO' || i.estado === 'SEM_CPF' || i.estado === 'SEM_CONTRATOS',
        ).length,
        caixas: caixas.length,
        respostas: respostas.length,
      },
    };
  }

  /** A timeline do cliente: caixa (SEM a senha), envios e respostas por banco. */
  async timelineDoCliente(clienteId: string): Promise<{
    importacao: ImportacaoCorvo | null;
    caixa: (Omit<CaixaCorvo, 'senha'> & { temSenha: boolean }) | null;
    envios: readonly EnvioCorvo[];
    respostas: readonly RespostaCorvo[];
    dossies: readonly DossieCorvo[];
  } | null> {
    const importacao = (await this.deps.json.get(
      NS_IMPORTACOES,
      clienteId,
    )) as ImportacaoCorvo | null;
    if (importacao === null) return null;
    const cpf = importacao.cpf;
    const caixaCrua =
      cpf !== null ? ((await this.deps.json.get(NS_CAIXAS, cpf)) as CaixaCorvo | null) : null;
    const caixa =
      caixaCrua === null
        ? null
        : {
            cpf: caixaCrua.cpf,
            nome: caixaCrua.nome,
            email: caixaCrua.email,
            imap: caixaCrua.imap,
            smtp: caixaCrua.smtp,
            webmail: caixaCrua.webmail,
            criadaEm: caixaCrua.criadaEm,
            temSenha: caixaCrua.senha !== null,
          };
    const [todosEnvios, todasRespostas] = await Promise.all([
      this.deps.json.list(NS_ENVIOS) as Promise<readonly EnvioCorvo[]>,
      this.deps.json.list(NS_RESPOSTAS) as Promise<readonly RespostaCorvo[]>,
    ]);
    const doCliente = (c: string | null, caixaEmail: string | null): boolean =>
      (cpf !== null && c === cpf) || (caixa !== null && caixaEmail === caixa.email);
    return {
      importacao,
      caixa,
      envios: todosEnvios
        .filter((e) => doCliente(e.cpf, e.caixaEmail))
        .sort((a, b) => (a.enviadoEm ?? '').localeCompare(b.enviadoEm ?? '')),
      respostas: todasRespostas
        .filter((r) => doCliente(r.cpf, r.caixaEmail))
        .sort((a, b) => (a.recebidaEm ?? '').localeCompare(b.recebidaEm ?? '')),
      dossies: cpf !== null ? await this.dossiesDe(cpf) : [],
    };
  }

  /** Revelar a senha da caixa é ATO EXPLÍCITO com trilha — nunca sai em lista. */
  async revelarSenha(cpf: string, quem: string): Promise<{ email: string; senha: string } | null> {
    const caixa = (await this.deps.json.get(
      NS_CAIXAS,
      cpf.replace(/\D/g, ''),
    )) as CaixaCorvo | null;
    if (caixa === null || caixa.senha === null) return null;
    const senha = this.decifrar(caixa.senha);
    if (senha === null) return null;
    this.deps.observability.event(
      'corvo',
      'senha-revelada',
      this.deps.clock.now(),
      `cpf=***${caixa.cpf.slice(-4)} por=${quem}`,
    );
    return { email: caixa.email, senha };
  }

  /** PONTE COM A PERÍCIA (2026-08-28): a credencial decifrada da caixa de um
   *  CHAT — consumo interno do sistema (propagação ao card do perito), não
   *  revelação a humano: por isso sem a trilha do revelarSenha. null = sem
   *  caixa, sem senha guardada ou cliente sem CPF. */
  async credencialDoChat(chatId: string): Promise<{ email: string; senha: string } | null> {
    const cpf = ((await this.deps.cpfDe(chatId)) ?? '').replace(/\D/g, '');
    if (cpf.length !== 11) return null;
    const caixa = (await this.deps.json.get(NS_CAIXAS, cpf)) as CaixaCorvo | null;
    if (caixa === null || caixa.senha === null || caixa.email === '') return null;
    const senha = this.decifrar(caixa.senha);
    return senha === null ? null : { email: caixa.email, senha };
  }

  /** Perdeu a credencial (ou a reconciliação trouxe senha null): pede reenvio. */
  async pedirReenvioDeCredencial(cpf: string): Promise<{ ok: boolean; erro?: string }> {
    if (this.deps.client === null) return { ok: false, erro: 'integração desligada' };
    return this.deps.client.reenviarCredencial(cpf.replace(/\D/g, ''));
  }

  // ── E. Dossiê de integridade (2026-08-26) ───────────────────────────────────
  // O Corvo empacota a cadeia de envio aos bancos (.eml + SHA256SUMS.txt +
  // relatorio.json). Aqui: DEBOUNCE por CPF (nunca dentro do webhook), download
  // com VERIFICAÇÃO obrigatória (hash-raiz), versão nova = linha nova (histórico
  // probatório, nada sobrescrito), ZIP no storage privado content-addressed.

  /** Chamado pelos handlers de banco.envio/banco.resposta (dados.dossie). */
  private async agendarDossie(dossieBruto: unknown, eventoId: string): Promise<void> {
    const dossie = dossieBruto as { cpf?: string } | null | undefined;
    const cpf = (dossie?.cpf ?? '').replace(/\D/g, '');
    if (cpf.length !== 11) return;
    const agora = this.deps.clock.now().toISOString();
    const anterior = (await this.deps.json.get(NS_DOSSIE_FILA, cpf)) as {
      primeiroEm?: string;
    } | null;
    await this.deps.json.put(NS_DOSSIE_FILA, cpf, {
      cpf,
      primeiroEm: anterior?.primeiroEm ?? agora,
      ultimoEm: agora,
      eventoOrigemId: eventoId,
    });
  }

  /** Job periódico (60s): baixa os CPFs cuja rajada de eventos assentou
   *  (2 min de silêncio) ou que esperam além do teto (10 min). */
  async processarFilaDeDossies(): Promise<{ baixados: number }> {
    if (this.deps.client === null || this.deps.media === undefined) return { baixados: 0 };
    const agora = this.deps.clock.now().getTime();
    const fila = (await this.deps.json.list(NS_DOSSIE_FILA)) as readonly {
      cpf: string;
      primeiroEm: string;
      ultimoEm: string;
      eventoOrigemId: string | null;
    }[];
    let baixados = 0;
    for (const pedido of fila) {
      const silencio = agora - new Date(pedido.ultimoEm).getTime();
      const espera = agora - new Date(pedido.primeiroEm).getTime();
      if (silencio < DOSSIE_SILENCIO_MS && espera < DOSSIE_TETO_ESPERA_MS) continue;
      const r = await this.baixarEGuardarDossie(pedido.cpf, pedido.eventoOrigemId);
      if (r.ok) {
        await this.deps.json.del(NS_DOSSIE_FILA, pedido.cpf);
        baixados += 1;
      } else {
        // Falha (rede/404): recomeça a contagem — nova tentativa em 2 min,
        // sem martelar o Corvo a cada tick.
        const carimbo = this.deps.clock.now().toISOString();
        await this.deps.json.put(NS_DOSSIE_FILA, pedido.cpf, {
          ...pedido,
          primeiroEm: carimbo,
          ultimoEm: carimbo,
        });
      }
    }
    return { baixados };
  }

  /** Download + verificação + gravação. Público: o botão "Atualizar dossiê"
   *  da ficha chama direto (sem debounce). */
  async baixarEGuardarDossie(
    cpfBruto: string,
    eventoOrigemId: string | null,
  ): Promise<{ ok: boolean; novo?: boolean; erro?: string }> {
    const cpf = cpfBruto.replace(/\D/g, '');
    if (this.deps.client === null || this.deps.media === undefined)
      return { ok: false, erro: 'integração desligada' };
    const agora = this.deps.clock.now();
    const r = await this.deps.client.baixarDossie(cpf);
    if (!r.ok) {
      this.deps.observability.error(
        'corvo',
        'dossie-download',
        agora,
        `cpf=***${cpf.slice(-4)} HTTP ${String(r.status ?? 'rede')}: ${r.erro}`,
      );
      return { ok: false, erro: r.erro };
    }
    // VERIFICAÇÃO OBRIGATÓRIA: sha256(SHA256SUMS.txt) === X-Dossie-Hash-Raiz.
    // Diverge ⇒ download corrompido/adulterado: DESCARTA, nada é gravado.
    const sums = lerArquivoDoZip(r.bytes, 'SHA256SUMS.txt');
    const hashSums = sums === null ? '' : createHash('sha256').update(sums).digest('hex');
    if (sums === null || r.hashRaiz === '' || hashSums !== r.hashRaiz) {
      this.deps.observability.error(
        'corvo',
        'dossie-integridade',
        agora,
        `cpf=***${cpf.slice(-4)} hash-raiz não confere (${sums === null ? 'sem SHA256SUMS.txt' : 'divergente'}) — dossiê DESCARTADO`,
      );
      return { ok: false, erro: 'hash-raiz não confere' };
    }
    const hashZip = createHash('sha256').update(r.bytes).digest('hex');
    const chave = `${cpf}:${r.hashRaiz}`;
    const existente = (await this.deps.json.get(NS_DOSSIES, chave)) as DossieCorvo | null;
    if (existente !== null) {
      // Idempotência por CONTEÚDO: mesma versão ⇒ só o carimbo de conferência.
      await this.deps.json.put(NS_DOSSIES, chave, {
        ...existente,
        baixadoEm: agora.toISOString(),
      } satisfies DossieCorvo);
      return { ok: true, novo: false };
    }
    // relatorio.json = índice estruturado (metadados sem parsear os .eml).
    let resumo: DossieCorvo['resumo'] = {
      envios: null,
      respostas: null,
      bancos: [],
      documentos: null,
    };
    const relatorioBruto = lerArquivoDoZip(r.bytes, 'relatorio.json');
    if (relatorioBruto !== null) {
      try {
        const rel = JSON.parse(relatorioBruto.toString('utf8')) as Record<string, unknown>;
        const contar = (x: unknown): number | null => (Array.isArray(x) ? x.length : null);
        const bancos = new Set<string>();
        for (const e of Array.isArray(rel['envios']) ? (rel['envios'] as unknown[]) : []) {
          const banco = (e as { banco?: { nome?: string } | string }).banco;
          const nome = typeof banco === 'string' ? banco : banco?.nome;
          if (typeof nome === 'string' && nome !== '') bancos.add(nome);
        }
        resumo = {
          envios: contar(rel['envios']),
          respostas: contar(rel['respostas']),
          bancos: [...bancos],
          documentos: contar(rel['documentos']),
        };
      } catch {
        // relatório ilegível não invalida o dossiê (o hash já conferiu)
      }
    }
    const clienteId = (await this.importacaoPorCpf(cpf))?.clienteId ?? null;
    await this.deps.media.put({
      sha256: hashZip,
      mime: 'application/zip',
      size: r.bytes.length,
      bytes: new Uint8Array(r.bytes),
    });
    await this.deps.json.put(NS_DOSSIES, chave, {
      cpf,
      clienteId,
      hashRaiz: r.hashRaiz,
      hashZip,
      geradoEm: r.geradoEm,
      nomeArquivo: r.nomeArquivo,
      tamanho: r.bytes.length,
      resumo,
      eventoOrigemId,
      baixadoEm: agora.toISOString(),
    } satisfies DossieCorvo);
    this.deps.observability.event(
      'corvo',
      clienteId === null ? 'dossie-sem-cliente' : 'dossie-guardado',
      agora,
      `cpf=***${cpf.slice(-4)} versao=${r.hashRaiz.slice(0, 12)}${clienteId === null ? ' — CONCILIAÇÃO MANUAL (CPF sem cliente)' : ''}`,
    );
    return { ok: true, novo: true };
  }

  /** Portal do ADVOGADO (2026-08-27): as versões do dossiê do cliente da
   *  missão dele — resolvidas pelo chat (o isolamento por atribuição é do
   *  chamador). null = cliente sem CPF na jornada. */
  async dossiesDoChat(
    chatId: string,
  ): Promise<{ cpf: string; dossies: readonly DossieCorvo[] } | null> {
    const cpf = ((await this.deps.cpfDe(chatId)) ?? '').replace(/\D/g, '');
    if (cpf.length !== 11) return null;
    return { cpf, dossies: await this.dossiesDe(cpf) };
  }

  /** Versões do dossiê de um CPF, mais recente primeiro. */
  async dossiesDe(cpf: string): Promise<readonly DossieCorvo[]> {
    const limpo = cpf.replace(/\D/g, '');
    const todos = (await this.deps.json.list(NS_DOSSIES)) as readonly DossieCorvo[];
    return todos
      .filter((d) => d.cpf === limpo)
      .sort((a, b) => (b.geradoEm || b.baixadoEm).localeCompare(a.geradoEm || a.baixadoEm));
  }

  /** O ZIP de uma versão, do storage privado (download autenticado no Admin). */
  async zipDoDossie(
    cpf: string,
    hashRaiz: string,
  ): Promise<{ nomeArquivo: string; bytes: Buffer } | null> {
    if (this.deps.media === undefined) return null;
    const registro = (await this.deps.json.get(
      NS_DOSSIES,
      `${cpf.replace(/\D/g, '')}:${hashRaiz}`,
    )) as DossieCorvo | null;
    if (registro === null) return null;
    const blob = await this.deps.media.read(registro.hashZip);
    if (blob === null) return null;
    return { nomeArquivo: registro.nomeArquivo, bytes: Buffer.from(blob.bytes) };
  }

  // ── Cifra da credencial (AES-256-GCM; chave derivada de env por sha256) ─────

  private cifrar(texto: string): SenhaCifrada {
    const iv = randomBytes(12);
    const cifra = createCipheriv('aes-256-gcm', this.chaveAes, iv);
    const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
    return {
      iv: iv.toString('base64'),
      tag: cifra.getAuthTag().toString('base64'),
      dados: dados.toString('base64'),
    };
  }

  private decifrar(c: SenhaCifrada): string | null {
    try {
      const decifra = createDecipheriv('aes-256-gcm', this.chaveAes, Buffer.from(c.iv, 'base64'));
      decifra.setAuthTag(Buffer.from(c.tag, 'base64'));
      return Buffer.concat([
        decifra.update(Buffer.from(c.dados, 'base64')),
        decifra.final(),
      ]).toString('utf8');
    } catch {
      return null; // chave trocada/registro corrompido: nunca explode
    }
  }
}
