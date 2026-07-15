// ─────────────────────────────────────────────────────────────────────────────
// Reidratação genérica — reconstrução de estado a partir dos eventos (memória
// oficial). O motor é agnóstico do agregado: recebe uma semente e um `fold`
// (reducer) fornecido pelo chamador. Isso permite reconstituir qualquer projeção
// de um stream SEM que o Event Store conheça o domínio e SEM alterar o domínio
// congelado (as fábricas do domínio validam invariantes na escrita; a reidratação
// reproduz o histórico já validado).
//
// NOTA ARQUITETURAL (registrada na auditoria): os eventos de domínio congelados são
// contratos mínimos (eventName/occurredAt/aggregateId). A reidratação PROFUNDA do
// estado interno de um agregado dependerá do enriquecimento aditivo dos payloads de
// evento — extensão FUTURA e autorizada, que NÃO altera este motor nem o domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { StoredEvent } from './stored-event.js';

/** Resultado de uma reidratação: estado reconstruído + versão alcançada. */
export interface Rehydrated<S> {
  readonly state: S;
  readonly version: number;
}

/** Reducer que aplica um evento ao estado acumulado. */
export type Fold<S> = (state: S, event: StoredEvent) => S;

/**
 * Reconstrói o estado dobrando os eventos em ordem. Valida que as versões são
 * contíguas a partir de `fromVersion` (default 0); versões fora de ordem indicam
 * corrupção e lançam.
 */
export function rehydrate<S>(
  seed: S,
  events: readonly StoredEvent[],
  fold: Fold<S>,
  fromVersion = 0,
): Rehydrated<S> {
  let state = seed;
  let version = fromVersion;
  for (const event of events) {
    if (event.version !== version + 1) {
      throw new Error(
        `Reidratação: versão fora de sequência (esperado ${String(version + 1)}, obtido ${String(event.version)}).`,
      );
    }
    state = fold(state, event);
    version = event.version;
  }
  return { state, version };
}
