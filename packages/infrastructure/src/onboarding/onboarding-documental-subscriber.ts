// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING DOCUMENTAL SUBSCRIBER (Decreto "Jornada Documental Inicial") —
// alimenta a contabilidade canônica da Jornada 1 a partir dos eventos REAIS:
//
//   • mission.created      ⇒ SEMEIA a jornada (os 3 obrigatórios pendentes
//                            desde o primeiro momento) e sincroniza o ALIR;
//   • document.recognized  ⇒ CLASSIFICA (texto transcrito pelo Reader + nome
//                            do arquivo; regras explícitas) e atualiza o que
//                            chegou/falta.
//
// RETRY LEGÍTIMO (2A.2): o vínculo documento→mídia é ASSÍNCRONO (CAT-02B); se o
// texto ainda não está legível e o nome do arquivo não bastou, o subscriber
// LANÇA — o Dispatcher reentrega com backoff e a classificação acontece quando
// a transcrição existir. Esgotadas as tentativas (DLQ), a jornada simplesmente
// continua cobrando (modo de falha seguro do decreto). O mesmo vale quando o
// chat da missão ainda não é resolvível (a projeção do vínculo é incremental).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { EventSubscriber, ObservabilityRuntime, OnboardingDocumentalRuntime, StoredEvent } from '@reconstrua/application';

export interface OnboardingSubscriberDeps {
  readonly runtime: OnboardingDocumentalRuntime;
  /** Resolve o chatId REAL de uma missão (projeção do vínculo chat↔missão). */
  readonly chatDaMissao: (missionId: string) => string | null;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class OnboardingDocumentalSubscriber implements EventSubscriber {
  readonly name = 'onboarding-documental';
  readonly interestedIn = ['mission', 'document'];

  constructor(private readonly deps: OnboardingSubscriberDeps) {}

  async handle(event: StoredEvent): Promise<void> {
    const d = this.deps;
    const now = d.clock.now();

    if (event.streamType === 'mission' && event.eventType === 'mission.created') {
      const chatId = d.chatDaMissao(event.streamId);
      if (chatId === null) {
        // A projeção do vínculo pode estar um ciclo atrás ⇒ reentrega resolve.
        throw new Error(`onboarding: chat da missão ${event.streamId} ainda não resolvível`);
      }
      await d.runtime.aoCriarMissao(chatId, event.streamId, now);
      d.observability.event('onboarding', `jornada semeada chat=${chatId} missao=${event.streamId}`, now);
      return;
    }

    if (event.streamType === 'document' && event.eventType === 'document.recognized') {
      const missionId = typeof event.payload['missionId'] === 'string' ? event.payload['missionId'] : null;
      if (missionId === null) return;
      const chatId = d.chatDaMissao(missionId);
      if (chatId === null) {
        throw new Error(`onboarding: chat da missão ${missionId} ainda não resolvível (documento ${event.streamId})`);
      }
      const fileName = typeof event.payload['contentReference'] === 'string' ? event.payload['contentReference'] : '';
      const resultado = await d.runtime.aoReconhecerDocumento(chatId, missionId, event.streamId, fileName, now);
      if (resultado.classificacaoPendente) {
        // Texto ainda não transcrito E nome do arquivo insuficiente ⇒ retry 2A.2.
        throw new Error(`onboarding: classificação pendente do documento ${event.streamId} (transcrição ausente)`);
      }
      d.observability.event(
        'onboarding',
        `documento ${event.streamId} classificado=${resultado.classificacao}${resultado.jaRecebido ? ' (repetido)' : ''} faltam=${resultado.faltando.length}`,
        now,
      );
    }
  }
}
