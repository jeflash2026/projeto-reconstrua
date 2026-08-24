// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICAÇÃO DE CONTRATOS EM PROCESSOS (decreto do dono, 2026-08-04 —
// versão 2, modelo comercial: advogados parceiros adquirem cada PROCESSO
// disponível; a AHRI precisa contar exatamente como o negócio conta):
//
//   • CONTRATOS ATIVOS (janela de 5 anos) . cada 1 contrato = 1 PROCESSO;
//   • NÃO-ATIVOS (excluído/inativo/suspenso/migrado, janela de 5 anos)
//     ..................................... cada 3 contratos do MESMO BANCO +
//                                           MESMO ANO valem 1 processo; a
//                                           sobra (1 ou 2) fica FORA; TETO de
//                                           15 processos POR BANCO na divisão;
//                                           seleção SEMPRE dos maiores valores
//                                           para os menores;
//   • RMC / RCC ........................... sempre separados: 1 = 1 processo.
//
// A MESMA seleção vale em toda a cadeia: dossiê jurídico, planilha do perito e
// potencial financeiro — só os contratos SELECIONADOS contam. O painel mostra
// os DOIS números: contratos totais do cliente E processos (ex.: Maria, 20
// contratos do mesmo banco/ano ⇒ 20 contratos · 6 processos).
//
// PURO e determinístico; a regra de cada processo sai escrita em linguagem
// clara (o texto que o advogado lê). Nada é inventado: contrato sem ano
// legível não entra em trio (declarado — Lei 9).
// ─────────────────────────────────────────────────────────────────────────────
import { contratosDaJanela, type ContratoHiscon } from './hiscon-parser.js';

export type CategoriaAcao = 'ATIVOS' | 'EXCLUIDOS' | 'RMC' | 'RCC';

/** Teto de processos POR BANCO vindos da divisão 3=1 dos não-ativos. */
export const TETO_LOTES_POR_BANCO = 15;

export const ROTULO_CATEGORIA: Readonly<Record<CategoriaAcao, string>> = {
  ATIVOS: 'Contratos Ativos',
  EXCLUIDOS: 'Não-ativos (lote de 3 = 1 processo)',
  RMC: 'RMC — Reserva de Margem Consignável',
  RCC: 'RCC — Reserva de Cartão Consignado',
};

export interface AcaoProposta {
  /** Numeração sequencial do processo no dossiê (1..N). */
  readonly numero: number;
  readonly categoria: CategoriaAcao;
  /** Banco do processo, legível ("329 - BANCO X"); nunca misto. */
  readonly banco: string;
  readonly contratos: readonly ContratoHiscon[];
  /** A regra do guia que formou ESTE processo, em linguagem clara. */
  readonly regra: string;
}

export interface ResumoAcoes {
  /** PROCESSOS disponíveis (a unidade do modelo comercial). */
  readonly totalAcoes: number;
  /** TODOS os contratos do cliente na janela de 5 anos (a soma REAL). */
  readonly totalContratos: number;
  /** Contratos que ENTRARAM em processos (seleção do guia). */
  readonly contratosSelecionados: number;
  /** Não-ativos fora da seleção (sobra de trio, teto do banco ou sem ano). */
  readonly contratosForaDaSelecao: number;
  readonly porCategoria: Readonly<Record<CategoriaAcao, number>>;
}

export interface AgrupamentoDeAcoes {
  readonly acoes: readonly AcaoProposta[];
  readonly resumo: ResumoAcoes;
}

// ── helpers puros ─────────────────────────────────────────────────────────────

/** Categoria do contrato: modalidade manda (RMC/RCC); empréstimo se divide por
 *  SITUAÇÃO — "ATIVO" (palavra inteira; "INATIVO" NÃO conta) vs. o resto
 *  (excluído/inativo/suspenso/encerrado), que cai na régua do lote 3=1. */
export function categoriaDoContrato(c: ContratoHiscon): CategoriaAcao {
  if (c.modalidade === 'RMC') return 'RMC';
  if (c.modalidade === 'RCC') return 'RCC';
  const s = (c.situacao ?? '').toUpperCase();
  return /(^|[^A-Z])ATIVO/.test(s) ? 'ATIVOS' : 'EXCLUIDOS';
}

