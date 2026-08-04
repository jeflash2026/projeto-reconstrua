// ─────────────────────────────────────────────────────────────────────────────
// O NASCIMENTO DO PORTAL (PC-R3) — um MOMENTO da jornada, não uma feature: quando
// a AHRI reconhece que recebeu tudo, nasce uma nova relação. Sem clique humano.
//
// Invariantes (auditadas):
//  • ENVIO ÚNICO: o FATO liberacao-portal é gravado ANTES da mensagem (Lei 8 —
//    o fato é a decisão; a mensagem é consequência). Crash ⇒ nunca duplica.
//  • NUNCA PREMATURO: Readiness PRONTO + cliente RECONHECIDO + evidência REAL de
//    recebimento (documentos recebidos ≥ obrigatórios da matriz) + Brain sem veto.
//  • IDEMPOTENTE: candidato só existe sem fato; re-execuções são no-op.
//  • D2: texto homologado com {dias} da política única e {link} verbatim; a frase
//    final ("estarei aqui") é obrigatória — o relacionamento nunca termina.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientesList } from '../clientes/clientes-list.js';
import type { MemoryStore } from '../living-memory/ports.js';
import { requirementsFor } from '../qualification/requirements-matrix.js';
import { emitirTokenCliente } from './token.js';
import type { LiberacaoPortal } from './acompanhamento.js';

export interface LiberacaoPortalStore {
  load(clienteId: string): Promise<LiberacaoPortal | null>;
  save(record: LiberacaoPortal): Promise<void>;
}

/** Decreto 2026-07-31 (funil com confirmação): o FATO do PARECER enviado —
 *  a fase 1 completa agora gera o DOSSIÊ ao cliente e AGUARDA o SIM dele;
 *  o cadastro (liberação do Portal) só nasce com a confirmação. */
export interface ParecerEnviado {
  readonly clienteId: string;
  readonly chatId: string;
  readonly enviadoEm: Date;
  readonly contratos: number;
  readonly indicios: number;
  /** Onda 3 (2026-07-31): o instante em que o cliente CONFIRMOU o interesse —
   *  null/ausente = ainda aguardando o SIM. É a régua da mesa do Atendimento
   *  Humanizado (só confirmados entram). */
  readonly confirmadoEm?: Date | null;
}
export interface ParecerStore {
  load(clienteId: string): Promise<ParecerEnviado | null>;
  save(record: ParecerEnviado): Promise<void>;
}

/** A voz que entrega a mensagem (Brain decide; pipeline canônico entrega). */
export interface ComunicadorNascimento {
  /** true = mensagem aceita para entrega; false = Brain vetou/canal indisponível. */
  comunicar(chatId: string, clienteId: string, texto: string): Promise<boolean>;
}

export interface NascimentoConfig {
  /** PROCESSING_ESTIMATE_DAYS — a MESMA política única do Portal (D1). */
  readonly estimativaDias: number;
  readonly validadeLinkDias: number;
  readonly publicUrl: string;
  readonly tokenSecret: string;
}

export interface NascimentoDeps {
  readonly clientes: ClientesList;
  readonly memory: MemoryStore;
  readonly liberacao: LiberacaoPortalStore;
  /** Decreto 2026-07-31: o fato do parecer enviado (fase de confirmação). */
  readonly parecer: ParecerStore;
  /** Resumo do parecer (contratos na janela + indícios) — null = HISCON ainda
   *  ilegível/sem contratos ⇒ o parecer NÃO sai (nada é inventado). */
  readonly resumoParecer: (chatId: string) => Promise<{
    readonly contratos: number;
    readonly indicios: number;
  } | null>;
  /** O cliente CONFIRMOU (um "sim" inbound) DEPOIS do parecer enviado? */
  readonly confirmouApos: (chatId: string, desde: Date) => Promise<boolean>;
  readonly comunicador: ComunicadorNascimento;
  readonly config: NascimentoConfig;
}

export interface NascimentoResumo {
  readonly verificados: number;
  readonly nascidos: readonly string[]; // clienteIds com cadastro comunicado nesta varredura
  /** Decreto 2026-07-31: clienteIds que receberam o PARECER nesta varredura. */
  readonly pareceres: readonly string[];
}

/** Decreto 2026-07-31: o número pelo qual a EQUIPE HUMANA entra em contato na
 *  fase 2 (coleta de procuração, RG frente e verso e comprovante de endereço).
 *  Ditado pelo Fundador; muda SÓ aqui. (Atualizado 2026-08-04.) */
export const NUMERO_CONTATO_EQUIPE = '(41) 99802-8530';

