// ─────────────────────────────────────────────────────────────────────────────
// MATRIZ DE REQUISITOS DE QUALIFICAÇÃO — config DETERMINÍSTICA (não é IA). Define,
// por tipo de caso jurídico do Projeto Reconstrua, os documentos obrigatórios/
// opcionais, as informações obrigatórias, as condições impeditivas e as condições
// suficientes. É a fonte única do que torna um caso APTO a ser analisado. A decisão
// de prontidão (readiness) é baseada exclusivamente nestas regras explícitas.
// ─────────────────────────────────────────────────────────────────────────────

export type QualificationCaseType =
  | 'APOSENTADORIA_IDADE'
  | 'APOSENTADORIA_TEMPO_CONTRIBUICAO'
  | 'BENEFICIO_INCAPACIDADE'
  | 'BPC_LOAS'
  | 'PENSAO_MORTE'
  | 'REVISAO_BENEFICIO'
  | 'GENERICO';

export type ReadinessDocumentCode =
  | 'IDENTIDADE'
  | 'COMPROVANTE_RESIDENCIA'
  | 'CNIS'
  | 'CTPS'
  | 'LAUDO_MEDICO'
  | 'CADUNICO'
  | 'CARTA_CONCESSAO'
  | 'CARTA_INDEFERIMENTO'
  | 'CERTIDAO_OBITO'
  | 'COMPROVANTE_DEPENDENCIA'
  | 'PROCURACAO';

export type ReadinessInfoKey = 'CASO_REGISTRADO' | 'VERDADE_SINTETIZADA';

/** Condições impeditivas. `DIREITO_AFASTADO` só é avaliável após a Perícia (W1-03). */
export type ReadinessConditionKey = 'ENCERRADO' | 'SEM_CASO' | 'DIREITO_AFASTADO';

/** Condições impeditivas observáveis HOJE (as demais dependem de produtores futuros). */
export const OBSERVABLE_CONDITIONS: readonly ReadinessConditionKey[] = ['ENCERRADO', 'SEM_CASO'];

export const DOCUMENT_LABELS: Readonly<Record<ReadinessDocumentCode, string>> = {
  IDENTIDADE: 'documento de identidade',
  COMPROVANTE_RESIDENCIA: 'comprovante de residência',
  CNIS: 'extrato previdenciário (CNIS/HISCON)',
  CTPS: 'carteira de trabalho (CTPS)',
  LAUDO_MEDICO: 'laudo médico',
  CADUNICO: 'inscrição no CadÚnico',
  CARTA_CONCESSAO: 'carta de concessão do benefício',
  CARTA_INDEFERIMENTO: 'carta de indeferimento',
  CERTIDAO_OBITO: 'certidão de óbito',
  COMPROVANTE_DEPENDENCIA: 'comprovante de dependência',
  PROCURACAO: 'procuração',
};

export const INFO_LABELS: Readonly<Record<ReadinessInfoKey, string>> = {
  CASO_REGISTRADO: 'caso registrado',
  VERDADE_SINTETIZADA: 'verdade operacional sintetizada',
};

export const CONDITION_LABELS: Readonly<Record<ReadinessConditionKey, string>> = {
  ENCERRADO: 'caso encerrado',
  SEM_CASO: 'caso ainda não registrado',
  DIREITO_AFASTADO: 'direito afastado em perícia',
};

export interface CaseRequirements {
  readonly caseType: QualificationCaseType;
  readonly requiredDocuments: readonly ReadinessDocumentCode[];
  readonly optionalDocuments: readonly ReadinessDocumentCode[];
  readonly requiredInfo: readonly ReadinessInfoKey[];
  readonly blockingConditions: readonly ReadinessConditionKey[];
  /** Descrição textual das condições suficientes (documentação viva). */
  readonly sufficientConditions: readonly string[];
}

const BASE_INFO: readonly ReadinessInfoKey[] = ['CASO_REGISTRADO', 'VERDADE_SINTETIZADA'];
const BASE_BLOCKING: readonly ReadinessConditionKey[] = ['ENCERRADO', 'SEM_CASO'];
const SUFFICIENT = [
  'documentos obrigatórios recebidos',
  'verdade operacional sintetizada',
  'sem condição impeditiva',
];

export const REQUIREMENTS: Readonly<Record<QualificationCaseType, CaseRequirements>> = {
  APOSENTADORIA_IDADE: {
    caseType: 'APOSENTADORIA_IDADE',
    requiredDocuments: ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CNIS'],
    optionalDocuments: ['CARTA_INDEFERIMENTO', 'PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: BASE_BLOCKING,
    sufficientConditions: SUFFICIENT,
  },
  APOSENTADORIA_TEMPO_CONTRIBUICAO: {
    caseType: 'APOSENTADORIA_TEMPO_CONTRIBUICAO',
    requiredDocuments: ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CNIS', 'CTPS'],
    optionalDocuments: ['CARTA_INDEFERIMENTO', 'PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: BASE_BLOCKING,
    sufficientConditions: SUFFICIENT,
  },
  BENEFICIO_INCAPACIDADE: {
    caseType: 'BENEFICIO_INCAPACIDADE',
    requiredDocuments: ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CNIS', 'LAUDO_MEDICO'],
    optionalDocuments: ['CARTA_INDEFERIMENTO', 'PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: ['ENCERRADO', 'SEM_CASO', 'DIREITO_AFASTADO'],
    sufficientConditions: [...SUFFICIENT, 'perícia sem afastamento do direito (quando disponível)'],
  },
  BPC_LOAS: {
    caseType: 'BPC_LOAS',
    requiredDocuments: ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CADUNICO'],
    optionalDocuments: ['LAUDO_MEDICO', 'PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: BASE_BLOCKING,
    sufficientConditions: SUFFICIENT,
  },
  PENSAO_MORTE: {
    caseType: 'PENSAO_MORTE',
    requiredDocuments: [
      'IDENTIDADE',
      'COMPROVANTE_RESIDENCIA',
      'CERTIDAO_OBITO',
      'COMPROVANTE_DEPENDENCIA',
    ],
    optionalDocuments: ['CNIS', 'PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: BASE_BLOCKING,
    sufficientConditions: SUFFICIENT,
  },
  REVISAO_BENEFICIO: {
    caseType: 'REVISAO_BENEFICIO',
    requiredDocuments: ['IDENTIDADE', 'CNIS', 'CARTA_CONCESSAO'],
    optionalDocuments: ['COMPROVANTE_RESIDENCIA', 'PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: BASE_BLOCKING,
    sufficientConditions: SUFFICIENT,
  },
  GENERICO: {
    caseType: 'GENERICO',
    // Decreto "Jornada Documental Inicial": a documentação inicial é FIXA —
    // HISCON (CNIS) + RG/CNH (IDENTIDADE) + comprovante de endereço. Sempre.
    requiredDocuments: ['IDENTIDADE', 'COMPROVANTE_RESIDENCIA', 'CNIS'],
    optionalDocuments: ['PROCURACAO'],
    requiredInfo: BASE_INFO,
    blockingConditions: BASE_BLOCKING,
    sufficientConditions: SUFFICIENT,
  },
};

export function requirementsFor(caseType: QualificationCaseType): CaseRequirements {
  return REQUIREMENTS[caseType] ?? REQUIREMENTS.GENERICO;
}
