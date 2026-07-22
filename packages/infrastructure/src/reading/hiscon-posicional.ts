// ─────────────────────────────────────────────────────────────────────────────
// RECONSTRUÇÃO POSICIONAL DO HISCON (Frente 2, 2026-07-22) — decreto "100% real".
//
// O HISCON "CONTRATOS ATIVOS E SUSPENSOS" do Meu INSS é uma TABELA-MATRIZ impressa
// ROTACIONADA: cada COLUNA é um contrato, cada LINHA é um atributo (BANCO, INÍCIO
// DE DESCONTO, FIM, QTDE, VALOR PARCELA, EMPRESTADO…), e os cabeçalhos ficam
// verticais à esquerda. A Vision LINEARIZA isso e DESALINHA os valores (início vira
// data futura, fim vira número, a parcela recebe o valor emprestado) — corrompendo
// dado JURÍDICO. Aqui reconstruímos a matriz pelas COORDENADAS (x,y) de cada texto:
// as âncoras de coluna vêm SÓ das linhas numéricas limpas (uma célula por coluna),
// e cada valor cai no campo certo. Determinístico, sem IA, custo zero, sem invenção
// (na dúvida um campo fica vazio — a trava de coerência do potencial faz o resto).
//
// A saída é TEXTO no "Formato A" (CONTRATO:/BANCO:/COMPETÊNCIA INÍCIO…) que o
// parseHisconDetalhado JÁ lê — nada a jusante muda.
// ─────────────────────────────────────────────────────────────────────────────

/** Item de texto do pdf.js (o que precisamos: string + matriz de transformação). */
export interface ItemPosicional {
  readonly str: string;
  /** [a,b,c,d,e,f] — e = x, f = y (origem embaixo-esquerda). */
  readonly transform: readonly number[];
}

interface Celula {
  readonly x: number;
  readonly y: number;
  readonly s: string;
}
interface Linha {
  readonly y: number;
  readonly label: string;
  readonly cells: readonly Celula[];
}

const LABEL_MAX_X = 135; // rótulos rotacionados ficam à esquerda desta faixa
const COL_GAP = 18; // fragmentos do MESMO valor ficam < ~18px; colunas vizinhas > ~28px
const LABEL_BAND = 12; // rótulo rotacionado fica a até ~12px em Y da linha de valores

/** Linhas de VALORES (x≥135) por Y; o rótulo é a concatenação dos fragmentos de
 *  rótulo (x<135) próximos em Y. */
function linhasDaPagina(itens: readonly ItemPosicional[]): Linha[] {
  const limpos: Celula[] = itens
    .filter((it) => it.str.trim() !== '')
    .map((it) => ({ x: it.transform[4] ?? 0, y: it.transform[5] ?? 0, s: it.str }));
  const rotulos = limpos.filter((c) => c.x < LABEL_MAX_X);
  const linhas: { y: number; cells: Celula[] }[] = [];
  for (const c of limpos.filter((c) => c.x >= LABEL_MAX_X)) {
    let l = linhas.find((l) => Math.abs(l.y - c.y) < 4);
    if (l === undefined) {
      l = { y: c.y, cells: [] };
      linhas.push(l);
    }
    l.cells.push(c);
  }
  return linhas.map((l) => ({
    y: l.y,
    label: rotulos
      .filter((r) => Math.abs(r.y - l.y) <= LABEL_BAND)
      .sort((a, b) => a.x - b.x)
      .map((c) => c.s)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    cells: [...l.cells].sort((a, b) => a.x - b.x),
  }));
}

/** Âncoras de coluna a partir SÓ das linhas numéricas limpas (uma célula/coluna).
 *  Nunca das linhas de texto (origem/exclusão), cujos fragmentos fariam ponte. */
function ancoras(linhasLimpas: readonly (Linha | undefined)[]): number[] {
  const xs: number[] = [];
  for (const l of linhasLimpas) if (l) for (const c of l.cells) xs.push(c.x);
  xs.sort((a, b) => a - b);
  const grupos: number[][] = [];
  for (const x of xs) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && x - (ultimo[ultimo.length - 1] ?? 0) <= COL_GAP) ultimo.push(x);
    else grupos.push([x]);
  }
  return grupos.filter((g) => g.length >= 2).map((g) => g[Math.floor(g.length / 2)] ?? 0);
}

/** Valor de uma linha na coluna `anc`: concatena os fragmentos cuja âncora mais
 *  próxima é `anc`. `espaco` = junta com espaço (nomes) vs. sem (datas/valores). */
