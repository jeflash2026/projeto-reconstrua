// ─────────────────────────────────────────────────────────────────────────────
// INTELIGÊNCIA (GO-LIVE 13A · área de auditoria) — torna VISÍVEL como a AHRI
// pensa. View-models PUROS sobre os Read Models e o catálogo já existentes:
// biblioteca de estratégias, hipóteses produzidas, conhecimento aprendido. Só
// visualização; nada recalculado na interface; nada da arquitetura cognitiva é
// tocado; nada inventado. Nunca expõe Chain of Thought — apenas dados auditáveis.
// ─────────────────────────────────────────────────────────────────────────────
import type { Condition } from '../executive-brain/conditions.js';
import type { AtendimentoEncerrado } from '../strategic-reasoning/catalog-evolution.js';
import type { CatalogoDeEstrategias, Confianca, EstrategiaSpec } from '../strategic-reasoning/strategic-reasoning.js';
import type { DossieJuridico } from '../dossie/dossie.js';

// ── Condições legíveis (para a biblioteca de estratégias) ─────────────────────
const ROTULO_FATO: Readonly<Record<string, string>> = {
  problema_principal: 'Problema principal',
  beneficio: 'Benefício',
  tempo_do_problema: 'Tempo do problema',
  multiplos_bancos: 'Múltiplos bancos',
  documentacao_mencionada: 'Documentação mencionada',
  stateCode: 'Estado da missão',
  caseExists: 'Possui caso',
};
function rotuloFato(fact: string): string {
  return ROTULO_FATO[fact] ?? fact.replace(/_/g, ' ');
}
const OP_TXT: Readonly<Record<string, string>> = { eq: 'é', neq: 'não é', gt: '>', gte: '≥', lt: '<', lte: '≤' };

export function descreverCondicao(c: Condition): string {
  if ('all' in c) return c.all.map(descreverCondicao).join(' e ');
  if ('any' in c) return c.any.map(descreverCondicao).join(' ou ');
  if ('not' in c) return `não (${descreverCondicao(c.not)})`;
  if (c.op === 'truthy') return `${rotuloFato(c.fact)} é verdadeiro`;
  if (c.op === 'falsy') return `${rotuloFato(c.fact)} é falso`;
  if (c.op === 'in') return `${rotuloFato(c.fact)} ∈ {${c.value.join(', ')}}`;
  if (c.op === 'contains') return `${rotuloFato(c.fact)} contém ${String(c.value)}`;
  return `${rotuloFato(c.fact)} ${OP_TXT[c.op] ?? c.op} ${String(c.value)}`;
}

// ── Estatísticas por estratégia (dos atendimentos encerrados) ─────────────────
const PESO_CONF: Record<Confianca, number> = { alta: 1, media: 0.5, baixa: 0 };

export interface EstatisticaEstrategia {
  readonly usos: number;
  readonly correcoes: number;
  readonly taxaAcerto: number | null; // confirmadas / usos
  readonly confiancaMedia: number | null; // 0..1
  readonly ultimaUtilizacao: Date | null;
  readonly casos: readonly string[]; // missionId/ref dos atendimentos
}

export function estatisticasPorEstrategia(atendimentos: readonly AtendimentoEncerrado[]): ReadonlyMap<string, EstatisticaEstrategia> {
  const acc = new Map<string, { usos: number; correcoes: number; confirmadas: number; somaConf: number; ultima: Date | null; casos: string[] }>();
  for (const a of atendimentos) {
    const cur = acc.get(a.estrategiaEscolhida) ?? { usos: 0, correcoes: 0, confirmadas: 0, somaConf: 0, ultima: null, casos: [] };
    cur.usos += 1;
    if (a.decisaoAdvogado === 'confirmada') cur.confirmadas += 1;
    else cur.correcoes += 1;
    cur.somaConf += PESO_CONF[a.confianca];
    const quando = a.auditoria?.data ?? null;
    if (quando && (cur.ultima === null || quando > cur.ultima)) cur.ultima = quando;
    cur.casos.push(a.ref);
    acc.set(a.estrategiaEscolhida, cur);
  }
  const out = new Map<string, EstatisticaEstrategia>();
  for (const [ref, v] of acc) {
    out.set(ref, {
      usos: v.usos,
      correcoes: v.correcoes,
      taxaAcerto: v.usos > 0 ? Math.round((v.confirmadas / v.usos) * 100) / 100 : null,
      confiancaMedia: v.usos > 0 ? Math.round((v.somaConf / v.usos) * 1000) / 1000 : null,
      ultimaUtilizacao: v.ultima,
      casos: v.casos,
    });
  }
  return out;
}

// ── Biblioteca de estratégias (só consulta) ───────────────────────────────────
export interface EstrategiaCard {
  readonly ref: string;
  readonly descricao: string; // a hipótese autorada
  readonly problemaJuridico: string;
  readonly requisitosMinimos: readonly string[];
  readonly fatosReforcadores: readonly string[];
  readonly criteriosDeExclusao: readonly string[];
  readonly criterioDePrioridade: number;
  readonly documentosEsperados: readonly string[];
  readonly documentosOpcionais: readonly string[];
  readonly riscos: readonly string[];
  readonly proximaAcao: string;
  readonly fundamento: string;
  readonly usos: number;
  readonly casos: readonly string[];
  readonly confiancaMedia: number | null;
  readonly taxaAcerto: number | null;
  readonly ultimaUtilizacao: Date | null;
}

