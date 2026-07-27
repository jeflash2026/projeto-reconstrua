// ─────────────────────────────────────────────────────────────────────────────
// LEITOR POSICIONAL V2 DO HISCON (decreto 2026-07-27) — engine por TEMPLATE.
//
// Diferença para o V1 (hiscon-posicional.ts): o V1 trabalha nas coordenadas
// CRUAS do pdf.js (origem embaixo-esquerda, SEM desfazer a rotação da página
// paisagem) e INFERE as âncoras de coluna por agrupamento — por isso enxerga a
// tabela como "matriz transposta" e depende de heurística. O V2 normaliza cada
// item com a MATRIZ DO VIEWPORT (scale 1 ⇒ origem topo-esquerda, rotação da
// página desfeita) e usa os CENTROS X FIXOS do template oficial do INSS — o
// layout é idêntico em todos os HISCONs. Cada registro (linha da tabela) é
// segmentado pela ÂNCORA `MM/AAAA` da coluna de início de desconto (o único
// token que nunca fragmenta), cortando no ponto médio entre âncoras.
//
// AUDITORIA EMBUTIDA (nunca falhar em silêncio): a página 1 declara o
// "Quantitativo de Empréstimos por Situação" — comparamos o LIDO com o
// DECLARADO pelo próprio documento. O chamador usa essa auditoria para
// escolher entre V2, V1 e a extração linear (escolherLeituraHiscon).
//
// A saída é o MESMO texto "Formato A" que o parseHisconDetalhado já lê — nada
// a jusante muda. Determinístico, sem IA, sem invenção: campo que não casa o
// formato esperado fica FORA (nunca um dado errado num documento jurídico).
// ─────────────────────────────────────────────────────────────────────────────

/** Item de texto do pdf.js: string + matriz + largura (para o centro x). */
export interface ItemPdf {
  readonly str: string;
  /** [a,b,c,d,e,f] no ESPAÇO DO PDF (origem embaixo-esquerda). */
  readonly transform: readonly number[];
  readonly width?: number;
}

/** Uma página: os itens crus + a matriz do viewport (scale 1) que normaliza a
 *  rotação e leva a origem ao topo-esquerdo. */
export interface PaginaPdf {
  readonly itens: readonly ItemPdf[];
  readonly viewportTransform: readonly number[];
}

interface Palavra {
  readonly x: number;
  readonly y: number;
  readonly cx: number; // centro x — decide a coluna
  readonly s: string;
}

/** Util.transform do pdf.js (m1 × m2), implementado localmente. */
function transformar(m1: readonly number[], m2: readonly number[]): number[] {
  const a = (m: readonly number[], i: number): number => m[i] ?? 0;
  return [
    a(m1, 0) * a(m2, 0) + a(m1, 2) * a(m2, 1),
    a(m1, 1) * a(m2, 0) + a(m1, 3) * a(m2, 1),
    a(m1, 0) * a(m2, 2) + a(m1, 2) * a(m2, 3),
    a(m1, 1) * a(m2, 2) + a(m1, 3) * a(m2, 3),
    a(m1, 0) * a(m2, 4) + a(m1, 2) * a(m2, 5) + a(m1, 4),
    a(m1, 1) * a(m2, 4) + a(m1, 3) * a(m2, 5) + a(m1, 5),
  ];
}

function palavras(pagina: PaginaPdf): Palavra[] {
  return pagina.itens
    .filter((it) => it.str.trim() !== '')
    .map((it) => {
      const m = transformar(pagina.viewportTransform, it.transform);
      const x = m[4] ?? 0;
      const y = m[5] ?? 0;
      return { x, y, cx: x + (it.width ?? 0) / 2, s: it.str };
    });
}

function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── O TEMPLATE (centros x fixos, viewport scale 1, origem topo-esquerda) ──────

type ColunaId =
  | 'contrato'
  | 'tipo'
  | 'banco'
  | 'situacao'
  | 'origem_averbacao'
  | 'data_inclusao'
  | 'inicio_desconto'
  | 'fim_desconto'
  | 'qtde_parcelas'
  | 'parcela'
  | 'emprestado'
  | 'liberado'
  | 'iof'
  | 'cet_mensal'
  | 'cet_anual'
  | 'juros_mensal'
  | 'juros_anual'
  | 'valor_pago'
  | 'primeiro_desconto'
  | 'limite_cartao'
  | 'reservado'
  | 'outros';

interface Coluna {
  readonly id: ColunaId;
  readonly cx: number;
  /** true ⇒ fragmentos juntam com espaço (texto); false ⇒ sem (números/datas). */
  readonly texto: boolean;
}

