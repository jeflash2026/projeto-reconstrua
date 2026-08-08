// ─────────────────────────────────────────────────────────────────────────────
// DATAJUD (API Pública do CNJ) — decreto 2026-08-08: acompanhamento AUTOMÁTICO
// de processos do Painel Jurídico pelo número CNJ, sem digitação manual.
// SOMENTE LEITURA: consulta metadados públicos (classe, órgão julgador,
// movimentações); não toca em nada, não fala com ninguém.
//
// A API é Elasticsearch por trás: POST /api_publica_{tribunal}/_search com
// match pelo numeroProcesso (só dígitos). O tribunal sai do próprio número
// CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO → J=8 justiça estadual, TR=26 → TJSP).
// A chave pública é publicada pelo próprio CNJ (env DATAJUD_API_KEY p/ trocar).
// ─────────────────────────────────────────────────────────────────────────────

/** Chave PÚBLICA divulgada pelo CNJ na wiki oficial do DataJud. */
export const DATAJUD_CHAVE_PUBLICA = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const BASE = 'https://api-publica.datajud.cnj.jus.br';

/** Justiça Estadual (J=8): TR → alias do tribunal no DataJud. */
const TJ_POR_TR: Readonly<Record<string, string>> = {
  '01': 'tjac',
  '02': 'tjal',
  '03': 'tjap',
  '04': 'tjam',
  '05': 'tjba',
  '06': 'tjce',
  '07': 'tjdft',
  '08': 'tjes',
  '09': 'tjgo',
  '10': 'tjma',
  '11': 'tjmt',
  '12': 'tjms',
  '13': 'tjmg',
  '14': 'tjpa',
  '15': 'tjpb',
  '16': 'tjpr',
  '17': 'tjpe',
  '18': 'tjpi',
  '19': 'tjrj',
  '20': 'tjrn',
  '21': 'tjrs',
  '22': 'tjro',
  '23': 'tjrr',
  '24': 'tjsc',
  '25': 'tjse',
  '26': 'tjsp',
  '27': 'tjto',
};

/** Justiça Federal (J=4): TR → alias (TRF1..TRF6). */
const TRF_POR_TR: Readonly<Record<string, string>> = {
  '01': 'trf1',
  '02': 'trf2',
  '03': 'trf3',
  '04': 'trf4',
  '05': 'trf5',
  '06': 'trf6',
};

export interface MovimentoDatajud {
  readonly nome: string;
  readonly dataHora: string;
}

export interface AndamentoDatajud {
  readonly numero: string;
  readonly tribunal: string;
  readonly classe: string;
  readonly orgaoJulgador: string;
  readonly assunto: string;
  readonly grau: string;
  readonly dataAjuizamento: string;
  readonly ultimoMovimento: MovimentoDatajud | null;
  readonly movimentos: readonly MovimentoDatajud[];
}

/** Alias do tribunal a partir do número CNJ — null quando não mapeado. */
export function aliasDoTribunal(numeroCnj: string): string | null {
  const digitos = numeroCnj.replace(/\D/g, '');
  if (digitos.length !== 20) return null;
  const j = digitos.slice(13, 14);
  const tr = digitos.slice(14, 16);
  if (j === '8') return TJ_POR_TR[tr] ?? null;
  if (j === '4') return TRF_POR_TR[tr] ?? null;
  return null;
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export class DatajudClient {
  constructor(private readonly apiKey: string = DATAJUD_CHAVE_PUBLICA) {}

  /** Consulta UM processo pelo número CNJ. null = não encontrado/tribunal não
   *  mapeado; lança em falha de transporte (o chamador registra o erro). */
  async consultar(numeroCnj: string): Promise<AndamentoDatajud | null> {
    const alias = aliasDoTribunal(numeroCnj);
    if (alias === null) return null;
    const digitos = numeroCnj.replace(/\D/g, '');
    const res = await fetch(`${BASE}/api_publica_${alias}/_search`, {
      method: 'POST',
      headers: {
        authorization: `APIKey ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: { match: { numeroProcesso: digitos } }, size: 5 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`DataJud ${alias} respondeu ${String(res.status)}`);
    const corpo = (await res.json()) as {
      hits?: { hits?: { _source?: Record<string, unknown> }[] };
    };
    const fontes = (corpo.hits?.hits ?? [])
      .map((h) => h._source)
      .filter((s): s is Record<string, unknown> => s !== undefined);
    if (fontes.length === 0) return null;

    // O mesmo processo pode voltar em mais de um grau — fica com o registro
    // cuja ÚLTIMA movimentação é a mais recente (o retrato mais atual).
    const parseado = fontes.map((s) => {
      const movimentosBrutos = Array.isArray(s['movimentos']) ? (s['movimentos'] as unknown[]) : [];
      const movimentos = movimentosBrutos
        .map((m) => {
          const r = m as Record<string, unknown>;
          return { nome: texto(r['nome']), dataHora: texto(r['dataHora']) };
        })
        .filter((m) => m.nome !== '')
        .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
      const classe = (s['classe'] ?? {}) as Record<string, unknown>;
      const orgao = (s['orgaoJulgador'] ?? {}) as Record<string, unknown>;
      const assuntos = Array.isArray(s['assuntos']) ? (s['assuntos'] as unknown[]) : [];
      const primeiroAssunto = (assuntos[0] ?? {}) as Record<string, unknown>;
      return {
        numero: numeroCnj,
        tribunal: texto(s['tribunal']),
        classe: texto(classe['nome']),
        orgaoJulgador: texto(orgao['nome']),
        assunto: texto(primeiroAssunto['nome']),
        grau: texto(s['grau']),
        dataAjuizamento: texto(s['dataAjuizamento']),
        ultimoMovimento: movimentos[0] ?? null,
        movimentos: movimentos.slice(0, 15),
      } satisfies AndamentoDatajud;
    });
    parseado.sort((a, b) =>
      (b.ultimoMovimento?.dataHora ?? '').localeCompare(a.ultimoMovimento?.dataHora ?? ''),
    );
    return parseado[0] ?? null;
  }
}
