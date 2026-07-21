// ─────────────────────────────────────────────────────────────────────────────
// VISÃO DE ACOMPANHAMENTO (PC-R1) — a ÚNICA projeção segura do processo para o
// cliente (Princípio 3): consumida pelo Portal E pela AHRI em conversa. O Portal
// nunca interpreta nada — TODA a tradução para linguagem humana (voz da AHRI, 1ª
// pessoa — Princípios 5/7) acontece AQUI. A estrutura são as respostas às cinco
// perguntas do cliente (Princípio 4). Transparência sem exposição (Princípio 6):
// nenhum código interno, nenhuma fila interna, nenhum dado de terceiros.
//
// D1: o prazo vem da POLÍTICA vigente (config única) sobre o FATO da liberação
// (comunicadoEm) — nunca número duplicado. D3: nada nasce aqui; só composição.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientesList, ClienteStatus } from '../clientes/clientes-list.js';
import type { MemoryStore } from '../living-memory/ports.js';
import type { AssignmentStore, JuridicalWorkStore } from '../advogado-portal/juridical-work.js';
import { CLIENT_FACING_KINDS } from '../advogado-portal/juridical-work.js';
import type { StaffStore } from '../admin-portal/staff-directory.js';

/** O FATO da liberação do portal (persistido no PC-R3; aqui apenas o contrato). */
export interface LiberacaoPortal {
  readonly clienteId: string;
  readonly chatId: string;
  readonly comunicadoEm: Date;
  /** O que foi DITO ao cliente na época (Lei 10), mesmo que a política mude. */
  readonly estimativaDiasInformada: number;
}

export interface EtapaTimeline {
  readonly titulo: string;
  readonly situacao: 'concluida' | 'atual' | 'futura';
}

/** Estado do PULSO (Presence §2) — semântica real, nunca cosmética. */
export type EstadoPresenca = 'atenta' | 'serena' | 'repouso';

export interface AcompanhamentoCliente {
  readonly clienteId: string;
  readonly quem: string;
  // ── Presença (Presence doc) — o Portal só renderiza; a semântica nasce aqui ──
  readonly presenca: EstadoPresenca;
  /** A frase de abertura da carta (UX §2) — composta AQUI (P3: portal sem lógica). */
  readonly fraseAbertura: string;
  // ── As 5 perguntas (Princípio 4) — textos prontos, voz da AHRI ────────────────
  readonly ondeEsta: string;
  readonly agora: string;
  readonly proximoPasso: string;
  readonly precisaFazerAlgo: string;
  readonly quantoTempo: string;
  // ── Suporte visual ───────────────────────────────────────────────────────────
  readonly etapas: readonly EtapaTimeline[];
  readonly estimativaDias: number;
  readonly estimativaAte: Date | null;
  readonly advogado: { readonly nome: string } | null;
  readonly processo: { readonly numero: string } | null;
  readonly atualizacoes: ReadonlyArray<{ readonly quando: Date; readonly texto: string }>;
  readonly documentosRecebidos: readonly string[];
  readonly whatsapp: string;
}

export interface AcompanhamentoConfig {
  /** PROCESSING_ESTIMATE_DAYS — a política vigente, lida em UM único ponto (D1). */
  readonly estimativaDias: number;
  /** Número oficial — a volta ao relacionamento (Princípio 8). */
  readonly whatsapp: string;
}

export interface AcompanhamentoDeps {
  readonly clientes: ClientesList;
  readonly memory: MemoryStore;
  readonly juridical: JuridicalWorkStore;
  readonly assignments: AssignmentStore;
  readonly staff: StaffStore;
  /** Fonte do fato de liberação (PC-R3); até lá, () => null. */
  readonly liberacao: (clienteId: string) => Promise<LiberacaoPortal | null>;
  readonly config: AcompanhamentoConfig;
  /** 15ª rodada — rótulos HUMANOS dos documentos (da contabilidade documental:
   *  "RG (frente e verso)", "Comprovante de endereço", "HISCON") no lugar dos
   *  ids técnicos da memória ("documento 3e77f2a2"). Ausente/null ⇒ memória. */
  readonly rotulosDocumentais?: (chatId: string) => Promise<readonly string[] | null>;
}

const ETAPAS = ['Documentação', 'Análise técnica', 'Processo', 'Conclusão'] as const;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

/** "2 de agosto" no fuso do Brasil — a frase da previsão nasce AQUI (P3). */
function dataPorExtenso(d: Date): string {
  const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'numeric' });
  const partes = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const mes = MESES[Number(partes['month']) - 1] ?? '';
  return `${String(Number(partes['day']))} de ${mes}`;
}

/** PC-R5 — previsão VENCIDA: honestidade em vez de promessa em loop (Lei 8/11:
 *  o fato é imutável; a leitura reconhece o relógio). */
const TEXTO_PREVISAO_VENCIDA =
  'Está levando um pouco mais do que o previsto — isso acontece em alguns casos e não significa nenhum problema. ' +
  'Eu continuo acompanhando de perto e te aviso na hora em que houver novidade.';