const COLS_EMPRESTIMO: readonly Coluna[] = [
  { id: 'contrato', cx: 25, texto: false },
  { id: 'banco', cx: 54, texto: true },
  { id: 'situacao', cx: 80, texto: true },
  { id: 'origem_averbacao', cx: 108, texto: true },
  { id: 'data_inclusao', cx: 138, texto: false },
  { id: 'inicio_desconto', cx: 170, texto: false },
  { id: 'fim_desconto', cx: 205, texto: false },
  { id: 'qtde_parcelas', cx: 235, texto: false },
  { id: 'parcela', cx: 265, texto: false },
  { id: 'emprestado', cx: 308, texto: false },
  { id: 'liberado', cx: 355, texto: false },
  { id: 'iof', cx: 388, texto: false },
  { id: 'cet_mensal', cx: 414, texto: false },
  { id: 'cet_anual', cx: 442, texto: false },
  { id: 'juros_mensal', cx: 470, texto: false },
  { id: 'juros_anual', cx: 498, texto: false },
  { id: 'valor_pago', cx: 526, texto: false },
  { id: 'primeiro_desconto', cx: 561, texto: false },
  { id: 'outros', cx: 598, texto: true }, // suspensões/reativações/exclusão —
  { id: 'outros', cx: 633, texto: true }, // colunas lidas mas não mapeadas ao
  { id: 'outros', cx: 668, texto: true }, // Formato A (evitam que fragmentos
  { id: 'outros', cx: 703, texto: true }, // delas vazem para o valor_pago /
  { id: 'outros', cx: 738, texto: true }, // primeiro_desconto vizinhos).
  { id: 'outros', cx: 775, texto: true },
  { id: 'outros', cx: 813, texto: true },
];

// CONTRATOS de cartão RMC/RCC (páginas "CARTÃO DE CRÉDITO — CONTRATOS ATIVOS/
// EXCLUÍDOS"). Calibrado no PDF REAL (NYCOLLAS, 2026-07-27): contrato@25+,
// tipo@~90, banco@~146, situação@~237, averbação@~276, inclusão@~337 (dd/mm/aa
// — a ÂNCORA desta tabela), limite@~383, reservado/atualizado@~447 (o valor
// MENSAL comprometido do cartão ⇒ vira VALOR PARCELA a jusante).
const COLS_CARTAO: readonly Coluna[] = [
  { id: 'contrato', cx: 55, texto: false },
  { id: 'tipo', cx: 120, texto: true },
  { id: 'banco', cx: 190, texto: true },
  { id: 'situacao', cx: 248, texto: true },
  { id: 'origem_averbacao', cx: 300, texto: true },
  { id: 'data_inclusao', cx: 352, texto: false },
  { id: 'limite_cartao', cx: 408, texto: false },
  { id: 'reservado', cx: 462, texto: false },
  { id: 'outros', cx: 520, texto: true }, // suspensões/reativações/exclusão
  { id: 'outros', cx: 575, texto: true },
  { id: 'outros', cx: 625, texto: true },
  { id: 'outros', cx: 675, texto: true },
  { id: 'outros', cx: 725, texto: true },
  { id: 'outros', cx: 775, texto: true },
  { id: 'outros', cx: 815, texto: true },
];

/** Dicionário código→nome (bancos consignatários usuais). Desconhecido ⇒ o
 *  texto bruto da célula — nunca inventamos um nome. */
const BANCOS: Readonly<Record<string, string>> = {
  '001': 'BANCO DO BRASIL',
  '012': 'BANCO INBURSA',
  '025': 'BANCO ALFA',
  '029': 'ITAÚ CONSIGNADO',
  '033': 'BANCO SANTANDER',
  '041': 'BANRISUL',
  '069': 'CREFISA',
  '077': 'BANCO INTER',
  '079': 'PICPAY BANK',
  '104': 'CAIXA ECONÔMICA FEDERAL',
  '121': 'AGIBANK',
  '237': 'BRADESCO',
  '243': 'BANCO MASTER',
  '254': 'PARANÁ BANCO',
  '318': 'BANCO BMG',
  '329': 'QI SCD',
  '341': 'ITAÚ UNIBANCO',
  '380': 'PICPAY',
  '386': 'NUBANK',
  '389': 'BANCO MERCANTIL DO BRASIL',
  '394': 'BRADESCO FINANCIAMENTOS',
  '422': 'BANCO SAFRA',
  '623': 'BANCO PAN',
  '626': 'C6 CONSIGNADO',
  '643': 'BANCO PINE',
  '655': 'BANCO BV/VOTORANTIM',
  '707': 'BANCO DAYCOVAL',
  '739': 'BANCO CETELEM',
  '752': 'BNP PARIBAS BRASIL',
  '908': 'PARATI CFI',
  '925': 'BRB',
  '935': 'FACTA FINANCEIRA',
  '954': 'BANCO DIGIO',
  '955': 'OLÉ CONSIGNADO',
};

// ── Normalizações ("100% real ou fora") ──────────────────────────────────────

const ehMoeda = (s: string): boolean => /^R?\$?\d{1,3}(\.\d{3})*,\d{2}$/.test(s);
const ehTaxa = (s: string): boolean => /^\d{1,3},\d{2}%?$/.test(s);
const ehQtde = (s: string): boolean => /^\d{1,3}$/.test(s);
const ehCompetencia = (s: string): boolean => /^(0[1-9]|1[0-2])\/(19|20)\d{2}$/.test(s);
const ehDataCurta = (s: string): boolean => /^\d{2}\/\d{2}\/(\d{2}|\d{4})$/.test(s);
/** Formato real de nº de contrato do HISCON (spec do template). */
const CONTRATO_RE = /^[A-Za-z0-9][A-Za-z0-9./_-]{3,23}$/;

