// ─────────────────────────────────────────────────────────────────────────────
// DECISION STATE PROJECTION SUBSCRIBER (RFC-0035-G) — o PROJETOR. É um
// `EventSubscriber` (port congelado de 2A), drenado pelo mesmo Dispatcher que
// alimenta AdminProjection e Workflow. Folda o log de eventos no Decision State
// Read Model, por missão. NÃO decide, NÃO muta domínio, NÃO lê outra projeção.
//
// Consome SOMENTE eventos cujo produtor emite conteúdo real hoje (RFC-0035-H):
//   • `operational-truth.synthesized`                 → `truthEstablished = true`.
//   • `operational-state.derived` (`terminalState`)   → B4.1: `terminalState = 'ENCERRADA'`.
//   • `operational-state.derived` (`reopened:true`)    → B4.3: LIMPA a terminalidade.
// Os demais eventos de Estado/Etapa são CONTRATOS VAZIOS (sem código) e por isso NÃO
// são consumidos para conteúdo — nenhum valor é inventado. Idempotente: reaplicar um
// evento já refletido é no-op (reconstrutível por replay).
//
// B4.1 — TERMINALIDADE STICKY: só a derivação que carrega `terminalState:'ENCERRADA'`
// torna o Estado terminal. Uma derivação normal (sem terminalState) NÃO limpa o
// encerramento — do contrário um documento tardio "reabriria" a missão sem ato humano.
// B4.3 — só a REABERTURA EXPLÍCITA (`reopened:true`, evento append-only) limpa a
// terminalidade e devolve o processo ao acompanhamento recorrente (B4.2).
// ─────────────────────────────────────────────────────────────────────────────
import type { EventSubscriber, StoredEvent } from '@reconstrua/application';
import type { DecisionStateStore } from './decision-state-read-model.js';

/** Eventos com produtor de conteúdo real para a decisão hoje (RFC-0035-H / B4.1, 🟢). */
const TRUTH_SYNTHESIZED = 'operational-truth.synthesized';
const STATE_DERIVED = 'operational-state.derived';

/** missionId do evento: streamId (stream 'mission') ou payload.missionId (demais). */
function missionIdOf(event: StoredEvent): string | null {
  if (event.streamType === 'mission') return event.streamId;
  const fromPayload = event.payload['missionId'];
  return typeof fromPayload === 'string' ? fromPayload : null;
}

export class DecisionStateProjectionSubscriber implements EventSubscriber {
  readonly name = 'decision-state';
  readonly interestedIn = [TRUTH_SYNTHESIZED, STATE_DERIVED];

  constructor(private readonly store: DecisionStateStore) {}

  async handle(event: StoredEvent): Promise<void> {
    const missionId = missionIdOf(event);
    if (missionId === null) return;

    if (event.eventType === TRUTH_SYNTHESIZED) {
      const current = await this.store.load(missionId);
      if (current?.truthEstablished === true) return; // idempotente
      await this.store.save({
        missionId,
        truthEstablished: true,
        // preserva a terminalidade já projetada (não regride o encerramento)
        ...(current?.terminalState ? { terminalState: current.terminalState } : {}),
        updatedAt: event.recordedAt,
      });
      return;
    }

    if (event.eventType === STATE_DERIVED) {
      // B4.3 — reabertura EXPLÍCITA limpa a terminalidade (ENCERRADA → em curso).
      // Só age sobre um registro EFETIVAMENTE encerrado; nunca inventa registro nem
      // regride uma missão já em curso (idempotente).
      if (event.payload['reopened'] === true) {
        const current = await this.store.load(missionId);
        if (current == null || current.terminalState == null) return; // nada a reabrir
        await this.store.save({
          missionId,
          truthEstablished: current.truthEstablished,
          terminalState: null,
          updatedAt: event.recordedAt,
        });
        return;
      }
      // B4.1 — só encerramento (terminalState:'ENCERRADA') afeta a decisão; o resto é no-op.
      if (event.payload['terminalState'] !== 'ENCERRADA') return;
      const current = await this.store.load(missionId);
      if (current?.terminalState === 'ENCERRADA') return; // idempotente
      await this.store.save({
        missionId,
        truthEstablished: current?.truthEstablished ?? true,
        terminalState: 'ENCERRADA',
        updatedAt: event.recordedAt,
      });
    }
  }
}
