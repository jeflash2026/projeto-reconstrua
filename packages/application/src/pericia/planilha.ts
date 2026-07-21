// ─────────────────────────────────────────────────────────────────────────────
// PLANILHA (B-R2) — exportação dos contratos do perito ATRÁS DE INTERFACE:
// CSV primeiro (zero dependência nova), XLSX depois trocando o adapter — sem
// retrabalho. O CSV é amigável ao Excel pt-BR: BOM UTF-8 + separador ';'.
//
// Lei 9 na planilha: TODA a saída do parser aparece — contratos na janela,
// fora da janela e linhas NÃO RECONHECIDAS (declaradas) — nada é omitido.
// ─────────────────────────────────────────────────────────────────────────────
import type { HisconParse, HisconContrato } from './hiscon.js';

export interface Planilha {
  readonly nome: string;
  readonly colunas: readonly string[];
  readonly linhas: ReadonlyArray<ReadonlyArray<string | number | null>>;
}

/** Interface de exportação — trocar CSV→XLSX é trocar o adapter, nunca o chamador. */
export interface PlanilhaExporter {
  readonly extensao: string;
  readonly mime: string;
  gerar(planilha: Planilha): string;
}

const SEP = ';';

function csvField(value: string | number | null): string {
  if (value === null) return '';
  const raw = typeof value === 'number' ? formatNumberBr(value) : value;
  return /[";\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function formatNumberBr(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function formatDateBr(d: Date | null): string {
  if (d === null) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${String(d.getUTCFullYear())}`;
}

/** CSV Excel-BR: BOM UTF-8 (acentos corretos) + ';' (padrão pt-BR). */
export class CsvPlanilhaExporter implements PlanilhaExporter {
  readonly extensao = 'csv';
  readonly mime = 'text/csv; charset=utf-8';

  gerar(planilha: Planilha): string {
    const BOM = '﻿'; // explícito: Excel pt-BR abre UTF-8 corretamente
    const head = planilha.colunas.map((c) => csvField(c)).join(SEP);
    const rows = planilha.linhas.map((l) => l.map((v) => csvField(v)).join(SEP));
    return `${BOM}${[head, ...rows].join('\r\n')}\r\n`;
  }
}

export const COLUNAS_CONTRATOS: readonly string[] = [
  'Banco',
  'Contrato',
  'Data início',
  'Situação',
  'Valores (R$)',
  'Classificação',
  'Linha original',
];

function linhaDeContrato(
  c: HisconContrato,
  classificacao: string,
): ReadonlyArray<string | number | null> {
  return [
    c.banco,
    c.contrato,
    formatDateBr(c.dataInicio),
    c.situacao,
    c.valores.map(formatNumberBr).join(' | '),
    classificacao,
    c.linhaOrigem,
  ];
}

// ── Planilha DETALHADA (Decreto Dossiê Pericial) — do parser de blocos real ──
import { agruparPorBanco, contratosDaJanela, type HisconExtraido } from './hiscon-parser.js';

export const COLUNAS_CONTRATOS_DETALHADA: readonly string[] = [
  'Banco',
  'Código banco',
  'Contrato',
  'Modalidade',
  'Situação',
  'Origem da averbação',
  'Migrado',
  'Migrado do contrato',
  'Banco de origem (CBC)',
  'Data inclusão',
  'Competência início',
  'Competência fim',
  'Qtde parcelas',
  'Valor parcela (R$)',
  'Valor emprestado (R$)',
  'Valor liberado (R$)',
  'IOF (R$)',
  'CET mensal (%)',
  'CET anual (%)',
  'Juros mensal (%)',
  'Juros anual (%)',
  'Valor pago (R$)',
  'Janela',
];

/** Planilha do PERITO no formato do documento original: organizada POR BANCO
 *  (alfabético) e por contrato, com TODOS os campos e a marcação da janela de
 *  5 anos. Contratos fora da janela também entram, declarados (Lei 9). */
export function planilhaDeContratosDetalhada(
  nome: string,
  extraido: HisconExtraido,
  referencia: Date,
  anos = 5,
): Planilha {
  const naJanela = new Set(
    contratosDaJanela(extraido.contratos, referencia, anos).map((c) => c.contrato),
  );
  const linhas: ReadonlyArray<string | number | null>[] = [];
  for (const banco of agruparPorBanco(extraido.contratos)) {
    for (const c of banco.contratos) {
      linhas.push([
        banco.bancoNome,
        c.bancoCodigo,
        c.contrato,
        c.modalidade,
        c.situacao,
        c.origemAverbacao,
        c.migrado ? 'SIM' : 'NÃO',
        c.migradoDoContrato,
        c.migradoDoCbc,
        formatDateBr(c.dataInclusao),
        c.competenciaInicio,
        c.competenciaFim,
        c.qtdeParcelas,
        c.valorParcela,
        c.valorEmprestado,
        c.valorLiberado,
        c.iof,
        c.cetMensal,
        c.cetAnual,
        c.taxaJurosMensal,
        c.taxaJurosAnual,
        c.valorPago,
        naJanela.has(c.contrato) ? 'DENTRO_5_ANOS' : 'FORA_5_ANOS',
      ]);
    }
  }
  return { nome, colunas: COLUNAS_CONTRATOS_DETALHADA, linhas };
}

/** Monta a planilha de um cliente a partir do parse — inclui TUDO (Lei 9). */
export function planilhaDeContratos(nome: string, parse: HisconParse): Planilha {
  const linhas: ReadonlyArray<string | number | null>[] = [
    ...parse.contratos.map((c) => linhaDeContrato(c, 'DENTRO_5_ANOS')),
    ...parse.foraDaJanela.map((c) => linhaDeContrato(c, 'FORA_5_ANOS')),
    ...parse.naoReconhecidas.map(
      (linha) => [null, null, '', null, '', 'NAO_RECONHECIDA', linha] as const,
    ),
  ];
  return { nome, colunas: COLUNAS_CONTRATOS, linhas };
}
