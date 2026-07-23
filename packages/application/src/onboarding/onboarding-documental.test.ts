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
  load(): Promise<OnboardingDocumentalState | null> {
    return Promise.resolve(this.state);
  }
  save(s: OnboardingDocumentalState): Promise<void> {
    this.state = s;
    return Promise.resolve();
  }
}

function harness(textos: Record<string, string | null> = {}) {
  const store = new MemStore();
  const pendenciasGravadas: string[][] = [];
  const runtime = new OnboardingDocumentalRuntime({
    store,
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: {
      setPendingDocuments: (_c, labels) => {
        pendenciasGravadas.push([...labels]);
        return Promise.resolve();
      },
    },
  });
  return { store, runtime, pendenciasGravadas };
}

describe('Decreto · classificação DETERMINÍSTICA dos 3 obrigatórios', () => {
  it('HISCON: exige evidência de consignado NO CONTEÚDO (não basta o nome)', () => {
    expect(
      classificarDocumentoInicial('doc.pdf', 'HISTÓRICO DE EMPRÉSTIMO CONSIGNADO - INSS'),
    ).toBe('CNIS');
    expect(classificarDocumentoInicial('extrato.pdf', 'Extrato de consignações do benefício')).toBe(
      'CNIS',
    );
    // Sem texto (transcrição ainda não chegou): o nome do arquivo ainda vale —
    // a evidência de conteúdo é exigida quando o texto existe (abaixo).
    expect(classificarDocumentoInicial('hiscon-julho.pdf', '')).toBe('CNIS');
    // Caso José (2026-07-22): "Histórico de Créditos"/benefício nomeado como hiscon
    // — conteúdo é de PAGAMENTO de benefício, não de empréstimos ⇒ OUTRO (re-pede).
    expect(
      classificarDocumentoInicial(
        'hiscon.pdf',
        'INSS - Histórico de Créditos Espécie: 87 - BENEFÍCIO DE PRESTAÇÃO CONTINUADA Créditos do Benefício R$ 1.146,00 CARTAO MAGNETICO Pago',
      ),
    ).toBe('OUTRO');
  });
  it('RG/CNH: registro geral, habilitação, órgão emissor', () => {
    expect(
      classificarDocumentoInicial('IMG_1234.jpg', 'REGISTRO GERAL 12.345.678-9 ÓRGÃO EMISSOR SSP'),
    ).toBe('IDENTIDADE');
    expect(classificarDocumentoInicial('cnh.jpg', '')).toBe('IDENTIDADE');
    expect(classificarDocumentoInicial('foto.jpg', 'CARTEIRA NACIONAL DE HABILITAÇÃO')).toBe(
      'IDENTIDADE',
    );
  });
  it('comprovante de endereço: conta de luz/água, fatura de energia', () => {
    expect(
      classificarDocumentoInicial('conta.pdf', 'CEMIG — fatura de energia elétrica — vencimento'),
    ).toBe('COMPROVANTE_RESIDENCIA');
    expect(classificarDocumentoInicial('comprovante-de-endereco.jpg', '')).toBe(
      'COMPROVANTE_RESIDENCIA',
    );
  });
  it('15ª rodada — a conta de ÁGUA REAL que ficou OUTRO em produção ⇒ COMPROVANTE', () => {
    const contaReal =
      'JOSE RODRIGUES End.: RUA JOAO LOURENCO LEITE,475 - SANTA ERNESTINA - SP - 15970000 ' +
      'Cod. Cliente: 087130751 PDE/RGI: 037141285 Hidrometro: A18L203308 Lacre: RESIDENCIAL Tipo de ligacao: AGUA E ESGOTO';
    expect(classificarDocumentoInicial('IMG_5555.jpg', contaReal)).toBe('COMPROVANTE_RESIDENCIA');
    expect(classificarDocumentoInicial('foto.jpg', 'SABESP - Companhia de Saneamento Basico')).toBe(
      'COMPROVANTE_RESIDENCIA',
    );
    expect(classificarDocumentoInicial('foto.jpg', 'DAE Aguas — consumo do mes')).toBe(
      'COMPROVANTE_RESIDENCIA',
    );
  });
  it('cliente real 2026-07-22 — DECLARAÇÃO DE RESIDÊNCIA assinada ⇒ COMPROVANTE', () => {
    expect(
      classificarDocumentoInicial(
        'IMG_0001.jpg',
        'DECLARAÇÃO DE RESIDÊNCIA — Eu, Fulana de Tal, declaro para os devidos fins que resido na Rua X, nº 10, Rio de Janeiro - RJ.',
      ),
    ).toBe('COMPROVANTE_RESIDENCIA');
    expect(
      classificarDocumentoInicial(
        'declaracao.pdf',
        'Declaro ser residente e domiciliada no endereço abaixo, firmando a presente declaração.',
      ),
    ).toBe('COMPROVANTE_RESIDENCIA');
  });
  it('nada reconhecível OU empate ⇒ OUTRO (jamais adivinhar)', () => {
    expect(classificarDocumentoInicial('IMG_9999.jpg', '')).toBe('OUTRO');
    expect(classificarDocumentoInicial('doc.pdf', 'texto qualquer sem sinais')).toBe('OUTRO');
  });
});

