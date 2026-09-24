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
import {
  acolhimentoAceitavel,
  ehRoteiroDeColeta,
  SILENCIO_DA_JORNADA,
} from '@reconstrua/application';
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
      // SILÊNCIO DECIDIDO (caso REAL Angela, 2026-09-24): a jornada governa e a
      // decisão é calar — lote de anexos já respondido. Não é "sem roteiro":
      // nem o roteiro fala, nem a LLM improvisa.
      if (autorada === SILENCIO_DA_JORNADA) return '';
      if (autorada !== '') {
        // A jornada GOVERNA o conteúdo; a LLM (quando real) governa só a VOZ.
        // Caso REAL Maria Aparecida (2026-07-29): o humanizador REESCREVEU o
        // roteiro da triagem e DERRUBOU o pedido do CPF ("preciso apenas do
        // seu extrato…"). Roteiros de COLETA da fase 1 (nome, cidade/estado,
        // CPF, HISCON) saem VERBATIM — cada palavra deles importa; a
        // humanização segue valendo para o resto (explicações, acolhimento).
        if (!this.humanizarComLlm) return autorada;
        // O roteiro de coleta continua SAINDO INTEIRO, palavra por palavra —
        // o que muda é que ele pode vir precedido de uma frase respondendo o
        // que a pessoa acabou de dizer (caso REAL Angela, 2026-09-24).
        if (ehRoteiroDeColeta(autorada)) return await this.acolher(request, autorada, entrada);
        return await this.humanizar(request, autorada);
      }
    } catch {
      // Falha da jornada JAMAIS silencia a conversa: cai na expressão normal.
    }
    // CONCLUIDA/fora do funil ⇒ a LLM fala. REDE PÓS-HISCON (caso REAL Candida,
    // 2026-08-11): se ela voltar a cobrar/ensinar um documento que a jornada
    // JÁ registrou, a fala é trocada por uma que CONDUZ (pede o CPF que falta,
    // manda o dossiê pedindo o SIM, ou dá o andamento sem reabrir prazo).
    const falaDoLlm = await this.inner.phrase(request);
    try {
      return await this.jornada.revisarFalaPosHiscon(request.intent.chatId, falaDoLlm);
    } catch {
      return falaDoLlm; // a rede nunca pode silenciar a conversa
    }
  }

  /** UMA frase respondendo o que a pessoa disse, ANTES do roteiro intacto.
   *
   *  Caso REAL Angela (2026-09-24): "Tenho empréstimo consignado que eu fiz" —
   *  e de volta, seca, a mesma cobrança do CPF. Perguntar sem nunca responder é
   *  o que faz o atendimento soar a interrogatório. A frase é do LLM, mas ele
   *  não toca no roteiro: escreve só a linha de cima, e a peneira determinística
   *  (`acolhimentoAceitavel`) descarta em qualquer dúvida — pergunta, link,
   *  número, promessa, cobrança de documento ou eco do próprio roteiro. Nada
   *  passou? O roteiro sai sozinho, exatamente como antes. */
  private async acolher(
    request: PhrasingRequest,
    roteiro: string,
    entrada: EntradaDoTurno,
  ): Promise<string> {
    try {
      if (!(await this.jornada.cabeAcolhimento(request.intent.chatId, entrada))) return roteiro;
      const pedido: PhrasingRequest = {
        ...request,
        styleGuidance:
          'Você é a Ahri, consultora do Projeto Reconstrua, falando com um cliente por WhatsApp. ' +
          `A pessoa acabou de escrever: «${entrada.texto.trim()}». ` +
          'Escreva UMA frase curta, natural e objetiva respondendo ao que ela disse — nada além disso. ' +
          'PROIBIDO: fazer qualquer pergunta, pedir documento/CPF/extrato, citar prazo, valor ou resultado, ' +
          'prometer qualquer coisa, usar link ou emoji. ' +
          'Se a MENSAGEM ABAIXO já responde o que ela disse, ou se não há nada a responder, devolva VAZIO. ' +
          `MENSAGEM QUE SERÁ ENVIADA LOGO DEPOIS DA SUA FRASE: «${roteiro}»`,
      };
      const bruto = (await this.inner.phrase(pedido)).trim();
      return acolhimentoAceitavel(bruto, roteiro) ? `${bruto}\n\n${roteiro}` : roteiro;
    } catch {
      return roteiro; // acolher é um extra; o roteiro nunca depende dele
    }
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
