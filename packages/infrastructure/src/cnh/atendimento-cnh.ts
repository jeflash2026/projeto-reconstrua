// ─────────────────────────────────────────────────────────────────────────────
// ATENDIMENTO CNH (Reconstrua CNH, 2026-09-18) — o serviço do funil de CNH:
//
//   • RECEBE cada mensagem do WhatsApp oficial (número próprio da CNH), grava
//     na conversa do lead e, enquanto o lead estiver com a AHRI, responde
//     seguindo o roteiro (ahri-cnh.ts). Cada resposta da IA é VALIDADA; turno
//     inválido volta uma vez para a IA e, persistindo, sai a próxima pergunta
//     do roteiro — o lead nunca fica sem resposta nem recebe texto inventado;
//   • aceite e transferência passam o lead para GENTE (modo humano): a AHRI
//     para de responder e o painel mostra quem precisa de atenção;
//   • o "vou pensar" vira lead MORNO com follow-up em 24h — que SÓ sai pelo
//     painel, com a aprovação do dono (regra da casa desde 2026-07-30);
//   • as ações do painel (assumir, devolver, mensagem da equipe, contrato,
//     pagamento, descarte, reabrir) ficam no histórico do lead, assinadas.
//
// Dados na tabela PRÓPRIA (cnh.documents), namespace 'cnh-leads', chave = o
// telefone (só dígitos). Sem dependência de rede aqui: envio, IA e relógio são
// injetados (testável sem WhatsApp nem LLM).
// ─────────────────────────────────────────────────────────────────────────────
import {
  ESCRITORIO_CNH_PADRAO,
  ETAPAS_DA_AHRI,
  ETAPAS_CNH,
  FICHA_CNH_VAZIA,
  ROTULO_DESCARTE_CNH,
  ROTULO_ETAPA_CNH,
  entradaDaAhriCnh,
  lerTurnoCnh,
  promptAhriCnh,
  proximaPerguntaCnh,
  textoFollowupCnh,
  type EscritorioCnh,
  type EtapaCnh,
  type FalaCnh,
  type FichaCnh,
  type MotivoDescarteCnh,
  type TurnoCnh,
} from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS_LEADS = 'cnh-leads';
const JANELA_META_MS = 24 * 60 * 60 * 1000;
/** Margem para não mandar texto livre no último minuto da janela da Meta. */
const MARGEM_JANELA_MS = 10 * 60 * 1000;
const FOLLOWUP_APOS_MS = 24 * 60 * 60 * 1000;
const MAX_MENSAGENS = 400;
const MAX_HISTORICO = 200;

export type TipoMensagemCnh = 'texto' | 'audio' | 'imagem' | 'documento' | 'outro';

export interface MensagemCnh {
  readonly id: string;
  readonly de: 'cliente' | 'ahri' | 'equipe';
  readonly texto: string;
  readonly tipo: TipoMensagemCnh;
  /** Media ID da Meta (o painel baixa sob demanda). */
  readonly mediaId: string | null;
  readonly nomeArquivo: string | null;
  readonly em: string;
  /** Quem da equipe escreveu (só em de === 'equipe'). */
  readonly autor: string | null;
  /** Falha de envio (ex.: fora da janela de 24h). */
  readonly falha: string | null;
}

export interface EventoLeadCnh {
  readonly em: string;
  readonly texto: string;
  readonly autor: string;
}

