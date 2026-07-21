// ─────────────────────────────────────────────────────────────────────────────
// MEDIDOR DE CUSTO (2026-07-21) — cada chamada de IA vira um REGISTRO persistido
// (tokens de entrada/saída + preço do modelo + a quem pertence). Duas origens:
//   'conversa'          — o cérebro da AHRI num turno de atendimento (chatId).
//   'leitura-documento' — a visão transcrevendo um documento (documentId; o
//                          admin resolve documentId→chatId pela contabilidade
//                          documental na hora de agregar).
// Nada aqui decide nem bloqueia: o medidor só OBSERVA. Preços são ESTIMATIVAS
// (USD por milhão de tokens) — o Console da Anthropic/OpenAI é a fatura real.
// ─────────────────────────────────────────────────────────────────────────────
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NAMESPACE = 'custo-llm';

/** USD por MILHÃO de tokens (entrada/saída), por PREFIXO de modelo. */
const PRECOS_POR_MILHAO: readonly { prefixo: string; entrada: number; saida: number }[] = [
  { prefixo: 'claude-opus', entrada: 15, saida: 75 },
  { prefixo: 'claude-sonnet', entrada: 3, saida: 15 },
  { prefixo: 'claude-haiku', entrada: 1, saida: 5 },
  { prefixo: 'gpt-4o-mini', entrada: 0.15, saida: 0.6 },
  { prefixo: 'gpt-4o', entrada: 2.5, saida: 10 },
  { prefixo: 'gpt-5', entrada: 1.25, saida: 10 },
  { prefixo: 'gemini-2.5-pro', entrada: 1.25, saida: 10 },
  { prefixo: 'gemini', entrada: 0.3, saida: 2.5 },
];

export function precoDoModelo(model: string): { entrada: number; saida: number } | null {
  const p = PRECOS_POR_MILHAO.find((x) => model.startsWith(x.prefixo));
  return p ? { entrada: p.entrada, saida: p.saida } : null;
}

export type ContextoDeCusto = 'conversa' | 'leitura-documento';

export interface RegistroDeCusto {
  readonly id: string;
  readonly at: string; // ISO
  readonly contexto: ContextoDeCusto;
  readonly provider: string;
  readonly model: string;
  /** Dono da chamada quando o contexto é 'conversa' (o turno aberto). */
  readonly chatId: string | null;
  /** Documento lido quando o contexto é 'leitura-documento'. */
  readonly documentId: string | null;
  readonly tokensIn: number | null;
  readonly tokensOut: number | null;
  /** null = modelo sem preço na tabela (tokens ficam registrados mesmo assim). */
  readonly custoUsd: number | null;
}

export interface MedidorDeCustoDeps {
  readonly json: JsonStore;
  readonly clock: Clock;
}

export class MedidorDeCusto {
  /** Contexto do turno por CADEIA ASSÍNCRONA (turnos de chats diferentes correm
   *  em paralelo no Ingress — uma variável simples misturaria clientes). */
  private readonly turno = new AsyncLocalStorage<{ chatId: string }>();
  private seq = 0;

  constructor(private readonly deps: MedidorDeCustoDeps) {}

  /** Executa um TURNO de conversa com o chatId no contexto: toda chamada de IA
   *  disparada dentro de fn é atribuída a esse cliente. */
  noTurno<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
    return this.turno.run({ chatId }, fn);
  }

  /** Registra uma chamada de CONVERSA (atribuída ao turno em contexto, se houver). */
  async registrarConversa(uso: {
    provider: string;
    model: string;
    tokensIn: number | null;
    tokensOut: number | null;
  }): Promise<void> {
    await this.persistir({
      contexto: 'conversa',
      provider: uso.provider,
      model: uso.model,
      chatId: this.turno.getStore()?.chatId ?? null,
      documentId: null,
      tokensIn: uso.tokensIn,
      tokensOut: uso.tokensOut,
    });
  }

  /** Registra uma LEITURA de documento (visão) — atribuída ao documentId. */
  async registrarLeitura(uso: {
    provider: string;
    model: string;
    documentId: string;
    tokensIn: number | null;
    tokensOut: number | null;
  }): Promise<void> {
    await this.persistir({
      contexto: 'leitura-documento',
      provider: uso.provider,
      model: uso.model,
      chatId: null,
      documentId: uso.documentId,
      tokensIn: uso.tokensIn,
      tokensOut: uso.tokensOut,
    });
  }

  /** Todos os registros (a agregação por cliente é do admin, que sabe
   *  resolver documentId→chatId pela contabilidade documental). */
  async listar(): Promise<readonly RegistroDeCusto[]> {
    const rows = await this.deps.json.list(NAMESPACE);
    return rows.filter(ehRegistro);
  }

  private async persistir(r: Omit<RegistroDeCusto, 'id' | 'at' | 'custoUsd'>): Promise<void> {
    const at = this.deps.clock.now().toISOString();
    this.seq += 1;
    const id = `${at}-${String(this.seq)}-${Math.random().toString(36).slice(2, 8)}`;
    const preco = precoDoModelo(r.model);
    const custoUsd =
      preco === null
        ? null
        : ((r.tokensIn ?? 0) / 1_000_000) * preco.entrada +
          ((r.tokensOut ?? 0) / 1_000_000) * preco.saida;
    const registro: RegistroDeCusto = { ...r, id, at, custoUsd };
    // O medidor NUNCA derruba a operação que ele observa.
    try {
      await this.deps.json.put(NAMESPACE, id, registro);
    } catch {
      /* observador silencioso */
    }
  }
}

function ehRegistro(v: unknown): v is RegistroDeCusto {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['at'] === 'string' &&
    (r['contexto'] === 'conversa' || r['contexto'] === 'leitura-documento')
  );
}
