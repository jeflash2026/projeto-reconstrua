// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICAÇÃO E AGRUPAMENTO DE CONTRATOS EM AÇÕES (decreto do dono,
// 2026-08-04) — o guia de referência que padroniza como cada contrato vira
// ação judicial ANTES da distribuição aos advogados:
//
//   • CONTRATOS ATIVOS ..... regra geral 1 contrato = 1 ação; EXCEÇÃO: mesmo
//                            banco + mesmo dia (ou 1 dia de diferença) ⇒ uma
//                            única ação (estratégia processual);
//   • CONTRATOS EXCLUÍDOS .. (prescrição · janela de 5 anos) agrupa por mesmo
//                            ANO + mesmo BANCO; bancos diferentes SEMPRE
//                            separados, mesmo no mesmo ano;
//   • RMC ................... sempre em ação separada;
//   • RCC ................... sempre em ação separada.
//
// PURO e determinístico: recebe os contratos parseados do HISCON e devolve as
// ações propostas com a REGRA APLICADA escrita em linguagem clara — é o texto
// que o advogado lê no dossiê. Nada é inventado: contrato sem data/ano legível
// não é agrupado (vira ação própria, com a ressalva declarada — Lei 9).
// ─────────────────────────────────────────────────────────────────────────────
import { contratosDaJanela, type ContratoHiscon } from './hiscon-parser.js';

export type CategoriaAcao = 'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC';

export const ROTULO_CATEGORIA: Readonly<Record<CategoriaAcao, string>> = {
  ATIVOS: 'Contratos Ativos',
  EXCLUIDOS: 'Contratos Excluídos (prescrição · 5 anos)',
  RMC: 'RMC — Reserva de Margem Consignável',
  RCC: 'RCC — Reserva de Cartão Consignado',
};

export interface AcaoProposta {
  /** Numeração sequencial da ação no dossiê (1..N). */
  readonly numero: number;
  readonly categoria: CategoriaAcao;
  /** Banco da ação, legível ("329 - BANCO X"); nunca misto (regra do dono). */
  readonly banco: string;
  readonly contratos: readonly ContratoHiscon[];
  /** A regra do guia que formou ESTA ação, em linguagem clara. */
  readonly regra: string;
}

export interface ResumoAcoes {
  readonly totalAcoes: number;
  readonly totalContratos: number;
  readonly porCategoria: Readonly<Record<CategoriaAcao, number>>;
}

export interface AgrupamentoDeAcoes {
  readonly acoes: readonly AcaoProposta[];
  readonly resumo: ResumoAcoes;
}

// ── helpers puros ─────────────────────────────────────────────────────────────

/** Categoria do contrato: modalidade manda (RMC/RCC); empréstimo se divide por
 *  SITUAÇÃO — "ATIVO" (palavra inteira; "INATIVO" NÃO conta) vs. o resto
 *  (excluído/encerrado/suspenso), que cai na régua da prescrição. */
export function categoriaDoContrato(c: ContratoHiscon): CategoriaAcao {
  if (c.modalidade === 'RMC') return 'RMC';
  if (c.modalidade === 'RCC') return 'RCC';
  const s = (c.situacao ?? '').toUpperCase();
  return /(^|[^A-Z])ATIVO/.test(s) ? 'ATIVOS' : 'EXCLUIDOS';
}

/** Banco legível da ação — o agrupamento NUNCA mistura bancos. */
function bancoDe(c: ContratoHiscon): string {
  if (c.bancoCodigo !== null && c.bancoNome !== null) return `${c.bancoCodigo} - ${c.bancoNome}`;
  return c.bancoNome ?? c.bancoCodigo ?? 'Banco não identificado';
}

/** Chave de banco para agrupar (código quando há; senão o nome). */
function chaveBanco(c: ContratoHiscon): string {
  return c.bancoCodigo ?? c.bancoNome ?? '?';
}