export interface LeadCnh {
  /** O telefone, só dígitos (chave do lead). */
  readonly id: string;
  readonly chatId: string;
  readonly etapa: EtapaCnh;
  /** Quem responde: a AHRI, ou gente (aceite, transferência, "assumir"). */
  readonly modo: 'ahri' | 'humano';
  readonly ficha: FichaCnh;
  readonly resumo: string | null;
  readonly urgente: boolean;
  readonly motivoDescarte: MotivoDescarteCnh | null;
  readonly propostaEnviadaEm: string | null;
  readonly aceitoEm: string | null;
  readonly transferidoEm: string | null;
  readonly descartadoEm: string | null;
  /** Follow-up do lead morno: devido em 24h; SÓ sai pelo painel. */
  readonly followup: {
    readonly devidoEm: string;
    readonly enviadoEm: string | null;
    readonly por: string | null;
  } | null;
  readonly contratoEnviadoEm: string | null;
  readonly pagamentoConfirmadoEm: string | null;
  /** Por que o lead precisa de olhos humanos agora (null = nada). */
  readonly atencao: string | null;
  /** Última mensagem DO CLIENTE — a janela de 24h da Meta conta daqui. */
  readonly ultimaDoClienteEm: string | null;
  /** De onde veio (gravado no primeiro contato; null em leads antigos). */
  readonly origem: OrigemCnh | null;
  readonly conversa: readonly MensagemCnh[];
  readonly historico: readonly EventoLeadCnh[];
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

/** De onde o lead veio (marketing, 2026-09-18): anúncio com botão de WhatsApp
 *  (a Meta manda a identificação do anúncio junto da mensagem), o botão do
 *  site (mensagem pronta "Vim pelo site…"), ou direto no WhatsApp. */
export interface OrigemCnh {
  readonly tipo: 'anuncio' | 'site' | 'direto';
  /** Título do anúncio ou a página de origem, quando a Meta informa. */
  readonly detalhe: string | null;
}

/** Anúncio "clique para o WhatsApp" que trouxe a mensagem (campo referral da Meta). */
export interface AnuncioDeOrigem {
  readonly titulo: string | null;
  readonly url: string | null;
}

export function origemDoContato(texto: string | null, anuncio: AnuncioDeOrigem | null): OrigemCnh {
  if (anuncio !== null) return { tipo: 'anuncio', detalhe: anuncio.titulo ?? anuncio.url };
  if (texto !== null && /\b(pelo|no|do) site\b/iu.test(texto))
    return { tipo: 'site', detalhe: null };
  return { tipo: 'direto', detalhe: null };
}

const ROTULO_ORIGEM: Readonly<Record<OrigemCnh['tipo'], string>> = {
  anuncio: 'anúncio',
  site: 'site',
  direto: 'WhatsApp direto',
};

/** A linha do funil no painel (sem a conversa inteira). */
export interface LeadResumoCnh {
  readonly id: string;
  readonly nome: string | null;
  readonly cidade: string | null;
  readonly etapa: EtapaCnh;
  readonly etapaRotulo: string;
  readonly modo: 'ahri' | 'humano';
  readonly resumo: string | null;
  readonly urgente: boolean;
  readonly motoristaProfissional: boolean | null;
  /** A suspensão começa em dias ou o prazo de defesa está acabando. */
  readonly prazoCurto: boolean;
  readonly origem: OrigemCnh['tipo'] | null;
  readonly tipoCaso: FichaCnh['tipoCaso'];
  readonly atencao: string | null;
  readonly ultimaMensagem: {
    readonly de: MensagemCnh['de'];
    readonly texto: string;
    readonly em: string;
  } | null;
  readonly followupDevidoEm: string | null;
  readonly atualizadoEm: string;
  readonly criadoEm: string;
}

export interface EntradaCnh {
  readonly messageId: string;
  readonly chatId: string;
  readonly texto: string | null;
  readonly tipo: TipoMensagemCnh;
  readonly mediaId: string | null;
  readonly nomeArquivo: string | null;
  readonly em: Date;
  /** Presente quando a mensagem veio de um anúncio "clique para o WhatsApp". */
  readonly anuncio?: AnuncioDeOrigem | null;
}

export interface AtendimentoCnhDeps {
  readonly json: JsonStore;
  readonly clock: Clock;
  /** Envia um texto pelo número da CNH (Meta Cloud API). */
  readonly enviar: (chatId: string, texto: string) => Promise<void>;
  /** Follow-up fora da janela de 24h: o TEMPLATE aprovado na Meta. null = não
   *  configurado (o painel avisa que só dá para enviar dentro da janela). */
  readonly enviarTemplateFollowup: ((chatId: string, nome: string) => Promise<void>) | null;
  /** A LLM (system, user) → texto. null = sem IA (só a reserva do roteiro). */
  readonly completar: ((system: string, user: string) => Promise<string>) | null;
  readonly escritorio?: EscritorioCnh;
  /** Pausa entre as bolhas de uma resposta (produção ~1,2 s; testes 0). */
  readonly pausa?: (ms: number) => Promise<void>;
  readonly observar?: (evento: string, detalhe: string) => void;
}

export type ResultadoCnh = { readonly ok: true } | { readonly ok: false; readonly error: string };

const telefoneDe = (chatId: string): string => (chatId.split('@')[0] ?? chatId).replace(/\D/g, '');

const descreverMidia = (tipo: TipoMensagemCnh, nomeArquivo: string | null): string => {
  switch (tipo) {
    case 'audio':
      return '[o cliente enviou um áudio]';
    case 'imagem':
      return '[o cliente enviou uma foto]';
    case 'documento':
      return `[o cliente enviou um documento${nomeArquivo !== null ? `: ${nomeArquivo}` : ''}]`;
    case 'outro':
      return '[o cliente enviou uma mensagem que não é texto]';
    case 'texto':
      return '';
  }
};

export class AtendimentoCnh {
  /** Um atendimento por lead por vez; mensagem que chega no meio vira nova volta. */
  private readonly emAndamento = new Map<string, Promise<void>>();
  private readonly pendente = new Set<string>();

