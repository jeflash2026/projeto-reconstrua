// ─────────────────────────────────────────────────────────────────────────────
// DJEN — Diário da Justiça Eletrônico Nacional (API pública de comunicações do
// CNJ), 2026-09-10. O TJSP migrou para o eproc e o DataJud deixou de receber
// os processos novos ("não encontrado" em processo que já movimentava no
// eproc há dias). O DJEN publica as COMUNICAÇÕES de todos os tribunais — lista
// de distribuição e intimações com o texto do despacho/decisão: é o que gera
// prazo para o advogado.
//
// A API só responde a IP do BRASIL (403 fora) e a nossa VPS está nos EUA: a
// consulta passa por um RELAY no servidor do Corvo (BR), autenticado com a
// MESMA X-Api-Key da integração. O relay só repassa GET /comunicacao com
// parâmetros permitidos e devolve o JSON do CNJ tal como veio.
// Somente LEITURA de dados públicos.
// ─────────────────────────────────────────────────────────────────────────────

export interface PublicacaoDjen {
  readonly id: string;
  /** AAAA-MM-DD — data de disponibilização no diário. */
  readonly data: string;
  readonly tribunal: string;
  /** "Intimação", "Lista de distribuição", "Edital"… */
  readonly tipo: string;
  readonly orgao: string;
  readonly classe: string;
  /** Texto LIMPO (HTML removido, entidades decodificadas). */
  readonly texto: string;
  /** Link da comunicação no sistema do tribunal (eproc), quando houver. */
  readonly link: string | null;
}

export interface DjenConfig {
  /** URL do endpoint de comunicações (relay do Corvo ou a API do CNJ direto). */
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

const ENTIDADES: Readonly<Record<string, string>> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ordm: 'º',
  ordf: 'ª',
  sect: '§',
  deg: '°',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  middot: '·',
};

const MARCAS: Readonly<Record<string, string>> = {
  acute: '\u0301',
  grave: '\u0300',
  circ: '\u0302',
  tilde: '\u0303',
  uml: '\u0308',
  cedil: '\u0327',
};

function codePoint(n: number, original: string): string {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : original;
}

/** HTML da comunicação → texto legível (parágrafos viram quebra de linha). */
export function textoDoHtml(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/tr|\/section|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&([a-zA-Z])(acute|grave|circ|tilde|uml|cedil);/g,
      (_m, letra: string, marca: string) => `${letra}${MARCAS[marca] ?? ''}`.normalize('NFC'),
    )
    .replace(/&#x([0-9a-f]+);/gi, (m, h: string) => codePoint(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d: string) => codePoint(Number(d), m))
    .replace(/&([a-z]+);/gi, (m, nome: string) => ENTIDADES[nome.toLowerCase()] ?? m)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function texto(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

/** Itens do corpo do CNJ (o relay devolve o JSON tal como veio). Comunicação
 *  cancelada no diário (ativo=false) fica fora. Mais recentes primeiro. */
export function publicacoesDoCorpo(corpo: unknown): PublicacaoDjen[] {
  const itens = (corpo as { items?: unknown } | null)?.items;
  if (!Array.isArray(itens)) return [];
  const out: PublicacaoDjen[] = [];
  for (const bruto of itens) {
    const i = (bruto ?? {}) as Record<string, unknown>;
    if (i['ativo'] === false) continue;
    const data = texto(i['data_disponibilizacao']).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
    out.push({
      id: texto(i['id']) || texto(i['hash']),
      data,
      tribunal: texto(i['siglaTribunal']),
      tipo: texto(i['tipoComunicacao']) || 'Comunicação',
      orgao: texto(i['nomeOrgao']).replace(/\s+/g, ' ').trim(),
      // O CNJ manda a classe com caixa misturada ("EXIBIçãO…").
      classe: texto(i['nomeClasse']).toUpperCase(),
      texto: textoDoHtml(texto(i['texto'])).slice(0, 8000),
      link: texto(i['link']) || null,
    });
  }
  return out.sort((a, b) => b.data.localeCompare(a.data));
}

type FetchFn = typeof fetch;

export class DjenClient {
  constructor(
    private readonly config: DjenConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  /** Comunicações de UM processo (mais recentes primeiro). Lança em falha de
   *  transporte/HTTP — o chamador grava o erro literal na tela. */
  async consultar(numeroCnj: string): Promise<readonly PublicacaoDjen[]> {
    const digitos = numeroCnj.replace(/\D/g, '');
    if (digitos.length !== 20) return [];
    const params = new URLSearchParams({ numeroProcesso: digitos, itensPorPagina: '50' });
    const res = await this.fetchFn(`${this.config.url}?${params.toString()}`, {
      headers: { accept: 'application/json', ...this.config.headers },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`DJEN respondeu HTTP ${String(res.status)}`);
    return publicacoesDoCorpo(await res.json());
  }
}
