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
//
// RITMO (2026-09-11, nota do Corvo): o CNJ aceita 20 consultas/min por IP e
// TODAS saem do IP do Corvo — o relay corta em 18/min e 2/s e responde 429
// (ou 502 quando pausa após falhas) com Retry-After. Aqui: ~3,5 s entre
// consultas; 429/502 com Retry-After curto ⇒ espera e repete o MESMO processo;
// pausa longa ⇒ não insiste (o resto da rodada fica com o que já estava
// guardado e a próxima rodada retoma).
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

export interface DjenRitmo {
  /** Intervalo mínimo entre consultas (recomendação do relay: ~3,5 s). */
  readonly intervaloMs?: number;
  /** 429/502 com Retry-After até este tempo: espera e repete o processo. */
  readonly esperaMaximaMs?: number;
  /** Quantas vezes repete o MESMO processo depois de um Retry-After. */
  readonly repeticoes?: number;
  readonly agora?: () => number;
  readonly dormir?: (ms: number) => Promise<void>;
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

/** Retry-After (segundos ou data HTTP) → milissegundos; null = ausente/ilegível. */
export function esperaDoRetryAfter(valor: string | null, agoraMs: number): number | null {
  const t = (valor ?? '').trim();
  if (t === '') return null;
  if (/^\d+$/.test(t)) return Number(t) * 1000;
  const data = Date.parse(t);
  return Number.isNaN(data) ? null : Math.max(0, data - agoraMs);
}

/** Hora de Brasília (UTC-3 fixo) para a mensagem de pausa. */
function horaBrasilia(ms: number): string {
  const d = new Date(ms - 3 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

type FetchFn = typeof fetch;

export class DjenClient {
  /** Quando a próxima consulta pode sair (ritmo entre consultas). */
  private proximaConsulta = 0;
  /** O relay mandou esperar mais do que vale segurar a rodada. */
  private pausadoAte = 0;
  private readonly intervaloMs: number;
  private readonly esperaMaximaMs: number;
  private readonly repeticoes: number;
  private readonly agora: () => number;
  private readonly dormir: (ms: number) => Promise<void>;

  constructor(
    private readonly config: DjenConfig,
    private readonly fetchFn: FetchFn = fetch,
    ritmo: DjenRitmo = {},
  ) {
    this.intervaloMs = ritmo.intervaloMs ?? 3_500;
    this.esperaMaximaMs = ritmo.esperaMaximaMs ?? 90_000;
    this.repeticoes = ritmo.repeticoes ?? 2;
    this.agora = ritmo.agora ?? ((): number => Date.now());
    this.dormir =
      ritmo.dormir ?? ((ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms)));
  }

  /** Comunicações de UM processo (mais recentes primeiro). Lança em falha de
   *  transporte/HTTP — o chamador grava o erro literal na tela. */
  async consultar(numeroCnj: string): Promise<readonly PublicacaoDjen[]> {
    const digitos = numeroCnj.replace(/\D/g, '');
    if (digitos.length !== 20) return [];
    const params = new URLSearchParams({ numeroProcesso: digitos, itensPorPagina: '50' });
    for (let repeticao = 0; ; repeticao += 1) {
      if (this.agora() < this.pausadoAte)
        throw new Error(
          `DJEN em pausa pelo relay até ${horaBrasilia(this.pausadoAte)} (limite de consultas do CNJ)`,
        );
      const espera = this.proximaConsulta - this.agora();
      if (espera > 0) await this.dormir(espera);
      this.proximaConsulta = this.agora() + this.intervaloMs;
      const res = await this.fetchFn(`${this.config.url}?${params.toString()}`, {
        headers: { accept: 'application/json', ...this.config.headers },
        signal: AbortSignal.timeout(25_000),
      });
      if (res.ok) return publicacoesDoCorpo(await res.json());
      const retry =
        res.status === 429 || res.status === 502
          ? esperaDoRetryAfter(res.headers.get('retry-after'), this.agora())
          : null;
      if (retry !== null && retry <= this.esperaMaximaMs && repeticao < this.repeticoes) {
        await this.dormir(retry);
        continue;
      }
      // Pausa longa do relay: não insiste até ela passar.
      if (retry !== null && retry > this.esperaMaximaMs) this.pausadoAte = this.agora() + retry;
      throw new Error(`DJEN respondeu HTTP ${String(res.status)}`);
    }
  }
}
