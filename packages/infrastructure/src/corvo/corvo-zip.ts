// ─────────────────────────────────────────────────────────────────────────────
// ZIP DO LEAD PARA O CORVO (integração 2026-08-25) — o formato é CONTRATO da
// outra ponta e não pode variar um caractere:
//
//   Contratos - <NOME>.xlsx                       ← na raiz
//   documentos/HISCON - <NOME>.pdf
//   documentos/Procuração assinada - <NOME>.pdf
//   documentos/RG - <NOME>.pdf|jpg
//   documentos/Comprovante de endereço - <NOME>.pdf|jpg
//
// A classificação do Corvo é pelo PREFIXO antes de " - " — por isso RG em duas
// faces vira "RG - <NOME> (verso).jpg" (o prefixo continua "RG"). Nomes em
// UTF-8 (o zipStore liga o bit 11). A planilha é .xlsx REAL (nunca CSV) com o
// CPF como TEXTO (zeros à esquerda preservados) e linha em branco entre bancos.
// ─────────────────────────────────────────────────────────────────────────────
import { zipStore, nomeArquivoSeguro, type ArquivoZip } from '../util/zip.js';
import { xlsxDePlanilha } from '../util/xlsx.js';

export type CategoriaDocLead = 'HISCON' | 'PROCURACAO' | 'RG' | 'COMPROVANTE';

/** Prefixo EXATO que o Corvo espera antes de " - " para cada categoria. */
export const PREFIXO_CORVO: Readonly<Record<CategoriaDocLead, string>> = {
  HISCON: 'HISCON',
  PROCURACAO: 'Procuração assinada',
  RG: 'RG',
  COMPROVANTE: 'Comprovante de endereço',
};

export interface DocumentoDoLead {
  readonly categoria: CategoriaDocLead;
  readonly mime: string;
  readonly bytes: Uint8Array;
}

/** Uma linha da planilha — os campos vêm do ContratoHiscon já parseado. */
export interface ContratoDoLead {
  readonly bancoCodigo: string | null;
  readonly bancoNome: string | null;
  readonly contrato: string;
  readonly modalidade: string;
  readonly valorEmprestado: number | null;
  readonly qtdeParcelas: number | null;
  readonly valorParcela: number | null;
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly situacao: string | null;
}

export const COLUNAS_PLANILHA_CORVO = [
  'CPF do cliente',
  'Nome do cliente',
  'Banco',
  'Contrato',
  'Modalidade',
  'Valor emprestado',
  'Qtde parcelas',
  'Valor parcela',
  'Início',
  'Fim',
  'Situação',
] as const;

function extensaoDe(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime.startsWith('image/')) return 'jpg';
  return 'bin';
}

/** "033 - BANCO SANTANDER" — código de 3 dígitos + nome, como o Corvo pede. */
function rotuloBanco(c: ContratoDoLead): string {
  const codigo = (c.bancoCodigo ?? '').padStart(3, '0');
  const nome = c.bancoNome ?? 'BANCO NÃO IDENTIFICADO';
  return c.bancoCodigo === null ? nome : `${codigo} - ${nome}`;
}

/** Monta o ZIP completo do lead. `cpf` deve chegar com 11 dígitos (só números). */
export function montarZipDoLead(
  nomeCliente: string,
  cpf: string,
  contratos: readonly ContratoDoLead[],
  documentos: readonly DocumentoDoLead[],
): Buffer {
  const nome = nomeArquivoSeguro(nomeCliente, 'cliente');

  // ── Planilha: agrupada por banco, linha EM BRANCO entre grupos ─────────────
  const porBanco = new Map<string, ContratoDoLead[]>();
  for (const c of contratos) {
    const chave = rotuloBanco(c);
    const grupo = porBanco.get(chave) ?? [];
    grupo.push(c);
    porBanco.set(chave, grupo);
  }
  const linhas: (string | number | null)[][] = [];
  const bancos = [...porBanco.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  for (const [i, banco] of bancos.entries()) {
    if (i > 0) linhas.push(Array<null>(COLUNAS_PLANILHA_CORVO.length).fill(null));
    for (const c of porBanco.get(banco) ?? []) {
      linhas.push([
        cpf, // string ⇒ célula de TEXTO no xlsx (zeros à esquerda preservados)
        nomeCliente,
        banco,
        c.contrato,
        c.modalidade,
        c.valorEmprestado,
        c.qtdeParcelas,
        c.valorParcela,
        c.inicio,
        c.fim,
        c.situacao,
      ]);
    }
  }

  const arquivos: ArquivoZip[] = [
    {
      name: `Contratos - ${nome}.xlsx`,
      content: xlsxDePlanilha('Contratos', COLUNAS_PLANILHA_CORVO, linhas),
    },
  ];

  // ── Documentos: prefixo do contrato de integração; repetidos ganham sufixo
  //    DEPOIS do " - " (o prefixo classificador não muda) ─────────────────────
  const vistos = new Map<CategoriaDocLead, number>();
  for (const d of documentos) {
    const vez = (vistos.get(d.categoria) ?? 0) + 1;
    vistos.set(d.categoria, vez);
    const sufixo = vez === 1 ? '' : vez === 2 ? ' (verso)' : ` (${String(vez)})`;
    arquivos.push({
      name: `documentos/${PREFIXO_CORVO[d.categoria]} - ${nome}${sufixo}.${extensaoDe(d.mime)}`,
      content: Buffer.from(d.bytes),
    });
  }

  return zipStore(arquivos);
}

/** Lê os NOMES dos arquivos de um zip (diretório central) — usado nos testes
 *  para provar o formato sem depender de lib externa de unzip. */
export function nomesDoZip(zip: Buffer): readonly string[] {
  const nomes: string[] = [];
  let i = 0;
  while (i + 4 <= zip.length) {
    const assinatura = zip.readUInt32LE(i);
    if (assinatura === 0x02014b50) {
      const tamanhoNome = zip.readUInt16LE(i + 28);
      const tamanhoExtra = zip.readUInt16LE(i + 30);
      const tamanhoComentario = zip.readUInt16LE(i + 32);
      nomes.push(zip.subarray(i + 46, i + 46 + tamanhoNome).toString('utf8'));
      i += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
    } else if (assinatura === 0x04034b50) {
      const comprimido = zip.readUInt32LE(i + 18);
      const tamanhoNome = zip.readUInt16LE(i + 26);
      const tamanhoExtra = zip.readUInt16LE(i + 28);
      i += 30 + tamanhoNome + tamanhoExtra + comprimido;
    } else {
      break; // EOCD (ou lixo): o diretório central acabou
    }
  }
  return nomes;
}
