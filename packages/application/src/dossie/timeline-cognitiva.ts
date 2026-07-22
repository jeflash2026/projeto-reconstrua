// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE COGNITIVA (GO-LIVE 13A · seção 5) — conta a HISTÓRIA do caso, não os
// eventos técnicos. Narra como a AHRI pensou: cliente iniciou → identificou
// benefício → documento recebido → Reader analisou → contratos → Conversation
// Knowledge aprendeu → Strategic Reasoning avaliou → Executive Mind escolheu →
// Missão criada → Advogado recebeu → … → encerrado → feedback.
//
// View-model PURO sobre os Read Models: só emite um passo quando a evidência
// existe (nunca inventa); cada item carrega horário, responsável, origem,
// descrição e fonte; passos cognitivos permitem expandir os FATOS utilizados.
// Append-only por natureza: deriva de eventos imutáveis, nunca reescreve o
// passado. Nada é recalculado na interface.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoriaTimeline =
  | 'cliente'
  | 'beneficio'
  | 'documento'
  | 'reader'
  | 'contrato'
  | 'knowledge'
  | 'reasoning'
  | 'mind'
  | 'missao'
  | 'advogado'
  | 'dossie'
  | 'encerramento'
  | 'feedback';

export interface TimelineCognitivaItem {
  readonly ordem: number;
  readonly quando: Date | null;
  readonly responsavel: string; // quem agiu (Cliente, AHRI, Reader, Advogado…)
  readonly origem: string; // camada/subsistema de origem
  readonly titulo: string;
  readonly descricao: string | null;
  readonly fonte: string; // read model de origem (rastreabilidade)
  readonly categoria: CategoriaTimeline;
  /** Fatos usados neste passo (expansível na UI); null quando não se aplica. */
  readonly fatosUtilizados: readonly string[] | null;
}

export interface TCDocumento {
  readonly label: string;
  readonly em: Date | null;
  readonly reconhecidoComo: string | null;
}

export interface TimelineCognitivaInputs {
  readonly conversaIniciadaEm: Date | null;
  readonly totalMensagens: number;
  readonly beneficio: string | null;
  readonly fatosAprendidos: readonly string[]; // key=valor
  readonly documentos: readonly TCDocumento[];
  readonly contratos: readonly string[];
  readonly raciocinio: {
    readonly totalHipoteses: number;
    readonly principal: string | null;
    readonly fatosDaPrincipal: readonly string[];
  } | null;
  readonly decisao: {
    readonly strategyRef: string;
    readonly confianca: string;
    readonly em: Date | null;
  } | null;
  readonly missao: {
    readonly missionId: string;
    readonly criadaEm: Date | null;
    readonly advogado: string | null;
    readonly recebidaEm: Date | null;
  } | null;
  readonly dossieAtualizadoEm: Date | null;
  readonly encerradoEm: Date | null;
  readonly feedback: { readonly em: Date | null; readonly decisao: string } | null;
}

const HISCON_RX = /hiscon/i;

