// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · DOCUMENTO PERICIAL (Decreto 2026-07-24, itens 3–4)
// Metadados completos de cada arquivo do caso. O ORIGINAL é imutável: conversão/
// OCR geram um DERIVADO (derivadoDe aponta o original), nunca sobrescrevem.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { CategoriaDocumento, OrigemDocumento } from '@reconstrua/application';

export type StatusAnaliseDocumento = 'PENDENTE' | 'EM_ANALISE' | 'ANALISADO';

export interface AcessoDocumento {
  readonly usuario: string;
  readonly em: string;
}
export interface AlteracaoDocumento {
  readonly usuario: string;
  readonly em: string;
  readonly descricao: string;
}

export interface DocumentoPericial {
  readonly id: string;
  readonly casoId: string;
  readonly nomeOriginal: string;
  readonly categoria: CategoriaDocumento;
  readonly origem: OrigemDocumento;
  readonly responsavelEnvio: string;
  readonly uploadEm: string;
  readonly tamanho: number;
  readonly formato: string;
  readonly hashSha256: string;
  readonly paginas: number | null;
  readonly contratoVinculado: string | null;
  readonly versao: number;
  /** Quando é um DERIVADO (OCR/conversão/compactação): id do original preservado. */
  readonly derivadoDe: string | null;
  readonly statusAnalise: StatusAnaliseDocumento;
  readonly acessos: readonly AcessoDocumento[];
  readonly alteracoes: readonly AlteracaoDocumento[];
}

/** SHA-256 e tamanho a partir do conteúdo base64 (a fronteira de upload). */
export function hashETamanho(base64: string): { hash: string; tamanho: number } {
  const bytes = Buffer.from(base64, 'base64');
  return { hash: createHash('sha256').update(bytes).digest('hex'), tamanho: bytes.length };
}

/** Formato (extensão) a partir do nome do arquivo — minúsculo, sem ponto. */
export function formatoDoNome(nome: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(nome.trim());
  return m?.[1]?.toLowerCase() ?? 'desconhecido';
}
