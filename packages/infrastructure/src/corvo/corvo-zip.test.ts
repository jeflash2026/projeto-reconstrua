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

  it('REGRESSÃO (400 do Corvo, 2026-08-27): a coluna "Código banco" existe e sai preenchida', () => {
    // O validador do Corvo recusava a planilha inteira: "colunas ausentes:
    // Código banco." — o formato deles separa o código do nome do banco.
    const zip = montarZipDoLead('ANA', '01795790881', [CONTRATO_BASE], DOCS);
    const conteudo = zip.toString('utf8');
    expect(conteudo).toContain('Código banco');
    expect(conteudo).toContain('>033<'); // o código como célula própria (texto)
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

// ── DECRETO 2026-09-09 (caso ADONIRAM): o pedido administrativo cobre TODOS os
// contratos da JANELA de 5 anos — a seleção do guia (trios/teto/sobras) conta
// PROCESSOS do modelo comercial, não decide o que os bancos respondem. ────────
import { contratosDoPedidoAdministrativo } from './corvo-zip.js';
import type { ContratoHiscon } from '@reconstrua/application';

function contratoHiscon(parcial: Partial<ContratoHiscon>): ContratoHiscon {
  return {
    contrato: 'C-1',
    bancoCodigo: '341',
    bancoNome: 'ITAU',
    situacao: 'Ativo',
    origemAverbacao: null,
    migrado: false,
    migradoDoContrato: null,
    migradoDoCbc: null,
    modalidade: 'EMPRESTIMO',
    dataInclusao: new Date('2025-03-10T00:00:00Z'),
    competenciaInicio: '04/2025',
    competenciaFim: null,
    qtdeParcelas: 84,
    valorParcela: 100,
    valorEmprestado: 5000,
    valorLiberado: null,
    iof: null,
    cetMensal: null,
    cetAnual: null,
    taxaJurosMensal: null,
    taxaJurosAnual: null,
    valorPago: null,
    dataPrimeiroDesconto: null,
    ...parcial,
  };
}

describe('contratosDoPedidoAdministrativo — a janela INTEIRA, não a seleção do guia', () => {
  const HOJE = new Date('2026-09-09T12:00:00Z');

  it('sobra de trio ENTRA: 4 não-ativos do mesmo banco/ano = 4 linhas (o guia mandaria 3)', () => {
    const naoAtivo = (n: string): ContratoHiscon =>
      contratoHiscon({ contrato: n, situacao: 'EXCLUÍDO', competenciaFim: '01/2025' });
    const linhas = contratosDoPedidoAdministrativo(
      [naoAtivo('A'), naoAtivo('B'), naoAtivo('C'), naoAtivo('D')],
      HOJE,
    );
    expect(linhas.map((l) => l.contrato).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('banco só com sobras APARECE; fora da janela de 5 anos fica FORA; RMC entra', () => {
    const linhas = contratosDoPedidoAdministrativo(
      [
        // Banco 623 com UM não-ativo (sobra pura — o guia zeraria o banco):
        contratoHiscon({
          contrato: 'SOBRA',
          bancoCodigo: '623',
          bancoNome: 'PAN',
          situacao: 'EXCLUÍDO',
          competenciaFim: '02/2024',
        }),
        // Fora da janela (encerrado há mais de 5 anos):
        contratoHiscon({ contrato: 'VELHO', situacao: 'EXCLUÍDO', competenciaFim: '01/2019' }),
        // RMC ativo:
        contratoHiscon({ contrato: 'CARTAO', modalidade: 'RMC' }),
      ],
      HOJE,
    );
    expect(linhas.map((l) => l.contrato).sort()).toEqual(['CARTAO', 'SOBRA']);
    expect(linhas.find((l) => l.contrato === 'CARTAO')?.modalidade).toBe('RMC');
  });

  it('dedupe por contrato+banco e modalidade EMPRESTIMO vira o rótulo do Corvo', () => {
    const linhas = contratosDoPedidoAdministrativo(
      [contratoHiscon({ contrato: 'X' }), contratoHiscon({ contrato: 'X' })],
      HOJE,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.modalidade).toBe('EMPRÉSTIMO CONSIGNADO');
  });
});