/** Banco legível do processo — a seleção NUNCA mistura bancos. */
function bancoDe(c: ContratoHiscon): string {
  if (c.bancoCodigo !== null && c.bancoNome !== null) return `${c.bancoCodigo} - ${c.bancoNome}`;
  return c.bancoNome ?? c.bancoCodigo ?? 'Banco não identificado';
}

/** Chave de banco para agrupar (código quando há; senão o nome). */
function chaveBanco(c: ContratoHiscon): string {
  return c.bancoCodigo ?? c.bancoNome ?? '?';
}

/** O ANO do contrato — inclusão; sem ela, a competência de início (MM/AAAA);
 *  por fim o primeiro desconto. null = sem ano legível (não entra em trio). */
function anoDoContrato(c: ContratoHiscon): number | null {
  if (c.dataInclusao !== null) return c.dataInclusao.getUTCFullYear();
  const m = /(\d{4})/.exec(c.competenciaInicio ?? '');
  if (m !== null) return Number(m[1]);
  return c.dataPrimeiroDesconto?.getUTCFullYear() ?? null;
}

/** O VALOR do contrato para ordenar "dos maiores para os menores" — o
 *  emprestado; sem ele, a parcela; sem nada, zero (vai para o fim da fila). */
function valorDe(c: ContratoHiscon): number {
  return c.valorEmprestado ?? c.valorParcela ?? 0;
}