/** O DIA do contrato (época em dias UTC) — data de inclusão; sem ela, o
 *  primeiro desconto. null = sem data legível (não agrupa; declara). */
function diaDoContrato(c: ContratoHiscon): number | null {
  const d = c.dataInclusao ?? c.dataPrimeiroDesconto;
  return d === null ? null : Math.floor(d.getTime() / 86_400_000);
}

/** O ANO do contrato — inclusão; sem ela, a competência de início (MM/AAAA);
 *  por fim o primeiro desconto. null = sem ano legível. */
function anoDoContrato(c: ContratoHiscon): number | null {
  if (c.dataInclusao !== null) return c.dataInclusao.getUTCFullYear();
  const m = /(\d{4})/.exec(c.competenciaInicio ?? '');
  if (m !== null) return Number(m[1]);
  return c.dataPrimeiroDesconto?.getUTCFullYear() ?? null;
}

function dataBr(c: ContratoHiscon): string {
  const d = c.dataInclusao ?? c.dataPrimeiroDesconto;
  return d !== null ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : 'sem data';
}

/** Agrupa os ATIVOS de UM banco: ordena pelo dia e ENCADEIA contratos com
 *  diferença de até 1 dia (mesmo dia ou dia seguinte) — a exceção do guia.
 *  Sem data legível, o contrato NÃO agrupa (ação própria, com a ressalva). */
function agruparAtivosDoBanco(
  contratos: readonly ContratoHiscon[],
): readonly (readonly ContratoHiscon[])[] {
  const comData = contratos
    .filter((c) => diaDoContrato(c) !== null)
    .sort((a, b) => (diaDoContrato(a) ?? 0) - (diaDoContrato(b) ?? 0));
  const semData = contratos.filter((c) => diaDoContrato(c) === null);
  const grupos: ContratoHiscon[][] = [];
  for (const c of comData) {
    const ultimo = grupos[grupos.length - 1];
    const diaAnterior = ultimo ? (diaDoContrato(ultimo[ultimo.length - 1]!) ?? 0) : null;
    const dia = diaDoContrato(c) ?? 0;
    if (ultimo !== undefined && diaAnterior !== null && dia - diaAnterior <= 1) ultimo.push(c);
    else grupos.push([c]);
  }
  return [...grupos, ...semData.map((c) => [c])];
}

/** O GUIA aplicado: contratos do HISCON (janela de 5 anos) → ações propostas.
 *  Determinístico; a ordem de saída é estável (Ativos → Excluídos → RMC → RCC,
 *  banco em ordem alfabética, data crescente). */