/** Índice da etapa atual na jornada visual (derivado; jamais persistido). */
function etapaIndex(status: ClienteStatus): number {
  switch (status) {
    case 'ATENDIMENTO':
    case 'COLETANDO_DOCUMENTOS':
      return 0;
    case 'PRONTO_AGUARDANDO_MODALIDADE':
    case 'PRONTO_AGUARDANDO_VENDA':
    case 'PRONTO_AGUARDANDO_PERICIA':
    case 'AGUARDANDO_10_DIAS':
    case 'AGUARDANDO_SOCIO':
      return 1;
    case 'EM_PROCESSO':
      return 2;
    case 'VENDIDO':
    case 'ENCERRADO':
      return 3;
  }
}

interface Textos {
  readonly ondeEsta: string;
  readonly fraseAbertura: string;
  readonly agora: string;
  readonly proximoPasso: string;
  readonly quantoTempo: string;
}

/**
 * Estado do pulso (Presence §2): atenta = caso em curso; serena = espera legítima
 * de terceiros (solicitações enviadas); repouso = concluído ("terminei de vigiar —
 * mas não fui embora"). Sempre ancorado no estado REAL do caso.
 */
function presencaPara(status: ClienteStatus): EstadoPresenca {
  if (status === 'VENDIDO' || status === 'ENCERRADO') return 'repouso';
  if (status === 'AGUARDANDO_10_DIAS') return 'serena';
  return 'atenta';
}

/** Voz da AHRI (1ª pessoa, Princípio 7). NENHUM termo interno vaza (Princípio 5). */
function textosPara(status: ClienteStatus, dias: number, advogadoNome: string | null): Textos {
  const analiseTempo = `Essa fase costuma levar aproximadamente ${String(dias)} dias.`;
  switch (status) {
    case 'ATENDIMENTO':
    case 'COLETANDO_DOCUMENTOS':
      return {
        ondeEsta: 'Documentação',
        fraseAbertura: 'Estamos organizando a sua documentação — e eu estou com você em cada passo.',
        agora: 'Estou organizando a sua documentação com você pelo WhatsApp.',
        proximoPasso: 'Assim que tudo estiver completo, seu caso entra na análise técnica da nossa equipe — e eu te aviso.',
        quantoTempo: 'Depende só dos documentos — assim que chegarem, seguimos na hora.',
      };
    case 'AGUARDANDO_10_DIAS':
      return {
        ondeEsta: 'Análise técnica',
        fraseAbertura: 'Seu caso está em análise técnica — e eu estou acompanhando cada passo.',
        agora: 'Já enviamos as solicitações administrativas do seu caso e estou acompanhando as respostas.',
        proximoPasso: 'Com as respostas em mãos, definimos os próximos passos — e eu te aviso por aqui e pelo WhatsApp.',
        quantoTempo: analiseTempo,
      };
    case 'AGUARDANDO_SOCIO':
      return {
        ondeEsta: 'Análise técnica',
        fraseAbertura: 'Seu caso está em análise técnica — e eu estou acompanhando cada passo.',
        agora: 'Estamos concluindo a análise técnica do seu caso.',
        proximoPasso: 'Em seguida, um advogado da nossa equipe assume a condução do seu processo.',
        quantoTempo: analiseTempo,
      };
    case 'EM_PROCESSO':
      return {
        ondeEsta: 'Processo em andamento',
        fraseAbertura: 'Seu processo está em andamento — e eu acompanho cada movimentação.',
        // PC-R5: sem artigo de gênero — advogadas existem.
        agora:
          advogadoNome !== null
            ? `Quem está conduzindo o seu processo é ${advogadoNome}.`
            : 'Nosso time jurídico está conduzindo o seu processo.',
        proximoPasso: 'Cada movimentação importante aparece aqui — e eu também aviso você no WhatsApp.',
        quantoTempo: 'Cada processo tem o seu próprio ritmo — mas você não precisa vigiar prazos: eu acompanho tudo e te aviso a cada novidade.',
      };
    case 'VENDIDO':
      // Texto FINAL homologado (GO-LIVE-02) — a conclusão da etapa com a AHRI.
      return {
        ondeEsta: 'Conclusão',
        fraseAbertura: 'Esta etapa do seu caso foi concluída — e foi um prazer acompanhar você até aqui.',
        agora: 'Concluímos esta etapa do seu caso. Tudo o que construímos — seus documentos, cada passo do caminho — continua registrado aqui para você.',
        proximoPasso: 'Se houver qualquer novidade, eu mesma falo com você pelo WhatsApp — você não precisa vigiar nada.',
        quantoTempo: 'Esta etapa está concluída — não há mais prazos correndo para você acompanhar.',
      };
    case 'ENCERRADO':
      // Texto FINAL homologado (GO-LIVE-02) — o fim do caminho, nunca frio.
      return {
        ondeEsta: 'Conclusão',
        fraseAbertura: 'Seu caso foi concluído — obrigada por confiar em mim durante todo o caminho.',
        agora: 'Chegamos ao fim deste caminho. Seus documentos e todo o histórico continuam guardados aqui, sempre que quiser rever.',
        proximoPasso: 'Este espaço fica em repouso, mas eu não vou embora: qualquer dúvida, qualquer novidade, é só me chamar no WhatsApp.',
        quantoTempo: 'Não há mais nada correndo — você pode ficar em paz.',
      };
    default:
      return {
        ondeEsta: 'Análise técnica',
        fraseAbertura: 'Seu caso está em análise técnica — e eu estou acompanhando cada passo.',
        agora: 'Sua documentação está completa e a nossa equipe está analisando o seu caso.',
        proximoPasso: 'Ao concluir a análise, damos entrada nas solicitações do seu caso — e eu te aviso.',
        quantoTempo: analiseTempo,
      };
  }
}

