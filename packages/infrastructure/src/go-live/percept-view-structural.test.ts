// ─────────────────────────────────────────────────────────────────────────────
// DECRETO (13ª rodada): envelope de mídia É artefato POR ESTRUTURA — a LLM não
// decide nenhum passo da jornada. Percepção degradada (enrichment null / sem
// artefatos detectados) NÃO pode impedir RO-2D-INGEST-DOC de disparar.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type {
  InboundEnvelope,
  Percept,
  PerceptEnrichment,
  PerceptKind,
} from '@reconstrua/application';
import { toPerceptView } from './full-loop-brain-adapter.js';

const NOW = new Date('2026-07-21T06:00:00.000Z');

function envelope(kind: PerceptKind): InboundEnvelope {
  return {
    messageId: 'MSG-1',
    chatId: '5517996332346@s.whatsapp.net',
    from: '5517996332346@s.whatsapp.net',
    kind,
    text: null,
    mediaUrl: null,
    mediaMimeType: null,
    fileName: null,
    location: null,
    contact: null,
    reactionEmoji: null,
    reactionToMessageId: null,
    editedText: null,
    deletedMessageId: null,
    silenceMs: null,
    timestamp: NOW,
  };
}

function percept(kind: PerceptKind, enrichment: PerceptEnrichment | null): Percept {
  return { id: 'P-1', envelope: envelope(kind), enrichment, perceivedAt: NOW };
}

const DEGRADE: PerceptEnrichment = {
  summary: 'entrada percebida: image',
  sentiment: 'unknown',
  urgency: 'unknown',
  detectedIntentSignal: null,
  detectedArtifacts: [],
  language: null,
  perceivedPurpose: 'unknown',
};

describe('toPerceptView · artefato ESTRUTURAL para mídia (independente da LLM)', () => {
  it('CENÁRIO REAL das rodadas: image + percepção DEGRADADA (0 artefatos da LLM) ⇒ hasArtifacts TRUE', () => {
    const view = toPerceptView(percept('image', DEGRADE));
    expect(view.hasArtifacts).toBe(true);
    expect(view.artifactCount).toBe(1);
    expect(view.kind).toBe('image');
  });

  it('image sem enrichment nenhum (null) ⇒ ainda é artefato', () => {
    const view = toPerceptView(percept('image', null));
    expect(view.hasArtifacts).toBe(true);
  });

  it('pdf e document também são artefatos por estrutura', () => {
    expect(toPerceptView(percept('pdf', DEGRADE)).hasArtifacts).toBe(true);
    expect(toPerceptView(percept('document', DEGRADE)).hasArtifacts).toBe(true);
  });

  it('LLM detectou MAIS artefatos que o estrutural ⇒ prevalece o maior', () => {
    const view = toPerceptView(
      percept('image', { ...DEGRADE, detectedArtifacts: ['rg-frente', 'rg-verso'] }),
    );
    expect(view.artifactCount).toBe(2);
  });

  it('texto puro continua SEM artefato (nada muda fora da mídia)', () => {
    const view = toPerceptView(percept('text', DEGRADE));
    expect(view.hasArtifacts).toBe(false);
    expect(view.artifactCount).toBe(0);
  });
});
