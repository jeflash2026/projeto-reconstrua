// ─────────────────────────────────────────────────────────────────────────────
// AHRI COMMAND CENTER — INDICADORES EXECUTIVOS. Traduz os Read Models em
// indicadores de NEGÓCIO (não técnicos): cada um com rótulo humano, valor
// apresentável, uma EXPLICAÇÃO curta do que significa e a fonte (que fica só no
// tooltip). Puro; a interface apenas renderiza. Ausente vira '—', nunca inventado.
//
// Decreto 2026-08-03 (pedido do dono): a Visão Executiva passa a espelhar o
// FUNIL REAL da operação (fase 1 → parecer → confirmação → humanizado → perito
// → advogado). Saíram os três indicadores de laboratório (tempo até decisão,
// precisão, confiança da IA) — dependiam de um feedback manual que nunca é
// preenchido e viviam vazios — e a "receita prevista", que não tem fonte real.
// ─────────────────────────────────────────────────────────────────────────────

export type TomIndicador = 'neutro' | 'positivo' | 'atencao' | 'critico';

export interface IndicadorExecutivo {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string; // já apresentável ('—' quando ausente)
  /** O que este número significa, em uma linha (a interface mostra isto). */
  readonly explicacao: string;
  readonly tom: TomIndicador;
  readonly fonte: string; // técnica; só no tooltip
  readonly href: string | null;
}

export interface IndicadoresInputs {
  readonly clientesAtivos: number;
  readonly novosClientesHoje: number;
  /** Soma dos contratos de TODOS os clientes com HISCON legível (null = sem fonte). */
  readonly totalContratos: number | null;
  readonly dossiesGerados: number;
  readonly casosDistribuidos: number;
  readonly aguardandoDocumentos: number;
  readonly documentosProcessados: number;
  readonly valorRecuperavel: number | null; // R$
  /** Decreto 2026-08-04: SOMA das ações previstas pelo guia de agrupamento
   *  (ativos 1=1 c/ exceção mesmo banco ±1 dia; excluídos por ano+banco;
   *  RMC/RCC sempre separados). null = fonte indisponível. */
  readonly acoesPrevistas: number | null;
  /** Decreto 2026-08-04: o potencial CONFIRMADO — só clientes com a
   *  documentação COMPLETA (procuração assinada + RG + comprovante) entregue
   *  na mesa do Atendimento Humanizado. null = fonte indisponível. */
  readonly valorConfirmado: number | null;
  readonly clientesConfirmados: number | null;
  // ── Funil (decreto 2026-08-03) ─────────────────────────────────────────────
  /** CPF + HISCON legível entregues. */
  readonly fase1Completa: number;
  /** Fase 1 completa que ainda NÃO recebeu o parecer (alvo do lote). */
  readonly semParecer: number;
  /** Parecer enviado, aguardando o SIM do cliente. */
  readonly aguardandoConfirmacao: number;
  /** Confirmaram o interesse — a mesa do Atendimento Humanizado. */
  readonly confirmados: number;
  /** Ciclo completo (confirmação + procuração + RG + comprovante). */
  readonly prontosParaPerito: number;
}

