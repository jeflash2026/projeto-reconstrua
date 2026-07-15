// ─────────────────────────────────────────────────────────────────────────────
// Testes da Entidade DOCUMENTO — unitários + invariantes. Cada teste cita a norma
// do Livro Mestre que verifica. Puro (sem infraestrutura).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { DocumentAggregate } from './document.js';
import type { DocumentRecognitionInput } from './document.js';
import { DocumentId } from './document-id.js';
import { MissionRef, DocumentRecognitionResponsibleRef } from './refs.js';
import { DocumentRecognized } from './document-events.js';
import { documentEntityInvariants, DOCUMENT_INVARIANTS_MANIFEST } from './document-invariants.js';
import { InvariantsEngine } from '../kernel/invariants-engine.js';

const DOC_UUID = '00000000-0000-4000-8000-000000000031';
const MISSION_UUID = '00000000-0000-4000-8000-0000000000a1';
const RESP_UUID = '00000000-0000-4000-8000-0000000000b2';

function validInput(): DocumentRecognitionInput {
  return {
    id: DocumentId.fromString(DOC_UUID),
    originText: 'whatsapp',
    incorporatedInto: [MissionRef.fromString(MISSION_UUID)],
    contentReferenceText: 'content-ref://opaque-immutable-handle-001',
    recognizedAt: new Date('2026-07-13T12:00:00.000Z'),
    recognizedBy: DocumentRecognitionResponsibleRef.fromString(RESP_UUID),
  };
}

describe('DocumentAggregate — reconhecimento (INV-D01; Lei do Reconhecimento)', () => {
  it('reconhece com origem, incorporação e conteúdo e emite DocumentRecognized', () => {
    const result = DocumentAggregate.recognize(validInput());
    expect(result.isOk()).toBe(true);

    const doc = result.unwrap();
    const events = doc.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(DocumentRecognized);
    expect(events[0]?.eventName).toBe('document.recognized');
    expect(events[0]?.occurredAt.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(doc.pullDomainEvents()).toHaveLength(0);
  });

  it('INV-D02 — origem vazia impede o reconhecimento', () => {
    const result = DocumentAggregate.recognize({ ...validInput(), originText: '  ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-D02');
  });

  it('INV-D08 — sem incorporação a Missão impede o reconhecimento', () => {
    const result = DocumentAggregate.recognize({ ...validInput(), incorporatedInto: [] });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-D08');
  });

  it('INV-D10 — sem conteúdo probatório impede o reconhecimento', () => {
    const result = DocumentAggregate.recognize({ ...validInput(), contentReferenceText: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-D10');
  });

  it('INV-D03 — momento inválido impede o reconhecimento', () => {
    const result = DocumentAggregate.recognize({ ...validInput(), recognizedAt: new Date('x') });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-D03');
  });

  it('INV-D03 — responsável é obrigatório (tipo e runtime)', () => {
    // @ts-expect-error INV-D03: responsável é obrigatório (garantia de tipo).
    const result = DocumentAggregate.recognize({ ...validInput(), recognizedBy: undefined });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().invariantId).toBe('INV-D03');
  });
});

describe('DocumentAggregate — individualização (INV-D13)', () => {
  it('mesma DocumentId => igual; ids diferentes => diferentes', () => {
    const a = DocumentAggregate.recognize(validInput()).unwrap();
    const b = DocumentAggregate.recognize(validInput()).unwrap();
    expect(a.equals(b)).toBe(true);
    const other = DocumentAggregate.recognize({
      ...validInput(),
      id: DocumentId.fromString('00000000-0000-4000-8000-0000000000ff'),
    }).unwrap();
    expect(a.equals(other)).toBe(false);
  });
});

describe('DocumentAggregate — estrutura proíbe estado/veracidade/valor jurídico', () => {
  it('não expõe estado, decisão, conclusão, valor jurídico, classificação nem validação (INV-D04/D06/D07)', () => {
    const doc = DocumentAggregate.recognize(validInput()).unwrap();
    for (const forbidden of [
      'state',
      'estado',
      'decision',
      'conclusion',
      'valorJuridico',
      'legalValue',
      'classification',
      'validate',
      'approve',
      'isValid',
      'owner',
    ]) {
      expect(forbidden in doc).toBe(false);
    }
  });
});

describe('DocumentAggregate — invariantes de entidade (InvariantsEngine)', () => {
  it('um Documento reconhecido satisfaz as invariantes de nível de entidade', () => {
    const doc = DocumentAggregate.recognize(validInput()).unwrap();
    const result = InvariantsEngine.enforce(doc, documentEntityInvariants);
    expect(result.isOk()).toBe(true);
  });
});

describe('DocumentAggregate — manifesto de invariantes (cobertura do Canon)', () => {
  it('cobre exatamente INV-D01..INV-D14, sem lacunas nem duplicatas', () => {
    const ids = DOCUMENT_INVARIANTS_MANIFEST.map((s) => s.id);
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    for (let n = 1; n <= 14; n += 1) {
      const id = `INV-D${String(n).padStart(2, '0')}`;
      expect(ids).toContain(id);
    }
  });
});
