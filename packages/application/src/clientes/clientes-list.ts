// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES (GO LIVE A · R2) — a LISTA ÚNICA de clientes com status operacional.
// Filosofia congelada: TODA fila é DERIVADA EM LEITURA (nada de status persistido).
// O único estado gravado da jornada é o marcador MODALIDADE (VENDA | SOCIEDADE),
// chaveado pelo identificador canônico do CLIENTE (não pelo chat — chat é canal),
// decidido pelo Admin quando o caso está PRONTO. É o último ponto não-derivável
// do sistema (homologado); tudo o mais vem de ALIR + Readiness.
//
// Somente-leitura (exceto o marcador, cujo COMANDO nasce na R3). Reutiliza:
// MemoryStore (enumerar clientes), ALIRComposer (visão única) e Readiness.
// ─────────────────────────────────────────────────────────────────────────────
import type { MemoryStore } from '../living-memory/ports.js';
import { alirQuem, type ALIR, type ALIRHealthBand } from '../alir/alir-contract.js';
import type { ALIRComposer } from '../alir/alir-projection-builder.js';
import { evaluateReadiness, type ReadinessResult } from '../qualification/readiness.js';

/** A decisão de negócio que separa as duas jornadas oficiais (A e B). */
export type Modalidade = 'VENDA' | 'SOCIEDADE';

/** O marcador persistido — 1 registro por cliente; ato do Admin (OP-10 mínimo). */
export interface ModalidadeRecord {
  readonly clienteId: string;
  readonly modalidade: Modalidade;
  readonly decididaEm: Date;
  readonly decididaPor: string;
}

export interface ModalidadeStore {
  load(clienteId: string): Promise<ModalidadeRecord | null>;
  save(record: ModalidadeRecord): Promise<void>;
}

/** R3 — o registro da VENDA (Jornada A): o 2º e último estado persistido da jornada. */
export interface VendaRecord {
  readonly clienteId: string;
  readonly chatId: string;
  /** Advogado/escritório comprador (texto/id — entidade só nasce se uma jornada exigir). */
  readonly comprador: string;
  readonly vendidaEm: Date;
  readonly vendidaPor: string;
}

export interface VendaStore {
  load(clienteId: string): Promise<VendaRecord | null>;
  save(record: VendaRecord): Promise<void>;
}

// ── B-R3 — o ÚNICO fato persistido da Jornada B (homologado): a CONFIRMAÇÃO do
// envio dos pedidos administrativos pelo perito. Lei 8: este registro é o FATO;
// a tarefa de 10 dias no scheduler é apenas a CONSEQUÊNCIA temporal (sinal para a
// AHRI) — as filas derivam do fato + relógio, nunca do timer.
export const PRAZO_PEDIDOS_DIAS = 10;

export interface PedidosAdministrativosRecord {
  readonly clienteId: string;
  readonly chatId: string;
  readonly confirmadoEm: Date;
  readonly confirmadoPor: string;
  /** Rastreabilidade (Lei 10): bancos/quantidade dos contratos no momento da confirmação. */
  readonly bancos: readonly string[];
  readonly contratos: number;
}

export interface PedidosAdministrativosStore {
  load(clienteId: string): Promise<PedidosAdministrativosRecord | null>;
  save(record: PedidosAdministrativosRecord): Promise<void>;
}

/** Vencimento do prazo administrativo (fato + relógio; determinístico). */
export function prazoDosPedidos(confirmadoEm: Date): Date {
  return new Date(confirmadoEm.getTime() + PRAZO_PEDIDOS_DIAS * 24 * 60 * 60 * 1000);
}

/** Status operacional — SEMPRE derivado em leitura, jamais persistido. */
export type ClienteStatus =
  | 'ATENDIMENTO'
  | 'COLETANDO_DOCUMENTOS'
  | 'PRONTO_AGUARDANDO_MODALIDADE'
  | 'PRONTO_AGUARDANDO_VENDA'
  | 'PRONTO_AGUARDANDO_PERICIA'
  | 'AGUARDANDO_10_DIAS'
  | 'AGUARDANDO_SOCIO'
  | 'EM_PROCESSO'
  | 'VENDIDO'
  | 'ENCERRADO';

export interface ClienteResumo {
  readonly clienteId: string;
  readonly chatId: string;
  /** Missão/caso corrente (B-R2: o perito localiza os documentos por ela). */
  readonly missionId: string | null;
  readonly quem: string;
  readonly status: ClienteStatus;
  readonly modalidade: Modalidade | null;
  readonly pronto: boolean;
  /** O que ainda falta (rótulos legíveis do Readiness). */
  readonly faltando: readonly string[];
  readonly saude: ALIRHealthBand | null;
  readonly ultimoContatoAt: Date | null;
  /** B-R3 — quando os pedidos administrativos foram confirmados (rastreabilidade/Lei 10). */
  readonly pedidosConfirmadosEm: Date | null;
}

