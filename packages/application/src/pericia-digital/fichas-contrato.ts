// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · FICHAS POR CONTRATO (Decreto 2026-07-24, item 5)
// A partir do HISCON JÁ parseado (reuso de ContratoHiscon), cria uma FICHA por
// contrato: transcreve os dados existentes (nunca inventa), classifica o estágio
// e lista os documentos faltantes. NÃO conclui fraude — só localiza e organiza.
// ─────────────────────────────────────────────────────────────────────────────
import type { ContratoHiscon, HisconExtraido } from '../pericia/hiscon-parser.js';
import { NAO_APRESENTADO, campoSeguro } from './linguagem-segura.js';

export const CLASSIFICACOES_CONTRATO = [
  'CONTRATO_IDENTIFICADO',
  'CONTRATO_COM_DADOS_INCOMPLETOS',
  'POSSIVEL_REFINANCIAMENTO',
  'POSSIVEL_PORTABILIDADE',
  'POSSIVEL_CONTRATO_RELACIONADO',
  'NECESSITA_DOCUMENTACAO_DO_BANCO',
  'NECESSITA_REVISAO_HUMANA',
] as const;
export type ClassificacaoContrato = (typeof CLASSIFICACOES_CONTRATO)[number];

/** Documentos que o banco precisa apresentar para cada contrato (checklist base). */
export const DOCUMENTOS_DO_BANCO: readonly string[] = [
  'Contrato eletrônico original',
  'Cédula de crédito bancário (CCB)',
  'Certificado de conclusão da assinatura',
  'Trilha de auditoria (logs de IP, dispositivo, data/hora)',
  'Comprovante de crédito na conta do beneficiário',
  'Documento de identificação usado na contratação',
  'Selfie / prova de vida, se houver',
];

export interface FichaContrato {
  readonly contrato: string;
  readonly bancoNome: string;
  readonly bancoCodigo: string;
  readonly situacao: string;
  readonly origemAverbacao: string;
  readonly competenciaInicio: string;
  readonly competenciaFim: string;
  readonly qtdeParcelas: string;
  readonly valorParcela: string;
  readonly valorEmprestado: string;
  readonly classificacao: ClassificacaoContrato;
  /** Por que a classificação — sempre factual, nunca conclusiva. */
  readonly observacao: string;
  readonly documentosFaltantes: readonly string[];
}

function classificar(c: ContratoHiscon): { classe: ClassificacaoContrato; observacao: string } {
  const semNumero = c.contrato.trim() === '' || c.contrato.startsWith('CONFERIR-NO-HISCON');
  const incompleto = c.valorEmprestado === null || c.qtdeParcelas === null || c.bancoNome === null;
  const origem = (c.origemAverbacao ?? '').toLowerCase();

  if (semNumero) {
    return {
      classe: 'NECESSITA_REVISAO_HUMANA',
      observacao: 'Número do contrato não pôde ser lido com segurança no HISCON.',
    };
  }
  if (origem.includes('refinanc')) {
    return {
      classe: 'POSSIVEL_REFINANCIAMENTO',
      observacao:
        'A origem da averbação indica refinanciamento — a confirmar com a documentação do banco.',
    };
  }
  if (origem.includes('portab')) {
    return {
      classe: 'POSSIVEL_PORTABILIDADE',
      observacao:
        'A origem da averbação indica portabilidade — a confirmar com a documentação do banco.',
    };
  }
  if (incompleto) {
    return {
      classe: 'CONTRATO_COM_DADOS_INCOMPLETOS',
      observacao:
        'Alguns campos do contrato não constam no HISCON e precisam da documentação do banco.',
    };
  }
  return {
    classe: 'CONTRATO_IDENTIFICADO',
    observacao: 'Contrato localizado no HISCON com os campos principais preenchidos.',
  };
}

/** Uma ficha por contrato — dados transcritos com segurança + classificação +
 *  checklist. Toda ausência vira a frase canônica (NÃO APRESENTADO...). */
export function fichasDoHiscon(extraido: HisconExtraido): readonly FichaContrato[] {
  return extraido.contratos.map((c) => {
    const { classe, observacao } = classificar(c);
    return {
      contrato: campoSeguro(c.contrato.startsWith('CONFERIR') ? null : c.contrato),
      bancoNome: campoSeguro(c.bancoNome),
      bancoCodigo: campoSeguro(c.bancoCodigo),
      situacao: campoSeguro(c.situacao),
      origemAverbacao: campoSeguro(c.origemAverbacao),
      competenciaInicio: campoSeguro(c.competenciaInicio),
      competenciaFim: campoSeguro(c.competenciaFim),
      qtdeParcelas: campoSeguro(c.qtdeParcelas),
      valorParcela: campoSeguro(c.valorParcela === null ? null : c.valorParcela.toFixed(2)),
      valorEmprestado: campoSeguro(
        c.valorEmprestado === null ? null : c.valorEmprestado.toFixed(2),
      ),
      classificacao: classe,
      observacao,
      documentosFaltantes: DOCUMENTOS_DO_BANCO,
    };
  });
}

/** O beneficiário do HISCON, com segurança (para a identificação das partes). */
export function beneficiarioSeguro(extraido: HisconExtraido): {
  nome: string;
  beneficio: string;
} {
  return {
    nome: campoSeguro(extraido.beneficiario),
    beneficio: campoSeguro(extraido.numeroBeneficio),
  };
}

export { NAO_APRESENTADO };
