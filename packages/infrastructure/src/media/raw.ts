// ─────────────────────────────────────────────────────────────────────────────
// Helpers mínimos de leitura do payload cru da Evolution (JSON desconhecido).
// Fonte única — reutilizados pelo EvolutionMediaClient e pela captura.
// ─────────────────────────────────────────────────────────────────────────────
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** messageId da mensagem recebida (data.key.id do payload cru). null se ausente. */
export function messageIdOf(rawMessage: unknown): string | null {
  const root = asRecord(rawMessage);
  const data = root ? asRecord(root['data']) : null;
  const key = data ? asRecord(data['key']) : null;
  return key ? asString(key['id']) : null;
}