describe('Decreto HISCON-ONLY (2026-07-22) · contabilidade', () => {
  it('a documentação inicial obrigatória é APENAS o HISCON', () => {
    expect(DOCUMENTACAO_INICIAL).toEqual(['CNIS']);
    const s = novoOnboarding(CHAT, 'M-1', NOW);
    expect(proximo(s)).toBe('CNIS');
    expect(faltando(s)).toHaveLength(1);
    expect(completo(s)).toBe(false);
  });
});

describe('Decreto · runtime da jornada', () => {
  it('semeia na criação da missão: SÓ o HISCON pendente (decreto HISCON-only)', async () => {
    const h = harness();
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(false);
    expect(h.pendenciasGravadas.at(-1)).toEqual(['CNIS']);
    const visao = await h.runtime.visao(CHAT);
    expect(visao?.proximo).toContain('HISCON');
  });

  it('documentos ESPONTÂNEOS (RG/comprovante) registram, mas SÓ o HISCON completa', async () => {
    const h = harness({
      f: 'registro geral órgão emissor',
      d2: 'fatura de energia elétrica',
      d3: 'histórico de empréstimo consignado',
    });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);

    const r1 = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'f', 'IMG_1.jpg', NOW);
    expect(r1.classificacao).toBe('IDENTIDADE'); // registrado no acervo
    expect((await h.runtime.visao(CHAT))?.proximo).toContain('HISCON'); // pendente segue o HISCON

    const r2 = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd2', 'IMG_3.jpg', NOW);
    expect(r2.classificacao).toBe('COMPROVANTE_RESIDENCIA');
    expect((await h.runtime.visao(CHAT))?.proximo).toContain('HISCON');
    expect(await h.runtime.estaCompleto(CHAT)).toBe(false);

    const r3 = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'd3', 'doc.pdf', NOW);
    expect(r3.classificacao).toBe('CNIS');
    expect(r3.faltando).toHaveLength(0);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(true); // ⇒ ANALISE_ADMINISTRATIVA
    expect(h.pendenciasGravadas.at(-1)).toEqual([]); // ALIR/Readiness: nada pendente
  });

  it('CNH espontânea registra como CNH; o pendente segue sendo o HISCON', async () => {
    const h = harness({ c: 'carteira nacional de habilitação' });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'c', 'IMG_1.jpg', NOW);
    expect(r.classificacao).toBe('IDENTIDADE');
    const visao = await h.runtime.visao(CHAT);
    expect(visao?.recebidos).toContain('CNH');
    expect(visao?.proximo).toContain('HISCON');
  });

  it('TERCEIRA imagem de RG não duplica (identidade já completa)', async () => {
    const h = harness({ f: 'registro geral', v: 'carteira de identidade', x: 'registro geral' });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'f', 'a.jpg', NOW);
    await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'v', 'b.jpg', NOW);
    const r = await h.runtime.aoReconhecerDocumento(CHAT, 'M-1', 'x', 'c.jpg', NOW);
    expect(r.jaRecebido).toBe(true);
  });

  it('documento do MESMO tipo reenviado não duplica a contabilidade', async () => {
    const h = harness({ d1: 'conta de luz', d2: 'fatura de energia elétrica' });
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
    const r = await h.runtime.aoReconhecerDocumento(
      CHAT,
      'M-1',
      'dY',
      'hiscon-do-cliente.pdf',
      NOW,
    );
    expect(r.classificacao).toBe('CNIS');
    expect(r.classificacaoPendente).toBe(false);
  });

  it('jornada completa ⇒ documento novo NÃO pertence à Jornada 1 (é acervo/Jornada 2)', async () => {
    const h = harness({
      d1: 'hiscon',
      d2: 'carteira nacional de habilitação',
      d3: 'conta de luz',
      d4: 'procuração assinada',
    });
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
    // Decreto HISCON-only: o próprio HISCON era o único obrigatório ⇒ completa.
    expect((await h.runtime.visao(CHAT))?.faltando).toHaveLength(0);
    expect(await h.runtime.estaCompleto(CHAT)).toBe(true);
  });
});