function problemaDe(spec: EstrategiaSpec): string {
  const req = spec.requer.find((c) => 'fact' in c && c.fact === 'problema_principal');
  if (req && 'fact' in req && req.op === 'eq') return String(req.value);
  return spec.requer.map(descreverCondicao).join('; ');
}

export function montarBibliotecaEstrategias(catalogo: CatalogoDeEstrategias, atendimentos: readonly AtendimentoEncerrado[]): readonly EstrategiaCard[] {
  const stats = estatisticasPorEstrategia(atendimentos);
  return catalogo.map((spec) => {
    const s = stats.get(spec.ref);
    return {
      ref: spec.ref,
      descricao: spec.hipotese,
      problemaJuridico: problemaDe(spec),
      requisitosMinimos: spec.requer.map(descreverCondicao),
      fatosReforcadores: (spec.reforca ?? []).map(descreverCondicao),
      criteriosDeExclusao: (spec.criteriosDeExclusao ?? []).map(descreverCondicao),
      criterioDePrioridade: spec.prioridade ?? 0,
      documentosEsperados: spec.documentosEsperados ?? [],
      documentosOpcionais: spec.documentosOpcionais ?? [],
      riscos: (spec.riscos ?? []).map((r) => r.risco),
      proximaAcao: spec.proximaAcao,
      fundamento: spec.fundamento,
      usos: s?.usos ?? 0,
      casos: s?.casos ?? [],
      confiancaMedia: s?.confiancaMedia ?? null,
      taxaAcerto: s?.taxaAcerto ?? null,
      ultimaUtilizacao: s?.ultimaUtilizacao ?? null,
    };
  });
}

// ── Hipóteses produzidas (a partir dos dossiês) ───────────────────────────────
export interface HipoteseView {
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly hipotese: string;
  readonly estrategiaRef: string;
  readonly confianca: Confianca;
  readonly prioridade: number;
  readonly posicao: number;
  readonly decisaoFinal: string | null; // strategyRef vencedora do dossiê
  readonly status: 'vencedora' | 'avaliada';
  readonly fatosSustentam: readonly string[];
  readonly fatosAusentes: readonly string[];
  readonly documentosUtilizados: readonly string[];
  readonly quando: Date;
  /** "Como a AHRI chegou aqui?" — explicação auditável (do dossiê). */
  readonly explicacao: DossieJuridico['explicacao'];
}

/** Extrai as hipóteses de um dossiê como linhas navegáveis. Puro. */
export function hipotesesDoDossie(dossie: DossieJuridico, clienteNome: string): readonly HipoteseView[] {
  return dossie.hipoteses.map((h) => ({
    clienteId: dossie.clienteId,
    clienteNome,
    hipotese: h.hipotese,
    estrategiaRef: h.ref,
    confianca: h.confianca,
    prioridade: h.prioridade,
    posicao: h.posicao,
    decisaoFinal: dossie.strategyRef,
    status: dossie.strategyRef === h.ref ? 'vencedora' : 'avaliada',
    fatosSustentam: dossie.evidenciasEncontradas,
    fatosAusentes: dossie.evidenciasAusentes,
    documentosUtilizados: dossie.documentosReconhecidos,
    quando: dossie.geradoEm,
    explicacao: dossie.explicacao,
  }));
}

// ── Conhecimento aprendido (Conversation Knowledge estruturado) ───────────────
export interface FatoConhecimento {
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly factKey: string;
  readonly valor: string;
  readonly origem: string;
  readonly confianca: string;
  readonly fonte: string;
}
export interface CategoriaConhecimento {
  readonly categoria: string; // rótulo legível do factKey
  readonly factKey: string;
  readonly itens: readonly FatoConhecimento[];
}

export interface FatoAprendidoDeCliente {
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly factKey: string;
  readonly valor: string;
  readonly origem: string;
  readonly confianca: string;
}

/** Agrupa os fatos aprendidos por categoria (factKey). Só conhecimento — nunca mensagens. */
export function agregarConhecimento(fatos: readonly FatoAprendidoDeCliente[]): readonly CategoriaConhecimento[] {
  const grupos = new Map<string, FatoConhecimento[]>();
  for (const f of fatos) {
    const lista = grupos.get(f.factKey) ?? [];
    lista.push({ clienteId: f.clienteId, clienteNome: f.clienteNome, factKey: f.factKey, valor: f.valor, origem: f.origem, confianca: f.confianca, fonte: 'read-model:conversation-knowledge' });
    grupos.set(f.factKey, lista);
  }
  return [...grupos.entries()]
    .map(([factKey, itens]) => ({ categoria: rotuloFato(factKey), factKey, itens }))
    .sort((a, b) => b.itens.length - a.itens.length || a.factKey.localeCompare(b.factKey));
}