/** Monta a timeline cognitiva (ordem NARRATIVA do caso). Determinística. */
export function montarTimelineCognitiva(
  input: TimelineCognitivaInputs,
): readonly TimelineCognitivaItem[] {
  const itens: Array<Omit<TimelineCognitivaItem, 'ordem'>> = [];
  const push = (i: Omit<TimelineCognitivaItem, 'ordem'>): void => {
    itens.push(i);
  };

  // 1) Cliente iniciou o atendimento.
  if (input.conversaIniciadaEm !== null || input.totalMensagens > 0) {
    push({
      quando: input.conversaIniciadaEm,
      responsavel: 'Cliente',
      origem: 'Conversa (WhatsApp)',
      titulo: 'Cliente iniciou o atendimento',
      descricao:
        input.totalMensagens > 0 ? `${String(input.totalMensagens)} mensagem(ns) trocadas.` : null,
      fonte: 'read-model:conversation',
      categoria: 'cliente',
      fatosUtilizados: null,
    });
  }

  // 2) AHRI identificou o benefício.
  if (input.beneficio !== null) {
    push({
      quando: null,
      responsavel: 'AHRI',
      origem: 'Conversation Knowledge',
      titulo: 'AHRI identificou o benefício',
      descricao: `Benefício reconhecido: ${input.beneficio}.`,
      fonte: 'read-model:conversation-knowledge',
      categoria: 'beneficio',
      fatosUtilizados: [`beneficio=${input.beneficio}`],
    });
  }

  // 3) Documentos recebidos + Reader + contratos.
  for (const doc of input.documentos) {
    push({
      quando: doc.em,
      responsavel: 'Cliente',
      origem: 'Documentos',
      titulo: HISCON_RX.test(doc.label) ? 'HISCON recebido' : `Documento recebido: ${doc.label}`,
      descricao: doc.reconhecidoComo ? `Reconhecido como ${doc.reconhecidoComo}.` : null,
      fonte: 'read-model:memory.documentsSent',
      categoria: 'documento',
      fatosUtilizados: null,
    });
    if (doc.reconhecidoComo !== null) {
      push({
        quando: doc.em,
        responsavel: 'Reader',
        origem: 'Document Reader',
        titulo: 'Reader analisou o documento',
        descricao: `${doc.label} → ${doc.reconhecidoComo}.`,
        fonte: 'read-model:memory.documentsSent',
        categoria: 'reader',
        fatosUtilizados: null,
      });
    }
  }
  if (input.contratos.length > 0) {
    push({
      quando: null,
      responsavel: 'Reader',
      origem: 'Document Reader',
      titulo: 'Contratos encontrados',
      descricao: input.contratos.join(', '),
      fonte: 'read-model:memory.documentsSent',
      categoria: 'contrato',
      fatosUtilizados: null,
    });
  }

  // 4) Conversation Knowledge aprendeu fatos.
  if (input.fatosAprendidos.length > 0) {
    push({
      quando: null,
      responsavel: 'AHRI',
      origem: 'Conversation Knowledge',
      titulo: 'Conversation Knowledge aprendeu novos fatos',
      descricao: `${String(input.fatosAprendidos.length)} fato(s) aprendido(s) na conversa.`,
      fonte: 'read-model:conversation-knowledge',
      categoria: 'knowledge',
      fatosUtilizados: input.fatosAprendidos,
    });
  }

  // 5) Strategic Reasoning avaliou hipóteses.
  if (input.raciocinio && input.raciocinio.totalHipoteses > 0) {
    push({
      quando: null,
      responsavel: 'Strategic Reasoning',
      origem: 'Strategic Reasoning',
      titulo: 'Strategic Reasoning avaliou as hipóteses',
      descricao: `${String(input.raciocinio.totalHipoteses)} tese(s) avaliada(s)${input.raciocinio.principal ? `; principal: ${input.raciocinio.principal}` : ''}.`,
      fonte: 'read-model:strategic-reasoning',
      categoria: 'reasoning',
      fatosUtilizados:
        input.raciocinio.fatosDaPrincipal.length > 0 ? input.raciocinio.fatosDaPrincipal : null,
    });
  }

  // 6) Executive Mind escolheu a estratégia.
  if (input.decisao) {
    push({
      quando: input.decisao.em,
      responsavel: 'Executive Mind',
      origem: 'Executive Mind',
      titulo: 'Executive Mind escolheu a estratégia',
      descricao: `${input.decisao.strategyRef} (confiança ${input.decisao.confianca}).`,
      fonte: 'read-model:mission.provenance',
      categoria: 'mind',
      fatosUtilizados: input.raciocinio?.fatosDaPrincipal ?? null,
    });
  }

  // 7) Missão criada + advogado recebeu.
  if (input.missao) {
    push({
      quando: input.missao.criadaEm,
      responsavel: 'Planner',
      origem: 'Mission Runtime',
      titulo: 'Missão criada',
      descricao: `Missão ${input.missao.missionId}.`,
      fonte: 'read-model:mission',
      categoria: 'missao',
      fatosUtilizados: null,
    });
    if (input.missao.advogado !== null) {
      push({
        quando: input.missao.recebidaEm,
        responsavel: input.missao.advogado,
        origem: 'Distribuição',
        titulo: 'Advogado recebeu o caso',
        descricao: `Responsável: ${input.missao.advogado}.`,
        fonte: 'read-model:work.perAdvogado',
        categoria: 'advogado',
        fatosUtilizados: null,
      });
    }
  }

  // 8) Dossiê atualizado.
  if (input.dossieAtualizadoEm !== null) {
    push({
      quando: input.dossieAtualizadoEm,
      responsavel: 'AHRI',
      origem: 'Dossiê Jurídico',
      titulo: 'Dossiê atualizado',
      descricao: 'O parecer inicial foi regenerado com os fatos mais recentes.',
      fonte: 'read-model:dossie',
      categoria: 'dossie',
      fatosUtilizados: null,
    });
  }

  // 9) Encerramento + feedback.
  if (input.encerradoEm !== null) {
    push({
      quando: input.encerradoEm,
      responsavel: 'Advogado',
      origem: 'Mission Runtime',
      titulo: 'Caso encerrado',
      descricao: null,
      fonte: 'read-model:operational-state',
      categoria: 'encerramento',
      fatosUtilizados: null,
    });
  }
  if (input.feedback) {
    push({
      quando: input.feedback.em,
      responsavel: 'Sistema',
      origem: 'Feedback Loop',
      titulo: 'Feedback registrado',
      descricao: `Decisão do advogado: ${input.feedback.decisao}.`,
      fonte: 'read-model:catalog-evolution',
      categoria: 'feedback',
      fatosUtilizados: null,
    });
  }

  return itens.map((i, idx) => ({ ...i, ordem: idx + 1 }));
}
