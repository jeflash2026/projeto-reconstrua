// ─────────────────────────────────────────────────────────────────────────────
// HISCON PARSER (GO LIVE B · B-R1) — organiza o extrato de consignações do cliente
// em CONTRATOS AGRUPADOS POR BANCO, janela dos últimos 5 anos. Função PURA e 100%
// DETERMINÍSTICA: a IA (Vision) apenas extraiu o texto antes; aqui só regras
// explícitas. O que não casa com os padrões vira LINHA NÃO RECONHECIDA declarada
// (Regra 6 — ausência declarada, nunca inventada) para o perito completar.
//
// Sem persistência (B-R1), sem entidade nova: contrato = linha derivada do texto
// (banco = string como escrita; sem normalização especulativa — risco-ERP bloqueado).
// Cada contrato carrega `linhaOrigem` para rastreabilidade total.
// ─────────────────────────────────────────────────────────────────────────────

export interface HisconContrato {
  /** Banco como escrito no extrato (uppercase, espaços colapsados; sem fuzzy). */
  readonly banco: string;
  /** Número/identificador do contrato (maior sequência de 6–20 dígitos da linha). */
  readonly contrato: string | null;
  /** Primeira data da linha (dd/mm/aaaa) — a data de referência do contrato. */
  readonly dataInicio: Date | null;
  /** Todos os valores monetários da linha, na ordem (sem adivinhar qual é parcela). */
  readonly valores: readonly number[];
  /** Situação quando um token explícito aparece (ATIVO/QUITADO/EXCLUIDO/SUSPENSO). */
  readonly situacao: string | null;
  /** A linha original — rastreabilidade total para o perito conferir. */
  readonly linhaOrigem: string;
}

export interface HisconParse {
  /** Contratos reconhecidos DENTRO da janela (ou sem data — o perito decide). */
  readonly contratos: readonly HisconContrato[];
  /** Reconhecidos porém mais antigos que a janela de 5 anos. */
  readonly foraDaJanela: readonly HisconContrato[];
  /** Linhas candidatas (têm cara de contrato) que NÃO parsearam — declaradas. */
  readonly naoReconhecidas: readonly string[];
  /** Agrupamento por banco dos contratos dentro da janela (derivado). */
  readonly porBanco: Readonly<Record<string, readonly HisconContrato[]>>;
  /** Janela aplicada (para exibição/auditoria). */
  readonly janelaInicio: Date;
  readonly referencia: Date;
}

const DATE_RE = /(\d{2})\/(\d{2})\/(\d{4})/g;
const MONEY_RE = /R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
/** Cabeçalho de banco: linha que nomeia a instituição (sem data/valor de contrato). */
const BANK_HEADER_RE =
  /\b(BANCO|BCO\.?|FINANCEIRA|FINANC\.?|CAIXA ECONOMICA|CAIXA ECONÔMICA|COOPERATIVA)\b/i;
const SITUACAO_RE = /\b(ATIVO|QUITADO|EXCLUIDO|EXCLUÍDO|SUSPENSO|CANCELADO|LIQUIDADO)\b/i;
const CONTRACT_ID_RE = /\d{6,20}/g;

const BANCO_NAO_IDENTIFICADO = 'BANCO NÃO IDENTIFICADO';

