// ─────────────────────────────────────────────────────────────────────────────
// PAINEL DO ADVOGADO (GO-LIVE 13A · seção 1) — o painel deixa de listar clientes
// e passa a listar CASOS. Cada card resume o caso em segundos: cliente, status,
// confiança da AHRI, principal hipótese, próxima ação, documentos pendentes,
// tempo parado, urgência, dossiê disponível, missão e responsável. A ação
// principal é ABRIR O DOSSIÊ (nunca "abrir conversa").
//
// View-model PURO derivado do Dossiê (já montado dos Read Models) + status
// operacional. Nada recalculado na interface; nada inventado.
// ─────────────────────────────────────────────────────────────────────────────
import type { Confianca } from '../strategic-reasoning/strategic-reasoning.js';
import type { DossieJuridico } from './dossie.js';

export type Urgencia = 'alta' | 'media' | 'baixa';

export interface CartaoCaso {
  readonly chatId: string;
  readonly clienteNome: string;
  readonly status: string;
  readonly grauConfianca: Confianca | null;
  readonly principalHipotese: string | null;
  readonly proximaAcao: string | null;
  readonly documentosPendentes: readonly string[];
  readonly tempoParadoMs: number | null;
  readonly urgencia: Urgencia;
  readonly dossieDisponivel: boolean;
  readonly missionId: string | null;
  readonly advogadoResponsavel: string | null;
  /** A ação principal do card abre o DOSSIÊ (que abre no topo do cliente). */
  readonly href: string;
  readonly fonte: string;
}

export interface ResumoCasoInputs {
  readonly chatId: string;
  readonly clienteNome: string;
  readonly status: string;
  readonly tempoParadoMs: number | null;
  readonly advogadoResponsavel: string | null;
  readonly dossie: Pick<DossieJuridico, 'grauConfianca' | 'hipoteses' | 'proximasAcoes' | 'documentosPendentes' | 'missionId'>;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Urgência DETERMINÍSTICA: parado há muito tempo, docs pendentes ou baixa
 *  confiança elevam a prioridade. */
function calcularUrgencia(tempoParadoMs: number | null, docsPendentes: number, confianca: Confianca | null): Urgencia {
  const paradoMuito = tempoParadoMs !== null && tempoParadoMs > 5 * DIA_MS;
  const paradoMedio = tempoParadoMs !== null && tempoParadoMs > 2 * DIA_MS;
  if (paradoMuito || (docsPendentes > 0 && confianca === 'baixa')) return 'alta';
  if (paradoMedio || docsPendentes > 0) return 'media';
  return 'baixa';
}

/** Resume um caso para o card do painel do advogado. Determinístico. */
export function resumirCaso(input: ResumoCasoInputs): CartaoCaso {
  const { dossie } = input;
  const principal = dossie.hipoteses[0] ?? null;
  const dossieDisponivel = dossie.hipoteses.length > 0;
  const urgencia = calcularUrgencia(input.tempoParadoMs, dossie.documentosPendentes.length, dossie.grauConfianca);
  return {
    chatId: input.chatId,
    clienteNome: input.clienteNome,
    status: input.status,
    grauConfianca: dossie.grauConfianca,
    principalHipotese: principal?.hipotese ?? null,
    proximaAcao: dossie.proximasAcoes[0] ?? null,
    documentosPendentes: dossie.documentosPendentes,
    tempoParadoMs: input.tempoParadoMs,
    urgencia,
    dossieDisponivel,
    missionId: dossie.missionId ?? input.dossie.missionId,
    advogadoResponsavel: input.advogadoResponsavel,
    href: `/clientes/${encodeURIComponent(input.chatId)}`,
    fonte: 'read-models + dossie',
  };
}

/** Ordena os casos por urgência (alta→baixa) e, dentro dela, mais parados antes. */
export function ordenarCasos(casos: readonly CartaoCaso[]): readonly CartaoCaso[] {
  const peso: Record<Urgencia, number> = { alta: 0, media: 1, baixa: 2 };
  return [...casos].sort((a, b) => peso[a.urgencia] - peso[b.urgencia] || (b.tempoParadoMs ?? 0) - (a.tempoParadoMs ?? 0) || a.chatId.localeCompare(b.chatId));
}
