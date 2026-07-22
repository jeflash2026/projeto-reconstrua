// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY-GOVERNED EXPRESSION (decreto 2026-07-20 + humanização 2026-07-22) —
// o interceptador que faz a LLM parar de DECIDIR o funil: enquanto a jornada
// comercial está ATIVA, o CONTEÚDO do turno é o ROTEIRO AUTORADO do Journey
// Runtime (determinístico — fatos, pedidos e ordem).
//
// Decreto de humanização (2026-07-22: "a AHRI jamais deve se comportar como um
// robô"): com LLM REAL disponível, o roteiro não sai verbatim — a LLM o REDIZ
// com palavras humanas e variadas (mesmos fatos, mesmos pedidos, mesma ordem;
// proibido inventar). Falha/vazio ⇒ o roteiro sai como está (nunca silêncio).
// Offline (testes/dev) ⇒ roteiro verbatim (determinismo dos testes preservado).
//
// Implementa o port congelado LlmExpressionPort — nada do 2B muda; apenas a
// implementação por trás do port. phrase() é somente-leitura (os fatos foram
// capturados no pré-hook serializado do ingress), então as re-chamadas do guard
// anti-repetição são inofensivas e idempotentes.
// ─────────────────────────────────────────────────────────────────────────────
import type { EntradaDoTurno, LlmExpressionPort, PhrasingRequest } from '@reconstrua/application';
import type { JornadaComercialRuntime } from './jornada-runtime.js';

export class JourneyGovernedExpression implements LlmExpressionPort {
  constructor(
    private readonly jornada: JornadaComercialRuntime,
    private readonly inner: LlmExpressionPort,
    /** true = LLM real disponível: o roteiro autorado é REDITO com naturalidade
     *  humana (fallback verbatim). false (offline/testes) = roteiro verbatim. */
    private readonly humanizarComLlm: boolean = false,
  ) {}

  async phrase(request: PhrasingRequest): Promise<string> {
    const chatId = request.intent.chatId;
    try {
      const envelope = request.context.lastPercept?.envelope ?? null;
      const entrada: EntradaDoTurno = {
        tipo:
          envelope !== null && (envelope.fileName != null || envelope.mediaUrl != null)
            ? 'documento'
            : 'texto',
        texto: envelope?.text ?? '',
        // Sinal TEMPORAL (follow-up) nunca é "primeiro contato" — sem isto, o
        // follow-up de um lead de 1 mensagem repetia as boas-vindas VERBATIM
        // (eco robótico que o guard agora silencia; caso Lucas 2026-07-22).
        primeiroContato: request.context.session.turns <= 1 && envelope?.kind !== 'timeout',
        timestamp: envelope?.timestamp ?? null,
      };
      const autorada = await this.jornada.responder(chatId, entrada);
      if (autorada !== '') {
        // A jornada GOVERNA o conteúdo; a LLM (quando real) governa só a VOZ.
        if (!this.humanizarComLlm) return autorada;
        return await this.humanizar(request, autorada);
      }
    } catch {
      // Falha da jornada JAMAIS silencia a conversa: cai na expressão normal.
    }
    return this.inner.phrase(request); // CONCLUIDA/fora do funil ⇒ comportamento existente
  }

  /** Rediz o roteiro com voz humana. QUALQUER falha ⇒ o roteiro verbatim. */
  private async humanizar(request: PhrasingRequest, roteiro: string): Promise<string> {
    try {
      const pedido: PhrasingRequest = {
        ...request,
        styleGuidance:
          `${request.styleGuidance}; ROTEIRO OBRIGATÓRIO DESTE TURNO — reescreva com as SUAS palavras, como uma consultora humana conversando (responda primeiro ao que a pessoa disse, se houver o que responder), mantendo TODOS os fatos, pedidos e a ordem do roteiro; ` +
          `PROIBIDO acrescentar promessas, pedidos novos, prazos ou emojis; PROIBIDO omitir o pedido do roteiro. ROTEIRO: «${roteiro}»`,
      };
      const humanizada = (await this.inner.phrase(pedido)).trim();
      return humanizada !== '' ? humanizada : roteiro;
    } catch {
      return roteiro;
    }
  }
}
