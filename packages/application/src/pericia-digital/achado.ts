// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · MOTOR DE ACHADOS (Decreto 2026-07-24, item 7)
// Um achado é um registro RASTREÁVEL: o que foi observado, com qual método, em
// qual documento/página, com qual limitação — e QUEM (perito) validou. A máquina
// só produz achados até INFERENCIA_TECNICA; CONCLUSAO_APROVADA_PERITO é humano.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReferenciaDocumental, TipoFato } from './caso-pericial.js';

export const GRAVIDADES = [
  'INFORMATIVO',
  'ATENCAO',
  'RELEVANTE',
  'CRITICO',
  'INCONCLUSIVO',
] as const;
export type Gravidade = (typeof GRAVIDADES)[number];

export const GRAVIDADE_ROTULO: Readonly<Record<Gravidade, string>> = {
  INFORMATIVO: 'Informativo',
  ATENCAO: 'Atenção',
  RELEVANTE: 'Relevante',
  CRITICO: 'Crítico',
  INCONCLUSIVO: 'Inconclusivo',
};

export type StatusAchado = 'ABERTO' | 'VALIDADO_PELO_PERITO' | 'DESCARTADO';

export interface Achado {
  readonly id: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly categoria: string;
  readonly gravidade: Gravidade;
  /** Distinção obrigatória (item 7): fato ≠ dado ≠ ausência ≠ inconsistência ≠ inferência. */
  readonly tipoFato: TipoFato;
  readonly origem: ReferenciaDocumental | null;
  /** Trecho/elemento efetivamente analisado (transcrito, nunca inventado). */
  readonly elementoAnalisado: string | null;
  readonly metodo: string | null;
  readonly ferramenta: string | null;
  readonly resultado: string | null;
  readonly limitacao: string | null;
  readonly responsavelValidacao: string | null;
  readonly status: StatusAchado;
  readonly criadoEm: string;
}

/** Um achado AUTOMÁTICO nasce sempre ABERTO e nunca como conclusão do perito. */
export function novoAchadoAutomatico(input: {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  gravidade: Gravidade;
  tipoFato: Exclude<TipoFato, 'CONCLUSAO_APROVADA_PERITO'>;
  origem?: ReferenciaDocumental | null;
  elementoAnalisado?: string | null;
  metodo?: string | null;
  ferramenta?: string | null;
  resultado?: string | null;
  limitacao?: string | null;
  criadoEm: string;
}): Achado {
  return {
    id: input.id,
    titulo: input.titulo,
    descricao: input.descricao,
    categoria: input.categoria,
    gravidade: input.gravidade,
    tipoFato: input.tipoFato,
    origem: input.origem ?? null,
    elementoAnalisado: input.elementoAnalisado ?? null,
    metodo: input.metodo ?? null,
    ferramenta: input.ferramenta ?? null,
    resultado: input.resultado ?? null,
    limitacao: input.limitacao ?? null,
    responsavelValidacao: null,
    status: 'ABERTO',
    criadoEm: input.criadoEm,
  };
}

/** Há achado CRÍTICO ainda aberto? (trava a emissão até o perito resolver). */
export function temCriticoAberto(achados: readonly Achado[]): boolean {
  return achados.some((a) => a.gravidade === 'CRITICO' && a.status === 'ABERTO');
}
