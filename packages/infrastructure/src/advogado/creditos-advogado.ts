// ─────────────────────────────────────────────────────────────────────────────
// CARTEIRA DE CRÉDITOS DO ADVOGADO PARCEIRO (decreto 2026-08-04) — o modelo
// comercial: o advogado COMPRA contratos (R$ 100/un; ex.: R$ 20.000 = 200
// contratos) e cada cliente ENCAMINHADO abate da carteira os PROCESSOS do guia
// v2 (ativos 1=1; não-ativos em trios 3=1 por banco+ano, teto 15 por banco).
//
// O perito NÃO é afetado: ele recebe os números REAIS de todos os contratos
// selecionados (os 3 de cada trio chegam por extenso). O abate é contábil —
// gestão do dono + prestação de contas ao advogado.
//
// Fatos em 'creditos-advogado' (por advogadoId): lançamentos imutáveis de
// COMPRA e ABATE. Abate é IDEMPOTENTE por cliente (reencaminhar o mesmo
// cliente ao mesmo advogado nunca abate duas vezes). Saldo = derivação pura.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS = 'creditos-advogado';

export interface LancamentoCredito {
  readonly em: string;
  readonly tipo: 'compra' | 'abate';
  /** Contratos (a unidade vendida). Compra soma; abate subtrai. */
  readonly quantidade: number;
  /** Presentes no ABATE: o cliente encaminhado que consumiu os créditos. */
  readonly clienteId?: string;
  readonly nome?: string;
}

export interface CarteiraAdvogado {
  readonly advogadoId: string;
  readonly lancamentos: readonly LancamentoCredito[];
}

export interface SaldoAdvogado {
  readonly advogadoId: string;
  readonly comprados: number;
  readonly abatidos: number;
  readonly saldo: number;
  readonly clientesAbatidos: number;
}

export class CreditosAdvogadoService {
  constructor(private readonly deps: { json: JsonStore; clock: Clock }) {}

  private async carteira(advogadoId: string): Promise<CarteiraAdvogado> {
    const raw = (await this.deps.json.get(NS, advogadoId)) as CarteiraAdvogado | null;
    return raw ?? { advogadoId, lancamentos: [] };
  }

  /** ATO DO ADMIN: registra a compra de N contratos pelo advogado parceiro. */
  async registrarCompra(
    advogadoId: string,
    quantidade: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const n = Math.round(quantidade);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: 'quantidade inválida — informe um número de contratos > 0' };
    }
    const c = await this.carteira(advogadoId);
    await this.deps.json.put(NS, advogadoId, {
      advogadoId,
      lancamentos: [
        ...c.lancamentos,
        { em: this.deps.clock.now().toISOString(), tipo: 'compra', quantidade: n },
      ],
    } satisfies CarteiraAdvogado);
    return { ok: true };
  }

  /** ABATE pela atribuição de um cliente — IDEMPOTENTE por clienteId: o mesmo
   *  cliente nunca abate duas vezes do mesmo advogado (reatribuição segura). */
  async abaterPorCliente(
    advogadoId: string,
    cliente: { clienteId: string; nome: string },
    processos: number,
  ): Promise<{ ok: boolean; jaAbatido: boolean; abatidos: number }> {
    const n = Math.round(processos);
    if (!Number.isFinite(n) || n <= 0) return { ok: true, jaAbatido: false, abatidos: 0 };
    const c = await this.carteira(advogadoId);
    if (c.lancamentos.some((l) => l.tipo === 'abate' && l.clienteId === cliente.clienteId)) {
      return { ok: true, jaAbatido: true, abatidos: 0 };
    }
    await this.deps.json.put(NS, advogadoId, {
      advogadoId,
      lancamentos: [
        ...c.lancamentos,
        {
          em: this.deps.clock.now().toISOString(),
          tipo: 'abate',
          quantidade: n,
          clienteId: cliente.clienteId,
          nome: cliente.nome,
        },
      ],
    } satisfies CarteiraAdvogado);
    return { ok: true, jaAbatido: false, abatidos: n };
  }

  /** Saldo derivado (nunca armazenado): comprados − abatidos. */
  async saldo(advogadoId: string): Promise<SaldoAdvogado> {
    const c = await this.carteira(advogadoId);
    const comprados = c.lancamentos
      .filter((l) => l.tipo === 'compra')
      .reduce((s, l) => s + l.quantidade, 0);
    const abates = c.lancamentos.filter((l) => l.tipo === 'abate');
    const abatidos = abates.reduce((s, l) => s + l.quantidade, 0);
    return {
      advogadoId,
      comprados,
      abatidos,
      saldo: comprados - abatidos,
      clientesAbatidos: abates.length,
    };
  }

  /** Extrato completo (recentes primeiro) — a prestação de contas. */
  async extrato(advogadoId: string): Promise<readonly LancamentoCredito[]> {
    const c = await this.carteira(advogadoId);
    return [...c.lancamentos].sort((a, b) => b.em.localeCompare(a.em));
  }
}
