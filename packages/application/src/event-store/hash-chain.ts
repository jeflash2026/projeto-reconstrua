// ─────────────────────────────────────────────────────────────────────────────
// Encadeamento verificável dos eventos (R9 — cadeia reconstituível; Lei 4 —
// auditabilidade). Cada evento carrega `hash = H(previousHash ⧺ canonical(evento))`.
// A integridade da cadeia (sequência de versões + hashes) é verificável a qualquer
// momento, detectando adulteração — o que reforça, no plano técnico, que a memória
// é perpétua e íntegra (Lei 3; DF-11).
//
// Funções PURAS: recebem um `Hasher` injetado (a criptografia vive na infra).
// ─────────────────────────────────────────────────────────────────────────────
import type { Hasher } from './ports.js';
import type { StoredEvent, StoredProvenance } from './stored-event.js';
import { EventStoreIntegrityError } from './errors.js';

/** Campos constitutivos que entram no hash (imutáveis; determinísticos). */
export interface HashableEvent {
  readonly streamType: string;
  readonly streamId: string;
  readonly version: number;
  readonly eventType: string;
  readonly isRelevant: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly provenance: StoredProvenance;
  readonly occurredAt: Date;
}

/** Serialização canônica e determinística (chaves ordenadas) dos campos do evento. */
export function canonicalEventString(e: HashableEvent): string {
  return JSON.stringify([
    e.streamType,
    e.streamId,
    e.version,
    e.eventType,
    e.isRelevant,
    stableStringify(e.payload),
    [
      e.provenance.factRef,
      e.provenance.actor,
      e.provenance.decisionType,
      e.provenance.fundamento,
      e.provenance.operationalRuleRef,
    ],
    e.occurredAt.toISOString(),
  ]);
}

/** Constante de gênese: hash "anterior" da versão 1 de qualquer stream. */
export const GENESIS = 'GENESIS';

/** Calcula o hash de um evento encadeado ao anterior. */
export function computeHash(
  previousHash: string | null,
  event: HashableEvent,
  hasher: Hasher,
): string {
  return hasher.hash(`${previousHash ?? GENESIS}\n${canonicalEventString(event)}`);
}

/**
 * Verifica a integridade de um stream inteiro: versões 1..N contíguas e cada hash
 * consistente com o anterior e com o conteúdo. Lança EventStoreIntegrityError.
 */
export function assertStreamIntegrity(
  events: readonly StoredEvent[],
  hasher: Hasher,
): void {
  let expectedVersion = 0;
  let previousHash: string | null = null;
  for (const e of events) {
    expectedVersion += 1;
    if (e.version !== expectedVersion) {
      throw new EventStoreIntegrityError(
        e.streamType,
        e.streamId,
        `versão fora de sequência: esperado ${String(expectedVersion)}, obtido ${String(e.version)}`,
      );
    }
    if ((e.previousHash ?? null) !== (previousHash ?? null)) {
      throw new EventStoreIntegrityError(
        e.streamType,
        e.streamId,
        `previousHash divergente na versão ${String(e.version)}`,
      );
    }
    const recomputed = computeHash(previousHash, e, hasher);
    if (recomputed !== e.hash) {
      throw new EventStoreIntegrityError(
        e.streamType,
        e.streamId,
        `hash adulterado na versão ${String(e.version)}`,
      );
    }
    previousHash = e.hash;
  }
}

// ── Serialização estável (ordem de chaves determinística, recursiva) ────────────
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
