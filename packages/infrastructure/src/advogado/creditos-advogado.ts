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
  /** 'estorno' (2026-08-12): o cliente saiu deste advogado — os créditos dele
   *  voltam. Nasceu do caso real de um cliente encaminhado ao advogado errado:
   *  sem o estorno, o advogado que perdeu o cliente continuava pagando por ele. */
  readonly tipo: 'compra' | 'abate' | 'estorno';
  /** Contratos (a unidade vendida). Compra e estorno somam; abate subtrai. */
  readonly quantidade: number;
  /** Presentes no ABATE e no ESTORNO: o cliente que consumiu (ou devolveu). */
  readonly clienteId?: string;
  readonly nome?: string;
  /** Por que o estorno aconteceu — a prestação de contas ao advogado. */
  readonly motivo?: string;
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

  /** ESTORNO (2026-08-12): o cliente deixou este advogado — os créditos que ele
   *  consumiu voltam para a carteira. Nada é apagado: o abate original continua
   *  no extrato e o estorno entra como lançamento próprio, para o advogado ver
   *  o que aconteceu. Só estorna o que foi de fato abatido, e uma vez só. */
  async estornarPorCliente(
    advogadoId: string,
    clienteId: string,
    motivo: string,
  ): Promise<{ ok: boolean; estornados: number }> {
    const c = await this.carteira(advogadoId);
    const abatido = c.lancamentos
      .filter((l) => l.tipo === 'abate' && l.clienteId === clienteId)
      .reduce((s, l) => s + l.quantidade, 0);
    const jaEstornado = c.lancamentos
      .filter((l) => l.tipo === 'estorno' && l.clienteId === clienteId)
      .reduce((s, l) => s + l.quantidade, 0);
    const devolver = abatido - jaEstornado;
    if (devolver <= 0) return { ok: true, estornados: 0 };
    const nome = c.lancamentos.find((l) => l.tipo === 'abate' && l.clienteId === clienteId)?.nome;
    await this.deps.json.put(NS, advogadoId, {
      advogadoId,
      lancamentos: [
        ...c.lancamentos,
        {
          em: this.deps.clock.now().toISOString(),
          tipo: 'estorno',
          quantidade: devolver,
          clienteId,
          ...(nome !== undefined ? { nome } : {}),
          motivo,
        },
      ],
    } satisfies CarteiraAdvogado);
    return { ok: true, estornados: devolver };
  }

  /** O abatido LÍQUIDO de cada cliente (abates − estornos), por clienteId. */
  private liquidoPorCliente(c: CarteiraAdvogado): Map<string, number> {
    const porCliente = new Map<string, number>();
    for (const l of c.lancamentos) {
      if (l.clienteId === undefined) continue;
      const atual = porCliente.get(l.clienteId) ?? 0;
      if (l.tipo === 'abate') porCliente.set(l.clienteId, atual + l.quantidade);
      if (l.tipo === 'estorno') porCliente.set(l.clienteId, atual - l.quantidade);
    }
    return porCliente;
  }

  /** AJUSTE À RÉGUA ATUAL (auditoria 2026-08-24, caso Juvenal): o guia mudou
   *  (migração + RMC/RCC que o leitor não via) e abates antigos ficaram
   *  menores — e o abate normal é idempotente por cliente, então não se
   *  corrige sozinho. Aqui o lançamento é a DIFERENÇA: complemento de abate
   *  quando a régua atual é maior; estorno parcial quando é menor. Sempre com
   *  motivo, sempre como lançamento novo — o extrato conta a história toda. */
  async ajustarPorCliente(
    advogadoId: string,
    cliente: { clienteId: string; nome: string },
    regraAtual: number,
    motivo: string,
  ): Promise<{ ok: boolean; ajuste: number }> {
    const alvo = Math.max(0, Math.round(regraAtual));
    const c = await this.carteira(advogadoId);
    const liquido = this.liquidoPorCliente(c).get(cliente.clienteId) ?? 0;
    const ajuste = alvo - liquido;
    if (ajuste === 0) return { ok: true, ajuste: 0 };
    // Só ajusta quem JÁ foi abatido — ajustar quem nunca foi encaminhado seria
    // cobrar por cliente que o advogado não recebeu.
    if (!c.lancamentos.some((l) => l.tipo === 'abate' && l.clienteId === cliente.clienteId))
      return { ok: false, ajuste: 0 };
    await this.deps.json.put(NS, advogadoId, {
      advogadoId,
      lancamentos: [
        ...c.lancamentos,
        {
          em: this.deps.clock.now().toISOString(),
          tipo: ajuste > 0 ? ('abate' as const) : ('estorno' as const),
          quantidade: Math.abs(ajuste),
          clienteId: cliente.clienteId,
          nome: cliente.nome,
          motivo,
        },
      ],
    } satisfies CarteiraAdvogado);
    return { ok: true, ajuste };
  }

  /** Saldo derivado (nunca armazenado): comprados + estornados − abatidos. */
  async saldo(advogadoId: string): Promise<SaldoAdvogado> {
    const c = await this.carteira(advogadoId);
    const comprados = c.lancamentos
      .filter((l) => l.tipo === 'compra')
      .reduce((s, l) => s + l.quantidade, 0);
    const abatidos = c.lancamentos
      .filter((l) => l.tipo === 'abate')
      .reduce((s, l) => s + l.quantidade, 0);
    const estornados = c.lancamentos
      .filter((l) => l.tipo === 'estorno')
      .reduce((s, l) => s + l.quantidade, 0);
    // Clientes que o advogado REALMENTE tem: líquido > 0 (com os ajustes da
    // auditoria, um cliente pode ter MAIS de um lançamento de abate — contar
    // lançamentos contaria o mesmo cliente duas vezes).
    const liquidos = this.liquidoPorCliente(c);
    return {
      advogadoId,
      comprados,
      abatidos: abatidos - estornados,
      saldo: comprados - abatidos + estornados,
      clientesAbatidos: [...liquidos.values()].filter((v) => v > 0).length,
    };
  }

  /** Extrato completo (recentes primeiro) — a prestação de contas. */
  async extrato(advogadoId: string): Promise<readonly LancamentoCredito[]> {
    const c = await this.carteira(advogadoId);
    return [...c.lancamentos].sort((a, b) => b.em.localeCompare(a.em));
  }
}
