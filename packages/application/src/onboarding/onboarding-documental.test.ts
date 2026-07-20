// ─────────────────────────────────────────────────────────────────────────────
// JORNADA 1 — DOCUMENTAÇÃO INICIAL (decreto): classificação determinística,
// ordem fixa (HISCON primeiro), contabilidade canônica e sincronização das
// pendências (ALIR/Readiness enxergam a mesma verdade).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  DOCUMENTACAO_INICIAL,
  OnboardingDocumentalRuntime,
  classificarDocumentoInicial,
  completo,
  faltando,
  novoOnboarding,
  proximo,
  type OnboardingDocumentalState,
  type OnboardingDocumentalStore,
} from './onboarding-documental.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const CHAT = '5517996332346@s.whatsapp.net';

class MemStore implements OnboardingDocumentalStore {
  private state: OnboardingDocumentalState | null = null;
  load(): Promise<OnboardingDocumentalState | null> { return Promise.resolve(this.state); }
  save(s: OnboardingDocumentalState): Promise<void> { this.state = s; return Promise.resolve(); }
}

function harness(textos: Record<string, string | null> = {}) {
  const store = new MemStore();
  const pendenciasGravadas: string[][] = [];
  const runtime = new OnboardingDocumentalRuntime({
    store,
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: { setPendingDocuments: (_c, labels) => { pendenciasGravadas.push([...labels]); return Promise.resolve(); } },
  });
  return { store, runtime, pendenciasGravadas };
}

describe('Decreto · classificação DETERMINÍSTICA dos 3 obrigatórios', () => {
  it('HISCON: pelo texto transcrito ou pelo nome do arquivo', () => {
    expect(classificarDocumentoInicial('doc.pdf', 'HISTÓRICO DE EMPRÉSTIMO CONSIGNADO - INSS')).toBe('CNIS');
    expect(classificarDocumentoInicial('hiscon-julho.pdf', '')).toBe('CNIS');
    expect(classificarDocumentoInicial('extrato.pdf', 'Extrato de consignações do benefício')).toBe('CNIS');
  });
  it('RG/CNH: registro geral, habilitação, órgão emissor', () => {
    expect(classificarDocumentoInicial('IMG_1234.jpg', 'REGISTRO GERAL 12.345.678-9 ÓRGÃO EMISSOR SSP')).toBe('IDENTIDADE');
    expect(classificarDocumentoInicial('cnh.jpg', '')).toBe('IDENTIDADE');
    expect(classificarDocumentoInicial('foto.jpg', 'CARTEIRA NACIONAL DE HABILITAÇÃO')).toBe('IDENTIDADE');
  });
  it('comprovante de endereço: conta de luz/água, fatura de energia', () => {
    expect(classificarDocumentoInicial('conta.pdf', 'CEMIG — fatura de energia elétrica — vencimento')).toBe('COMPROVANTE_RESIDENCIA');
    expect(classificarDocumentoInicial('comprovante-de-endereco.jpg', '')).toBe('COMPROVANTE_RESIDENCIA');
  });
  it('nada reconhecível OU empate ⇒ OUTRO (jamais adivinhar)', () => {
    expect(classificarDocumentoInicial('IMG_9999.jpg', '')).toBe('OUTRO');
    expect(classificarDocumentoInicial('doc.pdf', 'texto qualquer sem sinais')).toBe('OUTRO');
  });
});

describe('Decreto · ordem FIXA e contabilidade', () => {
  it('a ordem é HISCON → RG/CNH → comprovante de endereço. Sempre.', () => {
    expect(DOCUMENTACAO_INICIAL).toEqual(['CNIS', 'IDENTIDADE', 'COMPROVANTE_RESIDENCIA']);
    const s = novoOnboarding(CHAT, 'M-1', NOW);
    expect(proximo(s)).toBe('CNIS'); // HISCON primeiro (15B)
    expect(faltando(s)).toHaveLength(3);
    expect(completo(s)).toBe(false);
  });
});

describe('Decreto · runtime da jornada', () => {
  it('semeia na criação da missão: os TRÊS pendentes sincronizados', async () => {
    const h = harness();
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(false);
    expect(h.pendenciasGravadas.at(-1)).toEqual(['CNIS', 'IDENTIDADE', 'COMPROVANTE_RESIDENCIA']);
    const visao = await h.runtime.visao(CHAT);
    expect(visao?.proximo).toContain('HISCON');
  });

  it('cada documento classificado atualiza a lista automaticamente até 100%', async () => {
    const h = harness({ d1: 'histórico de empréstimo consignado', d2: 'registro geral órgão emissor', d3: 'fatura de energia elétrica' });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);

    const r1 = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'doc.pdf', NOW);
    expect(r1.classificacao).toBe('CNIS');
    expect((await h.runtime.visao(CHAT))?.proximo).toContain('RG ou CNH'); // o próximo, imediatamente

    const r2 = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd2', 'IMG_1.jpg', NOW);
    expect(r2.classificacao).toBe('IDENTIDADE');
    expect((await h.runtime.visao(CHAT))?.proximo).toContain('comprovante de endereço');

    const r3 = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd3', 'IMG_2.jpg', NOW);
    expect(r3.classificacao).toBe('COMPROVANTE_RESIDENCIA');
    expect(r3.faltando).toHaveLength(0);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(true); // ⇒ ANALISE_ADMINISTRATIVA
    expect(h.pendenciasGravadas.at(-1)).toEqual([]); // ALIR/Readiness: nada pendente
  });

  it('documento do MESMO tipo reenviado não duplica a contabilidade', async () => {
    const h = harness({ d1: 'hiscon', d2: 'extrato de consignações' });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'a.pdf', NOW);
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd2', 'b.pdf', NOW);
    expect(r.jaRecebido).toBe(true);
    const visao = await h.runtime.visao(CHAT);
    expect(visao?.recebidos).toHaveLength(1);
  });

  it('sem transcrição E nome inútil ⇒ classificação PENDENTE (vale retentar)', async () => {
    const h = harness(); // leitor devolve null
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'dX', 'IMG_5555.jpg', NOW);
    expect(r.classificacao).toBe('OUTRO');
    expect(r.classificacaoPendente).toBe(true);
  });

  it('nome do arquivo claro dispensa a transcrição (sem retry desnecessário)', async () => {
    const h = harness();
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'dY', 'hiscon-do-cliente.pdf', NOW);
    expect(r.classificacao).toBe('CNIS');
    expect(r.classificacaoPendente).toBe(false);
  });

  it('jornada completa ⇒ documento novo NÃO pertence à Jornada 1 (é acervo/Jornada 2)', async () => {
    const h = harness({ d1: 'hiscon', d2: 'registro geral', d3: 'conta de luz', d4: 'procuração assinada' });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'a.pdf', NOW);
    await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd2', 'b.jpg', NOW);
    await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd3', 'c.jpg', NOW);
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd4', 'procuracao.pdf', NOW);
    expect(r.classificacao).toBe('OUTRO');
    expect(r.classificacaoPendente).toBe(false); // nunca retenta depois de 100%
    expect(await h.runtime.estaCompleto(CHAT)).toBe(true);
  });

  it('documento chega ANTES da semeadura ⇒ a jornada nasce ali mesmo (lazy)', async () => {
    const h = harness({ d1: 'hiscon' });
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd1', 'x.pdf', NOW);
    expect(r.classificacao).toBe('CNIS');
    expect((await h.runtime.visao(CHAT))?.faltando).toHaveLength(2);
  });
});
