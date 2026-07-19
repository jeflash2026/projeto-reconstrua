// ─────────────────────────────────────────────────────────────────────────────
// AHRI COMMAND CENTER (GO-LIVE 13A) — o BRIEFING EXECUTIVO dinâmico. A AHRI abre
// o dia decidindo SOZINHA o que importa: varre indicadores derivados dos Read
// Models e emite apenas os insights cujo estado real os justifica, ranqueados por
// severidade. Nunca cards fixos; o briefing reflete a empresa NAQUELE momento —
// dois dias iguais só se o estado for idêntico.
//
// Presentation view-model PURO (como operational-metrics): NÃO recalcula nada,
// NÃO toca a arquitetura cognitiva, NÃO inventa. Todo insight carrega sua FONTE
// (rastreabilidade) e um ponto de entrada (href) para a área correspondente.
// A interface apenas RENDERIZA o que este motor produz.
// ─────────────────────────────────────────────────────────────────────────────

export type Severidade = 'critico' | 'alerta' | 'oportunidade' | 'informacao';

/** Um fato/alerta/recomendação que a AHRI escolheu trazer ao founder. */
export interface Insight {
  readonly id: string;
  readonly categoria: string;
  readonly severidade: Severidade;
  readonly titulo: string; // a frase que a AHRI "fala"
  readonly detalhe: string | null;
  readonly fonte: string; // read model de origem (rastreabilidade obrigatória)
  readonly href: string | null; // ponto de entrada para a área
  readonly valor: number | null; // métrica associada (para ranqueamento/relevância)
}

/** Entradas — TODAS derivadas de Read Models já projetados (nunca da UI). */
export interface BriefingInputs {
  readonly founderName: string;
  readonly now: Date;
  readonly clientesAtivos: number;
  readonly novosClientesHoje: number;
  readonly dossiesProntos: number;
  readonly aguardandoDocumentos: number;
  readonly aguardandoAdvogado: number;
  readonly casosCriticos: number; // atenção imediata (ex.: prazos vencendo)
  readonly casosPorAdvogado: Readonly<Record<string, number>>;
  readonly limiteCargaAdvogado: number; // acima disso = sobrecarga
  readonly confiancaMediaCatalogo: number | null; // painel de evolução (11B), 0..1
  readonly confiancaMediaAnterior: number | null; // baseline p/ delta
  readonly taxaAcerto: number | null; // precisão das decisões (11B), 0..1
  readonly estrategiaEmAlta: { readonly ref: string; readonly usos: number } | null; // padrão detectado
  readonly gargalo: string | null;
}

export interface Briefing {
  readonly saudacao: string; // "Bom dia, Jessé."
  readonly resumo: string; // "Hoje encontrei N fatos importantes." / estado vazio elegante
  readonly insights: readonly Insight[]; // ranqueados; dinâmicos
  readonly totalInsights: number;
  readonly geradoEm: Date;
  readonly fonte: string; // 'read-models'
}

const ORDEM: Record<Severidade, number> = { critico: 0, alerta: 1, oportunidade: 2, informacao: 3 };

function saudacaoDe(now: Date, nome: string): string {
  const h = now.getHours();
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return `${parte}, ${nome}.`;
}

function pct(v: number): string {
  return `${String(Math.round(v * 100))}%`;
}

