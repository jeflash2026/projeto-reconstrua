// ─────────────────────────────────────────────────────────────────────────────
// DOSSIÊ JURÍDICO (GO-LIVE 13A · seção 4) — o PARECER INICIAL que a AHRI entrega
// ao advogado. Não é uma tela de dados: é o raciocínio jurídico da AHRI tornado
// VISÍVEL. Monta-se a partir dos Read Models (fatos aprendidos, documentos,
// timeline, missão/decisão) e REUTILIZA o motor que a AHRI já possui
// (raciocinar/deliberar) — nenhuma arquitetura nova, nenhum recálculo na
// interface, nada inventado. Todo item é rastreável até os fatos.
//
// Inclui "Como a AHRI chegou nesta conclusão": apenas informações AUDITÁVEIS
// (fatos, documentos, hipóteses avaliadas/descartadas, estratégia vencedora,
// confiança). NUNCA expõe Chain of Thought.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluateCondition, type Condition } from '../executive-brain/conditions.js';
import { deliberar } from '../executive-mind/executive-mind.js';
import { fatosEstrategicos, type EntradasEstrategicas } from '../strategic-reasoning/fatos-estrategicos.js';
import { ESTRATEGIAS_CONSIGNADO_INSS } from '../strategic-reasoning/consignado-strategies.js';
import { raciocinar, type CatalogoDeEstrategias, type Confianca, type EstrategiaSpec } from '../strategic-reasoning/strategic-reasoning.js';

export interface DossieTimelineEvento {
  readonly rotulo: string;
  readonly em: Date | null;
  readonly fonte: string;
}

export interface DossieInputs {
  readonly clienteId: string;
  readonly chatId: string;
  readonly missionId: string | null;
  readonly decisionId: string | null;
  readonly correlationId: string | null;
  readonly versaoCatalogo: string;
  readonly geradoEm: Date;
  /** Entradas do raciocínio (Truth ⊕ Conversation Knowledge ⊕ documentos). */
  readonly entradas: EntradasEstrategicas;
  readonly documentosReconhecidos: readonly string[];
  readonly contratosEncontrados: readonly string[];
  readonly timeline: readonly DossieTimelineEvento[];
  readonly catalogo?: CatalogoDeEstrategias;
}

export interface TeseRanqueada {
  readonly posicao: number;
  readonly ref: string;
  readonly hipotese: string;
  readonly confianca: Confianca;
  readonly prioridade: number;
  readonly justificativa: string; // por que esta tese se sustenta (fatos)
  readonly fundamento: string; // base jurídica (domínio)
}

export interface DossieExplicacao {
  readonly fatosUtilizados: readonly string[];
  readonly documentosConsiderados: readonly string[];
  readonly hipotesesAvaliadas: ReadonlyArray<{ readonly ref: string; readonly confianca: Confianca }>;
  readonly hipotesesDescartadas: ReadonlyArray<{ readonly ref: string; readonly motivo: string }>;
  readonly estrategiaVencedora: string | null;
  readonly confianca: Confianca | null;
  readonly criterios: string;
}

export interface DossieJuridico {
  // ── Cabeçalho / rastreabilidade ──
  readonly clienteId: string;
  readonly chatId: string;
  readonly missionId: string | null;
  readonly decisionId: string | null;
  readonly strategyRef: string | null;
  readonly correlationId: string | null;
  readonly versaoCatalogo: string;
  readonly geradoEm: Date;
  readonly grauConfianca: Confianca | null;
  // ── Conteúdo do parecer ──
  readonly resumoExecutivo: string;
  readonly problemaIdentificado: string | null;
  readonly hipoteses: readonly TeseRanqueada[];
  readonly evidenciasEncontradas: readonly string[];
  readonly evidenciasAusentes: readonly string[];
  readonly documentosReconhecidos: readonly string[];
  readonly documentosPendentes: readonly string[];
  readonly contratosEncontrados: readonly string[];
  readonly timeline: readonly DossieTimelineEvento[];
  readonly proximasAcoes: readonly string[];
  readonly riscos: readonly string[];
  readonly observacoesIA: readonly string[];
  // ── Como a AHRI chegou (auditável) ──
  readonly explicacao: DossieExplicacao;
  readonly fonte: string;
}

function factKeys(conds: readonly Condition[]): string[] {
  const out: string[] = [];
  for (const c of conds) {
    if ('all' in c) out.push(...factKeys(c.all));
    else if ('any' in c) out.push(...factKeys(c.any));
    else if ('not' in c) out.push(...factKeys([c.not]));
    else out.push(c.fact);
  }
  return out;
}

function contemDoc(recebidos: readonly string[], esperado: string): boolean {
  const alvo = esperado.toLowerCase();
  return recebidos.some((d) => d.toLowerCase().includes(alvo) || alvo.includes(d.toLowerCase()));
}

const CONF_LABEL: Record<Confianca, string> = { alta: 'alta', media: 'média', baixa: 'baixa' };

