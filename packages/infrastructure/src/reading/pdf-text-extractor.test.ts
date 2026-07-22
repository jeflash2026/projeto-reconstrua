// ─────────────────────────────────────────────────────────────────────────────
// Testes do extrator LOCAL de PDF — prova que unpdf extrai o texto LITERAL de um
// PDF nativo (o mesmo caminho do HISCON do Meu INSS) e nunca lança em lixo.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { extrairTextoDePdf } from './pdf-text-extractor.js';

// PDF nativo MÍNIMO (gerado no dev; camada de texto real). Texto embutido:
// "CONTRATO: 987654 BANCO: 001 - BANCO DO BRASIL SITUACAO: Ativo".
const PDF_NATIVO_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA5MiA+PgpzdHJlYW0KQlQgL0YxIDEyIFRmIDUwIDc1MCBUZCAoQ09OVFJBVE86IDk4NzY1NCBCQU5DTzogMDAxIC0gQkFOQ08gRE8gQlJBU0lMIFNJVFVBQ0FPOiBBdGl2bykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAzODMgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0NTMKJSVFT0Y=';

describe('extrairTextoDePdf (extração LOCAL, custo zero)', () => {
  it('extrai o texto LITERAL de um PDF nativo — igual ao que o parser HISCON espera', async () => {
    const bytes = new Uint8Array(Buffer.from(PDF_NATIVO_BASE64, 'base64'));
    const texto = await extrairTextoDePdf(bytes);
    expect(texto).not.toBeNull();
    expect(texto).toContain('CONTRATO: 987654');
    expect(texto).toContain('BANCO: 001 - BANCO DO BRASIL');
    expect(texto).toContain('SITUACAO: Ativo');
  });

  it('bytes que NÃO são PDF ⇒ null (nunca lança; o chamador cai na Vision)', async () => {
    expect(await extrairTextoDePdf(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(await extrairTextoDePdf(new Uint8Array(0))).toBeNull();
  });

  it('NÃO detacha o buffer de entrada — os bytes seguem íntegros para a Vision (caso Maria)', async () => {
    const bytes = new Uint8Array(Buffer.from(PDF_NATIVO_BASE64, 'base64'));
    const tamanhoAntes = bytes.length;
    await extrairTextoDePdf(bytes);
    // Antes da correção, o pdf.js detachava o ArrayBuffer e bytes.length virava 0
    // — a Vision recebia o PDF vazio e a leitura do HISCON falhava (HTTP 400).
    expect(bytes.length).toBe(tamanhoAntes);
    expect(bytes.length).toBeGreaterThan(0);
    // E continua sendo um PDF válido (assinatura "%PDF-").
    expect(Array.from(bytes.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });
});