/** A SELEÇÃO do guia aplicada aos contratos do HISCON (janela de 5 anos). */
export function agruparContratosEmAcoes(
  contratos: readonly ContratoHiscon[],
  hoje: Date,
): AgrupamentoDeAcoes {
  // A MESMA janela de 5 anos de todo o pipeline (decreto: fora dela, descarta).
  const janela = contratosDaJanela(contratos, hoje, 5);

  // MIGRAÇÕES (decreto do dono, caso Juvenal 2026-08-24): migração NÃO é o
  // mesmo empréstimo — é contrato NOVO criado sem autorização do cliente, e a
  // migração em si é objeto da ação. O ESPELHO (o registro não-ativo do banco
  // de origem, com o número que o ativo declara em "Migrado do contrato X
  // CBC: N") viaja no MESMO processo do ativo migrado: o advogado e o pedido
  // administrativo recebem os DOIS números juntos. O espelho sai do pool de
  // trios — ele já está representado no processo da migração.
  const espelhoDe = (ativo: ContratoHiscon): ContratoHiscon | null => {
    if (!ativo.migrado || ativo.migradoDoContrato === null) return null;
    return (
      janela.find(
        (c) =>
          c !== ativo &&
          c.contrato === ativo.migradoDoContrato &&
          (ativo.migradoDoCbc === null || c.bancoCodigo === ativo.migradoDoCbc) &&
          (c.situacao ?? '').toUpperCase() !== 'ATIVO',
      ) ?? null
    );
  };
  const espelhosDeMigracao = new Set<ContratoHiscon>();

  const porCategoria: Record<CategoriaAcao, ContratoHiscon[]> = {
    ATIVOS: [],
    EXCLUIDOS: [],
    RMC: [],
    RCC: [],
  };
  for (const c of janela) porCategoria[categoriaDoContrato(c)].push(c);

  const acoes: Omit<AcaoProposta, 'numero'>[] = [];

  // ── ATIVOS: cada 1 contrato = 1 processo (a unidade do modelo comercial) ───
  const ativosOrdenados = [...porCategoria.ATIVOS].sort(
    (a, b) => chaveBanco(a).localeCompare(chaveBanco(b)) || valorDe(b) - valorDe(a),
  );
  for (const c of ativosOrdenados) {
    const espelho = espelhoDe(c);
    if (espelho !== null) espelhosDeMigracao.add(espelho);
    acoes.push({
      categoria: 'ATIVOS',
      banco: bancoDe(c),
      contratos: espelho !== null ? [c, espelho] : [c],
      regra:
        espelho !== null
          ? 'Contrato ATIVO MIGRADO: 1 processo com os DOIS contratos — o original do banco de origem e o migrado. A migração gerou contrato novo sem autorização do cliente.'
          : 'Contrato ATIVO: 1 contrato = 1 processo.',
    });
  }

  // ── NÃO-ATIVOS: trios do MESMO banco + MESMO ano = 1 processo; teto de 15
  //    processos POR BANCO; sempre dos MAIORES valores para os menores.
  //    Espelhos de migração ficam FORA do pool: já viajam no processo do ativo.
  const naoAtivosPorBanco = new Map<string, ContratoHiscon[]>();
  for (const c of porCategoria.EXCLUIDOS.filter((x) => !espelhosDeMigracao.has(x))) {
    const k = chaveBanco(c);
    naoAtivosPorBanco.set(k, [...(naoAtivosPorBanco.get(k) ?? []), c]);
  }
  for (const [, doBanco] of [...naoAtivosPorBanco.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    // Agrupa por ANO dentro do banco; sem ano legível não entra em trio.
    const porAno = new Map<number, ContratoHiscon[]>();
    for (const c of doBanco) {
      const ano = anoDoContrato(c);
      if (ano === null) continue;
      porAno.set(ano, [...(porAno.get(ano) ?? []), c]);
    }
    // Monta TODOS os trios possíveis (por ano, maiores valores primeiro)…
    const trios: { ano: number; contratos: ContratoHiscon[]; valor: number }[] = [];
    for (const [ano, doAno] of porAno) {
      const ordenados = [...doAno].sort((a, b) => valorDe(b) - valorDe(a));
      for (let i = 0; i + 3 <= ordenados.length; i += 3) {
        const trio = ordenados.slice(i, i + 3);
        trios.push({ ano, contratos: trio, valor: trio.reduce((s, c) => s + valorDe(c), 0) });
      }
    }
    // …e aplica o TETO do banco: ficam os 15 trios de MAIOR valor.
    const escolhidos = trios.sort((a, b) => b.valor - a.valor).slice(0, TETO_LOTES_POR_BANCO);
    for (const t of escolhidos.sort((a, b) => a.ano - b.ano || b.valor - a.valor)) {
      acoes.push({
        categoria: 'EXCLUIDOS',
        banco: bancoDe(t.contratos[0]!),
        contratos: t.contratos,
        regra:
          `Não-ativos: 3 contratos do MESMO banco no MESMO ano (${String(t.ano)}) = 1 processo ` +
          '(seleção dos maiores valores; teto de 15 processos por banco).',
      });
    }
  }

  // ── RMC e RCC: SEMPRE separados — 1 = 1 processo ───────────────────────────
  for (const c of porCategoria.RMC) {
    acoes.push({
      categoria: 'RMC',
      banco: bancoDe(c),
      contratos: [c],
      regra: 'RMC (Reserva de Margem Consignável): sempre em processo separado.',
    });
  }
  for (const c of porCategoria.RCC) {
    acoes.push({
      categoria: 'RCC',
      banco: bancoDe(c),
      contratos: [c],
      regra: 'RCC (Reserva de Cartão Consignado): sempre em processo separado.',
    });
  }

  const numeradas: AcaoProposta[] = acoes.map((a, i) => ({ ...a, numero: i + 1 }));
  const selecionados = numeradas.reduce((s, a) => s + a.contratos.length, 0);
  const contagem = (cat: CategoriaAcao): number =>
    numeradas.filter((a) => a.categoria === cat).length;
  return {
    acoes: numeradas,
    resumo: {
      totalAcoes: numeradas.length,
      totalContratos: janela.length,
      contratosSelecionados: selecionados,
      contratosForaDaSelecao: janela.length - selecionados,
      porCategoria: {
        ATIVOS: contagem('ATIVOS'),
        EXCLUIDOS: contagem('EXCLUIDOS'),
        RMC: contagem('RMC'),
        RCC: contagem('RCC'),
      },
    },
  };
}

/** A SELEÇÃO crua (união dos contratos que entraram em processos) — a MESMA
 *  régua da planilha do perito e do potencial financeiro (decreto 2026-08-04:
 *  "são esses mesmos contratos que devem chegar até a central do perito…
 *  e potencial financeiro"). */
export function contratosSelecionadosDoGuia(
  contratos: readonly ContratoHiscon[],
  hoje: Date,
): readonly ContratoHiscon[] {
  return agruparContratosEmAcoes(contratos, hoje).acoes.flatMap((a) => a.contratos);
}