export function agruparContratosEmAcoes(
  contratos: readonly ContratoHiscon[],
  hoje: Date,
): AgrupamentoDeAcoes {
  // A MESMA janela de 5 anos de todo o pipeline (decreto: fora dela, descarta).
  const janela = contratosDaJanela(contratos, hoje, 5);

  const porCategoria: Record<CategoriaAcao, ContratoHiscon[]> = {
    ATIVOS: [],
    EXCLUIDOS: [],
    RMC: [],
    RCC: [],
  };
  for (const c of janela) porCategoria[categoriaDoContrato(c)].push(c);

  const acoes: Omit<AcaoProposta, 'numero'>[] = [];

  // ── CONTRATOS ATIVOS: 1=1; exceção mesmo banco + mesmo dia (±1) ────────────
  const ativosPorBanco = new Map<string, ContratoHiscon[]>();
  for (const c of porCategoria.ATIVOS) {
    const k = chaveBanco(c);
    ativosPorBanco.set(k, [...(ativosPorBanco.get(k) ?? []), c]);
  }
  for (const [, doBanco] of [...ativosPorBanco.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const grupo of agruparAtivosDoBanco(doBanco)) {
      const primeiro = grupo[0]!;
      const regra =
        grupo.length > 1
          ? `Exceção do guia: ${String(grupo.length)} contratos do MESMO banco averbados no ` +
            `mesmo dia (ou 1 dia de diferença) — agrupados em UMA ação (estratégia processual).`
          : diaDoContrato(primeiro) === null
            ? 'Regra geral: 1 contrato = 1 ação. (Sem data legível no HISCON — não agrupável.)'
            : 'Regra geral dos ativos: 1 contrato = 1 ação (processo separado).';
      acoes.push({ categoria: 'ATIVOS', banco: bancoDe(primeiro), contratos: grupo, regra });
    }
  }

  // ── CONTRATOS EXCLUÍDOS: mesmo ANO + mesmo BANCO; bancos nunca se misturam ─
  const excluidosPorAnoBanco = new Map<string, ContratoHiscon[]>();
  const excluidosSemAno: ContratoHiscon[] = [];
  for (const c of porCategoria.EXCLUIDOS) {
    const ano = anoDoContrato(c);
    if (ano === null) {
      excluidosSemAno.push(c);
      continue;
    }
    const k = `${chaveBanco(c)}|${String(ano)}`;
    excluidosPorAnoBanco.set(k, [...(excluidosPorAnoBanco.get(k) ?? []), c]);
  }
  for (const [k, grupo] of [...excluidosPorAnoBanco.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const ano = k.split('|')[1] ?? '?';
    const regra =
      grupo.length > 1
        ? `Excluídos: ${String(grupo.length)} contratos do MESMO banco no MESMO ano (${ano}) — ` +
          'agrupados em UMA ação. (Bancos diferentes seguem sempre separados.)'
        : `Excluídos: único contrato deste banco no ano ${ano} — ação própria. ` +
          '(Agruparia com outros do mesmo banco e mesmo ano, se houvesse.)';
    acoes.push({ categoria: 'EXCLUIDOS', banco: bancoDe(grupo[0]!), contratos: grupo, regra });
  }
  for (const c of excluidosSemAno) {
    acoes.push({
      categoria: 'EXCLUIDOS',
      banco: bancoDe(c),
      contratos: [c],
      regra: 'Excluídos: sem ano legível no HISCON — não agrupável; ação própria (declarado).',
    });
  }

  // ── RMC e RCC: SEMPRE separados ────────────────────────────────────────────
  for (const c of porCategoria.RMC) {
    acoes.push({
      categoria: 'RMC',
      banco: bancoDe(c),
      contratos: [c],
      regra: 'RMC (Reserva de Margem Consignável): sempre em ação separada.',
    });
  }
  for (const c of porCategoria.RCC) {
    acoes.push({
      categoria: 'RCC',
      banco: bancoDe(c),
      contratos: [c],
      regra: 'RCC (Reserva de Cartão Consignado): sempre em ação separada.',
    });
  }

  const numeradas: AcaoProposta[] = acoes.map((a, i) => ({ ...a, numero: i + 1 }));
  const contagem = (cat: CategoriaAcao): number =>
    numeradas.filter((a) => a.categoria === cat).length;
  return {
    acoes: numeradas,
    resumo: {
      totalAcoes: numeradas.length,
      totalContratos: janela.length,
      porCategoria: {
        ATIVOS: contagem('ATIVOS'),
        EXCLUIDOS: contagem('EXCLUIDOS'),
        RMC: contagem('RMC'),
        RCC: contagem('RCC'),
      },
    },
  };
}

/** Linha-resumo de um contrato para o dossiê do advogado (legível). */
export function linhaDoContrato(c: ContratoHiscon): string {
  const partes = [
    `Contrato ${c.contrato}`,
    c.situacao !== null ? c.situacao : null,
    dataBr(c),
    c.valorEmprestado !== null
      ? `R$ ${c.valorEmprestado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : null,
    c.valorParcela !== null
      ? `parcela R$ ${c.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : null,
    c.migrado ? 'MIGRADO' : null,
  ];
  return partes.filter((p): p is string => p !== null).join(' · ');
}