  constructor(private readonly deps: AtendimentoCnhDeps) {}

  private get esc(): EscritorioCnh {
    return this.deps.escritorio ?? ESCRITORIO_CNH_PADRAO;
  }
  private agora(): string {
    return this.deps.clock.now().toISOString();
  }
  private async ler(id: string): Promise<LeadCnh | null> {
    return (await this.deps.json.get(NS_LEADS, id)) as LeadCnh | null;
  }
  private async gravar(lead: LeadCnh): Promise<void> {
    await this.deps.json.put(NS_LEADS, lead.id, {
      ...lead,
      conversa: lead.conversa.slice(-MAX_MENSAGENS),
      historico: lead.historico.slice(-MAX_HISTORICO),
      atualizadoEm: this.agora(),
    } satisfies LeadCnh);
  }
  private evento(lead: LeadCnh, texto: string, autor: string): LeadCnh {
    return { ...lead, historico: [...lead.historico, { em: this.agora(), texto, autor }] };
  }

  private novoLead(chatId: string, origem: OrigemCnh): LeadCnh {
    const agora = this.agora();
    return {
      id: telefoneDe(chatId),
      chatId,
      etapa: 'recepcao',
      modo: 'ahri',
      ficha: FICHA_CNH_VAZIA,
      resumo: null,
      urgente: false,
      motivoDescarte: null,
      propostaEnviadaEm: null,
      aceitoEm: null,
      transferidoEm: null,
      descartadoEm: null,
      followup: null,
      contratoEnviadoEm: null,
      pagamentoConfirmadoEm: null,
      atencao: null,
      ultimaDoClienteEm: null,
      origem,
      conversa: [],
      historico: [
        {
          em: agora,
          texto: `Primeiro contato pelo WhatsApp (${ROTULO_ORIGEM[origem.tipo]}${origem.detalhe !== null ? `: ${origem.detalhe}` : ''}).`,
          autor: 'AHRI',
        },
      ],
      criadoEm: agora,
      atualizadoEm: agora,
    };
  }

  // ── Entrada (webhook) ──────────────────────────────────────────────────────

