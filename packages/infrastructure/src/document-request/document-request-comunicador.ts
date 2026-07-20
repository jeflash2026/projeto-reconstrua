// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST COMUNICADOR (15C-3 · Parte 3) — DISPARO PROATIVO:
//   created → messaged → ConversationGateway → WhatsApp do cliente.
// Reusa os componentes existentes (gateway + memória da conversa + runtime):
// envia a mensagem AUTORADA, grava o outbound na memória (a conversa fica
// ciente) e registra a transição no aggregate (registrarMensagemEnviada —
// Correção 1). Nenhuma lógica duplicada. Best-effort com erro explícito.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { DocumentRequestState } from '@reconstrua/domain';
import type { ConversationGateway, ConversationMemoryRuntime, DocumentRequestRuntime, ObservabilityRuntime } from '@reconstrua/application';
import { mensagemAoCliente } from '@reconstrua/application';

export type NomeDoClienteProvider = (chatId: string) => Promise<string | null>;

export interface ComunicadorDeps {
  readonly gateway: ConversationGateway;
  readonly memory: ConversationMemoryRuntime;
  readonly runtime: DocumentRequestRuntime;
  readonly nomeDoCliente: NomeDoClienteProvider | null;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class DocumentRequestComunicador {
  constructor(private readonly deps: ComunicadorDeps) {}

  /** Anuncia a solicitação ao cliente (created → messaged → WhatsApp). */
  async anunciar(state: DocumentRequestState): Promise<{ ok: boolean; erro: string | null }> {
    const d = this.deps;
    const now = d.clock.now();
    try {
      const nome = d.nomeDoCliente !== null ? await d.nomeDoCliente(state.clientId).catch(() => null) : null;
      const texto = mensagemAoCliente(state, nome ?? '');
      const receipt = await d.gateway.sendText(state.clientId, texto);
      await d.memory.recordOutbound(state.clientId, texto, receipt.providerMessageId);
      const registrado = await d.runtime.registrarMensagem(state.requestId, now);
      if (registrado.isErr()) {
        // Mensagem foi ao cliente; o registro falhou (ex.: duplicidade) — observa.
        d.observability.error('document-request', 'anunciar:registro', now, registrado.unwrapErr().message);
      }
      d.observability.event('document-request', `anunciada ${state.requestId} → ${state.clientId}`, now);
      return { ok: true, erro: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      d.observability.error('document-request', 'anunciar', now, msg);
      return { ok: false, erro: msg };
    }
  }
}
