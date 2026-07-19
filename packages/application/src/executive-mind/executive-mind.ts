// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE MIND (GO-LIVE 10B) — a estratégia é DELIBERADA antes de executada.
//
// Posição decretada:
//   Truth Layer → Strategic Reasoning → [EXECUTIVE MIND] → Brain Facts → Planner
//
// Separação de poderes:
//   • Strategic Reasoning PENSA: produz possibilidades — nunca decide.
//   • Executive Mind ESCOLHE: compara, descarta, prioriza, justifica — e entrega
//     UMA ÚNICA estratégia ativa (as demais ficam REGISTRADAS, com o motivo
//     exato da derrota).
//   • O Planner EXECUTA: recebe apenas a strategicDecision — jamais compara.
//
// Determinístico e auditável: o mesmo conjunto de hipóteses SEMPRE produz a
// mesma decisão (id incluso). Nada de linguagem gerada: o why é montado de
// partes AUTORADAS (refs, fatos key=valor, critério declarado).
// ─────────────────────────────────────────────────────────────────────────────
import type { Confianca, HipoteseAvaliada, RaciocinioEstrategico } from '../strategic-reasoning/strategic-reasoning.js';

export interface AlternativaRegistrada {
  readonly strategyRef: string;
  readonly hipotese: string;
  readonly confidence: Confianca;
  /** Por que ESTA alternativa perdeu para a vencedora (auditável). */
  readonly motivoDaDerrota: string;
}

export interface StrategicDecision {
  /** Determinístico: mesmo raciocínio ⇒ mesmo id (rastreável e reprodutível). */
  readonly decisionId: string;
  readonly strategyRef: string;
  readonly confidence: Confianca;
  /** Por que esta estratégia VENCEU (fatos + critério — nunca prosa inventada). */
  readonly why: string;
  /** O que se espera confirmar/alcançar com a estratégia ativa. */
  readonly expectedOutcome: string;
  readonly nextAction: string;
  /** A segunda colocada (troca imediata se a ativa cair) — null se não houver. */
  readonly fallbackStrategy: string | null;
  /** REGRA: UMA ativa; as demais permanecem REGISTRADAS (com motivo da derrota). */
  readonly alternativasRegistradas: readonly AlternativaRegistrada[];
  readonly auditoria: {
    readonly criterio: string;
    readonly hipotesesRecebidas: number;
    readonly sustentadaPor: readonly string[];
    readonly reforcadaPor: readonly string[];
  };
}

const RANK: Record<Confianca, number> = { alta: 2, media: 1, baixa: 0 };
const CRITERIO = 'confiança > nº de reforços > ordem do raciocínio (estável)';

/** Hash determinístico curto (djb2) — o id nasce do CONTEÚDO da decisão. */
function idDeterministico(semente: string): string {
  let h = 5381;
  for (let i = 0; i < semente.length; i += 1) h = ((h << 5) + h + semente.charCodeAt(i)) >>> 0;
  return `dec-${h.toString(16).padStart(8, '0')}`;
}

/** Por que a `perdedora` perdeu para a `vencedora` — comparação declarada. */
function motivoDerrota(vencedora: HipoteseAvaliada, perdedora: HipoteseAvaliada): string {
  if (RANK[perdedora.confianca] < RANK[vencedora.confianca]) {
    return `confiança inferior (${perdedora.confianca} < ${vencedora.confianca})`;
  }
  if (perdedora.reforcadaPor.length < vencedora.reforcadaPor.length) {
    return `menos fatos de reforço (${String(perdedora.reforcadaPor.length)} < ${String(vencedora.reforcadaPor.length)})`;
  }
  return 'empate técnico — ordem do raciocínio decidiu (determinístico)';
}

/**
 * DELIBERA: compara todas as hipóteses e entrega UMA estratégia ativa.
 * null = nada a decidir (sem hipóteses sustentadas — jamais inventa decisão).
 */
export function deliberar(raciocinio: RaciocinioEstrategico): StrategicDecision | null {
  const candidatas = [...raciocinio.hipoteses].sort(
    (a, b) => RANK[b.confianca] - RANK[a.confianca] || b.reforcadaPor.length - a.reforcadaPor.length,
  );
  const vencedora = candidatas[0];
  if (vencedora === undefined) return null;

  const perdedoras = candidatas.slice(1);
  const alternativasRegistradas: AlternativaRegistrada[] = perdedoras.map((p) => ({
    strategyRef: p.ref,
    hipotese: p.hipotese,
    confidence: p.confianca,
    motivoDaDerrota: motivoDerrota(vencedora, p),
  }));

  const proxima = raciocinio.proximaMelhorAcao;
  const why =
    `estratégia ${vencedora.ref} venceu por ${CRITERIO}: confiança ${vencedora.confianca}; ` +
    `sustentada por [${vencedora.sustentadaPor.join(', ')}]` +
    (vencedora.reforcadaPor.length > 0 ? `; reforçada por [${vencedora.reforcadaPor.join(', ')}]` : '') +
    (perdedoras.length > 0
      ? `; derrotadas: ${perdedoras.map((p) => `${p.ref} (${motivoDerrota(vencedora, p)})`).join('; ')}`
      : '; nenhuma alternativa concorrente');

  return {
    decisionId: idDeterministico(`${vencedora.ref}|${vencedora.confianca}|${vencedora.sustentadaPor.join('|')}`),
    strategyRef: vencedora.ref,
    confidence: vencedora.confianca,
    why,
    expectedOutcome: `confirmar a hipótese: ${vencedora.hipotese}`,
    nextAction: proxima?.acao ?? '',
    fallbackStrategy: perdedoras[0]?.ref ?? null,
    alternativasRegistradas,
    auditoria: {
      criterio: CRITERIO,
      hipotesesRecebidas: raciocinio.hipoteses.length,
      sustentadaPor: vencedora.sustentadaPor,
      reforcadaPor: vencedora.reforcadaPor,
    },
  };
}
