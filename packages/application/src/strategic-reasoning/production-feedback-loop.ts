// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION FEEDBACK LOOP (GO-LIVE 11C) — liga o ENCERRAMENTO REAL de uma missão
// ao motor de evolução do catálogo (11B). Sem nova camada, sem novo conceito:
// apenas INTEGRA.
//
//   Mission Runtime → encerramento → AtendimentoEncerrado → Catalog Evolution
//
// Tudo que o sistema JÁ TEM é preenchido automaticamente (strategyRef, decisionId,
// confidence, documentos recebidos/faltantes, tempo até decisão, fatos aprendidos);
// o advogado fornece SOMENTE 3 campos humanos (decisão correta, estratégia correta
// quando diferente, motivo). Cada registro é PERSISTIDO e nunca recalculado — o
// painel do arquiteto sempre trabalha sobre os registros salvos.
// ─────────────────────────────────────────────────────────────────────────────
import type { CatalogoDeEstrategias, Confianca } from './strategic-reasoning.js';
import {
  gerarRelatorioDeEvolucao,
  type AtendimentoAuditoria,
  type AtendimentoEncerrado,
  type ContagemPorChave,
  type DecisaoAdvogado,
  type EstrategiaCorrigida,
} from './catalog-evolution.js';

/** Dados AUTOMÁTICOS coletados no encerramento (tudo que o sistema já tem). */
export interface EncerramentoAutomatico {
  readonly missionId: string;
  readonly decisionId: string | null;
  readonly correlationId: string;
  readonly cliente: string;
  readonly advogado: string;
  readonly data: Date;
  readonly strategyRef: string; // estratégia escolhida (Executive Mind)
  readonly confianca: Confianca;
  readonly documentosRecebidos: readonly string[];
  readonly documentosFaltantes: readonly string[];
  readonly tempoAteDecisaoMs: number;
  readonly fatosAprendidos: readonly string[];
  /** Fatos que foram difíceis de descobrir (opcional; ex.: esperados e ausentes). */
  readonly fatosDificeis?: readonly string[];
}

/** Os ÚNICOS campos humanos pedidos no painel do advogado ao encerrar. */
export interface DecisaoHumana {
  readonly decisaoAdvogado: DecisaoAdvogado;
  readonly estrategiaCorreta?: string; // caso diferente da escolhida
  readonly motivoCorrecao?: string;
}

/** Monta o registro de encerramento a partir do automático + do humano. Puro. */
export function montarAtendimentoEncerrado(auto: EncerramentoAutomatico, humano: DecisaoHumana): AtendimentoEncerrado {
  const auditoria: AtendimentoAuditoria = {
    missionId: auto.missionId,
    decisionId: auto.decisionId,
    correlationId: auto.correlationId,
    cliente: auto.cliente,
    data: auto.data,
    advogado: auto.advogado,
  };
  return {
    ref: auto.missionId,
    estrategiaEscolhida: auto.strategyRef,
    confianca: auto.confianca,
    documentosRecebidos: auto.documentosRecebidos,
    decisaoAdvogado: humano.decisaoAdvogado,
    estrategiaCorreta: humano.estrategiaCorreta ?? null,
    // A escolhida vira a "incorreta" quando o advogado corrige/rejeita.
    estrategiaIncorreta: humano.decisaoAdvogado === 'confirmada' ? null : auto.strategyRef,
    documentosFaltantes: auto.documentosFaltantes,
    motivoCorrecao: humano.motivoCorrecao ?? null,
    fatosDificeis: auto.fatosDificeis ?? [],
    tempoAteDecisaoMs: auto.tempoAteDecisaoMs,
    fatosAprendidos: auto.fatosAprendidos,
    auditoria,
  };
}

/** PERSISTÊNCIA dos registros. Salva cada AtendimentoEncerrado; nunca recalcula. */
export interface AtendimentoStore {
  salvar(atendimento: AtendimentoEncerrado): Promise<void>;
  listar(): Promise<readonly AtendimentoEncerrado[]>;
}