function valorNaColuna(
  linha: Linha | undefined,
  anc: number,
  todas: readonly number[],
  espaco: boolean,
): string {
  if (linha === undefined) return '';
  const meus = linha.cells.filter((c) => {
    const perto = todas.reduce(
      (b, a) => (Math.abs(a - c.x) < Math.abs(b - c.x) ? a : b),
      todas[0] ?? 0,
    );
    return perto === anc;
  });
  return meus
    .map((c) => c.s)
    .join(espaco ? ' ' : '')
    .replace(/\s+/g, ' ')
    .trim();
}

const acha = (linhas: readonly Linha[], re: RegExp): Linha | undefined =>
  linhas.find((l) => re.test(l.label));

function secao(textoPagina: string): string {
  if (/CART[ÃA]O.*RMC|RESERVA DE MARGEM/i.test(textoPagina)) return 'CARTÃO RMC';
  if (/\bRCC\b/i.test(textoPagina)) return 'CARTÃO RCC';
  return 'EMPRÉSTIMOS BANCÁRIOS';
}

/** Reconstrói o HISCON a partir dos itens posicionais POR PÁGINA. Devolve o texto
 *  Formato A (que o parseHisconDetalhado lê) ou null se não houver tabela de
 *  contratos (não é um HISCON matriz — o chamador cai na extração comum). */
export function reconstruirHisconPosicional(
  paginas: readonly (readonly ItemPosicional[])[],
): string | null {
  const blocos: string[] = [];
  let secaoAtual = '';
  for (const itens of paginas) {
    const linhas = linhasDaPagina(itens);
    const lIni = acha(linhas, /IN[ÍI]CIO DE DESCONT/i);
    const lFim = acha(linhas, /FIM DE DESCONT/i);
    if (lIni === undefined && lFim === undefined) continue; // página sem tabela
    const lBanco = acha(linhas, /^BANCO/i);
    const lSit = acha(linhas, /SITUA/i);
    const lOrig = acha(linhas, /ORIGEM.*AVERBA/i);
    const lIncl = acha(linhas, /INCLUS/i);
    const lQtd = acha(linhas, /QTDE|PARCE\s*LAS/i);
    // Âncora no INÍCIO do rótulo: "QTDE PARCELAS" NÃO deve casar como valor-parcela
    // (senão a quantidade cai na casa da parcela). "PARCELA"/"VALOR PARCELA" casam.
    const lParc = acha(linhas, /^(?:VALOR\s+)?PARCELA/i);
    const lEmpr = acha(linhas, /EMPRESTADO/i);
    const lPrim = acha(linhas, /PRIMEIRO DESCONT/i);
    const anc = ancoras([lIni, lFim, lQtd, lParc, lEmpr, lPrim, lIncl]);
    const lNum = linhas
      .filter((l) => l.cells.some((c) => /^\d{5,}$/.test(c.s)))
      .sort((a, b) => a.y - b.y)[0];
    const textoPagina = itens.map((i) => i.str).join(' ');
    const sec = secao(textoPagina);
    if (sec !== secaoAtual) {
      secaoAtual = sec;
      blocos.push(sec);
    }
    let col = 0;
    for (const a of anc) {
      const v = (l: Linha | undefined, espaco = false): string => valorNaColuna(l, a, anc, espaco);
      const ini = v(lIni);
      const parc = v(lParc);
      const num = v(lNum) || `POS-${String(blocos.length)}-${String(col)}`;
      col += 1;
      if (ini === '' && parc === '') continue;
      blocos.push(
        [
          `CONTRATO: ${num.replace(/\s+/g, '')}`,
          `BANCO: ${v(lBanco, true)}`,
          `SITUAÇÃO: ${v(lSit, true)}`,
          `ORIGEM DA AVERBAÇÃO: ${v(lOrig, true)}`,
          `DATA INCLUSÃO: ${v(lIncl)}`,
          `COMPETÊNCIA INÍCIO DE DESCONTO: ${ini}`,
          `COMPETÊNCIA FIM DE DESCONTO: ${v(lFim)}`,
          `QTDE PARCELAS: ${v(lQtd)}`,
          `VALOR PARCELA: ${parc}`,
          `EMPRESTADO: ${v(lEmpr)}`,
          `PRIMEIRO DESCONTO: ${v(lPrim)}`,
        ].join('\n'),
      );
    }
  }
  if (blocos.filter((b) => b.startsWith('CONTRATO:')).length === 0) return null;
  return `Instituto Nacional do Seguro Social\nHISTÓRICO DE\nEMPRÉSTIMO CONSIGNADO\n\n${blocos.join('\n\n')}\n`;
}
