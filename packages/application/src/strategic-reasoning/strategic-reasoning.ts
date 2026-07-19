// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIC REASONING (GO-LIVE 10A) — a AHRI passa a ELABORAR ESTRATÉGIAS.
//
// Posição decretada: Truth Layer → [STRATEGIC REASONING] → Brain Facts → Planner.
//
// Esta camada NUNCA fala com o cliente e NUNCA produz linguagem: ela SELECIONA
// hipóteses/prioridades/riscos AUTORADOS pelo catálogo do domínio e produz
// RACIOCÍNIO ESTRUTURADO — avaliar, comparar, formular hipóteses, escolher e
// JUSTIFICAR, sempre sobre fatos.
//
// GENÉRICA: o motor conhece apenas fatos (o MESMO formato BrainFacts e as
// MESMAS condições serializáveis do Brain — auditáveis por construção). O
// domínio muda (Reconstrua/Business/Life) trocando o CATÁLOGO DE ESTRATÉGIAS;
// o raciocínio continua o mesmo.
//
// Regras invioláveis:
//  • NUNCA inventar hipótese: só entra no raciocínio a hipótese cujos requisitos
//    casaram com fatos REAIS — e ela carrega `sustentadaPor` (quais fatos).
//  • Toda prioridade carrega justificativa; toda recomendação carrega confiança.
//  • Tudo é rastreável: ref da estratégia + fatos + fundamento do domínio.
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts, FactValue } from '../executive-brain/facts.js';
import { evaluateCondition, type Condition } from '../executive-brain/conditions.js';

export type Confianca = 'alta' | 'media' | 'baixa';

/** Uma ESTRATÉGIA autorada pelo domínio (dados declarativos; nunca closures). */
export interface EstrategiaSpec {
  readonly ref: string; // ex.: 'EST-CONSIG-REVISAO-001'
  /** A hipótese declarativa (texto AUTORADO pelo domínio; o motor não escreve). */
  readonly hipotese: string;
  /** Fatos que a SUSTENTAM — TODOS precisam casar (senão a hipótese não existe). */
  readonly requer: readonly Condition[];
  /** Fatos que a REFORÇAM — elevam a confiança quando presentes. */
  readonly reforca?: readonly Condition[];
  /** Riscos condicionais: só aparecem quando os fatos os sustentam. */
  readonly riscos?: ReadonlyArray<{ readonly quando: readonly Condition[]; readonly risco: string }>;
  /** Oportunidades condicionais (mesma disciplina dos riscos). */
  readonly oportunidades?: ReadonlyArray<{ readonly quando: readonly Condition[]; readonly oportunidade: string }>;
  /** Prioridades condicionais — cada uma com a sua justificativa. */
  readonly prioridades?: ReadonlyArray<{
    readonly quando: readonly Condition[];
    readonly acao: string;
    readonly justificativa: string;
  }>;
  /** A próxima melhor ação quando esta é a hipótese principal. */
  readonly proximaAcao: string;
  /** Base do domínio (regra jurídica/negócio) — auditabilidade. */
  readonly fundamento: string;
}

export type CatalogoDeEstrategias = readonly EstrategiaSpec[];

export interface HipoteseAvaliada {
  readonly ref: string;
  readonly hipotese: string;
  readonly confianca: Confianca;
  /** RASTREABILIDADE: os fatos exatos (key=valor) que sustentam a hipótese. */
  readonly sustentadaPor: readonly string[];
  /** Fatos que a reforçaram (elevaram a confiança). */
  readonly reforcadaPor: readonly string[];
  readonly fundamento: string;
}

export interface RaciocinioEstrategico {
  /** Hipóteses SUSTENTADAS por fatos, ordenadas (confiança > reforços > catálogo). */
  readonly hipoteses: readonly HipoteseAvaliada[];
  readonly hipotesePrincipal: HipoteseAvaliada | null;
  readonly prioridades: ReadonlyArray<{ readonly acao: string; readonly justificativa: string; readonly ref: string }>;
  readonly riscos: ReadonlyArray<{ readonly risco: string; readonly sustentadoPor: readonly string[]; readonly ref: string }>;
  readonly oportunidades: ReadonlyArray<{ readonly oportunidade: string; readonly sustentadoPor: readonly string[]; readonly ref: string }>;
  readonly proximaMelhorAcao: {
    readonly acao: string;
    readonly justificativa: string;
    readonly confianca: Confianca;
    readonly ref: string;
  } | null;
  /** Trilha de auditoria da decisão (determinística). */
  readonly auditoria: {
    readonly estrategiasAvaliadas: number;
    readonly fatosConsiderados: readonly string[];
  };
}

