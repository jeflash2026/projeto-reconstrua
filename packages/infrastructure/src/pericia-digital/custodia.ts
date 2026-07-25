// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · CADEIA DE CUSTÓDIA (Decreto 2026-07-24, item 4)
// Trilha de auditoria INVIOLÁVEL: cada evento é encadeado por hash (o hash de um
// registro cobre o hash do anterior + o próprio conteúdo). Qualquer alteração
// posterior quebra a cadeia e é DETECTADA por `verificar`. Append-only; o
// original de um documento JAMAIS é sobrescrito (só nascem derivados/registros).
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS = 'pericia-custodia';
export const HASH_GENESIS = 'GENESIS';

export interface EventoCustodia {
  readonly id: string;
  readonly casoId: string;
  readonly seq: number;
  readonly usuario: string;
  readonly acao: string;
  readonly em: string;
  readonly ip: string | null;
  readonly arquivoId: string | null;
  readonly versao: number | null;
  readonly motivo: string | null;
  readonly detalhe: string | null;
  readonly hashAnterior: string;
  readonly hash: string;
}

/** Conteúdo assinado pelo hash (tudo menos o próprio hash). Canonicalizado. */
function conteudoCanonico(e: Omit<EventoCustodia, 'hash'>): string {
  return JSON.stringify([
    e.id,
    e.casoId,
    e.seq,
    e.usuario,
    e.acao,
    e.em,
    e.ip,
    e.arquivoId,
    e.versao,
    e.motivo,
    e.detalhe,
    e.hashAnterior,
  ]);
}

function calcularHash(e: Omit<EventoCustodia, 'hash'>): string {
  return createHash('sha256').update(conteudoCanonico(e)).digest('hex');
}

export interface NovoEventoCustodia {
  readonly usuario: string;
  readonly acao: string;
  readonly ip?: string | null;
  readonly arquivoId?: string | null;
  readonly versao?: number | null;
  readonly motivo?: string | null;
  readonly detalhe?: string | null;
}

export class CustodiaService {
  constructor(private readonly deps: { json: JsonStore; clock: Clock; uuid: UuidGenerator }) {}

  private async eventos(casoId: string): Promise<EventoCustodia[]> {
    const raw = (await this.deps.json.get(NS, casoId)) as EventoCustodia[] | null;
    return raw ?? [];
  }

  /** Registra um evento encadeado ao anterior (append-only). Retorna o evento. */
  async registrar(casoId: string, novo: NovoEventoCustodia): Promise<EventoCustodia> {
    const anteriores = await this.eventos(casoId);
    const ultimo = anteriores[anteriores.length - 1] ?? null;
    const semHash: Omit<EventoCustodia, 'hash'> = {
      id: this.deps.uuid.next(),
      casoId,
      seq: anteriores.length,
      usuario: novo.usuario,
      acao: novo.acao,
      em: this.deps.clock.now().toISOString(),
      ip: novo.ip ?? null,
      arquivoId: novo.arquivoId ?? null,
      versao: novo.versao ?? null,
      motivo: novo.motivo ?? null,
      detalhe: novo.detalhe ?? null,
      hashAnterior: ultimo?.hash ?? HASH_GENESIS,
    };
    const evento: EventoCustodia = { ...semHash, hash: calcularHash(semHash) };
    await this.deps.json.put(NS, casoId, [...anteriores, evento]);
    return evento;
  }

  async trilha(casoId: string): Promise<readonly EventoCustodia[]> {
    return this.eventos(casoId);
  }

  /** Recalcula a cadeia. Íntegra ⇒ ok. Quebra ⇒ o seq do primeiro evento adulterado. */
  async verificar(casoId: string): Promise<{ integro: boolean; quebrouEmSeq: number | null }> {
    const eventos = await this.eventos(casoId);
    let anterior = HASH_GENESIS;
    for (const e of eventos) {
      const { hash, ...semHash } = e;
      if (semHash.hashAnterior !== anterior || calcularHash(semHash) !== hash) {
        return { integro: false, quebrouEmSeq: e.seq };
      }
      anterior = hash;
    }
    return { integro: true, quebrouEmSeq: null };
  }
}
