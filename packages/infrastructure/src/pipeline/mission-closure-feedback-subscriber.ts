// ─────────────────────────────────────────────────────────────────────────────
// MISSION CLOSURE FEEDBACK HOOK (GO-LIVE 11D) — o fio que faltava. Liga o
// encerramento REAL de uma missão ao ProductionFeedbackLoop (11C) que já existe.
//
// Assíncrono e desacoplado: é um EventSubscriber. No instante em que uma missão
// muda para ENCERRADA (evento operational-state com terminalState=ENCERRADA), o
// hook monta o EncerramentoAutomatico a partir de dados JÁ EXISTENTES (via um
// resolver injetado — nenhuma nova consulta/cálculo/contrato) e chama
// registrarEncerramento().
//
// FALHA ISOLADA: se o feedback falhar, o `handle` NUNCA lança — o encerramento
// da missão segue normalmente. Registra observabilidade (missionId, decisionId,
// correlationId, feedbackId, resultado, tempo) e permite reprocessamento (o
// evento pode ser reentregue; a operação é idempotente pelo store).
//
// Nada de Planner/Executive Mind/Strategic Reasoning/Conversation é tocado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type {
  DecisaoHumana,
  EncerramentoAutomatico,
  EventSubscriber,
  ObservabilityRuntime,
  ProductionFeedbackLoop,
  StoredEvent,
} from '@reconstrua/application';

/** Resolve os dados JÁ EXISTENTES de um encerramento a partir do evento. Retorna
 *  null quando o evento não é um encerramento de missão elegível. */
export type EncerramentoResolver = (event: StoredEvent) => EncerramentoAutomatico | null;

/** Ao encerrar automaticamente, a estratégia é registrada como estava — sem
 *  correção humana (o advogado pode corrigir depois pelo painel, fluxo 11C). */
const ENCERRAMENTO_AUTOMATICO: DecisaoHumana = { decisaoAdvogado: 'confirmada' };

export interface FeedbackHookDeps {
  readonly loop: ProductionFeedbackLoop;
  readonly resolver: EncerramentoResolver;
  readonly observability: ObservabilityRuntime;
  readonly uuid: UuidGenerator;
  readonly clock: Clock;
}

const CONFIANCAS = new Set(['alta', 'media', 'baixa']);

/** Resolver DEFAULT de produção: MAPEIA exclusivamente o que o evento de
 *  encerramento ENRIQUECIDO (12A) já carrega — nenhuma nova consulta/cálculo.
 *  Sem os identificadores mínimos já existentes (correlationId + cliente), NÃO
 *  fabrica registro. */
export const defaultEncerramentoResolver: EncerramentoResolver = (event) => {
  const p = event.payload;
  const str = (k: string): string | null => {
    const v = p[k];
    return typeof v === 'string' ? v : null;
  };
  const strArray = (k: string): readonly string[] => {
    const v = p[k];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };
  const num = (k: string): number => {
    const v = p[k];
    return typeof v === 'number' ? v : 0;
  };
  const correlationId = str('correlationId');
  const cliente = str('chatId') ?? str('cliente');
  if (correlationId === null || cliente === null) return null;

  const confRaw = str('confidence');
  const confianca =
    confRaw !== null && CONFIANCAS.has(confRaw)
      ? (confRaw as EncerramentoAutomatico['confianca'])
      : 'media';
  return {
    missionId: str('missionId') ?? event.streamId,
    decisionId: str('decisionId'),
    correlationId,
    cliente,
    advogado: str('advogado') ?? 'sistema',
    data: event.occurredAt,
    strategyRef: str('strategyRef') ?? event.provenance.operationalRuleRef ?? 'desconhecida',
    confianca,
    documentosRecebidos: strArray('documentosRecebidos'),
    documentosFaltantes: strArray('documentosFaltantes'),
    tempoAteDecisaoMs: num('tempoDaMissao'),
    fatosAprendidos: strArray('fatosAprendidos'),
  };
};

export class MissionClosureFeedbackSubscriber implements EventSubscriber {
  readonly name = 'mission-closure-feedback';
  // 13ª rodada: interestedIn é filtrado por event.eventType (não stream type).
  readonly interestedIn = ['operational-state.derived'];

  constructor(private readonly deps: FeedbackHookDeps) {}

  async handle(event: StoredEvent): Promise<void> {
    // Só reage ao instante do ENCERRAMENTO — ignora qualquer outro evento.
    if (event.streamType !== 'operational-state' || event.payload['terminalState'] !== 'ENCERRADA')
      return;

    const auto = this.deps.resolver(event);
    if (auto === null) return; // sem dados suficientes já existentes ⇒ no-op silencioso

    const now = this.deps.clock.now();
    const t0 = Date.now();
    const feedbackId = this.deps.uuid.next();

    // FALHA ISOLADA: registrar o feedback JAMAIS pode derrubar o encerramento.
    try {
      await this.deps.loop.registrarEncerramento(auto, ENCERRAMENTO_AUTOMATICO);
      this.deps.observability.event(
        'feedback-loop',
        `closed mission=${auto.missionId} decision=${auto.decisionId ?? 'none'} corr=${auto.correlationId} feedback=${String(feedbackId)} result=ok ms=${String(Date.now() - t0)}`,
        now,
      );
    } catch (e) {
      // Swallow: o encerramento segue; o feedback é assíncrono e reprocessável.
      this.deps.observability.error(
        'feedback-loop',
        `closed mission=${auto.missionId} decision=${auto.decisionId ?? 'none'} corr=${auto.correlationId} feedback=${String(feedbackId)} result=fail ms=${String(Date.now() - t0)}`,
        now,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
