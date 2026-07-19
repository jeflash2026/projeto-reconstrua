// ─────────────────────────────────────────────────────────────────────────────
// JSON STORE — persistência REAL genérica (namespace × key → documento JSON) sobre
// PostgreSQL, com variante in-memory de mesma semântica. Todos os stores de
// documento da operação (config, memória, sessões, filas, cursores, decisões,
// equipe, atribuições, trabalho jurídico, métricas, identidades, scheduler,
// handoff, progresso, produtividade) montam SOBRE este par — trocando o adapter,
// NENHUM runtime muda (só adapters, como exige a spec).
// ─────────────────────────────────────────────────────────────────────────────
import type { SqlClient, SqlRow } from '../event-store/sql-client.js';

export interface JsonStore {
  get(namespace: string, key: string): Promise<unknown>;
  put(namespace: string, key: string, value: unknown): Promise<void>;
  del(namespace: string, key: string): Promise<void>;
  list(namespace: string): Promise<readonly unknown[]>;
  keys(namespace: string): Promise<readonly string[]>;
}

export class InMemoryJsonStore implements JsonStore {
  private readonly data = new Map<string, Map<string, unknown>>();
  private ns(namespace: string): Map<string, unknown> {
    let map = this.data.get(namespace);
    if (!map) {
      map = new Map();
      this.data.set(namespace, map);
    }
    return map;
  }
  get(namespace: string, key: string): Promise<unknown> {
    return Promise.resolve(this.ns(namespace).get(key) ?? null);
  }
  put(namespace: string, key: string, value: unknown): Promise<void> {
    this.ns(namespace).set(key, value);
    return Promise.resolve();
  }
  del(namespace: string, key: string): Promise<void> {
    this.ns(namespace).delete(key);
    return Promise.resolve();
  }
  list(namespace: string): Promise<readonly unknown[]> {
    return Promise.resolve([...this.ns(namespace).values()]);
  }
  keys(namespace: string): Promise<readonly string[]> {
    return Promise.resolve([...this.ns(namespace).keys()]);
  }
}

/** PostgreSQL: tabela production.documents (ver 04-production.sql). */
/**
 * GO-LIVE-06.2 — CAUSA RAIZ do BUG 1: a coluna `value` é `jsonb`. Dependendo do
 * driver/protocolo (aqui `postgres` via `sql.unsafe`), o valor pode voltar como
 * STRING JSON em vez de OBJETO. Todo o sistema assume OBJETO (ex.: byRole acessa
 * `.role`; reviveDates percorre chaves). Com o valor como string, `.role` é
 * `undefined`, o filtro não acha o administrador e o registro "não reaparece" —
 * embora esteja gravado. Normalizamos na FRONTEIRA de leitura: string → objeto.
 * Idempotente para objetos; nunca lança (fallback ao valor cru).
 */
function coerceJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Só reinterpretamos strings que representam OBJETO/ARRAY — que é tudo o que o
  // JsonStore grava (documentos). Escalares e strings comuns ('true', '42',
  // 'hello', ...) NUNCA são reinterpretados, evitando regressão: no modo normal
  // do driver (que já devolve objeto) um valor string legítimo permanece string.
  const trimmed = value.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export class PgJsonStore implements JsonStore {
  constructor(private readonly sql: SqlClient) {}

  async get(namespace: string, key: string): Promise<unknown> {
    const rows = await this.sql.query<SqlRow>(
      'SELECT value FROM production.documents WHERE namespace = $1 AND key = $2',
      [namespace, key],
    );
    const raw = rows[0]?.['value'];
    return raw === undefined || raw === null ? null : coerceJson(raw);
  }
  async put(namespace: string, key: string, value: unknown): Promise<void> {
    await this.sql.query(
      `INSERT INTO production.documents (namespace, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [namespace, key, JSON.stringify(value)],
    );
  }
  async del(namespace: string, key: string): Promise<void> {
    await this.sql.query('DELETE FROM production.documents WHERE namespace = $1 AND key = $2', [namespace, key]);
  }
  async list(namespace: string): Promise<readonly unknown[]> {
    const rows = await this.sql.query<SqlRow>(
      'SELECT value FROM production.documents WHERE namespace = $1 ORDER BY key',
      [namespace],
    );
    return rows.map((r) => coerceJson(r['value']));
  }
  async keys(namespace: string): Promise<readonly string[]> {
    const rows = await this.sql.query<SqlRow>(
      'SELECT key FROM production.documents WHERE namespace = $1 ORDER BY key',
      [namespace],
    );
    return rows.map((r) => String(r['key']));
  }
}

/** Reidrata Dates serializadas (ISO) ao ler documentos de volta. */
export function reviveDates<T>(value: unknown, dateKeys: readonly string[]): T {
  const revive = (node: unknown): unknown => {
    if (node instanceof Date) return node; // já é Date (store in-memory)
    if (Array.isArray(node)) return node.map(revive);
    if (typeof node === 'object' && node !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (dateKeys.includes(k) && typeof v === 'string') {
          const d = new Date(v);
          out[k] = Number.isNaN(d.getTime()) ? v : d;
        } else {
          out[k] = revive(v);
        }
      }
      return out;
    }
    return node;
  };
  return revive(value) as T;
}
