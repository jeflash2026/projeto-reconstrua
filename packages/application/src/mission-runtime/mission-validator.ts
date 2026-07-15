// ─────────────────────────────────────────────────────────────────────────────
// MISSION VALIDATOR — valida PRÉ-CONDIÇÕES universais antes de executar qualquer
// Use Case. Em especial: PROÍBE decisão sem Regra Operacional e sem registro
// DECISOR/FUNDAMENTO (nenhum Use Case pode ignorar Regras Operacionais). Pré-condições
// específicas de cada Use Case são verificadas dentro dele.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionContext } from './use-case.js';

export interface ValidationResult {
  readonly ok: boolean;
  readonly error: string | null;
}

export class MissionValidator {
  validate(ctx: MissionContext): ValidationResult {
    const intent = ctx.intent;
    if (intent.operationalRuleRef.trim() === '') {
      return { ok: false, error: 'decisão sem Regra Operacional — proibido (RO-R7-001)' };
    }
    if (intent.decisor.trim() === '' || intent.fundamento.trim() === '') {
      return { ok: false, error: 'decisão sem registro DECISOR/FUNDAMENTO (INV-AH-02)' };
    }
    if (ctx.facts.chatId.trim() === '') {
      return { ok: false, error: 'contexto de conversa ausente' };
    }
    return { ok: true, error: null };
  }
}
