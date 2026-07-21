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

/** A projeção mínima de que o resolver precisa (o TimelineProjector real satisfaz). */
export interface ProjecaoDeMissoes {
  missions(): readonly { readonly missionId: string; readonly chatId: string | null }[];
  refresh(): Promise<void>;
}

/**
 * Resolver AUTO-ATUALIZÁVEL do chat da missão — correção do defeito real de
 * produção: o projector em memória nasce VAZIO a cada restart do container e só
 * era atualizado pelas rotas do painel; sem isto, o primeiro documento
 * pós-deploy caía em "chat não resolvível" → retries → DLQ → classificação
 * perdida. Tenta; se não achar, faz refresh incremental (globalSeq) e tenta de
 * novo. Falha do refresh é tolerada (devolve null ⇒ retry do dispatcher).
 */
export function criarResolverDeChat(projector: ProjecaoDeMissoes): (missionId: string) => Promise<string | null> {
  return async (missionId) => {
    const achar = (): string | null => projector.missions().find((m) => m.missionId === missionId)?.chatId ?? null;
    let chat = achar();
    if (chat === null) {
      await projector.refresh().catch(() => undefined);
      chat = achar();
    }
    return chat;
  };
}

export interface OnboardingSubscriberDeps {
  readonly runtime: OnboardingDocumentalRuntime;
  /** Resolve o chatId REAL de uma missão (projeção do vínculo chat↔missão).
   *  ASSÍNCRONO por decreto do defeito real de produção: o projector em memória
   *  nasce VAZIO a cada restart do container e só era atualizado pelas rotas do
   *  painel — o resolver precisa poder se AUTO-ATUALIZAR (refresh incremental)
   *  antes de desistir. */
  readonly chatDaMissao: (missionId: string) => Promise<string | null>;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
  /** SOLUÇÃO DEFINITIVA do descompasso (4 rodadas de teste real): o vínculo da
   *  mídia é assíncrono e a classificação perdia o turno — a resposta saía com
   *  a contabilidade velha e o LLM improvisava (pulava o verso). Com o sleeper,
   *  o subscriber ESPERA a transcrição DENTRO do turno (o drain roda antes da
   *  fala): a AHRI só responde depois de ENXERGAR o documento. */
  readonly sleeper?: { sleep(ms: number): Promise<void> } | null;
  /** PROGRESSÃO AUTOMÁTICA (5ª rodada): registro concluído ⇒ a AHRI envia
   *  SOZINHA a mensagem autorada "✅ Registrado: X! Agora me manda: Y" —
   *  determinística, sem LLM, no turno OU segundos depois (retry). A conversa
   *  do turno só dá o ack ("recebi, registrando"); quem progride é esta. */
  readonly comunicador?: { enviar(chatId: string, texto: string): Promise<void> } | null;
  /** Decreto de diagnóstico (7ª rodada): quando o registro conclui DENTRO do
   *  turno, a PRÓPRIA resposta da jornada fala o fato ("Recebi a frente do RG.
   *  Agora envie o verso.") — o subscriber então só envia a progressão TARDIA
   *  (marcador aguardandoProgressao ativo = o turno respondeu só o ack). */
  readonly jornada?: {
    estaAguardandoProgressao(chatId: string): Promise<boolean>;
    concluirProgressao(chatId: string): Promise<void>;
  } | null;
}

/** Espera local pela transcrição: N tentativas com intervalo — dentro do turno. */
const ESPERA_TENTATIVAS = 4;
const ESPERA_MS = 4000;

export class OnboardingDocumentalSubscriber implements EventSubscriber {
  readonly name = 'onboarding-documental';
  // CAUSA RAIZ da 13ª rodada: o registry filtra por event.eventType — declarar
  // stream types aqui ('mission','document') fazia o subscriber NUNCA receber
  // entrega nenhuma em produção (zero deliveries na história).
  readonly interestedIn = ['mission.created', 'document.recognized'];

  constructor(private readonly deps: OnboardingSubscriberDeps) {}

  async handle(event: StoredEvent): Promise<void> {
    const d = this.deps;
    const now = d.clock.now();

    if (event.streamType === 'mission' && event.eventType === 'mission.created') {
      const chatId = await d.chatDaMissao(event.streamId);
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
      const chatId = await d.chatDaMissao(missionId);
      if (chatId === null) {
        throw new Error(`onboarding: chat da missão ${missionId} ainda não resolvível (documento ${event.streamId})`);
      }
      const fileName = typeof event.payload['contentReference'] === 'string' ? event.payload['contentReference'] : '';
      let resultado = await d.runtime.aoReconhecerDocumento(chatId, missionId, event.streamId, fileName, now);
      // ESPERA DENTRO DO TURNO: a captura/vínculo da mídia leva segundos; sem
      // esperar, a classificação só chegava DEPOIS da resposta — e a conversa
      // falava com dados velhos. Espera curta e limitada; o retry 2A.2 continua
      // sendo a rede de segurança se a transcrição não vier a tempo.
      if (resultado.classificacaoPendente && d.sleeper) {
        for (let tentativa = 0; tentativa < ESPERA_TENTATIVAS && resultado.classificacaoPendente; tentativa += 1) {
          await d.sleeper.sleep(ESPERA_MS);
          resultado = await d.runtime.aoReconhecerDocumento(chatId, missionId, event.streamId, fileName, d.clock.now());
        }
      }
      if (resultado.classificacaoPendente) {
        // Texto ainda não transcrito E nome do arquivo insuficiente ⇒ retry 2A.2.
        throw new Error(`onboarding: classificação pendente do documento ${event.streamId} (transcrição ausente)`);
      }
      // 14ª rodada: 'OUTRO' com texto PRESENTE era sucesso mudo (o cliente ficava
      // no ack para sempre e nada aparecia nos logs). Agora a causa é literal:
      // o excerto do texto lido mostra POR QUE os sinais não casaram.
      if (resultado.classificacao === 'OUTRO') {
        d.observability.error(
          'onboarding',
          'classificacao',
          now,
          `documento ${event.streamId} ficou OUTRO com texto presente :: "${(resultado.textoExcerto ?? '').replace(/\s+/g, ' ')}"`,
        );
        return;
      }
      // PROGRESSÃO AUTOMÁTICA: registro novo ⇒ a AHRI avisa e pede o próximo,
      // sozinha (best-effort: falha de envio nunca desfaz o registro; a cliente
      // ainda pode perguntar e a conversa, com a contabilidade certa, responde).
      // 7ª rodada: registro DENTRO do turno ⇒ a resposta da jornada fala o fato
      // — aqui só a progressão TARDIA (marcador ativo). Sem jornada ligada
      // (testes/legado) ⇒ comportamento anterior (sempre envia).
      if (resultado.progresso !== null && d.comunicador) {
        const tardio = d.jornada ? await d.jornada.estaAguardandoProgressao(chatId).catch(() => true) : true;
        if (tardio) {
          await d.comunicador.enviar(chatId, resultado.progresso).catch((e: unknown) => {
            d.observability.error('onboarding', 'progresso-envio', now, e instanceof Error ? e.message : String(e));
          });
          if (d.jornada) await d.jornada.concluirProgressao(chatId).catch(() => undefined);
        }
      }
      d.observability.event(
        'onboarding',
        `documento ${event.streamId} classificado=${resultado.classificacao}${resultado.jaRecebido ? ' (repetido)' : ''} faltam=${resultado.faltando.length}`,
        now,
      );
    }
  }
}
