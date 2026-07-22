// ─────────────────────────────────────────────────────────────────────────────
// CATALOG EVOLUTION (GO-LIVE 11B) — o catálogo deixa de evoluir MANUALMENTE e
// passa a ser MEDIDO continuamente. Para cada atendimento ENCERRADO registra-se
// o desfecho (estratégia escolhida, documentos, decisão do advogado, correção,
// documentos faltantes, fatos difíceis, confiança, tempo até decisão) e um
// relatório agregado é produzido.
//
// REGRA ABSOLUTA: esta camada NUNCA altera o catálogo. Ela só MEDE e RELATA.
// O relatório é insumo do ARQUITETO para evoluir o conhecimento — a decisão de
// mudar o catálogo permanece humana. Determinística; sem efeitos colaterais.
// ─────────────────────────────────────────────────────────────────────────────
import type { CatalogoDeEstrategias, Confianca } from './strategic-reasoning.js';

/** O que o advogado fez com a estratégia proposta pela AHRI ao encerrar o caso. */
export type DecisaoAdvogado = 'confirmada' | 'corrigida' | 'rejeitada';

/** GO-LIVE 11C — auditoria do registro: rastreia o atendimento até a origem. */
export interface AtendimentoAuditoria {
  readonly missionId: string;
  readonly decisionId: string | null;
  readonly correlationId: string;
  readonly cliente: string;
  readonly data: Date;
  readonly advogado: string; // responsável pelo encerramento
}

/** O desfecho REGISTRADO de um atendimento encerrado (anonimizado). */
export interface AtendimentoEncerrado {
  readonly ref: string; // id do atendimento
  readonly estrategiaEscolhida: string; // a ref decidida pelo Executive Mind
  readonly confianca: Confianca; // confiança da decisão
  readonly documentosRecebidos: readonly string[];
  readonly decisaoAdvogado: DecisaoAdvogado;
  readonly estrategiaCorreta: string | null; // segundo o advogado (quando corrigida)
  readonly estrategiaIncorreta: string | null; // a que estava errada (quando corrigida)
  readonly documentosFaltantes: readonly string[]; // documentos que faltaram
  readonly motivoCorrecao: string | null;
  readonly fatosDificeis: readonly string[]; // fatos difíceis de descobrir no atendimento
  readonly tempoAteDecisaoMs: number; // tempo do início do atendimento até a decisão
  /** GO-LIVE 11C — fatos APRENDIDOS na conversa (Conversation Knowledge). */
  readonly fatosAprendidos?: readonly string[];
  /** GO-LIVE 11C — auditoria (missionId/decisionId/correlationId/cliente/data/advogado). */
  readonly auditoria?: AtendimentoAuditoria;
}

export interface ContagemPorChave {
  readonly chave: string;
  readonly ocorrencias: number;
}
export interface EstrategiaCorrigida {
  readonly ref: string;
  readonly correcoes: number;
  readonly usos: number;
  readonly taxaCorrecao: number; // correcoes / usos (0..1)
}

export interface RelatorioDeEvolucao {
  readonly totalAtendimentos: number;
  readonly estrategiasMaisUtilizadas: readonly ContagemPorChave[]; // desc
  readonly estrategiasNuncaUtilizadas: readonly string[]; // refs do catálogo nunca escolhidas
  readonly estrategiasFrequentementeCorrigidas: readonly EstrategiaCorrigida[]; // desc por correções
  readonly documentosQueMaisFaltam: readonly ContagemPorChave[]; // desc
  readonly fatosMaisDificeis: readonly ContagemPorChave[]; // desc
  readonly confiancaMedia: number; // 0..1 (alta=1, media=0.5, baixa=0)
  readonly confiancaDistribuicao: Readonly<Record<Confianca, number>>;
  readonly tempoMedioAteDecisaoMs: number;
  readonly taxaAcerto: number; // confirmadas / total (0..1)
}

const PESO: Record<Confianca, number> = { alta: 1, media: 0.5, baixa: 0 };

/** Agrega ocorrências de uma lista de chaves em ordem determinística (desc, depois chave asc). */
function contar(chaves: readonly string[]): ContagemPorChave[] {
  const mapa = new Map<string, number>();
  for (const c of chaves) mapa.set(c, (mapa.get(c) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([chave, ocorrencias]) => ({ chave, ocorrencias }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.chave.localeCompare(b.chave));
}

function arredondar(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Produz o RELATÓRIO de evolução a partir dos atendimentos encerrados. NUNCA
 * altera o catálogo — apenas o lê para descobrir as estratégias nunca usadas.
 */
export function gerarRelatorioDeEvolucao(
  catalogo: CatalogoDeEstrategias,
  atendimentos: readonly AtendimentoEncerrado[],
): RelatorioDeEvolucao {
  const total = atendimentos.length;

  const usosPorRef = new Map<string, number>();
  const correcoesPorRef = new Map<string, number>();
  const documentosFaltantes: string[] = [];
  const fatosDificeis: string[] = [];
  const distribuicao: Record<Confianca, number> = { alta: 0, media: 0, baixa: 0 };
  let somaConfianca = 0;
  let somaTempo = 0;
  let confirmadas = 0;

  for (const a of atendimentos) {
    usosPorRef.set(a.estrategiaEscolhida, (usosPorRef.get(a.estrategiaEscolhida) ?? 0) + 1);
    if (a.decisaoAdvogado === 'confirmada') confirmadas += 1;
    // "Frequentemente corrigidas" conta a estratégia que ESTAVA errada (a escolhida).
    if (a.decisaoAdvogado === 'corrigida' || a.decisaoAdvogado === 'rejeitada') {
      const errada = a.estrategiaIncorreta ?? a.estrategiaEscolhida;
      correcoesPorRef.set(errada, (correcoesPorRef.get(errada) ?? 0) + 1);
    }
    documentosFaltantes.push(...a.documentosFaltantes);
    fatosDificeis.push(...a.fatosDificeis);
    distribuicao[a.confianca] += 1;
    somaConfianca += PESO[a.confianca];
    somaTempo += a.tempoAteDecisaoMs;
  }

  const estrategiasMaisUtilizadas = [...usosPorRef.entries()]
    .map(([chave, ocorrencias]) => ({ chave, ocorrencias }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.chave.localeCompare(b.chave));

  const estrategiasNuncaUtilizadas = catalogo
    .map((s) => s.ref)
    .filter((ref) => !usosPorRef.has(ref));

  const estrategiasFrequentementeCorrigidas = [...correcoesPorRef.entries()]
    .map(([ref, correcoes]) => {
      const usos = usosPorRef.get(ref) ?? correcoes;
      return { ref, correcoes, usos, taxaCorrecao: usos > 0 ? arredondar(correcoes / usos) : 1 };
    })
    .sort(
      (a, b) =>
        b.correcoes - a.correcoes || b.taxaCorrecao - a.taxaCorrecao || a.ref.localeCompare(b.ref),
    );

  return {
    totalAtendimentos: total,
    estrategiasMaisUtilizadas,
    estrategiasNuncaUtilizadas,
    estrategiasFrequentementeCorrigidas,
    documentosQueMaisFaltam: contar(documentosFaltantes),
    fatosMaisDificeis: contar(fatosDificeis),
    confiancaMedia: total > 0 ? arredondar(somaConfianca / total) : 0,
    confiancaDistribuicao: distribuicao,
    tempoMedioAteDecisaoMs: total > 0 ? Math.round(somaTempo / total) : 0,
    taxaAcerto: total > 0 ? arredondar(confirmadas / total) : 0,
  };
}