  /** Grava a mensagem do cliente. Devolve se a AHRI deve responder (o
   *  servidor agenda `responder` com um pequeno atraso para juntar bolhas). */
  async receber(
    entrada: EntradaCnh,
  ): Promise<{ readonly responder: boolean; readonly leadId: string }> {
    const id = telefoneDe(entrada.chatId);
    if (id === '') return { responder: false, leadId: id };
    const atual =
      (await this.ler(id)) ??
      this.novoLead(entrada.chatId, origemDoContato(entrada.texto, entrada.anuncio ?? null));
    if (atual.conversa.some((m) => m.id === entrada.messageId))
      return { responder: false, leadId: id };
    const texto =
      entrada.texto !== null && entrada.texto.trim() !== ''
        ? entrada.texto.trim()
        : descreverMidia(entrada.tipo, entrada.nomeArquivo);
    const mensagem: MensagemCnh = {
      id: entrada.messageId,
      de: 'cliente',
      texto,
      tipo: entrada.tipo,
      mediaId: entrada.mediaId,
      nomeArquivo: entrada.nomeArquivo,
      em: entrada.em.toISOString(),
      autor: null,
      falha: null,
    };
    const comAhri = atual.modo === 'ahri' && ETAPAS_DA_AHRI.has(atual.etapa);
    const atencao = comAhri
      ? atual.atencao
      : atual.etapa === 'descartado'
        ? 'Escreveu depois do descarte'
        : 'Mensagem nova do cliente';
    await this.gravar({
      ...atual,
      conversa: [...atual.conversa, mensagem],
      ultimaDoClienteEm: mensagem.em,
      atencao,
    });
    return { responder: comAhri, leadId: id };
  }

  /** Responde o lead (uma volta por vez). Mensagem que chegar durante a
   *  resposta gera mais uma volta no fim — nada fica sem resposta. */
  async responder(leadId: string): Promise<void> {
    const rodando = this.emAndamento.get(leadId);
    if (rodando !== undefined) {
      this.pendente.add(leadId);
      return rodando;
    }
    const volta = (async (): Promise<void> => {
      try {
        do {
          this.pendente.delete(leadId);
          await this.umaVolta(leadId);
        } while (this.pendente.has(leadId));
      } finally {
        this.emAndamento.delete(leadId);
      }
    })();
    this.emAndamento.set(leadId, volta);
    return volta;
  }

  private async umaVolta(leadId: string): Promise<void> {
    const lead = await this.ler(leadId);
    if (lead === null || lead.modo !== 'ahri' || !ETAPAS_DA_AHRI.has(lead.etapa)) return;
    // Só responde se a última fala é do cliente (sem resposta ainda).
    const ultima = lead.conversa[lead.conversa.length - 1];
    if (ultima?.de !== 'cliente') return;

    const estado = {
      ficha: lead.ficha,
      etapa: lead.etapa,
      propostaEnviada: lead.propostaEnviadaEm !== null,
    };
    const falas: FalaCnh[] = lead.conversa.map((m) => ({ de: m.de, texto: m.texto }));
    const agora = this.deps.clock.now();
    let turno: TurnoCnh | null = null;
    let viaReserva = false;
    const completar = this.deps.completar;
    if (completar !== null) {
      const system = promptAhriCnh(this.esc);
      const user = entradaDaAhriCnh(estado, falas, agora);
      for (let tentativa = 0; tentativa < 2 && turno === null; tentativa += 1) {
        try {
          const extra =
            tentativa === 0
              ? ''
              : '\n\nATENÇÃO: a sua resposta anterior foi recusada (formato inválido, preço fora da tabela ou antes da proposta, ou promessa de resultado). Responda de novo seguindo as regras e o formato JSON.';
          turno = lerTurnoCnh(await completar(system, user + extra), estado, this.esc);
        } catch (e) {
          this.deps.observar?.('ia-falhou', e instanceof Error ? e.message : 'falha');
        }
      }
    }
    if (turno === null) {
      viaReserva = true;
      turno = {
        mensagens: proximaPerguntaCnh(lead.ficha, lead.etapa, agora),
        ficha: lead.ficha,
        etapa: lead.etapa,
        acao: 'conversar',
        motivoTransferencia: null,
        motivo: null,
        urgente: false,
        resumo: lead.resumo,
      };
    }
    await this.executar(lead, turno, viaReserva);
  }

