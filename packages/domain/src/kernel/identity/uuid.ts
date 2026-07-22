// ─────────────────────────────────────────────────────────────────────────────
// UUID abstraído. O domínio NÃO gera UUIDs (isso é tecnologia: crypto, libs).
// Define apenas o tipo `Uuid` (branded) e o PORT `UuidGenerator`, implementado
// pela infraestrutura. Puro.
// ─────────────────────────────────────────────────────────────────────────────

/** String opaca marcada como UUID. Só a infraestrutura a produz de forma válida. */
export type Uuid = string & { readonly __brand: 'Uuid' };

/** Port de geração de identificadores. Implementado fora do domínio. */
export interface UuidGenerator {
  next(): Uuid;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Valida e marca uma string como Uuid. Útil para reconstituir a partir de I/O. */
export function toUuid(value: string): Uuid {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Valor inválido para Uuid: "${value}".`);
  }
  return value as Uuid;
}

export function isUuid(value: string): value is Uuid {
  return UUID_REGEX.test(value);
}