function situacaoCanonica(bruta: string): string {
  const s = semAcentos(bruta).toUpperCase().trim();
  if (s.startsWith('ATIVO')) return 'ATIVO';
  if (s.startsWith('SUSPENS')) return 'SUSPENSO';
  if (s.startsWith('EXCLU')) return 'EXCLUÍDO';
  if (s.startsWith('ENCERR')) return 'ENCERRADO';
  if (s.startsWith('RESERV')) return 'RESERVADO';
  return ''; // fora do vocabulário ⇒ nunca emitir lixo como situação
}

/** Averbação canônica. Aprendizado do PDF real (2026-07-27): o bloco "Migrado
 *  do contrato X CBC: NNN" é ALTO e vaza fragmentos entre linhas vizinhas — a
 *  linha migrada pode perder o "Migrado" (e viraria pedido administrativo
 *  INDEVIDO) e a vizinha pode ganhá-lo. A âncora confiável é a frase
 *  "do contrato": quem a tem É migrado (prefixa "Migrado" se perdeu); quem tem
 *  o vocabulário de averbação é averbação (um "Migrado" solto que vazou é
 *  descartado). Dígitos partidos ("005458 1486") são reunidos — o mapa de
 *  migrações a jusante lê o número inteiro. */
function averbacaoCanonica(bruta: string): string {
  const digitosJuntos = bruta.replace(/(\d)\s+(?=\d)/g, '$1');
  const chave = semAcentos(digitosJuntos).toLowerCase().replace(/\s+/g, '');
  if (/do\s*contrato/i.test(digitosJuntos)) {
    const resto = digitosJuntos.slice(digitosJuntos.search(/do\s*contrato/i));
    return `Migrado ${resto}`.replace(/\s+/g, ' ').trim();
  }
  if (chave.includes('averbacaonova')) return 'Averbação nova';
  if (chave.includes('refinanciamento')) return 'Averbação por Refinanciamento';
  if (chave.includes('portabilidade')) return 'Averbação por Portabilidade';
  if (/\bmigrado\b/i.test(digitosJuntos)) return digitosJuntos.replace(/\s+/g, ' ').trim();
  return /[a-zà-ú]/i.test(bruta) ? bruta.replace(/\s+/g, ' ').trim() : '';
}

/** "254 - PARANÁ BANCO" (fragmentado ou truncado) → "254 - <nome do dicionário>". */
function bancoCanonico(bruto: string): string {
  const limpo = bruto.replace(/\s+/g, ' ').trim();
  const cod = /(\d{1,4})/.exec(limpo)?.[1] ?? null;
  if (cod === null) return limpo;
  const cod3 = cod.padStart(3, '0');
  const nome = BANCOS[cod3];
  if (nome !== undefined) return `${cod3} - ${nome}`;
  const resto = limpo
    .replace(cod, '')
    .replace(/^[\s-]+/, '')
    .trim();
  return resto !== '' ? `${cod} - ${resto}` : limpo;
}

// ── PORTÃO DO TEMPLATE (aprendizado do relatório real, 2026-07-27) ───────────
// O INSS emite o HISCON em (pelo menos) DOIS layouts: o template EM LINHAS
// (deste V2) e a MATRIZ ROTACIONADA (do V1). Rodar o V2 na matriz FABRICA
// registros: as âncoras MM/AAAA caem em posições aleatórias e cada fatia vira
// um "contrato" (visto na base real: cliente com 2 ativos "ganhou" 93). O V2
// só pode rodar quando o CABEÇALHO do template aparece nas posições esperadas
// — incluindo obrigatoriamente um rótulo do lado DIREITO (na matriz, todos os
// rótulos vivem na faixa esquerda e jamais casam ali).

const CABECALHO_EMPRESTIMO: readonly (readonly [RegExp, number])[] = [
  [/CONTRATO/, 25],
  [/BANCO/, 54],
  [/SITUA/, 80],
  [/INCLUS/, 138],
  [/PARCELA/, 265],
  [/EMPRESTADO/, 308],
];
// Calibrado no PDF real: CONTRATO@26, TIPO@102, BANCO@168, SITUAÇÃO@228,
// LIMITE DE CARTÃO@383, RESERVADO ATUALIZADO@438 (cabeçalho quebra em 2 linhas).
const CABECALHO_CARTAO: readonly (readonly [RegExp, number])[] = [
  [/CONTRATO/, 55],
  [/TIPO/, 120],
  [/BANCO/, 190],
  [/SITUA/, 248],
  [/LIMITE/, 408],
  [/RESERVADO|ATUALIZADO/, 462],
];

