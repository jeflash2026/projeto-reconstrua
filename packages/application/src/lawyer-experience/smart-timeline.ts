// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE INTELIGENTE — nunca 300 eventos. Dobra DETERMINÍSTICA (sem IA):
//  1) a tríade R6 (verdade+estado+etapa contíguas) vira UM grupo "situação
//     re-sintetizada";
//  2) o resto agrupa por CAPÍTULO (workflow: documento, perícia, distribuição,
//     conclusão, pessoas, missão, operação);
//  3) grupos carregam contagem + faixa de tempo + os eventos crus DENTRO
//     (expansível: nada se perde, tudo auditável).
// ─────────────────────────────────────────────────────────────────────────────
import type { TimelineEntry } from '../admin-portal/timeline-projector.js';

export type ChapterKind =
  | 'situacao' // tríade R6 dobrada
  | 'pessoas' // person/cliente
  | 'missao'
  | 'documentos'
  | 'pericia'
  | 'conhecimento' // case/process
  | 'operacao'
  | 'projecao'
  | 'outros';

export interface TimelineChapter {
  readonly kind: ChapterKind;
  readonly title: string;
  readonly count: number;
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly relevant: boolean;
  /** Os eventos crus — a auditabilidade dobrada, nunca perdida. */
  readonly events: readonly TimelineEntry[];
}

const CHAPTER_OF: Readonly<Record<string, ChapterKind>> = {
  person: 'pessoas',
  cliente: 'pessoas',
  mission: 'missao',
  document: 'documentos',
  event: 'documentos',
  pericia: 'pericia',
  case: 'conhecimento',
  process: 'conhecimento',
  operation: 'operacao',
  projection: 'projecao',
};

const TRIAD = new Set(['operational-truth', 'operational-state', 'operational-stage']);

const TITLES: Readonly<Record<ChapterKind, string>> = {
  situacao: 'Situação re-sintetizada',
  pessoas: 'Pessoas e cliente',
  missao: 'Missão',
  documentos: 'Documentos e fatos',
  pericia: 'Perícia',
  conhecimento: 'Conhecimento (caso/processo)',
  operacao: 'Operações',
  projecao: 'Projeções',
  outros: 'Outros',
};

function chapterOf(entry: TimelineEntry): ChapterKind {
  if (TRIAD.has(entry.streamType)) return 'situacao';
  return CHAPTER_OF[entry.streamType] ?? 'outros';
}

/**
 * Dobra uma sequência ORDENADA de eventos em capítulos. Eventos consecutivos do
 * mesmo capítulo colapsam num grupo; a tríade R6 contígua vira um único grupo
 * 'situacao'. Determinística e total.
 */
export function foldTimeline(entries: readonly TimelineEntry[]): readonly TimelineChapter[] {
  const chapters: TimelineChapter[] = [];
  for (const entry of entries) {
    const kind = chapterOf(entry);
    const last = chapters[chapters.length - 1];
    if (last && last.kind === kind) {
      chapters[chapters.length - 1] = {
        ...last,
        count: last.count + 1,
        lastAt: entry.recordedAt,
        relevant: last.relevant || entry.isRelevant,
        events: [...last.events, entry],
      };
    } else {
      chapters.push({
        kind,
        title: TITLES[kind],
        count: 1,
        firstAt: entry.recordedAt,
        lastAt: entry.recordedAt,
        relevant: entry.isRelevant,
        events: [entry],
      });
    }
  }
  return chapters;
}

/** Quantos eventos foram OCULTADOS da primeira dobra (métrica de produtividade). */
export function hiddenCount(entries: readonly TimelineEntry[], chapters: readonly TimelineChapter[]): number {
  return Math.max(0, entries.length - chapters.length);
}
