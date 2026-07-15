// ─────────────────────────────────────────────────────────────────────────────
// Webhook da Evolution → Conversation Runtime. Mapeia o payload bruto e despacha
// para o Runtime. Função PURA e testável (sem Fastify), reutilizada pela rota.
//
// A Conversa é a ÚNICA superfície que fala com o cliente; nunca escreve no Event
// Store de domínio (fronteira da spec 2B).
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationRuntime } from '@reconstrua/application';
import { mapEvolutionUpsert } from '@reconstrua/infrastructure';

export interface WebhookResult {
  readonly processed: boolean;
  readonly chatId: string | null;
  readonly skipped: boolean;
}

/** Mapeia e PROCESSA um evento da Evolution ponta a ponta (aguarda o turno). */
export async function mapAndProcess(runtime: ConversationRuntime, payload: unknown): Promise<WebhookResult> {
  const envelope = mapEvolutionUpsert(payload);
  if (!envelope) {
    return { processed: false, chatId: null, skipped: false };
  }
  const result = await runtime.receive(envelope);
  return { processed: !result.skipped, chatId: envelope.chatId, skipped: result.skipped };
}