function templateCasa(ps: readonly Palavra[], ehCartao: boolean): boolean {
  const alvo = ehCartao ? CABECALHO_CARTAO : CABECALHO_EMPRESTIMO;
  const casa = (re: RegExp, cx: number): boolean =>
    ps.some((p) => re.test(semAcentos(p.s).toUpperCase()) && Math.abs(p.cx - cx) <= 30);
  const acertos = alvo.filter(([re, cx]) => casa(re, cx)).length;
  const direita = ehCartao
    ? casa(/LIMITE/, 408) || casa(/RESERVADO|ATUALIZADO/, 462)
    : casa(/PARCELA/, 265) || casa(/EMPRESTADO/, 308);
  return acertos >= (ehCartao ? 3 : 4) && direita;
}

// ── Segmentação por âncoras MM/AAAA ──────────────────────────────────────────

interface Registro {
  readonly campos: ReadonlyMap<ColunaId, string>;
}

// Vocabulário dos CABEÇALHOS de tabela — uma linha (bucket de y) com 3+ destes
// tokens é cabeçalho, e cabeçalhos aparecem TAMBÉM no meio da página (a
// sub-tabela "EXCLUÍDOS" vem abaixo da de ativos). Removê-los por linha inteira
// preserva os valores: "BANCO" solto numa linha de dados (ex.: "623 - BANCO
// PAN") não derruba a linha, pois o bucket dela não acumula 3 tokens.
const VOCAB_CABECALHO =
  /^(CONTRA(TO)?|TIPO|BANCO|SITUA(CAO)?|ORIGEM|DA|AVERBA(CAO)?|DATA|INCLUS(AO)?|EXCLUS(AO)?|COMPET(ENCIA)?|VALOR|LIMITE|RESERVADO|ATUALIZADO|SUSPENS.*|REATIV.*|INSS|MOTIVO|QTDE|PARCE(LA|LAS)?|LAS|EMPRESTADO|LIBERADO|IOF|CET|TAXA|JUROS|MENSAL|ANUAL|PAGO\*{0,3}|PRIMEIRO|DESCONT(O|OS)?|FIM|DE|INICIO|CARTAO|SALDO|DEVEDOR|UTILIZADO|NO|MES)$/;
const TITULO_DE_SECAO =
  /CONTRATOS (ATIVOS|EXCLUIDOS)|CARTAO DE CREDITO|EMPRESTIMOS BANCARIOS|INSTITUTO NACIONAL/;

/** Remove as LINHAS de cabeçalho/título (inclusive no meio do corpo). */
function semLinhasDeCabecalho(ps: readonly Palavra[]): Palavra[] {
  const buckets: { y: number; ps: Palavra[] }[] = [];
  for (const p of [...ps].sort((a, b) => a.y - b.y)) {
    const b = buckets.find((x) => Math.abs(x.y - p.y) < 4);
    if (b) b.ps.push(p);
    else buckets.push({ y: p.y, ps: [p] });
  }
  const manter: Palavra[] = [];
  for (const b of buckets) {
    const upper = b.ps.map((p) => semAcentos(p.s).toUpperCase().trim());
    const texto = upper.join(' ');
    if (TITULO_DE_SECAO.test(texto)) continue;
    const tokensCabecalho = upper.filter((s) => VOCAB_CABECALHO.test(s)).length;
    if (tokensCabecalho >= 3) continue;
    manter.push(...b.ps);
  }
  return manter;
}

function extrairRegistros(
  psBrutos: readonly Palavra[],
  cols: readonly Coluna[],
  colunaAncora: ColunaId,
  ehAncora: (s: string) => boolean,
): Registro[] {
  // Corpo da tabela: sem as linhas de cabeçalho/título (mesmo no meio da
  // página), abaixo do cabeçalho principal e acima das notas de rodapé (*).
  const rotuloCabecalho = psBrutos.filter((p) =>
    /EMPRESTADO|LIMITE|RESERVADO/i.test(semAcentos(p.s)),
  );
  const ps = semLinhasDeCabecalho(psBrutos);
  const ancorasBrutas = ps
    .filter((p) => ehAncora(p.s.trim()) && colunaDe(p, cols) === colunaAncora)
    .sort((a, b) => a.y - b.y);
  if (ancorasBrutas.length === 0) return [];
  const primeiraAncoraY = ancorasBrutas[0]?.y ?? 0;
  const cabecalhoY = rotuloCabecalho
    .filter((p) => p.y < primeiraAncoraY)
    .reduce((max, p) => Math.max(max, p.y), Number.NEGATIVE_INFINITY);
  const topo = Number.isFinite(cabecalhoY) ? cabecalhoY + 1 : primeiraAncoraY - 12;
  const ultimaAncoraY = ancorasBrutas[ancorasBrutas.length - 1]?.y ?? 0;
  const rodapeY = ps
    .filter((p) => p.s.trim().startsWith('*') && p.y > ultimaAncoraY)
    .reduce((min, p) => Math.min(min, p.y), Number.POSITIVE_INFINITY);

  // Dedup de âncoras a menos de 6pt (fragmento repetido da mesma célula).
  const ancoras: number[] = [];
  for (const a of ancorasBrutas) {
    const ultima = ancoras[ancoras.length - 1];
    if (ultima === undefined || a.y - ultima >= 6) ancoras.push(a.y);
  }

  // Cortes no ponto médio entre âncoras consecutivas.
  const cortes: number[] = [topo];
  for (let i = 1; i < ancoras.length; i += 1)
    cortes.push(((ancoras[i - 1] ?? 0) + (ancoras[i] ?? 0)) / 2);
  cortes.push(Math.min(rodapeY, Number.POSITIVE_INFINITY));

  const corpo = ps.filter((p) => p.y > topo && p.y < rodapeY && !p.s.trim().startsWith('*'));
  const registros: Registro[] = [];
  for (let r = 0; r < ancoras.length; r += 1) {
    const de = cortes[r] ?? topo;
    const ate = cortes[r + 1] ?? Number.POSITIVE_INFINITY;
    const doRegistro = corpo
      .filter((p) => p.y >= de && p.y < ate)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const campos = new Map<ColunaId, string[]>();
    for (const p of doRegistro) {
      const col = colunaDe(p, cols);
      const lista = campos.get(col) ?? [];
      lista.push(p.s);
      campos.set(col, lista);
    }
    const juntos = new Map<ColunaId, string>();
    for (const [id, frags] of campos) {
      const def = cols.find((c) => c.id === id);
      juntos.set(id, frags.join(def?.texto === true ? ' ' : '').trim());
    }
    registros.push({ campos: juntos });
  }
  return registros;
}