/** Derivação pura do status (a tabela de filas do modelo congelado). */
export function deriveClienteStatus(
  alir: ALIR,
  readiness: ReadinessResult,
  modalidade: Modalidade | null,
  vendido: boolean,
  pedidos: PedidosAdministrativosRecord | null,
  now: Date,
): ClienteStatus {
  const m = alir.operational.missao;
  if (vendido) return 'VENDIDO'; // venda registrada precede o terminal genérico
  if (m.terminalState === 'ENCERRADA') return 'ENCERRADO';
  // Jornada B: atribuição ao sócio (já no ALIR) ⇒ processo em condução.
  if (alir.operational.operacao.atribuicao !== null) return 'EM_PROCESSO';
  // Jornada B: fato confirmado + relógio derivam a fila (Lei 8 — nunca o timer).
  if (pedidos !== null) {
    return now.getTime() < prazoDosPedidos(pedidos.confirmadoEm).getTime()
      ? 'AGUARDANDO_10_DIAS'
      : 'AGUARDANDO_SOCIO';
  }
  if (!readiness.ready) return m.missionId === null ? 'ATENDIMENTO' : 'COLETANDO_DOCUMENTOS';
  if (modalidade === null) return 'PRONTO_AGUARDANDO_MODALIDADE';
  return modalidade === 'VENDA' ? 'PRONTO_AGUARDANDO_VENDA' : 'PRONTO_AGUARDANDO_PERICIA';
}

export interface ClientesDeps {
  readonly memory: MemoryStore;
  readonly alir: ALIRComposer;
  readonly modalidade: ModalidadeStore;
  readonly venda: VendaStore;
  readonly pedidos: PedidosAdministrativosStore;
  /** Nome AUTORITATIVO do cliente (o beneficiário do HISCON), quando houver — é o
   *  nome REAL da pessoa e prevalece sobre o que a AHRI capturou na conversa (que
   *  às vezes é a cidade). Opcional (ausente ⇒ usa só o nome da identidade). */
  readonly nomeAutoritativo?: (chatId: string) => Promise<string | null>;
}

export class ClientesList {
  constructor(private readonly deps: ClientesDeps) {}

  /** A lista única: um resumo por cliente conhecido, status derivado em leitura. */
  async list(now?: Date): Promise<readonly ClienteResumo[]> {
    const memories = await this.deps.memory.all();
    const out: ClienteResumo[] = [];
    for (const mem of memories) {
      out.push(await this.resumo(mem.chatId, now));
    }
    return out.sort(
      (a, b) => (b.ultimoContatoAt?.getTime() ?? 0) - (a.ultimoContatoAt?.getTime() ?? 0),
    );
  }

  /** Fila do Admin no Modelo A: prontos, com modalidade VENDA, aguardando a venda. */
  async prontosParaVenda(now?: Date): Promise<readonly ClienteResumo[]> {
    return (await this.list(now)).filter((c) => c.status === 'PRONTO_AGUARDANDO_VENDA');
  }

  private async resumo(chatId: string, now?: Date): Promise<ClienteResumo> {
    const groups: readonly ('CORE' | 'OPERATIONAL')[] = ['CORE', 'OPERATIONAL'];
    const { alir, metrics } = await this.deps.alir.compose(
      chatId,
      now !== undefined ? { groups, now } : { groups },
    );
    const readiness = evaluateReadiness(
      now !== undefined
        ? { alir, caseType: 'GENERICO', unavailable: metrics.fieldsUnavailable, now }
        : { alir, caseType: 'GENERICO', unavailable: metrics.fieldsUnavailable },
    );
    // Modalidade/venda/pedidos pertencem ao CLIENTE reconhecido; contato sem clienteId nunca os tem.
    const reconhecido = alir.clienteId !== chatId;
    const record = reconhecido ? await this.deps.modalidade.load(alir.clienteId) : null;
    const modalidade = record?.modalidade ?? null;
    const venda = reconhecido ? await this.deps.venda.load(alir.clienteId) : null;
    const pedidos = reconhecido ? await this.deps.pedidos.load(alir.clienteId) : null;

    // Nome REAL do HISCON prevalece sobre o capturado na conversa (que às vezes é
    // a cidade — caso "São Roque"). Sem HISCON legível, mantém o da identidade.
    const nomeHiscon = await this.deps.nomeAutoritativo?.(chatId).catch(() => null);
    return {
      clienteId: alir.clienteId,
      chatId,
      missionId: alir.operational.missao.missionId,
      quem: nomeHiscon ?? alirQuem(alir),
      status: deriveClienteStatus(
        alir,
        readiness,
        modalidade,
        venda !== null,
        pedidos,
        now ?? new Date(),
      ),
      modalidade,
      pronto: readiness.ready,
      faltando: readiness.missingRequirements.map((r) => r.label),
      saude: alir.healthScore?.band ?? null,
      ultimoContatoAt: alir.operational.ahri.ultimoContatoAt,
      pedidosConfirmadosEm: pedidos?.confirmadoEm ?? null,
    };
  }
}
