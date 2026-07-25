// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · CASO PERICIAL (Decreto 2026-07-24)
// O estado de um caso, seus 11 status oficiais e a máquina de transições. Nada
// aqui conclui nada — só governa o CICLO DE VIDA com revisão humana obrigatória.
// ─────────────────────────────────────────────────────────────────────────────

/** Os 11 status oficiais do fluxo pericial (item 10 do decreto). */
export const STATUS_PERICIA = [
  'HISCON_RECEBIDO',
  'CONTRATOS_IDENTIFICADOS',
  'DOCUMENTACAO_PENDENTE',
  'EVIDENCIAS_EM_ANALISE',
  'MINUTA_GERADA',
  'EM_REVISAO_PELO_PERITO',
  'AJUSTES_SOLICITADOS',
  'APROVADO_PELO_PERITO',
  'ASSINADO',
  'LIBERADO_PARA_O_ADVOGADO',
  'CANCELADO',
] as const;
export type StatusPericia = (typeof STATUS_PERICIA)[number];

export const STATUS_ROTULO: Readonly<Record<StatusPericia, string>> = {
  HISCON_RECEBIDO: 'HISCON recebido',
  CONTRATOS_IDENTIFICADOS: 'Contratos identificados',
  DOCUMENTACAO_PENDENTE: 'Documentação pendente',
  EVIDENCIAS_EM_ANALISE: 'Evidências em análise',
  MINUTA_GERADA: 'Minuta gerada',
  EM_REVISAO_PELO_PERITO: 'Em revisão pelo perito',
  AJUSTES_SOLICITADOS: 'Ajustes solicitados',
  APROVADO_PELO_PERITO: 'Aprovado pelo perito',
  ASSINADO: 'Assinado',
  LIBERADO_PARA_O_ADVOGADO: 'Liberado para o advogado',
  CANCELADO: 'Cancelado',
};

/** Transições PERMITIDAS. A automação NUNCA salta a revisão humana: só o perito
 *  leva de EM_REVISAO para APROVADO; a assinatura é ato humano separado. */
const TRANSICOES: Readonly<Record<StatusPericia, readonly StatusPericia[]>> = {
  HISCON_RECEBIDO: ['CONTRATOS_IDENTIFICADOS', 'CANCELADO'],
  CONTRATOS_IDENTIFICADOS: ['DOCUMENTACAO_PENDENTE', 'EVIDENCIAS_EM_ANALISE', 'CANCELADO'],
  DOCUMENTACAO_PENDENTE: ['EVIDENCIAS_EM_ANALISE', 'CANCELADO'],
  EVIDENCIAS_EM_ANALISE: ['MINUTA_GERADA', 'DOCUMENTACAO_PENDENTE', 'CANCELADO'],
  MINUTA_GERADA: ['EM_REVISAO_PELO_PERITO', 'CANCELADO'],
  EM_REVISAO_PELO_PERITO: ['AJUSTES_SOLICITADOS', 'APROVADO_PELO_PERITO', 'CANCELADO'],
  AJUSTES_SOLICITADOS: ['MINUTA_GERADA', 'EM_REVISAO_PELO_PERITO', 'CANCELADO'],
  APROVADO_PELO_PERITO: ['ASSINADO', 'AJUSTES_SOLICITADOS', 'CANCELADO'],
  ASSINADO: ['LIBERADO_PARA_O_ADVOGADO', 'CANCELADO'],
  LIBERADO_PARA_O_ADVOGADO: [],
  CANCELADO: [],
};

export function podeTransitar(de: StatusPericia, para: StatusPericia): boolean {
  return TRANSICOES[de].includes(para);
}

export function proximosStatus(de: StatusPericia): readonly StatusPericia[] {
  return TRANSICOES[de];
}

/** Antes da aprovação, a minuta é RASCUNHO e carrega a marca d'água obrigatória. */
export const STATUS_APROVADOS: readonly StatusPericia[] = [
  'APROVADO_PELO_PERITO',
  'ASSINADO',
  'LIBERADO_PARA_O_ADVOGADO',
];
export function exigeMarcaDagua(status: StatusPericia): boolean {
  return !STATUS_APROVADOS.includes(status);
}

// ── Os 6 TIPOS DE FATO (item 7) — o sistema NUNCA os confunde ─────────────────
export type TipoFato =
  | 'FATO_OBSERVADO'
  | 'DADO_EXTRAIDO'
  | 'AUSENCIA_DOCUMENTAL'
  | 'INCONSISTENCIA'
  | 'INFERENCIA_TECNICA'
  | 'CONCLUSAO_APROVADA_PERITO';

export const TIPO_FATO_ROTULO: Readonly<Record<TipoFato, string>> = {
  FATO_OBSERVADO: 'Fato observado',
  DADO_EXTRAIDO: 'Dado extraído',
  AUSENCIA_DOCUMENTAL: 'Ausência documental',
  INCONSISTENCIA: 'Inconsistência',
  INFERENCIA_TECNICA: 'Inferência técnica',
  CONCLUSAO_APROVADA_PERITO: 'Conclusão aprovada pelo perito',
};

/** Referência de PROVA: todo dado específico aponta para arquivo + página. */
export interface ReferenciaDocumental {
  readonly documentoId: string;
  readonly nomeArquivo: string;
  readonly pagina: number | null;
}
