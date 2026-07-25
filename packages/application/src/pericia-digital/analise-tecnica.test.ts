// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · testes da ANÁLISE TÉCNICA (Decreto 2026-07-24).
// Dados FICTÍCIOS. Prova: extrai só o que existe; ausência ⇒ frase canônica;
// assinatura criptográfica ⇒ validação externa (nunca invalida sozinha).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { NAO_APRESENTADO } from './linguagem-segura.js';
import {
  analisarMetadadosPdf,
  analisarTrilhaAuditoria,
  classificarAssinatura,
} from './analise-tecnica.js';

const b64 = (s: string): string => Buffer.from(s, 'latin1').toString('base64');

describe('Metadados de PDF', () => {
  it('extrai versão, datas, produtor e revisões do que o PDF carrega', () => {
    const pdf =
      '%PDF-1.7\n/CreationDate (D:20240101120000)\n/ModDate (D:20240102130000)\n' +
      '/Producer (Gerador Ficticio)\n%%EOF\n/incremental\n%%EOF\n';
    const m = analisarMetadadosPdf(b64(pdf));
    expect(m.versaoPdf).toBe('1.7');
    expect(m.dataCriacao).toBe('D:20240101120000');
    expect(m.produtor).toBe('Gerador Ficticio');
    expect(m.revisoes).toBe(2); // dois %%EOF = duas gravações
    expect(m.naoEhPdf).toBe(false);
  });
  it('conteúdo que não é PDF ⇒ ausências canônicas, sem forçar interpretação', () => {
    const m = analisarMetadadosPdf(b64('isto nao e um pdf'));
    expect(m.naoEhPdf).toBe(true);
    expect(m.versaoPdf).toBe(NAO_APRESENTADO);
    expect(m.produtor).toBe(NAO_APRESENTADO);
  });
});

describe('Assinaturas eletrônicas', () => {
  it('assinatura criptográfica ⇒ NECESSITA_VALIDACAO_EXTERNA (nunca invalida)', () => {
    const pdf = '%PDF-1.7\n/Type /Sig /ByteRange [0 100 200 300] /SubFilter /ETSI.CAdES\n%%EOF';
    const a = classificarAssinatura(b64(pdf));
    expect(a.classificacao).toBe('NECESSITA_VALIDACAO_EXTERNA');
    expect(a.observacao.toLowerCase()).toContain('não se invalida por não ser icp-brasil');
  });
  it('sem elementos ⇒ ASSINATURA_NAO_DETECTADA (ausência canônica)', () => {
    const a = classificarAssinatura(b64('%PDF-1.4\ntexto qualquer\n%%EOF'));
    expect(a.classificacao).toBe('ASSINATURA_NAO_DETECTADA');
    expect(a.observacao).toBe(NAO_APRESENTADO);
  });
  it('imagem de assinatura sem dicionário ⇒ classifica como imagem', () => {
    const a = classificarAssinatura(
      b64('%PDF-1.4\nsem cripto\n%%EOF'),
      'contém assinatura do cliente',
    );
    expect(a.classificacao).toBe('ASSINATURA_DIGITALIZADA_COMO_IMAGEM');
  });
});

describe('Trilha de auditoria', () => {
  it('reporta PRESENTE para o que consta e NÃO APRESENTADO para o resto', () => {
    const texto =
      'Acesso registrado. IP: 200.150.10.20 em 01/01/2024 12:00 UTC. ' +
      'user-agent: Mozilla Chrome Android. session-id: abc.';
    const itens = analisarTrilhaAuditoria(texto);
    const porEl = new Map(itens.map((i) => [i.elemento, i.status]));
    expect(porEl.get('IP')).toBe('PRESENTE_MAS_INCOMPLETO');
    expect(porEl.get('User-agent')).toBe('PRESENTE_MAS_INCOMPLETO');
    expect(porEl.get('IMEI')).toBe('NAO_APRESENTADO');
    expect(porEl.get('UUID')).toBe('NAO_APRESENTADO');
    // Ausência traz a frase canônica como evidência.
    expect(itens.find((i) => i.elemento === 'IMEI')?.evidencia).toBe(NAO_APRESENTADO);
  });
});
