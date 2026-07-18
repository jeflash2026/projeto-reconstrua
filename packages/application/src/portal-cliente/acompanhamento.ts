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

export interface AcompanhamentoCliente {
  readonly clienteId: string;
  readonly quem: string;
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
}

const ETAPAS = ['Documentação', 'Análise técnica', 'Processo', 'Conclusão'] as const;

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
  readonly agora: string;
  readonly proximoPasso: string;
  readonly quantoTempo: string;
}

/** Voz da AHRI (1ª pessoa, Princípio 7). NENHUM termo interno vaza (Princípio 5). */
function textosPara(status: ClienteStatus, dias: number, advogadoNome: string | null): Textos {
  const analiseTempo = `Essa fase costuma levar aproximadamente ${String(dias)} dias.`;
  switch (status) {
    case 'ATENDIMENTO':
    case 'COLETANDO_DOCUMENTOS':
      return {
        ondeEsta: 'Documentação',
        agora: 'Estou organizando a sua documentação com você pelo WhatsApp.',
        proximoPasso: 'Assim que tudo estiver completo, seu caso entra na análise técnica da nossa equipe — e eu te aviso.',
        quantoTempo: 'Depende só dos documentos — assim que chegarem, seguimos na hora.',
      };
    case 'AGUARDANDO_10_DIAS':
      return {
        ondeEsta: 'Análise técnica',
        agora: 'Já enviamos as solicitações administrativas do seu caso e estou acompanhando as respostas.',
        proximoPasso: 'Com as respostas em mãos, definimos os próximos passos — e eu te aviso por aqui e pelo WhatsApp.',
        quantoTempo: analiseTempo,
      };
    case 'AGUARDANDO_SOCIO':
      return {
        ondeEsta: 'Análise técnica',
        agora: 'Estamos concluindo a análise técnica do seu caso.',
        proximoPasso: 'Em seguida, um advogado da nossa equipe assume a condução do seu processo.',
        quantoTempo: analiseTempo,
      };
    case 'EM_PROCESSO':
      return {
        ondeEsta: 'Processo em andamento',
        agora:
          advogadoNome !== null
            ? `O advogado ${advogadoNome} está conduzindo o seu processo.`
            : 'Nosso time jurídico está conduzindo o seu processo.',
        proximoPasso: 'Cada movimentação importante aparece aqui — e eu também aviso você no WhatsApp.',
        quantoTempo: 'Cada processo tem o seu próprio ritmo — mas você não precisa vigiar prazos: eu acompanho tudo e te aviso a cada novidade.',
      };
    case 'VENDIDO':
    case 'ENCERRADO':
      // Texto neutro PROVISÓRIO (pendência §9.3 da spec — homologar redação final).
      return {
        ondeEsta: 'Conclusão',
        agora: 'Esta etapa do seu caso foi concluída.',
        proximoPasso: 'Se houver qualquer novidade, eu falo com você pelo WhatsApp.',
        quantoTempo: 'Etapa concluída.',
      };
    default:
      return {
        ondeEsta: 'Análise técnica',
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
      atualizacoes = entries
        .filter((e) => CLIENT_FACING_KINDS.includes(e.kind) && e.kind !== 'numero_processo')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((e) => ({ quando: e.createdAt, texto: e.text }));
    }

    const memoria = await this.deps.memory.load(cliente.chatId);
    const documentosRecebidos = (memoria?.documentsSent ?? []).map((d) => d.label);

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
    return {
      clienteId: cliente.clienteId,
      quem: cliente.quem,
      ondeEsta: t.ondeEsta,
      agora: t.agora,
      proximoPasso: t.proximoPasso,
      precisaFazerAlgo:
        'Nada por enquanto — estou cuidando de tudo. Se eu precisar de algo, falo com você no WhatsApp.',
      quantoTempo: t.quantoTempo,
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
