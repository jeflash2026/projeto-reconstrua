// ─────────────────────────────────────────────────────────────────────────────
// ZIP DO LEAD (Corvo) — o formato é contrato da outra ponta: prova os NOMES
// exatos (prefixo antes de " - ", acento em UTF-8), a planilha .xlsx na raiz e
// o CPF como TEXTO. O leitor de nomes usa o diretório central do próprio zip.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  montarZipDoLead,
  nomesDoZip,
  type ContratoDoLead,
  type DocumentoDoLead,
} from './corvo-zip.js';

const CONTRATO_BASE: ContratoDoLead = {
  bancoCodigo: '033',
  bancoNome: 'BANCO SANTANDER',
  contrato: '0012345678',
  modalidade: 'EMPRÉSTIMO CONSIGNADO',
  valorEmprestado: 6650.18,
  qtdeParcelas: 96,
  valorParcela: 178.9,
  inicio: '03/2024',
  fim: '02/2032',
  situacao: 'ATIVO',
};

const DOCS: DocumentoDoLead[] = [
  { categoria: 'HISCON', mime: 'application/pdf', bytes: new Uint8Array([1]) },
  { categoria: 'PROCURACAO', mime: 'application/pdf', bytes: new Uint8Array([2]) },
  { categoria: 'RG', mime: 'image/jpeg', bytes: new Uint8Array([3]) },
  { categoria: 'COMPROVANTE', mime: 'application/pdf', bytes: new Uint8Array([4]) },
];

describe('montarZipDoLead — o formato que o Corvo classifica', () => {
  it('nomes EXATOS: planilha na raiz + documentos/ com os prefixos do contrato', () => {
    const zip = montarZipDoLead('JOSÉ DA SILVA', '01795790881', [CONTRATO_BASE], DOCS);
    expect(nomesDoZip(zip)).toEqual([
      'Contratos - JOSÉ DA SILVA.xlsx',
      'documentos/HISCON - JOSÉ DA SILVA.pdf',
      'documentos/Procuração assinada - JOSÉ DA SILVA.pdf',
      'documentos/RG - JOSÉ DA SILVA.jpg',
      'documentos/Comprovante de endereço - JOSÉ DA SILVA.pdf',
    ]);
  });

  it('RG em duas faces: a segunda ganha sufixo DEPOIS do " - " (prefixo intacto)', () => {
    const zip = montarZipDoLead(
      'MARIA',
      '01795790881',
      [CONTRATO_BASE],
      [...DOCS, { categoria: 'RG', mime: 'image/jpeg', bytes: new Uint8Array([5]) }],
    );
    const nomes = nomesDoZip(zip);
    expect(nomes).toContain('documentos/RG - MARIA.jpg');
    expect(nomes).toContain('documentos/RG - MARIA (verso).jpg');
    // Todo nome de documento classifica pelo prefixo antes de " - ".
    for (const n of nomes.filter((x) => x.startsWith('documentos/'))) {
      expect(['HISCON', 'Procuração assinada', 'RG', 'Comprovante de endereço']).toContain(
        n.slice('documentos/'.length).split(' - ')[0],
      );
    }
  });

  it('CPF com zero à esquerda sai como TEXTO no xlsx (inlineStr, nunca número)', () => {
    const zip = montarZipDoLead('ANA', '01795790881', [CONTRATO_BASE], DOCS);
    // O xlsx é STORE (sem compressão): o XML da planilha está legível no zip.
    const conteudo = zip.toString('utf8');
    expect(conteudo).toContain('t="inlineStr"><is><t xml:space="preserve">01795790881</t>');
  });

  it('linha em branco separa grupos de banco; "Banco" = código + nome', () => {
    const zip = montarZipDoLead(
      'ANA',
      '01795790881',
      [
        CONTRATO_BASE,
        { ...CONTRATO_BASE, bancoCodigo: '623', bancoNome: 'BANCO PAN', contrato: '780434117-5' },
      ],
      DOCS,
    );
    const conteudo = zip.toString('utf8');
    expect(conteudo).toContain('033 - BANCO SANTANDER');
    expect(conteudo).toContain('623 - BANCO PAN');
    // 2 bancos ⇒ cabeçalho + linha + EM BRANCO + linha = 4 rows no sheet.
    expect(conteudo.match(/<row /g)?.length).toBe(4);
  });
});