/** Decreto 2026-07-31 (funil com confirmação) — a mensagem do PARECER: a fase 1
 *  fechou, a análise encontrou contratos aptos, e o cliente recebe o DOSSIÊ
 *  JURÍDICO (link com token) + o pedido de CONFIRMAÇÃO. O cadastro só nasce
 *  com o SIM — é o filtro de quem realmente quer ir até o fim. */
export function mensagemParecer(contratos: number, indicios: number, link: string): string {
  return (
    'Boa notícia! Concluí a análise do seu HISCON. ' +
    `Encontrei ${String(contratos)} contrato(s) de consignado na janela de 5 anos, com ${String(indicios)} indício(s) de irregularidade — o seu caso é APTO para seguirmos. ` +
    'Preparei o seu DOSSIÊ JURÍDICO com tudo organizado (você pode ver e baixar em PDF): ' +
    `${link} ` +
    'Para a nossa equipe jurídica assumir o seu caso e darmos entrada no processo, eu só preciso da sua CONFIRMAÇÃO: você deseja seguir? ' +
    'É só responder SIM por aqui — na hora eu gero o seu cadastro. ' +
    'Se preferir tirar alguma dúvida antes, é só me perguntar — estou à disposição.'
  );
}

/** O texto HOMOLOGADO da CONFIRMAÇÃO (decreto 2026-07-31): o cliente disse SIM
 *  ao parecer ⇒ o cadastro nasce, o Portal abre e a fase 2 (equipe humana,
 *  ligação pelo número fixo) é anunciada. Conteúdo do Fundador; slots
 *  determinísticos. */
export function mensagemNascimento(link: string): string {
  return (
    'Confirmação registrada — o seu cadastro foi gerado! A partir de agora a nossa equipe jurídica assume o seu caso. ' +
    'Você pode acompanhar tudo pelo Portal do Cliente: ' +
    `${link} ` +
    'O próximo passo é nosso: a nossa equipe vai entrar em contato com você para colher os demais documentos — a procuração, o RG (frente e verso) e o comprovante de endereço. ' +
    `É só aguardar — entraremos em contato por ligação no WhatsApp, pelo número ${NUMERO_CONTATO_EQUIPE}. ` +
    'Enquanto isso, se você tiver qualquer dúvida, é só me chamar por aqui — estou à disposição.'
  );
}

export class NascimentoPortalRuntime {
  constructor(private readonly deps: NascimentoDeps) {}

