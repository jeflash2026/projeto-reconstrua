// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DO CATÁLOGO (GO-LIVE 11A) — roda a matriz de estratégias contra um
// conjunto de CASOS REAIS e reporta a saúde do conhecimento jurídico:
//   • estratégias NUNCA utilizadas (não disparam em nenhum caso);
//   • estratégias CONFLITANTES (empate no topo, sem desempate determinístico);
//   • estratégias de BAIXA CONFIANÇA (nunca alcançam confiança 'alta');
//   • LACUNAS do catálogo (casos que não casam com nenhuma estratégia).
//
// Ferramenta de análise do DOMÍNIO — não altera arquitetura nem o runtime.
// Determinística: reusa `raciocinar` (o mesmo motor da produção).
// ─────────────────────────────────────────────────────────────────────────────
import type { BrainFacts } from '../executive-brain/facts.js';
import { raciocinar, type CatalogoDeEstrategias, type Confianca } from './strategic-reasoning.js';

/** Um caso real (anonimizado): um conjunto de fatos observado em atendimento. */
export interface CasoReal {
  readonly ref: string;
  readonly facts: BrainFacts;
}

const RANK: Record<Confianca, number> = { alta: 2, media: 1, baixa: 0 };

export interface EstrategiaBaixaConfianca {
  readonly ref: string;
  readonly melhorConfianca: Confianca; // a maior confiança que alcançou em algum caso
}
export interface CasoConflitante {
  readonly caso: string;
  readonly empatadas: readonly string[]; // refs empatadas no topo (mesmo peso)
}

export interface AchadosDaValidacao {
  readonly estrategiasNuncaUtilizadas: readonly string[];
  readonly estrategiasBaixaConfianca: readonly EstrategiaBaixaConfianca[];
  readonly casosConflitantes: readonly CasoConflitante[];
  readonly lacunas: readonly string[]; // refs de casos sem NENHUMA hipótese
  readonly cobertura: {
    readonly casos: number;
    readonly estrategias: number;
    readonly utilizadas: number;
  };
}

/** Valida o catálogo contra os casos. Não decide nada de produção — só analisa. */
export function validarCatalogo(
  catalogo: CatalogoDeEstrategias,
  casos: readonly CasoReal[],
): AchadosDaValidacao {
  const utilizadas = new Set<string>();
  const melhorConfPorRef = new Map<string, Confianca>();
  const lacunas: string[] = [];
  const casosConflitantes: CasoConflitante[] = [];

  for (const caso of casos) {
    const r = raciocinar(caso.facts, catalogo);

    if (r.hipoteses.length === 0) {
      lacunas.push(caso.ref);
      continue;
    }

    for (const h of r.hipoteses) {
      utilizadas.add(h.ref);
      const atual = melhorConfPorRef.get(h.ref);
      if (atual === undefined || RANK[h.confianca] > RANK[atual])
        melhorConfPorRef.set(h.ref, h.confianca);
    }

    // CONFLITO: duas ou mais hipóteses empatadas no TOPO por confiança, reforços
    // E prioridade — o desempate cairia na ordem do catálogo (ambíguo p/ o domínio).
    const top = r.hipoteses[0];
    if (top !== undefined) {
      const empatadas = r.hipoteses.filter(
        (h) =>
          RANK[h.confianca] === RANK[top.confianca] &&
          h.reforcadaPor.length === top.reforcadaPor.length &&
          h.prioridade === top.prioridade,
      );
      if (empatadas.length > 1)
        casosConflitantes.push({ caso: caso.ref, empatadas: empatadas.map((h) => h.ref) });
    }
  }

  const estrategiasNuncaUtilizadas = catalogo
    .map((s) => s.ref)
    .filter((ref) => !utilizadas.has(ref));
  const estrategiasBaixaConfianca = [...melhorConfPorRef.entries()]
    .filter(([, conf]) => conf !== 'alta')
    .map(([ref, conf]) => ({ ref, melhorConfianca: conf }));

  return {
    estrategiasNuncaUtilizadas,
    estrategiasBaixaConfianca,
    casosConflitantes,
    lacunas,
    cobertura: { casos: casos.length, estrategias: catalogo.length, utilizadas: utilizadas.size },
  };
}
