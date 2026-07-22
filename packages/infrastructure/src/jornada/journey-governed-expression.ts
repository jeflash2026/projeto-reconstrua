// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY-GOVERNED EXPRESSION (decreto 2026-07-20) — o interceptador que faz a
// LLM parar de decidir o funil: enquanto a jornada comercial está ATIVA, a
// resposta do turno é a AUTORADA do Journey Runtime (determinística; a LLM não
// participa). Jornada CONCLUÍDA ⇒ delega à expressão normal (análise/pós-venda
// continuam humanizados pelo LLM, como antes).
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
      if (autorada !== '') return autorada; // a jornada GOVERNA: resposta determinística
    } catch {
      // Falha da jornada JAMAIS silencia a conversa: cai na expressão normal.
    }
    return this.inner.phrase(request); // CONCLUIDA/fora do funil ⇒ comportamento existente
  }
}
