// ─────────────────────────────────────────────────────────────────────────────
// MAPA DE CLIENTES (Decreto 2026-07-24) — distribuição geográfica da carteira:
// quantos clientes por ESTADO (derivado do DDD do WhatsApp — sinal universal e
// preciso) e as principais CIDADES (da localidade capturada na conversa). Só
// leitura, uma passada pelo namespace 'jornada' (chatId = telefone; + cidade).
// ─────────────────────────────────────────────────────────────────────────────
import { UF_NOME, ufDoTelefone } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

const NS_JORNADA = 'jornada';

export interface EstadoContagem {
  readonly uf: string;
  readonly nome: string;
  readonly total: number;
}

export interface CidadeContagem {
  readonly cidade: string;
  readonly total: number;
}

export interface MapaClientes {
  readonly total: number;
  readonly comEstado: number;
  readonly semEstado: number;
  /** Quantos têm cidade capturada na conversa. */
  readonly comCidade: number;
  readonly porEstado: readonly EstadoContagem[];
  readonly cidades: readonly CidadeContagem[];
}

/** Título leve da cidade — agrupa "sao roque" e "São Roque" no mesmo balde. */
function normalizarCidade(c: string): string {
  return c
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
}

export class MapaClientesService {
  constructor(private readonly deps: { json: JsonStore }) {}

  async gerar(): Promise<MapaClientes> {
    const chats = await this.deps.json.keys(NS_JORNADA);
    const porUf = new Map<string, number>();
    const porCidade = new Map<string, number>();
    let semEstado = 0;
    let comCidade = 0;

    for (const chatId of chats) {
      const uf = ufDoTelefone(chatId);
      if (uf !== null) porUf.set(uf, (porUf.get(uf) ?? 0) + 1);
      else semEstado += 1;

      const rec = (await this.deps.json.get(NS_JORNADA, chatId)) as {
        cidade?: string | null;
      } | null;
      const cidade = rec?.cidade?.trim();
      if (cidade !== undefined && cidade !== '') {
        comCidade += 1;
        const chave = normalizarCidade(cidade);
        porCidade.set(chave, (porCidade.get(chave) ?? 0) + 1);
      }
    }

    const porEstado = [...porUf.entries()]
      .map(([uf, total]) => ({ uf, nome: UF_NOME[uf] ?? uf, total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
    const cidades = [...porCidade.entries()]
      .map(([cidade, total]) => ({ cidade, total }))
      .sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade))
      .slice(0, 20);

    return {
      total: chats.length,
      comEstado: chats.length - semEstado,
      semEstado,
      comCidade,
      porEstado,
      cidades,
    };
  }
}
