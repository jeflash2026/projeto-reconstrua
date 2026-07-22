// ─────────────────────────────────────────────────────────────────────────────
// Testes da cadeia LOCAL-PRIMEIRO — a lógica de decisão econômica e segura:
// PDF nativo ⇒ local (custo zero, sem Vision); PDF escaneado/foto ⇒ Vision.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { DocumentReaderPort, LeituraDeDocumento } from './document-reader-port.js';
import type { PdfTextExtractorPort } from './pdf-text-extractor.js';
import { LocalFirstDocumentReader } from './local-first-reader.js';

class FakeExtractor implements PdfTextExtractorPort {
  calls = 0;
  constructor(private readonly resultado: string | null) {}
  extract(): Promise<string | null> {
    this.calls += 1;
    return Promise.resolve(this.resultado);
  }
}

class FakeVision implements DocumentReaderPort {
  calls = 0;
  read(): Promise<LeituraDeDocumento | null> {
    this.calls += 1;
    return Promise.resolve({ texto: 'TRANSCRITO PELA IA', tokensIn: 30000, tokensOut: 16000 });
  }
}

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

describe('LocalFirstDocumentReader', () => {
  it('PDF NATIVO (texto local substancial) ⇒ usa o local, metodo=local, NUNCA chama a Vision', async () => {
    const extractor = new FakeExtractor(
      'CONTRATO: 123 BANCO: 001 SITUACAO: Ativo — extrato de empréstimos consignados do INSS',
    );
    const vision = new FakeVision();
    const r = await new LocalFirstDocumentReader({ extractor, vision }).read(
      bytes,
      'application/pdf',
    );
    expect(r?.metodo).toBe('local');
    expect(r?.texto).toContain('CONTRATO: 123');
    expect(r?.tokensIn).toBeNull();
    expect(vision.calls).toBe(0); // custo ZERO — a IA nem foi tocada
  });

  it('PDF ESCANEADO (sem camada de texto) ⇒ cai na Vision, metodo=vision', async () => {
    const extractor = new FakeExtractor(null);
    const vision = new FakeVision();
    const r = await new LocalFirstDocumentReader({ extractor, vision }).read(
      bytes,
      'application/pdf',
    );
    expect(r?.metodo).toBe('vision');
    expect(r?.texto).toBe('TRANSCRITO PELA IA');
    expect(r?.tokensIn).toBe(30000);
    expect(vision.calls).toBe(1);
  });

  it('PDF com texto ÍNFIMO (abaixo do piso) ⇒ Vision (foto disfarçada de PDF)', async () => {
    const extractor = new FakeExtractor('pg 1'); // < 40 chars
    const vision = new FakeVision();
    const r = await new LocalFirstDocumentReader({ extractor, vision }).read(
      bytes,
      'application/pdf',
    );
    expect(r?.metodo).toBe('vision');
    expect(vision.calls).toBe(1);
  });

  it('IMAGEM (JPG/PNG) ⇒ Vision direto (o extrator local nem é chamado)', async () => {
    const extractor = new FakeExtractor('irrelevante');
    const vision = new FakeVision();
    const r = await new LocalFirstDocumentReader({ extractor, vision }).read(bytes, 'image/jpeg');
    expect(r?.metodo).toBe('vision');
    expect(extractor.calls).toBe(0);
    expect(vision.calls).toBe(1);
  });

  it('extrator LANÇA ⇒ nunca derruba; cai na Vision', async () => {
    const extractor: PdfTextExtractorPort = {
      extract: () => Promise.reject(new Error('pdf boom')),
    };
    const vision = new FakeVision();
    const r = await new LocalFirstDocumentReader({ extractor, vision }).read(
      bytes,
      'application/pdf',
    );
    expect(r?.metodo).toBe('vision');
    expect(vision.calls).toBe(1);
  });
});
