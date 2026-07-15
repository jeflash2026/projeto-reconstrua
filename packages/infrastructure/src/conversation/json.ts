// ─────────────────────────────────────────────────────────────────────────────
// Travessia SEGURA de JSON desconhecido (payloads da Evolution). Sem `any`, sem
// acesso inseguro: cada acessador valida o tipo e devolve `null` quando ausente.
// ─────────────────────────────────────────────────────────────────────────────

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function asArray(value: unknown): readonly unknown[] | null {
  return Array.isArray(value) ? value : null;
}

/** Navega um caminho de chaves em objetos aninhados, com segurança. */
export function dig(root: unknown, path: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return current;
}