/** Monta o Dossiê Jurídico. Determinístico; reutiliza o motor de raciocínio. */
export function montarDossie(input: DossieInputs): DossieJuridico {
  const catalogo = input.catalogo ?? ESTRATEGIAS_CONSIGNADO_INSS;
  const facts = fatosEstrategicos(input.entradas);
  const raciocinio = raciocinar(facts, catalogo);
  const decisao = deliberar(raciocinio);
  const principal = raciocinio.hipotesePrincipal;
  const specByRef = new Map<string, EstrategiaSpec>(catalogo.map((s) => [s.ref, s]));

  // Teses ranqueadas (o ranking já vem ordenado pelo motor).
  const hipoteses: TeseRanqueada[] = raciocinio.hipoteses.map((h, idx) => ({
    posicao: idx + 1,
    ref: h.ref,
    hipotese: h.hipotese,
    confianca: h.confianca,
    prioridade: h.prioridade,
    justificativa: `Sustentada por: ${h.sustentadaPor.join(', ')}${h.reforcadaPor.length > 0 ? `; reforçada por: ${h.reforcadaPor.join(', ')}` : ''}.`,
    fundamento: h.fundamento,
  }));

  // Evidências: os fatos conhecidos (aprendidos) que instruem o caso.
  const evidenciasEncontradas = (input.entradas.conhecimento ?? []).map((f) => `${f.factKey}=${f.valor}`);

  // Evidências ausentes: os fatos que a tese principal REFORÇARIA, mas não constam.
  const evidenciasAusentes: string[] = [];
  const documentosPendentes: string[] = [];
  if (principal) {
    const spec = specByRef.get(principal.ref);
    if (spec) {
      for (const c of spec.reforca ?? []) {
        if (!evaluateCondition(c, facts)) for (const k of factKeys([c])) if (!evidenciasAusentes.includes(k)) evidenciasAusentes.push(k);
      }
      for (const doc of spec.documentosEsperados ?? []) {
        if (!contemDoc(input.documentosReconhecidos, doc)) documentosPendentes.push(doc);
      }
    }
  }

  // Próximas ações: a próxima melhor ação + prioridades condicionais do motor.
  const proximasAcoes: string[] = [];
  if (raciocinio.proximaMelhorAcao) proximasAcoes.push(raciocinio.proximaMelhorAcao.acao);
  for (const p of raciocinio.prioridades) if (!proximasAcoes.includes(p.acao)) proximasAcoes.push(p.acao);

  const riscos = raciocinio.riscos.map((r) => r.risco);

  // Observações da IA — sínteses auditáveis (nunca opinião inventada).
  const observacoesIA: string[] = [];
  if (raciocinio.hipoteses.length > 1) observacoesIA.push(`${String(raciocinio.hipoteses.length)} teses concorrentes foram avaliadas; a de maior confiança prevaleceu.`);
  if (documentosPendentes.length > 0) observacoesIA.push(`Faltam ${String(documentosPendentes.length)} documento(s) para instruir a tese principal.`);
  if (evidenciasAusentes.length > 0) observacoesIA.push(`${String(evidenciasAusentes.length)} fato(s) reforçariam a tese, mas ainda não foram confirmados na conversa.`);
  if (raciocinio.oportunidades.length > 0) observacoesIA.push(...raciocinio.oportunidades.map((o) => o.oportunidade));

  const problema = typeof facts['problema_principal'] === 'string' ? String(facts['problema_principal']) : null;
  const grau = decisao?.confidence ?? principal?.confianca ?? null;

  const resumoExecutivo = principal
    ? `Análise preliminar indica ${principal.hipotese.toLowerCase()}. Confiança ${grau ? CONF_LABEL[grau] : 'a apurar'}, com ${String(raciocinio.hipoteses.length)} tese(s) avaliada(s). ${raciocinio.proximaMelhorAcao ? `Próximo passo: ${raciocinio.proximaMelhorAcao.acao.toLowerCase()}.` : ''}`.trim()
    : 'Ainda não há evidências suficientes para sustentar uma hipótese jurídica. É preciso apurar o problema principal e reunir a documentação básica antes de qualquer tese.';

  const explicacao: DossieExplicacao = {
    fatosUtilizados: principal ? [...principal.sustentadaPor, ...principal.reforcadaPor] : [],
    documentosConsiderados: input.documentosReconhecidos,
    hipotesesAvaliadas: raciocinio.hipoteses.map((h) => ({ ref: h.ref, confianca: h.confianca })),
    hipotesesDescartadas: (decisao?.alternativasRegistradas ?? []).map((a) => ({ ref: a.strategyRef, motivo: a.motivoDaDerrota })),
    estrategiaVencedora: decisao?.strategyRef ?? principal?.ref ?? null,
    confianca: grau,
    criterios: decisao?.auditoria.criterio ?? 'confiança > reforços > prioridade do domínio',
  };

  return {
    clienteId: input.clienteId,
    chatId: input.chatId,
    missionId: input.missionId,
    decisionId: input.decisionId ?? decisao?.decisionId ?? null,
    strategyRef: decisao?.strategyRef ?? principal?.ref ?? null,
    correlationId: input.correlationId,
    versaoCatalogo: input.versaoCatalogo,
    geradoEm: input.geradoEm,
    grauConfianca: grau,
    resumoExecutivo,
    problemaIdentificado: problema,
    hipoteses,
    evidenciasEncontradas,
    evidenciasAusentes,
    documentosReconhecidos: input.documentosReconhecidos,
    documentosPendentes,
    contratosEncontrados: input.contratosEncontrados,
    timeline: input.timeline,
    proximasAcoes,
    riscos,
    observacoesIA,
    explicacao,
    fonte: 'read-models + strategic-reasoning',
  };
}
