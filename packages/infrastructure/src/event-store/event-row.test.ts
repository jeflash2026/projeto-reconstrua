// ─────────────────────────────────────────────────────────────────────────────
// REGRESSÃO da 14ª rodada (GO LIVE): payload chegava DUPLAMENTE codificado do
// Postgres (JSON.stringify no INSERT + serialização jsonb do driver ⇒ jsonb-
// STRING). rowToStoredEvent fazia cast cego ⇒ subscribers recebiam uma STRING e
// payload['missionId']/['origin'] viravam undefined: o onboarding no-opava em
// silêncio e o projetor nunca criava o vínculo chat↔missão.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { decodePayload, rowToStoredEvent } from './event-row.js';

const ROW = {
  id: 'e-1', stream_type: 'document', stream_id: 'd-1', version: 1,
  event_type: 'document.recognized', is_relevant: true,
  fact_ref: null, actor: 'AHRI', decision_type: null, fundamento: null, operational_rule_ref: null,
  previous_hash: null, hash: 'h', occurred_at: new Date(), recorded_at: new Date(), global_seq: 186,
};

describe('decodePayload · dupla codificação histórica', () => {
  it('CENÁRIO REAL: payload como STRING JSON (linha dupla-codificada) ⇒ objeto decodificado', () => {
    const e = rowToStoredEvent({
      ...ROW,
      payload: '{"aggregateId":"9c912714","missionId":"993ac7f3","mimeType":"image/jpeg"}',
    });
    expect(e.payload['missionId']).toBe('993ac7f3');
    expect(e.payload['mimeType']).toBe('image/jpeg');
  });

  it('payload como OBJETO (linhas novas, pós-correção do INSERT) ⇒ intacto', () => {
    const e = rowToStoredEvent({ ...ROW, payload: { missionId: 'm-1' } });
    expect(e.payload['missionId']).toBe('m-1');
  });

  it('payload nulo/ausente/inválido ⇒ {} sem lançar', () => {
    expect(rowToStoredEvent({ ...ROW, payload: null }).payload).toEqual({});
    expect(decodePayload(undefined)).toEqual({});
    expect(decodePayload('texto que nao é json')).toEqual({});
    expect(decodePayload('"uma string json"')).toEqual({});
    expect(decodePayload('[1,2]')).toEqual({});
  });
});