  /** Envia as bolhas e aplica o que o turno decidiu. */
  private async executar(lead: LeadCnh, turno: TurnoCnh, viaReserva: boolean): Promise<void> {
    const enviadas: MensagemCnh[] = [];
    for (const [i, texto] of turno.mensagens.entries()) {
      if (i > 0) await (this.deps.pausa ?? (() => Promise.resolve()))(1_200);
      let falha: string | null = null;
      try {
        await this.deps.enviar(lead.chatId, texto);
      } catch (e) {
        falha = e instanceof Error ? e.message : 'falha no envio';
        this.deps.observar?.('envio-falhou', falha);
      }
      enviadas.push({
        id: `ahri-${String(this.deps.clock.now().getTime())}-${String(i)}`,
        de: 'ahri',
        texto,
        tipo: 'texto',
        mediaId: null,
        nomeArquivo: null,
        em: this.agora(),
        autor: null,
        falha,
      });
    }
    // Relê: pode ter chegado mensagem enquanto enviávamos.
    const base = (await this.ler(lead.id)) ?? lead;
    const agora = this.agora();
    let prox: LeadCnh = {
      ...base,
      conversa: [...base.conversa, ...enviadas],
      ficha: turno.ficha,
      resumo: turno.resumo ?? base.resumo,
      atencao: viaReserva ? 'A AHRI respondeu pela reserva do roteiro — confira a conversa' : null,
    };
    if (turno.etapa !== base.etapa)
      prox = this.evento(
        { ...prox, etapa: turno.etapa },
        `Etapa: ${ROTULO_ETAPA_CNH[base.etapa]} → ${ROTULO_ETAPA_CNH[turno.etapa]}.`,
        'AHRI',
      );
    switch (turno.acao) {
      case 'proposta':
        prox = this.evento(
          { ...prox, propostaEnviadaEm: agora },
          `Proposta enviada (${turno.ficha.tipoCaso === 'cassacao' ? 'cassação' : 'suspensão'}).`,
          'AHRI',
        );
        break;
      case 'aceite':
        prox = this.evento(
          {
            ...prox,
            modo: 'humano',
            aceitoEm: agora,
            followup: null,
            atencao: 'Aceitou a proposta — enviar contrato e pagamento',
          },
          'Aceitou a proposta. A equipe assume contrato e pagamento.',
          'AHRI',
        );
        break;
      case 'transferir': {
        const motivo = turno.motivoTransferencia ?? (turno.urgente ? 'urgencia' : 'pedido');
        const [atencao, registro] =
          motivo === 'urgencia'
            ? ['URGENTE — atender agora', 'Transferido por URGÊNCIA.']
            : motivo === 'proposta-com-advogado'
              ? [
                  'PPD ou bloqueio de prontuário — a proposta é do advogado',
                  'Caso sem tabela (PPD/bloqueio): a proposta fica com o advogado.',
                ]
              : ['Quer falar com o advogado', 'Pediu para falar com o advogado.'];
        prox = this.evento(
          { ...prox, modo: 'humano', transferidoEm: agora, urgente: turno.urgente, atencao },
          registro,
          'AHRI',
        );
        break;
      }
      case 'descartar':
        prox = this.evento(
          { ...prox, descartadoEm: agora, motivoDescarte: turno.motivo, followup: null },
          `Descartado: ${turno.motivo !== null ? ROTULO_DESCARTE_CNH[turno.motivo] : 'sem motivo'}.`,
          'AHRI',
        );
        break;
      case 'morno':
        prox = this.evento(
          {
            ...prox,
            followup: {
              devidoEm: new Date(this.deps.clock.now().getTime() + FOLLOWUP_APOS_MS).toISOString(),
              enviadoEm: null,
              por: null,
            },
          },
          'Lead morno ("vou pensar") — follow-up em 24h, pelo painel.',
          'AHRI',
        );
        break;
      case 'conversar':
        break;
    }
    // O lead que volta a conversar sai da fila de follow-up.
    if (
      turno.acao !== 'morno' &&
      prox.etapa !== 'morno' &&
      prox.followup !== null &&
      prox.followup.enviadoEm === null
    )
      prox = { ...prox, followup: null };
    await this.gravar(prox);
  }

  // ── Painel ─────────────────────────────────────────────────────────────────

