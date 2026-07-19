// ─────────────────────────────────────────────────────────────────────────────
// FATOS ESTRATÉGICOS (GO-LIVE 10A) — as ENTRADAS do raciocínio, achatadas no
// MESMO formato BrainFacts: Truth Layer (caseExists/casePhase/onboarding*/…),
// documentos recebidos e o Conversation Knowledge (fatos aprendidos — 9G).
// Nada de conversa/sessão/nota entra aqui: só fatos.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts, FactValue } from '../executive-brain/facts.js';
import type { FatoAprendido } from '../conversation/conversation-knowledge.js';

export interface EntradasEstrategicas {
  /** Fatos da Truth Layer (ex.: saída de buildFacts — caseExists, casePhase…). */
  readonly truthFacts?: BrainFacts | null;
  /** Conhecimento adquirido na conversa (9G). */
  readonly conhecimento?: readonly FatoAprendido[];
  /** Rótulos dos documentos RECEBIDOS (domínio) — viram fatos doc_<label>=true. */
  readonly documentosRecebidos?: readonly string[];
}

/** Achata as entradas no formato único de fatos do raciocínio. Determinístico. */
export function fatosEstrategicos(entradas: EntradasEstrategicas): BrainFacts {
  const out: Record<string, FactValue> = { ...(entradas.truthFacts ?? {}) };

  for (const f of entradas.conhecimento ?? []) {
    out[f.factKey] = f.valor;
  }

  const docs = entradas.documentosRecebidos ?? [];
  out['documentos_recebidos'] = docs.length;
  for (const d of docs) {
    out[`doc_${d.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`] = true;
  }

  return out;
}