/** Adapter de referência em memória (default; produção pluga o seu). */
export class InMemoryAtendimentoStore implements AtendimentoStore {
  private readonly registros: AtendimentoEncerrado[] = [];
  salvar(atendimento: AtendimentoEncerrado): Promise<void> {
    this.registros.push(atendimento);
    return Promise.resolve();
  }
  listar(): Promise<readonly AtendimentoEncerrado[]> {
    return Promise.resolve([...this.registros]);
  }
}

/** O laço de feedback: no encerramento, monta + persiste o AtendimentoEncerrado. */
export class ProductionFeedbackLoop {
  constructor(private readonly store: AtendimentoStore) {}
  async registrarEncerramento(auto: EncerramentoAutomatico, humano: DecisaoHumana): Promise<AtendimentoEncerrado> {
    const atendimento = montarAtendimentoEncerrado(auto, humano);
    await this.store.salvar(atendimento);
    return atendimento;
  }
}

// ── PAINEL DO ARQUITETO ───────────────────────────────────────────────────────

export interface HistoricoMensal {
  readonly mes: string; // 'YYYY-MM'
  readonly total: number;
  readonly taxaAcerto: number;
  readonly confiancaMedia: number;
  readonly tempoMedioAteDecisaoMs: number;
}

export interface PainelDoArquiteto {
  readonly taxaAcerto: number;
  readonly estrategiasMaisUtilizadas: readonly ContagemPorChave[];
  readonly estrategiasNuncaUtilizadas: readonly string[];
  readonly estrategiasMaisCorrigidas: readonly EstrategiaCorrigida[];
  readonly documentosMaisFaltantes: readonly ContagemPorChave[];
  readonly fatosDificeis: readonly ContagemPorChave[];
  readonly tempoMedioAteDecisaoMs: number;
  readonly confiancaMedia: number;
  readonly historicoMensal: readonly HistoricoMensal[];
  readonly totalAtendimentos: number;
}

function mesDe(data: Date): string {
  return `${String(data.getUTCFullYear())}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Monta o painel do arquiteto sobre os registros PERSISTIDOS. Só lê; nunca altera nada. */
export function montarPainelDoArquiteto(
  catalogo: CatalogoDeEstrategias,
  atendimentos: readonly AtendimentoEncerrado[],
): PainelDoArquiteto {
  const rel = gerarRelatorioDeEvolucao(catalogo, atendimentos);

  // Histórico mensal: agrupa por 'YYYY-MM' (data de auditoria) e reusa o relatório por mês.
  const porMes = new Map<string, AtendimentoEncerrado[]>();
  for (const a of atendimentos) {
    const mes = a.auditoria ? mesDe(a.auditoria.data) : 'sem-data';
    const lista = porMes.get(mes) ?? [];
    lista.push(a);
    porMes.set(mes, lista);
  }
  const historicoMensal: HistoricoMensal[] = [...porMes.entries()]
    .map(([mes, lista]) => {
      const r = gerarRelatorioDeEvolucao(catalogo, lista);
      return { mes, total: lista.length, taxaAcerto: r.taxaAcerto, confiancaMedia: r.confiancaMedia, tempoMedioAteDecisaoMs: r.tempoMedioAteDecisaoMs };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    taxaAcerto: rel.taxaAcerto,
    estrategiasMaisUtilizadas: rel.estrategiasMaisUtilizadas,
    estrategiasNuncaUtilizadas: rel.estrategiasNuncaUtilizadas,
    estrategiasMaisCorrigidas: rel.estrategiasFrequentementeCorrigidas,
    documentosMaisFaltantes: rel.documentosQueMaisFaltam,
    fatosDificeis: rel.fatosMaisDificeis,
    tempoMedioAteDecisaoMs: rel.tempoMedioAteDecisaoMs,
    confiancaMedia: rel.confiancaMedia,
    historicoMensal,
    totalAtendimentos: rel.totalAtendimentos,
  };
}