/** Gera o briefing dinâmico. Determinístico: mesmo estado ⇒ mesmo briefing. */
export function gerarBriefing(input: BriefingInputs): Briefing {
  const candidatos: Insight[] = [];

  // ── CRÍTICO — atenção imediata ──────────────────────────────────────────────
  if (input.casosCriticos > 0) {
    candidatos.push({
      id: 'casos-criticos',
      categoria: 'caso-critico',
      severidade: 'critico',
      titulo: input.casosCriticos === 1 ? '1 caso precisa de atenção imediata.' : `${String(input.casosCriticos)} casos precisam de atenção imediata.`,
      detalhe: 'Prazos ou situações que não podem esperar.',
      fonte: 'read-model:operational-metrics',
      href: '/missoes?prioridade=critica',
      valor: input.casosCriticos,
    });
  }

  // ── ALERTA — advogado sobrecarregado ────────────────────────────────────────
  const sobrecarregado = Object.entries(input.casosPorAdvogado)
    .filter(([, n]) => n > input.limiteCargaAdvogado)
    .sort((a, b) => b[1] - a[1])[0];
  if (sobrecarregado) {
    candidatos.push({
      id: `advogado-sobrecarregado:${sobrecarregado[0]}`,
      categoria: 'advogado-sobrecarregado',
      severidade: 'alerta',
      titulo: `Um advogado está sobrecarregado (${String(sobrecarregado[1])} casos).`,
      detalhe: `${sobrecarregado[0]} está acima do limite de ${String(input.limiteCargaAdvogado)}.`,
      fonte: 'read-model:operational-metrics.casosPorAdvogado',
      href: '/advogados',
      valor: sobrecarregado[1],
    });
  }

  // ── ALERTA — precisão das decisões caindo ───────────────────────────────────
  if (input.taxaAcerto !== null && input.taxaAcerto < 0.7) {
    candidatos.push({
      id: 'precisao-baixa',
      categoria: 'precisao-decisoes',
      severidade: 'alerta',
      titulo: `A precisão das decisões está em ${pct(input.taxaAcerto)}.`,
      detalhe: 'Abaixo do esperado — vale revisar o catálogo de estratégias.',
      fonte: 'read-model:catalog-evolution.taxaAcerto',
      href: '/inteligencia/evolucao',
      valor: Math.round(input.taxaAcerto * 100),
    });
  }

  // ── ALERTA — clientes parados aguardando documentos ─────────────────────────
  if (input.aguardandoDocumentos > 0) {
    candidatos.push({
      id: 'aguardando-documentos',
      categoria: 'aguardando-documentos',
      severidade: 'alerta',
      titulo: `${String(input.aguardandoDocumentos)} cliente(s) aguardando documentos.`,
      detalhe: 'A instrução está pausada até chegarem.',
      fonte: 'read-model:dashboard.awaitingDocuments',
      href: '/clientes?estado=aguardando-documentos',
      valor: input.aguardandoDocumentos,
    });
  }

  // ── ALERTA — gargalo operacional declarado ──────────────────────────────────
  if (input.gargalo !== null && input.gargalo.trim() !== '') {
    candidatos.push({
      id: 'gargalo',
      categoria: 'gargalo',
      severidade: 'alerta',
      titulo: `Gargalo operacional: ${input.gargalo}.`,
      detalhe: null,
      fonte: 'read-model:dashboard.bottlenecks',
      href: '/operacao',
      valor: null,
    });
  }

  // ── OPORTUNIDADE — dossiês prontos p/ o advogado ────────────────────────────
  if (input.dossiesProntos > 0) {
    candidatos.push({
      id: 'dossies-prontos',
      categoria: 'dossies-prontos',
      severidade: 'oportunidade',
      titulo: input.dossiesProntos === 1 ? '1 dossiê jurídico ficou pronto.' : `${String(input.dossiesProntos)} dossiês jurídicos ficaram prontos.`,
      detalhe: 'Prontos para liberar ao advogado responsável.',
      fonte: 'read-model:mission/dossies',
      href: '/inteligencia/dossies',
      valor: input.dossiesProntos,
    });
  }

  // ── OPORTUNIDADE — novo padrão jurídico detectado ───────────────────────────
  if (input.estrategiaEmAlta && input.estrategiaEmAlta.usos >= 3) {
    candidatos.push({
      id: `padrao:${input.estrategiaEmAlta.ref}`,
      categoria: 'padrao-detectado',
      severidade: 'oportunidade',
      titulo: `Detectei um padrão recorrente: ${input.estrategiaEmAlta.ref}.`,
      detalhe: `${String(input.estrategiaEmAlta.usos)} casos recentes seguem esta estratégia.`,
      fonte: 'read-model:catalog-evolution.estrategiasMaisUtilizadas',
      href: '/inteligencia/estrategias',
      valor: input.estrategiaEmAlta.usos,
    });
  }

  // ── OPORTUNIDADE — confiança do catálogo subiu ──────────────────────────────
  if (input.confiancaMediaCatalogo !== null && input.confiancaMediaAnterior !== null && input.confiancaMediaCatalogo > input.confiancaMediaAnterior) {
    candidatos.push({
      id: 'confianca-subiu',
      categoria: 'confianca-catalogo',
      severidade: 'oportunidade',
      titulo: `A confiança média do catálogo subiu para ${pct(input.confiancaMediaCatalogo)}.`,
      detalhe: `Antes: ${pct(input.confiancaMediaAnterior)}.`,
      fonte: 'read-model:catalog-evolution.confiancaMedia',
      href: '/inteligencia/evolucao',
      valor: Math.round(input.confiancaMediaCatalogo * 100),
    });
  }

  // ── INFORMAÇÃO — novos clientes hoje ────────────────────────────────────────
  if (input.novosClientesHoje > 0) {
    candidatos.push({
      id: 'novos-clientes',
      categoria: 'novos-clientes',
      severidade: 'informacao',
      titulo: input.novosClientesHoje === 1 ? '1 novo cliente chegou hoje.' : `${String(input.novosClientesHoje)} novos clientes chegaram hoje.`,
      detalhe: null,
      fonte: 'read-model:dashboard.newClientsToday',
      href: '/clientes',
      valor: input.novosClientesHoje,
    });
  }

  // ── INFORMAÇÃO — fila aguardando advogado ───────────────────────────────────
  if (input.aguardandoAdvogado > 0) {
    candidatos.push({
      id: 'aguardando-advogado',
      categoria: 'aguardando-advogado',
      severidade: 'informacao',
      titulo: `${String(input.aguardandoAdvogado)} caso(s) aguardando distribuição a um advogado.`,
      detalhe: null,
      fonte: 'read-model:dashboard.awaitingAdvogado',
      href: '/advogados',
      valor: input.aguardandoAdvogado,
    });
  }

  // Ranqueia: severidade primeiro; dentro dela, maior relevância; empate estável por id.
  const insights = candidatos.sort(
    (a, b) => ORDEM[a.severidade] - ORDEM[b.severidade] || (b.valor ?? 0) - (a.valor ?? 0) || a.id.localeCompare(b.id),
  );

  const saudacao = saudacaoDe(input.now, input.founderName);
  const resumo =
    insights.length === 0
      ? 'Está tudo tranquilo por aqui — nenhuma pendência crítica no momento. Sigo observando a operação.'
      : insights.length === 1
        ? 'Hoje há 1 fato que merece sua atenção.'
        : `Hoje encontrei ${String(insights.length)} fatos que merecem sua atenção.`;

  return {
    saudacao,
    resumo,
    insights,
    totalInsights: insights.length,
    geradoEm: input.now,
    fonte: 'read-models',
  };
}