function money(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/** Monta os indicadores executivos a partir dos Read Models. Determinístico. */
export function indicadoresExecutivos(input: IndicadoresInputs): readonly IndicadorExecutivo[] {
  return [
    {
      id: 'clientes-ativos',
      rotulo: 'Clientes ativos',
      valor: String(input.clientesAtivos),
      explicacao: 'Pessoas com atendimento aberto na plataforma',
      tom: 'neutro',
      fonte: 'read-model:clientes.list',
      href: '/clientes',
    },
    {
      id: 'novos-hoje',
      rotulo: 'Novos clientes hoje',
      valor: String(input.novosClientesHoje),
      explicacao: 'Primeiro contato registrado hoje',
      tom: input.novosClientesHoje > 0 ? 'positivo' : 'neutro',
      fonte: 'read-model:dashboard.newClientsToday',
      href: '/clientes/hoje',
    },
    {
      id: 'fase1-completa',
      rotulo: 'Fase 1 completa',
      valor: String(input.fase1Completa),
      explicacao: 'CPF + HISCON entregues e legíveis',
      tom: 'positivo',
      fonte: 'read-model:pericia.todosComHiscon(temCpf)',
      href: '/clientes',
    },
    {
      id: 'aguardando-docs',
      rotulo: 'Aguardando documentos',
      valor: String(input.aguardandoDocumentos),
      explicacao: 'Ainda falta CPF ou HISCON — em cobrança pela AHRI',
      tom: input.aguardandoDocumentos > 0 ? 'atencao' : 'neutro',
      fonte: 'read-model:dashboard.awaitingDocuments',
      href: '/clientes',
    },
    {
      id: 'sem-parecer',
      rotulo: 'Sem parecer enviado',
      valor: String(input.semParecer),
      explicacao: 'Fase 1 completa que ainda não recebeu o dossiê (envie em lote)',
      tom: input.semParecer > 0 ? 'atencao' : 'positivo',
      fonte: 'read-model:parecer-enviado (ausente)',
      href: '/clientes',
    },
    {
      id: 'aguardando-confirmacao',
      rotulo: 'Aguardando confirmação',
      valor: String(input.aguardandoConfirmacao),
      explicacao: 'Receberam o dossiê e ainda não responderam SIM',
      tom: 'neutro',
      fonte: 'read-model:parecer-enviado (sem confirmação)',
      href: '/clientes',
    },
    {
      id: 'confirmados',
      rotulo: 'Na mesa do humanizado',
      valor: String(input.confirmados),
      explicacao: 'Confirmaram o interesse — a equipe colhe procuração, RG e comprovante',
      tom: input.confirmados > 0 ? 'positivo' : 'neutro',
      fonte: 'read-model:parecer-enviado (confirmado)',
      href: null,
    },
    {
      id: 'prontos-perito',
      rotulo: 'Prontos para o perito',
      valor: String(input.prontosParaPerito),
      explicacao: 'Documentação completa — liberados para o pedido administrativo',
      tom: input.prontosParaPerito > 0 ? 'positivo' : 'neutro',
      fonte: 'read-model:humanizado (docs completos)',
      href: '/pericias',
    },
    {
      id: 'distribuidos',
      rotulo: 'Casos com advogado',
      valor: String(input.casosDistribuidos),
      explicacao: 'Já destinados a um advogado do time',
      tom: 'neutro',
      fonte: 'read-model:clientes.status EM_PROCESSO',
      href: '/missoes',
    },
    {
      id: 'acoes-previstas',
      rotulo: 'Processos disponíveis',
      valor: input.acoesPrevistas === null ? '—' : String(input.acoesPrevistas),
      explicacao:
        'Soma pelo guia v2 — ativos 1=1; não-ativos em lotes de 3 do mesmo banco e ano (teto 15 por banco); RMC/RCC separados',
      tom: 'positivo',
      fonte: 'read-model:pericia.somaAcoes (guia v2 2026-08-04)',
      href: '/pericias',
    },
    {
      id: 'total-contratos',
      rotulo: 'Total de contratos',
      valor: input.totalContratos === null ? '—' : String(input.totalContratos),
      explicacao: 'Contratos de consignado lidos em todos os HISCONs',
      tom: 'neutro',
      fonte: 'read-model:pericia.potencialDeTodos.contratos',
      href: '/pericias',
    },
    {
      id: 'dossies',
      rotulo: 'Dossiês gerados',
      valor: String(input.dossiesGerados),
      explicacao: 'Clientes com análise pericial pronta',
      tom: 'neutro',
      fonte: 'read-model:pericia.potencialDeTodos',
      href: '/inteligencia/dossies',
    },
    {
      id: 'docs-processados',
      rotulo: 'Documentos processados',
      valor: String(input.documentosProcessados),
      explicacao: 'Arquivos recebidos e lidos pela AHRI',
      tom: 'neutro',
      fonte: 'read-model:pericia.contagemDocumentosRegistrados',
      href: '/documentos',
    },
    {
      id: 'valor-recuperavel',
      rotulo: 'Valor potencial recuperável',
      valor: money(input.valorRecuperavel),
      explicacao: 'Soma já descontada dos benefícios nos HISCONs analisados',
      tom: 'positivo',
      fonte: 'read-model:financeiro (potencialDeTodos)',
      href: '/financeiro',
    },
    {
      id: 'valor-confirmado',
      rotulo: 'Potencial confirmado',
      valor: money(input.valorConfirmado),
      explicacao:
        input.clientesConfirmados !== null && input.clientesConfirmados > 0
          ? `Só quem entregou TUDO — procuração assinada, RG e comprovante (${String(input.clientesConfirmados)} cliente(s))`
          : 'Só quem entregou TUDO — procuração assinada, RG e comprovante',
      tom: 'positivo',
      fonte: 'read-model:humanizado (completos × potencial)',
      href: '/pericias',
    },
  ];
}