function colunaDe(p: Palavra, cols: readonly Coluna[]): ColunaId {
  let melhor: Coluna = cols[0] ?? { id: 'outros', cx: 0, texto: true };
  for (const c of cols) if (Math.abs(c.cx - p.cx) < Math.abs(melhor.cx - p.cx)) melhor = c;
  return melhor.id;
}

// ── Página 1 (retrato): beneficiário, benefício e o QUANTITATIVO declarado ───

interface Pagina1 {
  readonly nome: string | null;
  readonly numeroBeneficio: string | null;
  readonly situacaoBeneficio: string | null;
  readonly declarado: { ativos: number; suspensos: number } | null;
  /** TOTAL de empréstimos declarado (todas as situações) — null quando a tabela
   *  não lista excluídos/encerrados (aí só ativos/suspensos são conferíveis). */
  readonly declaradoTotal: number | null;
}

function linhasOrdenadas(ps: readonly Palavra[]): string[] {
  const buckets: { y: number; ps: Palavra[] }[] = [];
  for (const p of [...ps].sort((a, b) => a.y - b.y)) {
    const b = buckets.find((x) => Math.abs(x.y - p.y) < 4);
    if (b) b.ps.push(p);
    else buckets.push({ y: p.y, ps: [p] });
  }
  return buckets.map((b) =>
    b.ps
      .sort((a, z) => a.x - z.x)
      .map((p) => p.s)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function lerPagina1(ps: readonly Palavra[]): Pagina1 {
  const linhas = linhasOrdenadas(ps);
  const idxTitulo = linhas.findIndex((l) => /EMPR[ÉE]STIMO CONSIGNADO/i.test(l));
  let nome: string | null = null;
  if (idxTitulo >= 0) {
    for (let i = idxTitulo + 1; i < Math.min(idxTitulo + 5, linhas.length); i += 1) {
      const l = linhas[i] ?? '';
      if (/Benef[íi]cio/i.test(l)) break;
      if (/^[A-ZÀ-Ú][A-ZÀ-Ú' ]{4,60}$/.test(l)) {
        nome = l;
        break;
      }
    }
  }
  const linhaNb = linhas.find((l) => /N[ºo°]?\s*Benef[íi]cio/i.test(l)) ?? '';
  const nb = /(\d[\d.]{6,}[\d-]\d?)/.exec(linhaNb)?.[1] ?? null;
  // Só a PALAVRA da situação — a linha da página 1 funde a coluna vizinha de
  // flags ("ATIVO | Possui representante legal") e o resto não é situação.
  const linhaSit = linhas.find((l) => /^Situa[çc][ãa]o\b/i.test(l)) ?? '';
  const situacao = /Situa[çc][ãa]o\s*:?\s*([A-ZÀ-Úa-zà-ú-]+)/.exec(linhaSit)?.[1]?.trim() ?? null;

  // "Quantitativo de Empréstimos por Situação" — o que o INSS DECLARA. Além de
  // ativos/suspensos, capturamos excluídos/encerrados/reservados quando a tabela
  // os lista: o TOTAL declarado é a trava contra registros fabricados (base
  // real, 2026-07-27: cliente com 2 ativos "ganhou" 93 contratos e a auditoria
  // só de ativos deixava passar).
  const idxQ = linhas.findIndex((l) => /Quantitativo/i.test(l));
  let declarado: Pagina1['declarado'] = null;
  let declaradoTotal: number | null = null;
  if (idxQ >= 0) {
    const conta = (re: RegExp): number | null => {
      for (let i = idxQ; i < Math.min(idxQ + 12, linhas.length); i += 1) {
        const m = re.exec(semAcentos(linhas[i] ?? '').toUpperCase());
        if (m) return Number(m[1]);
      }
      return null;
    };
    const ativos = conta(/\bATIVOS?\b\D{0,10}(\d{1,3})/);
    const suspensos = conta(/\bSUSPENSOS?\b\D{0,10}(\d{1,3})/);
    const excluidos = conta(/\bEXCLUIDOS?\b\D{0,10}(\d{1,3})/);
    const encerrados = conta(/\bENCERRADOS?\b\D{0,10}(\d{1,3})/);
    const reservados = conta(/\bRESERVADOS?\b\D{0,10}(\d{1,3})/);
    if (ativos !== null) {
      declarado = { ativos, suspensos: suspensos ?? 0 };
      if (excluidos !== null || encerrados !== null || reservados !== null) {
        declaradoTotal =
          ativos + (suspensos ?? 0) + (excluidos ?? 0) + (encerrados ?? 0) + (reservados ?? 0);
      }
    }
  }
  return { nome, numeroBeneficio: nb, situacaoBeneficio: situacao, declarado, declaradoTotal };
}

// ── Margens (página 2: "VALORES DO BENEFÍCIO") ───────────────────────────────
// A margem extrapolada alimenta o indício EST-CONSIG-MARGEM-001 a jusante — o
// leitor precisa entregá-la. Só a PRIMEIRA ocorrência de cada rótulo (a seção
// "VALORES POR MODALIDADE" repete os nomes com 3 valores; não é a nossa).
const ROTULOS_MARGEM: readonly (readonly [string, RegExp])[] = [
  ['BASE DE CÁLCULO', /BASE DE CALCULO/],
  ['MÁXIMO DE COMPROMETIMENTO PERMITIDO', /MAXIMO DE COMPROMETIMENTO/],
  ['TOTAL COMPROMETIDO', /TOTAL COMPROMETIDO/],
  ['MARGEM EXTRAPOLADA***', /MARGEM EXTRAPOLADA/],
];

function lerMargens(ps: readonly Palavra[]): readonly string[] {
  const linhas = linhasOrdenadas(ps);
  const out: string[] = [];
  for (const [rotulo, re] of ROTULOS_MARGEM) {
    const linha = linhas.find((l) => re.test(semAcentos(l).toUpperCase()));
    const valor = linha !== undefined ? /R\$\s?[\d.]+,\d{2}/.exec(linha)?.[0] : undefined;
    if (valor !== undefined) out.push(`${rotulo}: ${valor.replace(/\s/g, '')}`);
  }
  return out;
}

// ── Montagem do Formato A + resultado com auditoria ──────────────────────────

export interface ResultadoPosicionalV2 {
  readonly texto: string;
  readonly contratosLidos: number;
  readonly ativosLidos: number;
  readonly suspensosLidos: number;
  /** EMPRÉSTIMOS lidos (sem os cartões) — o lado "lido" da conferência do total. */
  readonly emprestimosLidos: number;
  readonly declarado: { ativos: number; suspensos: number } | null;
  /** TOTAL declarado no quantitativo (todas as situações), quando listado. */
  readonly declaradoTotal: number | null;
  readonly auditoria: 'conferida' | 'divergente' | 'indisponivel';
}

export interface OpcoesV2 {
  /** false ⇒ MODO DIAGNÓSTICO (só o relatório comparativo): processa a página
   *  mesmo sem o cabeçalho do template, para MEDIR o que sairia — os medidores
   *  (números válidos × marcadores × coincidência) separam leitura real de
   *  fatiamento. A PRODUÇÃO nunca desliga o portão. */
  readonly portaoDoTemplate?: boolean;
}

/** Reconstrói o HISCON pelo template posicional. null quando nenhuma página tem
 *  a tabela de contratos (não é o HISCON — o chamador segue o fluxo normal). */
export function reconstruirHisconPosicionalV2(
  paginas: readonly PaginaPdf[],
  opcoes: OpcoesV2 = {},
): ResultadoPosicionalV2 | null {
  const blocos: string[] = [];
  let secaoAtual = '';
  let pagina1: Pagina1 | null = null;
  let margens: readonly string[] | null = null;
  let ativos = 0;
  let suspensos = 0;
  let emprestimos = 0;
  let marcador = 0;

  for (const [idx, pagina] of paginas.entries()) {
    const ps = palavras(pagina);
    const textoPagina = semAcentos(ps.map((p) => p.s).join(' ')).toUpperCase();
    // CLASSIFICAÇÃO POR PÁGINA (calibrada no PDF real de 2026-07-27):
    //  • "DESCONTOS DE CARTAO" = HISTÓRICO MENSAL de descontos (uma linha por
    //    competência do MESMO cartão) — NÃO são contratos; contá-los inflava a
    //    leitura (caso NYCOLLAS: ~80 linhas mensais viravam "87 contratos").
    //  • "CARTAO DE CREDITO" + "CONTRATOS…" = os CONTRATOS de cartão RMC/RCC.
    //  • "CONTRATOS ATIVOS/EXCLUIDOS" (sem cartão) = empréstimos bancários.
    const ehHistoricoMensal = /DESCONTOS DE CARTAO/.test(textoPagina);
    const ehCartao = !ehHistoricoMensal && /CARTAO DE CREDITO/.test(textoPagina);
    const ehEmprestimos =
      !ehHistoricoMensal &&
      !ehCartao &&
      /CONTRATOS ATIVOS E SUSPENSOS|CONTRATOS EXCLUIDOS E ENCERRADOS/.test(textoPagina);

    if (ehHistoricoMensal) continue; // histórico ≠ contrato (agregação fica p/ o futuro)
    if (!ehCartao && !ehEmprestimos) {
      // Página 1 (retrato) — beneficiário + quantitativo declarado. As MARGENS
      // (página 2) são lidas pelo texto linear das linhas (lerPagina1/margens).
      if (pagina1 === null && /EMPRESTIMO CONSIGNADO|QUANTITATIVO/.test(textoPagina)) {
        const lida = lerPagina1(ps);
        if (lida.nome !== null || lida.declarado !== null || lida.numeroBeneficio !== null)
          pagina1 = lida;
      }
      if (/VALORES DO BENEFICIO|BASE DE CALCULO/.test(textoPagina) && margens === null)
        margens = lerMargens(ps);
      continue;
    }

    // PORTÃO DO TEMPLATE: sem o cabeçalho nas posições esperadas, esta página
    // NÃO é o layout em linhas (é a matriz do V1, ou outra coisa) — pular é a
    // única leitura honesta; fatiar geraria contratos fabricados. O modo
    // diagnóstico (relatório) desliga o portão para MEDIR o resultado.
    if (opcoes.portaoDoTemplate !== false && !templateCasa(ps, ehCartao)) continue;

    const cols = ehCartao ? COLS_CARTAO : COLS_EMPRESTIMO;
    // Âncora: nos EMPRÉSTIMOS é a competência MM/AAAA do início de desconto; nos
    // CONTRATOS de cartão é a DATA INCLUSÃO dd/mm/aa (não há competência ali).
    const registros = ehCartao
      ? extrairRegistros(ps, cols, 'data_inclusao', ehDataCurta)
      : extrairRegistros(ps, cols, 'inicio_desconto', ehCompetencia);
    for (const reg of registros) {
      const v = (id: ColunaId): string => reg.campos.get(id) ?? '';
      const so = (id: ColunaId, ok: (s: string) => boolean): string => {
        const t = v(id).replace(/\s+/g, '');
        return ok(t) ? t : '';
      };

      const numBruto = v('contrato').replace(/\s+/g, '');
      const num = CONTRATO_RE.test(numBruto)
        ? numBruto
        : `CONFERIR-NO-HISCON-P${String(idx + 1)}R${String((marcador += 1))}`;

      const situacao = situacaoCanonica(v('situacao'));
      // A auditoria confere EMPRÉSTIMOS: o "Quantitativo de Empréstimos por
      // Situação" da página 1 não inclui os cartões RMC/RCC.
      if (!ehCartao) emprestimos += 1;
      if (!ehCartao && situacao === 'ATIVO') ativos += 1;
      if (!ehCartao && situacao === 'SUSPENSO') suspensos += 1;

      const secao = ehCartao
        ? /RCC/i.test(semAcentos(v('tipo')))
          ? 'CARTÃO RCC'
          : 'CARTÃO RMC'
        : 'EMPRÉSTIMOS BANCÁRIOS';
      if (secao !== secaoAtual) {
        secaoAtual = secao;
        blocos.push(secao);
      }

      const campos: ReadonlyArray<readonly [string, string]> = ehCartao
        ? [
            // Tabela de CONTRATOS do cartão (PDF real): banco, situação,
            // averbação, inclusão (dd/mm/aa) e o RESERVADO/ATUALIZADO — o valor
            // MENSAL comprometido, que a jusante é a "parcela" do cartão.
            ['BANCO', bancoCanonico(v('banco'))],
            ['SITUAÇÃO', situacao],
            ['ORIGEM DA AVERBAÇÃO', averbacaoCanonica(v('origem_averbacao'))],
            ['DATA INCLUSÃO', so('data_inclusao', ehDataCurta)],
            ['VALOR PARCELA', so('reservado', ehMoeda)],
          ]
        : [
            ['BANCO', bancoCanonico(v('banco'))],
            ['SITUAÇÃO', situacao],
            ['ORIGEM DA AVERBAÇÃO', averbacaoCanonica(v('origem_averbacao'))],
            ['DATA INCLUSÃO', so('data_inclusao', ehDataCurta)],
            ['COMPETÊNCIA INÍCIO DE DESCONTO', so('inicio_desconto', ehCompetencia)],
            ['COMPETÊNCIA FIM DE DESCONTO', so('fim_desconto', ehCompetencia)],
            ['QTDE PARCELAS', so('qtde_parcelas', ehQtde)],
            ['VALOR PARCELA', so('parcela', ehMoeda)],
            ['VALOR EMPRESTADO', so('emprestado', ehMoeda)],
            ['VALOR LIBERADO', so('liberado', ehMoeda)],
            ['IOF', so('iof', ehMoeda)],
            ['CET MENSAL', so('cet_mensal', ehTaxa).replace('%', '')],
            ['CET ANUAL', so('cet_anual', ehTaxa).replace('%', '')],
            ['TAXA JUROS MENSAL', so('juros_mensal', ehTaxa).replace('%', '')],
            ['TAXA JUROS ANUAL', so('juros_anual', ehTaxa).replace('%', '')],
            ['VALOR PAGO', so('valor_pago', ehMoeda)],
            ['PRIMEIRO DESCONTO', so('primeiro_desconto', ehDataCurta)],
          ];
      const linhas = [`CONTRATO: ${num}`];
      for (const [rotulo, valor] of campos) if (valor !== '') linhas.push(`${rotulo}: ${valor}`);
      blocos.push(linhas.join('\n'));
    }
  }

  const contratosLidos = blocos.filter((b) => b.startsWith('CONTRATO:')).length;
  if (contratosLidos === 0) return null;

  const declarado = pagina1?.declarado ?? null;
  const declaradoTotal = pagina1?.declaradoTotal ?? null;
  // Conferida exige TRÊS acertos: ativos, suspensos E o total declarado (quando
  // o quantitativo o lista) — a trava contra registros fabricados na base real.
  const auditoria: ResultadoPosicionalV2['auditoria'] =
    declarado === null
      ? 'indisponivel'
      : declarado.ativos === ativos &&
          declarado.suspensos === suspensos &&
          (declaradoTotal === null || declaradoTotal === emprestimos)
        ? 'conferida'
        : 'divergente';

  const cab: string[] = ['Instituto Nacional do Seguro Social', 'HISTÓRICO DE'];
  cab.push('EMPRÉSTIMO CONSIGNADO');
  if (pagina1?.nome != null) cab.push(pagina1.nome);
  if (pagina1?.numeroBeneficio != null) cab.push(`Nº Benefício: ${pagina1.numeroBeneficio}`);
  if (pagina1?.situacaoBeneficio != null) cab.push(`Situação: ${pagina1.situacaoBeneficio}`);
  if (margens !== null) cab.push(...margens);
  const totalTxt =
    declaradoTotal !== null
      ? `; total declarado ${String(declaradoTotal)} × lidos ${String(emprestimos)}`
      : '';
  cab.push(
    auditoria === 'conferida'
      ? `AUDITORIA DA LEITURA: conferida contra o quantitativo do próprio documento (${String(ativos)} ativo(s), ${String(suspensos)} suspenso(s)${totalTxt}).`
      : auditoria === 'divergente'
        ? `AUDITORIA DA LEITURA: DIVERGÊNCIA — o documento declara ${String(declarado?.ativos ?? 0)} ativo(s) e ${String(declarado?.suspensos ?? 0)} suspenso(s); a leitura encontrou ${String(ativos)} e ${String(suspensos)}${totalTxt}. Conferir no PDF.`
        : 'AUDITORIA DA LEITURA: quantitativo do documento não localizado — leitura sem conferência automática.',
  );

  return {
    texto: `${cab.join('\n')}\n\n${blocos.join('\n\n')}\n`,
    contratosLidos,
    ativosLidos: ativos,
    suspensosLidos: suspensos,
    emprestimosLidos: emprestimos,
    declarado,
    declaradoTotal,
    auditoria,
  };
}

// ── Escolha entre V2, V1 e linear (o guardião da troca) ──────────────────────

/** Ativos+suspensos LIDOS num texto Formato A (para comparar o V1 ao declarado). */
function ativosESuspensosDoTexto(texto: string): number {
  return (texto.match(/^SITUA[ÇC][ÃA]O:\s*(ATIVO|SUSPENS)/gim) ?? []).length;
}

/** Decide QUAL leitura vale: V2 auditado vence; sem auditoria, vence quem mais
 *  se aproxima do declarado (ou quem lê mais contratos). null ⇒ nenhum leu. */
export function escolherLeituraHiscon(
  v2: ResultadoPosicionalV2 | null,
  v1Texto: string | null,
): string | null {
  if (v2 === null) return v1Texto;
  if (v2.auditoria === 'conferida') return v2.texto;
  if (v1Texto === null) return v2.texto;
  const v1Contratos = (v1Texto.match(/^CONTRATO:/gm) ?? []).length;
  if (v2.declarado !== null) {
    const alvo = v2.declarado.ativos + v2.declarado.suspensos;
    const distV2 = Math.abs(v2.ativosLidos + v2.suspensosLidos - alvo);
    const distV1 = Math.abs(ativosESuspensosDoTexto(v1Texto) - alvo);
    return distV2 <= distV1 ? v2.texto : v1Texto;
  }
  return v2.contratosLidos >= v1Contratos ? v2.texto : v1Texto;
}