export class AcompanhamentoView {
  constructor(private readonly deps: AcompanhamentoDeps) {}

  /** A projeção autorizada de UM cliente (null = não renderizável; resposta neutra). */
  async acompanhamento(clienteId: string, now?: Date): Promise<AcompanhamentoCliente | null> {
    const cliente = (await this.deps.clientes.list(now)).find((c) => c.clienteId === clienteId);
    if (cliente === undefined || cliente.clienteId === cliente.chatId) return null; // só cliente reconhecido

    // Advogado (apenas o NOME — Princípio 6) e processo/atualizações (só o dizível).
    let advogado: { nome: string } | null = null;
    let processo: { numero: string } | null = null;
    let atualizacoes: Array<{ quando: Date; texto: string }> = [];
    if (cliente.missionId !== null) {
      const assignment = await this.deps.assignments.byMission(cliente.missionId);
      if (assignment !== null) {
        const member = await this.deps.staff.byId(assignment.advogadoId);
        if (member !== null) advogado = { nome: member.name };
      }
      const entries = await this.deps.juridical.byMission(cliente.missionId);
      const numero = entries
        .filter((e) => e.kind === 'numero_processo')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (numero !== undefined) processo = { numero: numero.text };
      // O MESMO filtro da AHRI (CLIENT_FACING_KINDS) — uma única definição do dizível.
      // GO-LIVE-02: o cliente SÓ vê a versão humanizada (textoCliente). Sem tradução
      // ⇒ o balão NÃO aparece (fail-closed, Lei 9) — nunca texto jurídico cru.
      atualizacoes = entries
        .filter(
          (e) =>
            CLIENT_FACING_KINDS.includes(e.kind) &&
            e.kind !== 'numero_processo' &&
            typeof e.textoCliente === 'string' &&
            e.textoCliente !== '',
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((e) => ({ quando: e.createdAt, texto: e.textoCliente as string }));
    }

    const memoria = await this.deps.memory.load(cliente.chatId);
    // Preferência: rótulos humanos da contabilidade documental; memória = fallback.
    const rotulos = this.deps.rotulosDocumentais
      ? await this.deps.rotulosDocumentais(cliente.chatId).catch(() => null)
      : null;
    const documentosRecebidos =
      rotulos !== null && rotulos.length > 0 ? [...rotulos] : (memoria?.documentsSent ?? []).map((d) => d.label);

    const liberacao = await this.deps.liberacao(clienteId);
    const dias = this.deps.config.estimativaDias;
    const estimativaAte =
      liberacao !== null ? new Date(liberacao.comunicadoEm.getTime() + dias * 24 * 60 * 60 * 1000) : null;

    const idx = etapaIndex(cliente.status);
    const etapas: EtapaTimeline[] = ETAPAS.map((titulo, i) => ({
      titulo,
      situacao: i < idx ? 'concluida' : i === idx ? 'atual' : 'futura',
    }));

    const t = textosPara(cliente.status, dias, advogado?.nome ?? null);

    // A frase completa do TEMPO nasce aqui (P3 — o Portal não compõe nada):
    // na fase de ANÁLISE, com previsão em curso → "A previsão é até {data}";
    // previsão VENCIDA → honestidade (nunca repetir "12 dias" em loop).
    const agoraMesmo = now ?? new Date();
    let quantoTempo = t.quantoTempo;
    if (idx === 1 && estimativaAte !== null) {
      quantoTempo =
        agoraMesmo.getTime() > estimativaAte.getTime()
          ? TEXTO_PREVISAO_VENCIDA
          : `${t.quantoTempo} A previsão é até ${dataPorExtenso(estimativaAte)}.`;
    }
    return {
      clienteId: cliente.clienteId,
      quem: cliente.quem,
      presenca: presencaPara(cliente.status),
      fraseAbertura: t.fraseAbertura,
      ondeEsta: t.ondeEsta,
      agora: t.agora,
      proximoPasso: t.proximoPasso,
      precisaFazerAlgo:
        'Nada por enquanto — estou cuidando de tudo. Se eu precisar de algo, falo com você no WhatsApp.',
      quantoTempo,
      etapas,
      estimativaDias: dias,
      estimativaAte,
      advogado,
      processo,
      atualizacoes,
      documentosRecebidos,
      whatsapp: this.deps.config.whatsapp,
    };
  }
}
