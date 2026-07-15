// ─────────────────────────────────────────────────────────────────────────────
// GOAL SELECTOR — deriva o OBJETIVO operacional corrente da Verdade/Estado/Etapa.
// Determinístico e tabelar. Competência humana / Canon silente ⇒ escalar (DF-09; E10).
// Não decide ação; só nomeia o norte que orienta a estratégia.
// ─────────────────────────────────────────────────────────────────────────────
import type { Goal, MissionSnapshot } from './mission-snapshot.js';

const STAGE_GOALS: Readonly<Record<string, Goal>> = {
  ONBOARDING: 'onboard_client',
  COLETA_DOCUMENTOS: 'collect_documents',
  ANALISE: 'clarify_facts',
  INSTRUCAO: 'advance_stage',
  ACOMPANHAMENTO: 'accompany',
  PRAZO: 'monitor_deadline',
  AGUARDANDO_CLIENTE: 'await_client',
  CONCLUSAO: 'conclude',
};

export class GoalSelector {
  select(snapshot: MissionSnapshot): Goal {
    // Competência humana ou silêncio do Canon têm precedência absoluta.
    if (snapshot.matterRequiresHuman || snapshot.canonSilent) {
      return 'escalate_to_human';
    }
    if (snapshot.awaitingDocuments || snapshot.pendingDocuments.length > 0) {
      return 'collect_documents';
    }
    const byStage = STAGE_GOALS[snapshot.stageCode];
    return byStage ?? 'accompany';
  }
}