  private resumoDe(l: LeadCnh): LeadResumoCnh {
    const ultima = l.conversa[l.conversa.length - 1] ?? null;
    return {
      id: l.id,
      nome: l.ficha.nome,
      cidade: l.ficha.cidade,
      etapa: l.etapa,
      etapaRotulo: ROTULO_ETAPA_CNH[l.etapa],
      modo: l.modo,
      resumo: l.resumo,
      urgente: l.urgente,
      motoristaProfissional: l.ficha.motoristaProfissional,
      // Leads gravados antes do campo existir não o têm (=== true resolve).
      prazoCurto: l.ficha.prazoCurto === true,
      // Leads anteriores à origem (2026-09-18) não a têm.
      origem: (l.origem as OrigemCnh | null | undefined)?.tipo ?? null,
      tipoCaso: l.ficha.tipoCaso,
      atencao: l.atencao,
      ultimaMensagem:
        ultima === null
          ? null
          : { de: ultima.de, texto: ultima.texto.slice(0, 160), em: ultima.em },
      followupDevidoEm:
        l.followup !== null && l.followup.enviadoEm === null ? l.followup.devidoEm : null,
      atualizadoEm: l.atualizadoEm,
      criadoEm: l.criadoEm,
    };
  }

  async listar(): Promise<readonly LeadResumoCnh[]> {
    const leads = (await this.deps.json.list(NS_LEADS)) as readonly LeadCnh[];
    return leads
      .map((l) => this.resumoDe(l))
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  }

  async obter(id: string): Promise<LeadCnh | null> {
    return this.ler(id.replace(/\D/g, ''));
  }

  /** Os números do topo do painel. */
  async resumo(): Promise<{
    readonly total: number;
    readonly porEtapa: Readonly<Record<EtapaCnh, number>>;
    readonly novosHoje: number;
    readonly aceitosHoje: number;
    readonly precisamDeAtencao: number;
    readonly followupsDevidos: number;
    readonly urgentes: number;
    /** Em andamento com motorista profissional ou prazo curto (a tese põe na frente). */
    readonly prioritarios: number;
    /** De onde vieram os leads (todos os tempos). */
    readonly porOrigem: Readonly<Record<OrigemCnh['tipo'], number>>;
  }> {
    const leads = (await this.deps.json.list(NS_LEADS)) as readonly LeadCnh[];
    const porEtapa = Object.fromEntries(ETAPAS_CNH.map((e) => [e, 0])) as Record<EtapaCnh, number>;
    // "Hoje" em Brasília.
    const hoje = new Date(this.deps.clock.now().getTime() - 3 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const diaBr = (iso: string | null): string | null =>
      iso === null
        ? null
        : new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    const agora = this.deps.clock.now().toISOString();
    let novosHoje = 0;
    let aceitosHoje = 0;
    let precisamDeAtencao = 0;
    let followupsDevidos = 0;
    let urgentes = 0;
    let prioritarios = 0;
    const porOrigem: Record<OrigemCnh['tipo'], number> = { anuncio: 0, site: 0, direto: 0 };
    for (const l of leads) {
      porEtapa[l.etapa] += 1;
      const origem = (l.origem as OrigemCnh | null | undefined)?.tipo;
      if (origem !== undefined) porOrigem[origem] += 1;
      if (
        l.etapa !== 'descartado' &&
        (l.ficha.motoristaProfissional === true || l.ficha.prazoCurto === true)
      )
        prioritarios += 1;
      if (diaBr(l.criadoEm) === hoje) novosHoje += 1;
      if (diaBr(l.aceitoEm) === hoje) aceitosHoje += 1;
      if (l.atencao !== null) precisamDeAtencao += 1;
      if (l.urgente && l.modo === 'humano' && l.etapa === 'transferido') urgentes += 1;
      if (l.followup !== null && l.followup.enviadoEm === null && l.followup.devidoEm <= agora)
        followupsDevidos += 1;
    }
    return {
      total: leads.length,
      porEtapa,
      novosHoje,
      aceitosHoje,
      precisamDeAtencao,
      followupsDevidos,
      urgentes,
      prioritarios,
      porOrigem,
    };
  }

  private dentroDaJanela(lead: LeadCnh): boolean {
    if (lead.ultimaDoClienteEm === null) return false;
    const passado = this.deps.clock.now().getTime() - new Date(lead.ultimaDoClienteEm).getTime();
    return passado < JANELA_META_MS - MARGEM_JANELA_MS;
  }

  /** Mensagem escrita pela EQUIPE no painel. Só dentro da janela de 24h da
   *  Meta (fora dela, só template — o follow-up aprovado). */
  async mensagemDaEquipe(id: string, texto: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    const limpo = texto.trim();
    if (limpo === '') return { ok: false, error: 'mensagem vazia' };
    if (!this.dentroDaJanela(lead))
      return {
        ok: false,
        error:
          'o cliente está há mais de 24h sem escrever — a Meta só aceita o modelo aprovado (use o follow-up)',
      };
    try {
      await this.deps.enviar(lead.chatId, limpo);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'falha no envio' };
    }
    await this.gravar({
      ...lead,
      atencao: null,
      conversa: [
        ...lead.conversa,
        {
          id: `equipe-${String(this.deps.clock.now().getTime())}`,
          de: 'equipe',
          texto: limpo,
          tipo: 'texto',
          mediaId: null,
          nomeArquivo: null,
          em: this.agora(),
          autor,
          falha: null,
        },
      ],
    });
    return { ok: true };
  }

