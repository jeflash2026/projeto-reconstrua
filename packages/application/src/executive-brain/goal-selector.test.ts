// ─────────────────────────────────────────────────────────────────────────────
// Testes do GoalSelector — precedência de escalação (matéria humana / Canon
// silente), objetivo de coleta com pendências, e mapa Etapa→Objetivo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { GoalSelector } from './goal-selector.js';
import { emptySnapshot, type MissionSnapshot } from './mission-snapshot.js';

function snap(over: Partial<MissionSnapshot>): MissionSnapshot {
  return { ...emptySnapshot('m1'), ...over };
}

describe('GoalSelector', () => {
  const gs = new GoalSelector();

  it('matéria humana ou Canon silente ⇒ escalar (precedência absoluta)', () => {
    expect(gs.select(snap({ matterRequiresHuman: true, stageCode: 'ANALISE' }))).toBe(
      'escalate_to_human',
    );
    expect(gs.select(snap({ canonSilent: true }))).toBe('escalate_to_human');
  });

  it('pendência de documentos ⇒ coletar', () => {
    expect(gs.select(snap({ pendingDocuments: ['rg'] }))).toBe('collect_documents');
    expect(gs.select(snap({ awaitingDocuments: true }))).toBe('collect_documents');
  });

  it('mapa Etapa→Objetivo com fallback', () => {
    expect(gs.select(snap({ stageCode: 'CONCLUSAO' }))).toBe('conclude');
    expect(gs.select(snap({ stageCode: 'PRAZO' }))).toBe('monitor_deadline');
    expect(gs.select(snap({ stageCode: 'DESCONHECIDA' }))).toBe('accompany');
  });
});