function normalizeSpaces(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function parseDateBr(dd: string, mm: string, yyyy: string): Date | null {
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Rejeita datas impossíveis (ex.: 31/02) — o Date "rola" o mês silenciosamente.
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? d
    : null;
}

function parseMoneyBr(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

/** Extrai o nome do banco de um cabeçalho (uppercase; sem normalização especulativa). */
function bankFromHeader(line: string): string {
  return normalizeSpaces(line).toUpperCase();
}

/** A linha nomeia um banco no próprio corpo? (layout inline: "BANCO X ... 01/01/2023 R$…") */
function inlineBank(line: string): string | null {
  const m = BANK_HEADER_RE.exec(line);
  if (m === null || m.index === undefined) return null;
  // Do token de banco até o primeiro dígito de data/valor/contrato: o nome da instituição.
  const rest = line.slice(m.index);
  const cut = rest.search(/\d{2}\/\d{2}\/\d{4}|R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}|\d{6,}/);
  const name = cut === -1 ? rest : rest.slice(0, cut);
  const cleaned = normalizeSpaces(name.replace(/[-–|:]+$/, ''));
  return cleaned.length >= 4 ? cleaned.toUpperCase() : null;
}

/**
 * Linha candidata a contrato: tem valor monetário E (data OU sequência de dígitos
 * com cara de contrato). Data é opcional — contrato sem data nunca é descartado.
 */
function isCandidate(line: string): boolean {
  MONEY_RE.lastIndex = 0;
  if (!MONEY_RE.test(line)) return false;
  DATE_RE.lastIndex = 0;
  if (DATE_RE.test(line)) return true;
  const semValores = line.replace(/\d{1,3}(?:\.\d{3})*,\d{2}/g, ' ');
  CONTRACT_ID_RE.lastIndex = 0;
  return CONTRACT_ID_RE.test(semValores);
}

function parseLine(line: string, bancoContexto: string | null): HisconContrato | null {
  const normalized = normalizeSpaces(line);

  DATE_RE.lastIndex = 0;
  const firstDate = DATE_RE.exec(normalized);
  const dataInicio =
    firstDate !== null
      ? parseDateBr(firstDate[1] ?? '', firstDate[2] ?? '', firstDate[3] ?? '')
      : null;

  const valores: number[] = [];
  MONEY_RE.lastIndex = 0;
  for (let m = MONEY_RE.exec(normalized); m !== null; m = MONEY_RE.exec(normalized)) {
    valores.push(parseMoneyBr(m[1] ?? ''));
  }
  if (valores.length === 0) return null; // sem valor não é contrato reconhecível

  // Contrato: a MAIOR sequência de 6–20 dígitos que não faz parte de data/valor.
  const semDatasEValores = normalized
    .replace(/\d{2}\/\d{2}\/\d{4}/g, ' ')
    .replace(/\d{1,3}(?:\.\d{3})*,\d{2}/g, ' ');
  let contrato: string | null = null;
  CONTRACT_ID_RE.lastIndex = 0;
  for (
    let m = CONTRACT_ID_RE.exec(semDatasEValores);
    m !== null;
    m = CONTRACT_ID_RE.exec(semDatasEValores)
  ) {
    if (contrato === null || (m[0]?.length ?? 0) > contrato.length) contrato = m[0] ?? null;
  }

  const sit = SITUACAO_RE.exec(normalized);
  const situacao =
    sit !== null ? (sit[1] ?? '').toUpperCase().replace('EXCLUÍDO', 'EXCLUIDO') : null;

  const banco = inlineBank(normalized) ?? bancoContexto ?? BANCO_NAO_IDENTIFICADO;

  return { banco, contrato, dataInicio, valores, situacao, linhaOrigem: normalized };
}

/**
 * Organiza o texto do HISCON em contratos por banco, janela de 5 anos.
 * Determinístico: mesma entrada + mesma referência ⇒ mesmo resultado, sempre.
 */
export function parseHiscon(texto: string, referencia: Date): HisconParse {
  const janelaInicio = new Date(
    Date.UTC(referencia.getUTCFullYear() - 5, referencia.getUTCMonth(), referencia.getUTCDate()),
  );

  const dentro: HisconContrato[] = [];
  const fora: HisconContrato[] = [];
  const naoReconhecidas: string[] = [];
  let bancoContexto: string | null = null;

  for (const raw of texto.split(/\r?\n/)) {
    const line = normalizeSpaces(raw);
    if (line === '') continue;

    if (!isCandidate(line)) {
      // Cabeçalho de banco define o contexto das linhas seguintes (layout tabular).
      if (BANK_HEADER_RE.test(line)) bancoContexto = bankFromHeader(line);
      continue; // linha não-candidata (título, rodapé, etc.) — ignorada por regra
    }

    const contrato = parseLine(line, bancoContexto);
    if (contrato === null || contrato.contrato === null) {
      // Candidata sem contrato identificável: DECLARADA (Regra 6) — nunca vira
      // "contrato anônimo" por palpite; o perito confere a linha original.
      naoReconhecidas.push(line);
      continue;
    }
    // Sem data ⇒ não dá para janelar: fica DENTRO (o perito decide) — nunca descartado.
    if (contrato.dataInicio !== null && contrato.dataInicio.getTime() < janelaInicio.getTime()) {
      fora.push(contrato);
    } else {
      dentro.push(contrato);
    }
  }

  const porBanco: Record<string, HisconContrato[]> = {};
  for (const c of dentro) {
    (porBanco[c.banco] ??= []).push(c);
  }

  return {
    contratos: dentro,
    foraDaJanela: fora,
    naoReconhecidas,
    porBanco,
    janelaInicio,
    referencia,
  };
}
