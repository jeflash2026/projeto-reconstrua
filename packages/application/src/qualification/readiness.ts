// ─────────────────────────────────────────────────────────────────────────────
// READINESS FOR QUALIFICATION — capacidade TRANSVERSAL do SO. Responde de forma
// OBJETIVA e DETERMINÍSTICA: "este caso já possui todas as informações necessárias
// para ser analisado?" → ready = true|false + missingRequirements + confidence +
// reason. NÃO qualifica (isso é W1-04); apenas determina QUANDO qualificar passa a
// ser possível. Nenhum modelo de IA decide — a IA apenas extrai; a decisão de
// prontidão vem das regras explícitas da matriz de requisitos.
//
// Consumida por Operador, AHRI, Dashboard, Modelo A e Modelo B (serviço transversal).
// Entradas: ALIR (missão, documentos, estado, verdade) + tipo de caso. Somente-leitura.
// ─────────────────────────────────────────────────────────────────────────────
import type { ALIR } from '../alir/alir-contract.js';
import {
  requirementsFor,
  DOCUMENT_LABELS,
  INFO_LABELS,
  CONDITION_LABELS,
  OBSERVABLE_CONDITIONS,
  type QualificationCaseType,
  type ReadinessDocumentCode,
} from './requirements-matrix.js';

export type ReadinessRequirementKind = 'document' | 'info' | 'condition';

export interface ReadinessRequirement {
  readonly kind: ReadinessRequirementKind;
  readonly code: string;
  readonly label: string;
}

export interface ReadinessResult {
  readonly ready: boolean;
  readonly missingRequirements: readonly ReadinessRequirement[];
  /** 0..1 — CONFIABILIDADE do veredito dado o que o ALIR expõe (não probabilidade de IA). */
  readonly confidence: number;
  readonly reason: string;
  readonly caseType: QualificationCaseType;
  readonly evaluatedAt: Date;
}

export interface ReadinessInput {
  readonly alir: ALIR;
  /** Tipo de caso jurídico; default GENERICO quando ainda não classificado. */
  readonly caseType?: QualificationCaseType;
  /** Órbitas do ALIR indisponíveis nesta composição (afeta apenas a confiança). */
  readonly unavailable?: readonly string[];
  readonly now?: Date;
}

/**
 * Avalia a prontidão para qualificação — 100% determinístico. Precedência: condições
 * impeditivas → documentos obrigatórios pendentes → informações obrigatórias ausentes.
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const caseType = input.caseType ?? 'GENERICO';
  const req = requirementsFor(caseType);
  const now = input.now ?? new Date();
  const unavailable = input.unavailable ?? [];

  const m = input.alir.operational.missao;
  const pendentes = input.alir.operational.documentos.pendentes;

  const blocking: ReadinessRequirement[] = [];
  for (const cond of req.blockingConditions) {
    if (!OBSERVABLE_CONDITIONS.includes(cond)) continue; // não observável hoje → não bloqueia
    if (cond === 'ENCERRADO' && m.terminalState === 'ENCERRADA') {
      blocking.push({ kind: 'condition', code: cond, label: CONDITION_LABELS[cond] });
    }
    if (cond === 'SEM_CASO' && m.missionId === null) {
      blocking.push({ kind: 'condition', code: cond, label: CONDITION_LABELS[cond] });
    }
  }

  const missing: ReadinessRequirement[] = [];
  // Documentos obrigatórios ainda pendentes (a lista de pendências é a contabilidade
  // autoritativa do que falta; comparação por código canônico).
  for (const doc of req.requiredDocuments) {
    if (pendentes.includes(doc)) {
      missing.push({ kind: 'document', code: doc, label: DOCUMENT_LABELS[doc] });
    }
  }
  // Informações obrigatórias
  for (const info of req.requiredInfo) {
    if (info === 'CASO_REGISTRADO' && m.missionId === null) {
      missing.push({ kind: 'info', code: info, label: INFO_LABELS[info] });
    }
    if (info === 'VERDADE_SINTETIZADA' && !m.truthEstablished) {
      missing.push({ kind: 'info', code: info, label: INFO_LABELS[info] });
    }
  }

  const allMissing: readonly ReadinessRequirement[] = [...blocking, ...missing];
  const ready = allMissing.length === 0;

  // Confiança (determinística): vereditos de "não pronto" são observados → 1.0.
  // Um "pronto" perde confiança quando o RECEBIMENTO de documentos é inferido (órbita
  // `enviados` indisponível) ou quando há condição impeditiva não observável (perícia).
  let confidence = 1;
  if (ready) {
    const receiptObservable = !unavailable.includes('operational.documentos.enviados');
    if (!receiptObservable && req.requiredDocuments.length > 0) confidence = Math.min(confidence, 0.75);
    const unobservableBlocking = req.blockingConditions.filter((c) => !OBSERVABLE_CONDITIONS.includes(c));
    if (unobservableBlocking.length > 0) confidence = Math.min(confidence, 0.6);
  }

  const reason = ready
    ? `Pronto para qualificação (${caseType}): documentos obrigatórios satisfeitos e verdade sintetizada.`
    : blocking.length > 0
      ? `Não pronto: ${blocking.map((b) => b.label).join('; ')}.`
      : `Não pronto: falta(m) ${missing.map((x) => x.label).join('; ')}.`;

  return { ready, missingRequirements: allMissing, confidence, reason, caseType, evaluatedAt: now };
}

/** Documento obrigatório? (utilitário para consumidores.) */
export function isRequiredDocument(caseType: QualificationCaseType, doc: ReadinessDocumentCode): boolean {
  return requirementsFor(caseType).requiredDocuments.includes(doc);
}