  /** A equipe ASSUME a conversa: a AHRI para de responder este lead. */
  async assumir(id: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    if (lead.modo === 'humano') return { ok: true };
    await this.gravar(
      this.evento({ ...lead, modo: 'humano' }, 'A equipe assumiu a conversa.', autor),
    );
    return { ok: true };
  }

  /** Devolve o lead para a AHRI (volta à etapa em que a conversa estava). */
  async devolverParaAhri(id: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    const etapa: EtapaCnh = ETAPAS_DA_AHRI.has(lead.etapa)
      ? lead.etapa
      : lead.propostaEnviadaEm !== null
        ? 'proposta'
        : lead.ficha.tipoCaso !== null
          ? 'viabilidade'
          : 'qualificacao';
    await this.gravar(
      this.evento(
        { ...lead, modo: 'ahri', etapa, urgente: false, atencao: null },
        `Devolvido para a AHRI (${ROTULO_ETAPA_CNH[etapa]}).`,
        autor,
      ),
    );
    return { ok: true };
  }

  /** Move o lead de etapa pelo painel (qualquer etapa — é decisão humana). */
  async moverEtapa(id: string, etapa: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    if (!(ETAPAS_CNH as readonly string[]).includes(etapa))
      return { ok: false, error: 'etapa inválida' };
    const nova = etapa as EtapaCnh;
    await this.gravar(
      this.evento(
        { ...lead, etapa: nova, modo: ETAPAS_DA_AHRI.has(nova) ? lead.modo : 'humano' },
        `Etapa movida no painel: ${ROTULO_ETAPA_CNH[lead.etapa]} → ${ROTULO_ETAPA_CNH[nova]}.`,
        autor,
      ),
    );
    return { ok: true };
  }

  async marcarContratoEnviado(id: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    await this.gravar(
      this.evento(
        { ...lead, contratoEnviadoEm: this.agora(), atencao: null },
        'Contrato e link de pagamento enviados.',
        autor,
      ),
    );
    return { ok: true };
  }

  async marcarPagamento(id: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    await this.gravar(
      this.evento(
        { ...lead, pagamentoConfirmadoEm: this.agora(), atencao: null },
        'Pagamento confirmado.',
        autor,
      ),
    );
    return { ok: true };
  }

  /** Descarte pelo painel — sem mensagem ao cliente (é decisão interna). */
  async descartar(id: string, motivo: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    const m: MotivoDescarteCnh =
      motivo in ROTULO_DESCARTE_CNH ? (motivo as MotivoDescarteCnh) : 'outro';
    await this.gravar(
      this.evento(
        {
          ...lead,
          etapa: 'descartado',
          motivoDescarte: m,
          descartadoEm: this.agora(),
          followup: null,
          atencao: null,
        },
        `Descartado no painel: ${ROTULO_DESCARTE_CNH[m]}.`,
        autor,
      ),
    );
    return { ok: true };
  }