function fatoTexto(facts: BrainFacts, c: Condition): string {
  if ('all' in c) return c.all.map((inner) => fatoTexto(facts, inner)).join(' ∧ ');
  if ('any' in c) return c.any.map((inner) => fatoTexto(facts, inner)).join(' ∨ ');
  if ('not' in c) return `¬(${fatoTexto(facts, c.not)})`;
  const v: FactValue | undefined = facts[c.fact];
  return `${c.fact}=${String(v)}`;
}

function casamTodas(conds: readonly Condition[], facts: BrainFacts): boolean {
  return conds.every((c) => evaluateCondition(c, facts));
}

/** Confiança DETERMINÍSTICA: requisitos casados ⇒ média; ≥2 reforços ⇒ alta. */
function confiancaDe(reforcos: number): Confianca {
  return reforcos >= 2 ? 'alta' : 'media';
}

const RANK: Record<Confianca, number> = { alta: 2, media: 1, baixa: 0 };

/** O raciocínio: avalia TODO o catálogo contra os fatos. Nunca inventa. */
export function raciocinar(facts: BrainFacts, catalogo: CatalogoDeEstrategias): RaciocinioEstrategico {
  const hipoteses: HipoteseAvaliada[] = [];
  const prioridades: Array<{ acao: string; justificativa: string; ref: string }> = [];
  const riscos: Array<{ risco: string; sustentadoPor: readonly string[]; ref: string }> = [];
  const oportunidades: Array<{ oportunidade: string; sustentadoPor: readonly string[]; ref: string }> = [];

  for (const spec of catalogo) {
    // NUNCA inventar: sem TODOS os requisitos casando, a hipótese não existe.
    if (spec.requer.length === 0 || !casamTodas(spec.requer, facts)) continue;

    const sustentadaPor = spec.requer.map((c) => fatoTexto(facts, c));
    const reforcadaPor = (spec.reforca ?? []).filter((c) => evaluateCondition(c, facts)).map((c) => fatoTexto(facts, c));

    hipoteses.push({
      ref: spec.ref,
      hipotese: spec.hipotese,
      confianca: confiancaDe(reforcadaPor.length),
      sustentadaPor,
      reforcadaPor,
      fundamento: spec.fundamento,
    });

    for (const p of spec.prioridades ?? []) {
      if (casamTodas(p.quando, facts)) prioridades.push({ acao: p.acao, justificativa: p.justificativa, ref: spec.ref });
    }
    for (const r of spec.riscos ?? []) {
      if (casamTodas(r.quando, facts)) {
        riscos.push({ risco: r.risco, sustentadoPor: r.quando.map((c) => fatoTexto(facts, c)), ref: spec.ref });
      }
    }
    for (const o of spec.oportunidades ?? []) {
      if (casamTodas(o.quando, facts)) {
        oportunidades.push({ oportunidade: o.oportunidade, sustentadoPor: o.quando.map((c) => fatoTexto(facts, c)), ref: spec.ref });
      }
    }
  }

  // COMPARAR e ESCOLHER (determinístico): confiança > nº de reforços > ordem do catálogo.
  hipoteses.sort((a, b) => RANK[b.confianca] - RANK[a.confianca] || b.reforcadaPor.length - a.reforcadaPor.length);
  const principal = hipoteses[0] ?? null;

  const proximaMelhorAcao =
    principal === null
      ? null
      : {
          acao: catalogo.find((s) => s.ref === principal.ref)?.proximaAcao ?? '',
          justificativa: `hipótese ${principal.ref} sustentada por: ${principal.sustentadaPor.join(', ')}`,
          confianca: principal.confianca,
          ref: principal.ref,
        };

  return {
    hipoteses,
    hipotesePrincipal: principal,
    prioridades,
    riscos,
    oportunidades,
    proximaMelhorAcao,
    auditoria: {
      estrategiasAvaliadas: catalogo.length,
      fatosConsiderados: Object.entries(facts).map(([k, v]) => `${k}=${String(v)}`),
    },
  };
}
