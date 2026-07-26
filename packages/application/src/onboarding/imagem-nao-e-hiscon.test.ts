// ─────────────────────────────────────────────────────────────────────────────
// Caso Gelciana (2026-07-26, cliente real): mandou a FOTO de uma tela de ERRO do
// Meu INSS ("Benefício não encontrado para este serviço") dizendo que NÃO
// conseguia acessar o extrato — e a AHRI aceitou a imagem como HISCON, marcando
// a documentação como completa e dizendo "seu HISCON já chegou certinho".
// Trava: IMAGEM NUNCA é HISCON (o extrato é sempre um PDF do Meu INSS).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  OnboardingDocumentalRuntime,
  classificarDocumentoInicial,
  ehImagem,
  type OnboardingDocumentalState,
  type OnboardingDocumentalStore,
} from './onboarding-documental.js';

const NOW = new Date('2026-07-26T13:49:00.000Z');
const CHAT = '5538990587920@s.whatsapp.net';

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
  const runtime = new OnboardingDocumentalRuntime({
    store: new MemStore(),
    leitor: { texto: (id) => Promise.resolve(textos[id] ?? null) },
    pendencias: null,
  });
  return { runtime };
}

// O texto que a Vision leu do print REAL da cliente (tela de ajuda + erro).
const TEXTO_DA_FOTO =
  'Nele também tem o valor das parcelas, o prazo para pagar e a margem livre para novos ' +
  'contratos. Empréstimo consignado. Benefício não encontrado para este serviço. ' +
  'Precisa de ajuda? Ligue 135.';

describe('IMAGEM nunca é HISCON', () => {
  it('reconhece imagem pelo mimeType e, sem ele, pela extensão', () => {
    expect(ehImagem('qualquer', 'image/jpeg')).toBe(true);
    expect(ehImagem('IMG_0001.jpg', null)).toBe(true);
    expect(ehImagem('print.PNG', undefined)).toBe(true);
    expect(ehImagem('extrato.pdf', 'application/pdf')).toBe(false);
    expect(ehImagem('extrato.pdf', null)).toBe(false);
    // O mimeType MANDA: um .pdf no nome não salva um arquivo que é imagem.
    expect(ehImagem('extrato.pdf', 'image/jpeg')).toBe(true);
  });

  it('a FOTO da cliente NÃO vira HISCON (o mesmo texto em PDF viraria)', () => {
    // Como imagem ⇒ recusada, por mais que o texto fale de consignado.
    expect(classificarDocumentoInicial('IMG_9482.jpg', TEXTO_DA_FOTO, 'image/jpeg')).toBe('OUTRO');
    // Um HISCON de VERDADE, em PDF, segue sendo aceito (não quebrei o funil).
    expect(
      classificarDocumentoInicial(
        'extrato.pdf',
        'Extrato de Empréstimos Consignados - Origem da averbação: Ativo. Banco consignatário. Competência de desconto 03/2026.',
        'application/pdf',
      ),
    ).toBe('CNIS');
  });

  it('RG e comprovante CONTINUAM valendo como imagem (são fotos por natureza)', () => {
    expect(
      classificarDocumentoInicial('IMG_1.jpg', 'REGISTRO GERAL ÓRGÃO EMISSOR SSP', 'image/jpeg'),
    ).toBe('IDENTIDADE');
    expect(
      classificarDocumentoInicial('IMG_2.jpg', 'CEMIG fatura de energia elétrica', 'image/jpeg'),
    ).toBe('COMPROVANTE_RESIDENCIA');
  });

  it('no runtime: a foto NÃO completa a jornada e devolve o motivo certo', async () => {
    const h = harness({ foto: TEXTO_DA_FOTO });
    await h.runtime.aoCriarMissao(CHAT, 'M-1', NOW);
    const r = await h.runtime.aoReconhecerDocumento(
      CHAT,
      'M-1',
      'foto',
      'IMG_9482.jpg',
      NOW,
      'image/jpeg',
    );
    expect(r.classificacao).toBe('OUTRO');
    expect(r.motivoOutro).toBe('imagem-nao-e-hiscon');
    // O bug real: a jornada NÃO pode ficar completa por causa de uma foto.
    expect(await h.runtime.estaCompleto(CHAT)).toBe(false);
    expect((await h.runtime.visao(CHAT))?.proximo).toContain('HISCON');
  });
});
