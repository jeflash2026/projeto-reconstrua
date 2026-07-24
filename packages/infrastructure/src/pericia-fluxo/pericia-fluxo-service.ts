// ─────────────────────────────────────────────────────────────────────────────
// FLUXO DA PERÍCIA (Decreto 2026-07-24) — o painel do perito organizado em etapas:
//   1) AGUARDANDO: cliente com HISCON legível ainda não trabalhado;
//   2) EM PERÍCIA: o perito BAIXOU o estudo (unitário ou em lote) → começa o
//      relógio de 10 dias. Aqui ele guarda as CREDENCIAIS do cliente (e-mail/senha/
//      provedor do pedido administrativo) e a RESPOSTA DO BANCO, se houver;
//   3) CONCLUÍDA: vencidos os 10 dias, o cliente vai para "Prontos p/ Advogado" no
//      admin — com as credenciais e a resposta, como PROVA de que o pedido foi feito.
//
// Estado próprio (ns 'pericia-fluxo', por chatId), desacoplado da jornada de venda/
// sociedade — o perito trabalha a ENTREGA do HISCON. Datas ISO; derivações puras.
// ─────────────────────────────────────────────────────────────────────────────
import { PRAZO_PEDIDOS_DIAS, prazoDosPedidos } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS = 'pericia-fluxo';

export interface CredenciaisCliente {
  readonly email: string;
  readonly senha: string;
  readonly provedor: string;
}

export interface RespostaBanco {
  readonly texto: string;
  readonly registradaEm: string;
}

export interface PericiaFluxoRecord {
  readonly chatId: string;
  readonly clienteId: string;
  readonly quem: string;
  /** Quando o perito BAIXOU o estudo (unitário/lote) — início dos 10 dias. */
  readonly iniciadaEm: string;
  readonly credenciais: CredenciaisCliente | null;
  readonly respostaBanco: RespostaBanco | null;
}

/** Registro + derivações do prazo (nunca armazenadas). */
export interface PericiaEmFluxo extends PericiaFluxoRecord {
  readonly prazoEm: string;
  readonly diasRestantes: number;
  readonly horasRestantes: number;
  readonly expirado: boolean;
}

export interface PericiaFluxoDeps {
  readonly json: JsonStore;
  readonly clock: Clock;
}

export class PericiaFluxoService {
  constructor(private readonly deps: PericiaFluxoDeps) {}

  private async recordDe(chatId: string): Promise<PericiaFluxoRecord | null> {
    return (await this.deps.json.get(NS, chatId)) as PericiaFluxoRecord | null;
  }

  /** BAIXOU o estudo ⇒ entra em perícia e o relógio começa. Idempotente: se já
   *  está em perícia, NÃO reinicia o prazo (só devolve jaEstava=true). */
  async iniciar(
    chatId: string,
    clienteId: string,
    quem: string,
  ): Promise<{ ok: true; jaEstava: boolean }> {
    const existente = await this.recordDe(chatId);
    if (existente !== null) return { ok: true, jaEstava: true };
    const record: PericiaFluxoRecord = {
      chatId,
      clienteId,
      quem,
      iniciadaEm: this.deps.clock.now().toISOString(),
      credenciais: null,
      respostaBanco: null,
    };
    await this.deps.json.put(NS, chatId, record);
    return { ok: true, jaEstava: false };
  }

  /** Inicia em lote (o "baixar todos"): retorna quantos ENTRARAM agora (novos). */
  async iniciarVarios(
    itens: readonly { chatId: string; clienteId: string; quem: string }[],
  ): Promise<{ novos: number; total: number }> {
    let novos = 0;
    for (const it of itens) {
      const r = await this.iniciar(it.chatId, it.clienteId, it.quem);
      if (!r.jaEstava) novos += 1;
    }
    return { novos, total: itens.length };
  }

  async salvarCredenciais(
    chatId: string,
    cred: CredenciaisCliente,
  ): Promise<{ ok: boolean; error?: string }> {
    const r = await this.recordDe(chatId);
    if (r === null) return { ok: false, error: 'cliente não está em perícia' };
    await this.deps.json.put(NS, chatId, { ...r, credenciais: cred } satisfies PericiaFluxoRecord);
    return { ok: true };
  }

  async salvarRespostaBanco(
    chatId: string,
    texto: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const r = await this.recordDe(chatId);
    if (r === null) return { ok: false, error: 'cliente não está em perícia' };
    const respostaBanco: RespostaBanco = {
      texto: texto.trim(),
      registradaEm: this.deps.clock.now().toISOString(),
    };
    await this.deps.json.put(NS, chatId, { ...r, respostaBanco } satisfies PericiaFluxoRecord);
    return { ok: true };
  }

  /** O registro cru de um cliente (para o Dossiê/advogado consultarem). */
  async registro(chatId: string): Promise<PericiaFluxoRecord | null> {
    return this.recordDe(chatId);
  }

  private derivar(r: PericiaFluxoRecord, now: Date): PericiaEmFluxo {
    const prazo = prazoDosPedidos(new Date(r.iniciadaEm));
    const restanteMs = prazo.getTime() - now.getTime();
    return {
      ...r,
      prazoEm: prazo.toISOString(),
      diasRestantes: Math.max(0, Math.floor(restanteMs / (24 * 60 * 60 * 1000))),
      horasRestantes: Math.max(0, Math.floor(restanteMs / (60 * 60 * 1000))),
      expirado: restanteMs <= 0,
    };
  }

  /** Todos os clientes em perícia (com prazo derivado). Recentes primeiro. */
  async listar(): Promise<readonly PericiaEmFluxo[]> {
    const now = this.deps.clock.now();
    const chats = await this.deps.json.keys(NS);
    const out: PericiaEmFluxo[] = [];
    for (const chatId of chats) {
      const r = await this.recordDe(chatId);
      if (r !== null) out.push(this.derivar(r, now));
    }
    return out.sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm));
  }

  /** EM ANDAMENTO: prazo ainda correndo (o perito trabalha). */
  async emAndamento(): Promise<readonly PericiaEmFluxo[]> {
    return (await this.listar()).filter((p) => !p.expirado);
  }

  /** CONCLUÍDAS: 10 dias vencidos ⇒ vão para "Prontos p/ Advogado" (com provas). */
  async concluidas(): Promise<readonly PericiaEmFluxo[]> {
    return (await this.listar()).filter((p) => p.expirado);
  }

  /** chatIds já em perícia — para filtrar a lista "aguardando". */
  async chatsEmFluxo(): Promise<readonly string[]> {
    return this.deps.json.keys(NS);
  }
}

export { PRAZO_PEDIDOS_DIAS };
