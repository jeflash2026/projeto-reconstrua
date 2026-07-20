// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION CONTEXT RUNTIME — monta a visão de contexto (read-only) que a
// expressão usa para soar viva e que o Brain consulta para decidir.
//
// Só LÊ (sessão + memória). Não decide, não muta nada. É o "aqui e agora" da
// conversa: sessão, janela recente, últimas falas da AHRI, último percept, silêncio.
// ─────────────────────────────────────────────────────────────────────────────
import type { Percept } from './percept.js';
import type { ConversationContextView, MissaoDaConversa, Session } from './ports.js';
import type { SessionRuntime } from './session-runtime.js';
import type { ConversationMemoryRuntime } from './conversation-memory-runtime.js';
import { MISSAO_PADRAO } from './sales-conversation-policy.js';

export interface ContextOptions {
  readonly memoryWindow: number;
  readonly outboundWindow: number;
}

export const DEFAULT_CONTEXT_OPTIONS: ContextOptions = {
  memoryWindow: 20,
  outboundWindow: 8,
};

/** PC-R4 — fornece o pacote de FATOS do caso (derivado da visão segura do Portal).
 *  Opcional e best-effort: falha ⇒ null; a conversa NUNCA quebra por causa dele. */
export type CasoFatosProvider = (chatId: string) => Promise<string | null>;

/** GO-LIVE 15A — fornece o ESTADO da missão (derivado do domínio). Opcional e
 *  best-effort: ausente/falha ⇒ LEAD (todo novo contato é um lead). */
export type MissaoProvider = (chatId: string) => Promise<MissaoDaConversa | null>;

/** GO-LIVE 15C-3 — fornece a PENDÊNCIA documental (derivada do Mission
 *  Snapshot). Opcional e best-effort: ausente/falha ⇒ nada pendente. */
export type PendenciaDocumentalProvider = (chatId: string) => Promise<NonNullable<ConversationContextView['pendenciaDocumental']> | null>;

/** Decreto "Jornada Documental Inicial" — fornece a contabilidade da Jornada 1
 *  (rótulos humanos). Opcional e best-effort: ausente/falha ⇒ null. */
export type OnboardingDocumentalProvider = (chatId: string) => Promise<NonNullable<ConversationContextView['onboardingDocumental']> | null>;

export class ConversationContextRuntime {
  private readonly options: ContextOptions;

  constructor(
    private readonly sessions: SessionRuntime,
    private readonly memory: ConversationMemoryRuntime,
    options: Partial<ContextOptions> = {},
    private readonly casoFatos?: CasoFatosProvider,
    private readonly missao?: MissaoProvider,
    private readonly pendencia?: PendenciaDocumentalProvider,
    private readonly onboarding?: OnboardingDocumentalProvider,
  ) {
    this.options = { ...DEFAULT_CONTEXT_OPTIONS, ...options };
  }

  async build(
    chatId: string,
    lastPercept: Percept | null,
    now: Date,
    silenceMs: number | null = null,
  ): Promise<ConversationContextView> {
    const session: Session = await this.sessions.getOrOpen(chatId, now);
    const [recentEntries, recentOutboundTexts, casoFatos, missao, pendencia, onboarding] = await Promise.all([
      this.memory.recent(chatId, this.options.memoryWindow),
      this.memory.recentOutboundTexts(chatId, this.options.outboundWindow),
      this.casoFatos !== undefined ? this.casoFatos(chatId).catch(() => null) : Promise.resolve(null),
      this.missao !== undefined ? this.missao(chatId).catch(() => null) : Promise.resolve(null),
      this.pendencia !== undefined ? this.pendencia(chatId).catch(() => null) : Promise.resolve(null),
      this.onboarding !== undefined ? this.onboarding(chatId).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      chatId,
      session,
      recentEntries,
      recentOutboundTexts,
      lastPercept,
      silenceMs,
      casoFatos,
      // GO-LIVE 15A — estado EXPLÍCITO da missão no contexto (default LEAD).
      missaoDaConversa: missao ?? MISSAO_PADRAO,
      // GO-LIVE 15C-3 — a pendência documental viva (do Mission Snapshot).
      pendenciaDocumental: pendencia,
      // Decreto "Jornada Documental Inicial" — a contabilidade da Jornada 1.
      onboardingDocumental: onboarding,
    };
  }
}