  /** Reabre um lead descartado: volta para a AHRI desde a recepção. */
  async reabrir(id: string, autor: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    await this.gravar(
      this.evento(
        {
          ...lead,
          etapa: lead.ficha.situacao !== null ? 'qualificacao' : 'recepcao',
          modo: 'ahri',
          motivoDescarte: null,
          descartadoEm: null,
          atencao: null,
        },
        'Lead reaberto — de volta para a AHRI.',
        autor,
      ),
    );
    return { ok: true };
  }

  async marcarVisto(id: string): Promise<ResultadoCnh> {
    const lead = await this.obter(id);
    if (lead === null) return { ok: false, error: 'lead não encontrado' };
    if (lead.atencao !== null) await this.gravar({ ...lead, atencao: null });
    return { ok: true };
  }

  // ── Follow-up (lead morno) — sai SÓ pelo painel, com a aprovação do dono ───

  async followupsDevidos(): Promise<
    readonly (LeadResumoCnh & { readonly dentroDaJanela: boolean })[]
  > {
    const agora = this.agora();
    const leads = (await this.deps.json.list(NS_LEADS)) as readonly LeadCnh[];
    return leads
      .filter(
        (l) => l.followup !== null && l.followup.enviadoEm === null && l.followup.devidoEm <= agora,
      )
      .map((l) => ({ ...this.resumoDe(l), dentroDaJanela: this.dentroDaJanela(l) }))
      .sort((a, b) => (a.followupDevidoEm ?? '').localeCompare(b.followupDevidoEm ?? ''));
  }

  /** Envia os follow-ups APROVADOS no painel: texto livre dentro da janela de
   *  24h, o modelo aprovado fora dela (quando configurado). */
  async enviarFollowups(
    ids: readonly string[],
    autor: string,
  ): Promise<readonly { readonly id: string; readonly ok: boolean; readonly detalhe: string }[]> {
    const resultados: { id: string; ok: boolean; detalhe: string }[] = [];
    for (const idBruto of ids) {
      const lead = await this.obter(idBruto);
      const id = idBruto.replace(/\D/g, '');
      if (lead === null || lead.followup === null || lead.followup.enviadoEm !== null) {
        resultados.push({ id, ok: false, detalhe: 'sem follow-up pendente' });
        continue;
      }
      const texto = textoFollowupCnh(lead.ficha.nome);
      let via: 'texto' | 'modelo';
      try {
        if (this.dentroDaJanela(lead)) {
          await this.deps.enviar(lead.chatId, texto);
          via = 'texto';
        } else if (this.deps.enviarTemplateFollowup !== null) {
          await this.deps.enviarTemplateFollowup(lead.chatId, lead.ficha.nome ?? '');
          via = 'modelo';
        } else {
          resultados.push({
            id,
            ok: false,
            detalhe:
              'fora da janela de 24h e sem modelo aprovado configurado (CNH_META_TEMPLATE_FOLLOWUP)',
          });
          continue;
        }
      } catch (e) {
        resultados.push({
          id,
          ok: false,
          detalhe: e instanceof Error ? e.message : 'falha no envio',
        });
        continue;
      }
      await this.gravar(
        this.evento(
          {
            ...lead,
            followup: { ...lead.followup, enviadoEm: this.agora(), por: autor },
            conversa: [
              ...lead.conversa,
              {
                id: `followup-${String(this.deps.clock.now().getTime())}`,
                de: 'ahri',
                // O modelo da Meta tem o texto que o dono aprovou lá — aqui, o registro.
                texto: via === 'texto' ? texto : '[follow-up pelo modelo aprovado na Meta]',
                tipo: 'texto',
                mediaId: null,
                nomeArquivo: null,
                em: this.agora(),
                autor,
                falha: null,
              },
            ],
          },
          `Follow-up enviado (${via === 'texto' ? 'mensagem' : 'modelo aprovado'}), aprovado por ${autor}.`,
          autor,
        ),
      );
      resultados.push({ id, ok: true, detalhe: via });
    }
    return resultados;
  }
}