  /** A varredura — roda no tick temporal existente (60s). Decreto 2026-07-31:
   *  DUAS fases, cada uma com as invariantes de sempre (fato ANTES da mensagem,
   *  envio único, idempotência, nunca prematuro):
   *   1. fase 1 completa ⇒ PARECER (dossiê + pedido de confirmação) — e espera;
   *   2. cliente CONFIRMOU ⇒ cadastro (liberação) + Portal + fase 2 anunciada. */
  async verificar(now: Date): Promise<NascimentoResumo> {
    const { clientes, memory, liberacao, parecer, comunicador, config } = this.deps;
    if (config.tokenSecret === '') return { verificados: 0, nascidos: [], pareceres: [] }; // fail-closed

    const lista = await clientes.list(now);
    const nascidos: string[] = [];
    const pareceres: string[] = [];
    let verificados = 0;

    for (const cliente of lista) {
      // Candidato: RECONHECIDO (chat é canal; a relação nasce com o cliente).
      if (cliente.clienteId === cliente.chatId) continue;
      verificados += 1;

      const parecerFato = await parecer.load(cliente.clienteId);

      // ── FASE 1 do momento: o PARECER (dossiê + pedido de confirmação) ────────
      if (parecerFato === null) {
        // LEGADO (Onda 3): quem já tem cadastro do fluxo antigo NUNCA recebe o
        // parecer automaticamente — só pelo LOTE do Admin (decreto anti-spam).
        if ((await liberacao.load(cliente.clienteId)) !== null) continue;

        // PRONTO (Readiness determinístico, já refletido na lista única).
        if (!cliente.pronto) continue;

        // NUNCA PREMATURO: evidência REAL de recebimento — a contabilidade de
        // pendências não basta se nenhum documento chegou de fato.
        const memoria = await memory.load(cliente.chatId);
        const recebidos = memoria?.documentsSent.length ?? 0;
        const obrigatorios = requirementsFor('GENERICO').requiredDocuments.length;
        if (recebidos < obrigatorios) continue;

        // A análise precisa ter ENCONTRADO contratos — sem leitura, sem parecer
        // (nada é prometido sem fato; a varredura re-tenta quando a leitura sair).
        const resumo = await this.deps.resumoParecer(cliente.chatId).catch(() => null);
        if (resumo === null || resumo.contratos === 0) continue;

        // O FATO nasce ANTES da mensagem (Lei 8) — envio ÚNICO do parecer.
        await parecer.save({
          clienteId: cliente.clienteId,
          chatId: cliente.chatId,
          enviadoEm: now,
          contratos: resumo.contratos,
          indicios: resumo.indicios,
          confirmadoEm: null,
        });

        // O link do DOSSIÊ: token com o CHAT como sujeito (é pré-cadastro).
        const tokenParecer = emitirTokenCliente(
          cliente.chatId,
          config.validadeLinkDias,
          now,
          config.tokenSecret,
        );
        const linkParecer = `${config.publicUrl.replace(/\/+$/, '')}/parecer?t=${tokenParecer}`;
        const entregue = await comunicador.comunicar(
          cliente.chatId,
          cliente.clienteId,
          mensagemParecer(resumo.contratos, resumo.indicios, linkParecer),
        );
        if (entregue) pareceres.push(cliente.clienteId);
        continue; // o cadastro AGUARDA a confirmação do cliente
      }

      // ── FASE 2 do momento: a CONFIRMAÇÃO ⇒ o cadastro nasce ─────────────────
      if (parecerFato.confirmadoEm != null) continue; // ciclo já completo
      const confirmou = await this.deps
        .confirmouApos(cliente.chatId, parecerFato.enviadoEm)
        .catch(() => false);
      if (!confirmou) continue; // sem SIM, sem cadastro — o filtro do decreto

      // O FATO nasce ANTES da mensagem (Lei 8): a CONFIRMAÇÃO registrada —
      // crash depois daqui ⇒ nunca duplica. É a régua da mesa do Humanizado.
      await parecer.save({ ...parecerFato, confirmadoEm: now });
      // O cadastro (liberação do Portal) — legado já o tem; novo fluxo cria.
      if ((await liberacao.load(cliente.clienteId)) === null) {
        await liberacao.save({
          clienteId: cliente.clienteId,
          chatId: cliente.chatId,
          comunicadoEm: now,
          estimativaDiasInformada: config.estimativaDias,
        });
      }

      // O LINK nasce: extensão temporária da identidade do WhatsApp (D4).
      const token = emitirTokenCliente(
        cliente.clienteId,
        config.validadeLinkDias,
        now,
        config.tokenSecret,
      );
      const link = `${config.publicUrl.replace(/\/+$/, '')}/portal?t=${token}`;

      // A MENSAGEM nasce (texto homologado; entrega pelo pipeline canônico).
      const entregue = await comunicador.comunicar(
        cliente.chatId,
        cliente.clienteId,
        mensagemNascimento(link),
      );
      if (entregue) nascidos.push(cliente.clienteId);
      // Se o Brain vetar/canal falhar: o fato permanece (decisão tomada) e o
      // link renasce sob demanda na conversa — nunca reenvio automático em loop.
    }

    return { verificados, nascidos, pareceres };
  }

  /** Onda 3 (2026-07-31) — o PARECER para UM cliente, disparado pelo LOTE do
   *  Admin (a base legada, com cadastro do fluxo antigo, nunca o recebeu). O
   *  fato é o claim (envio único); nada sai sem HISCON legível. */
  async enviarParecer(clienteId: string, now: Date): Promise<{ ok: boolean; motivo?: string }> {
    const { clientes, parecer, comunicador, config } = this.deps;
    if (config.tokenSecret === '') return { ok: false, motivo: 'sem segredo do link' };
    const cliente = (await clientes.list(now)).find((c) => c.clienteId === clienteId);
    if (cliente === undefined || cliente.clienteId === cliente.chatId) {
      return { ok: false, motivo: 'cliente não reconhecido' };
    }
    if ((await parecer.load(clienteId)) !== null) {
      return { ok: false, motivo: 'parecer já enviado' };
    }
    const resumo = await this.deps.resumoParecer(cliente.chatId).catch(() => null);
    if (resumo === null || resumo.contratos === 0) {
      return { ok: false, motivo: 'HISCON ainda não legível' };
    }
    await parecer.save({
      clienteId,
      chatId: cliente.chatId,
      enviadoEm: now,
      contratos: resumo.contratos,
      indicios: resumo.indicios,
      confirmadoEm: null,
    });
    const token = emitirTokenCliente(
      cliente.chatId,
      config.validadeLinkDias,
      now,
      config.tokenSecret,
    );
    const link = `${config.publicUrl.replace(/\/+$/, '')}/parecer?t=${token}`;
    const entregue = await comunicador.comunicar(
      cliente.chatId,
      clienteId,
      mensagemParecer(resumo.contratos, resumo.indicios, link),
    );
    return entregue ? { ok: true } : { ok: false, motivo: 'entrega vetada pelo canal' };
  }
}
