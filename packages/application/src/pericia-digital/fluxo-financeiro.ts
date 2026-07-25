// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · FLUXO FINANCEIRO (Decreto 2026-07-24, item 6F)
// Compara o que o HISCON traz com o que os documentos do banco declaram (valor
// contratado, valor creditado, refinanciamento, quitação, troco, parcelas). Aponta
// DIVERGÊNCIAS — nunca conclui fraude. O crédito é um ELEMENTO do caso, jamais
// comprovação automática da AUTORIA da contratação. Puro: entra o que existe.
// ─────────────────────────────────────────────────────────────────────────────
import { NAO_APRESENTADO, campoSeguro } from './linguagem-segura.js';

export interface FluxoFinanceiroEntrada {
  /** Do HISCON (transcrito, quando houver). */
  readonly valorContratoHiscon: number | null;
  readonly parcelasHiscon: number | null;
  readonly valorParcelaHiscon: number | null;
  /** Dos documentos do banco (o perito informa; ausência é dita como tal). */
  readonly valorContratoDeclarado: number | null;
  readonly valorCreditado: number | null;
  readonly dataCredito: string | null;
  readonly contaDestinataria: string | null;
  readonly titularidade: string | null;
  readonly valorRefinanciado: number | null;
  readonly valorQuitacao: number | null;
  readonly trocoLiberado: number | null;
}

export type StatusFluxo = 'COINCIDE' | 'DIVERGE' | 'NAO_APRESENTADO' | 'NAO_APLICAVEL';

export interface ItemFluxo {
  readonly campo: string;
  readonly hiscon: string;
  readonly documento: string;
  readonly status: StatusFluxo;
}

export interface AnaliseFluxoFinanceiro {
  readonly itens: readonly ItemFluxo[];
  readonly divergencias: number;
  readonly observacao: string;
}

const moeda = (v: number | null): string =>
  v === null ? NAO_APRESENTADO : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Compara dois valores monetários com tolerância de 1 centavo. */
function compararValor(a: number | null, b: number | null): StatusFluxo {
  if (a === null || b === null) return 'NAO_APRESENTADO';
  return Math.abs(a - b) <= 0.01 ? 'COINCIDE' : 'DIVERGE';
}

/** Monta o quadro comparativo do fluxo financeiro. Cada linha diz o que o HISCON
 *  traz, o que o documento do banco traz e se coincide/diverge — sem concluir. */
export function analisarFluxoFinanceiro(e: FluxoFinanceiroEntrada): AnaliseFluxoFinanceiro {
  const itens: ItemFluxo[] = [
    {
      campo: 'Valor do contrato',
      hiscon: moeda(e.valorContratoHiscon),
      documento: moeda(e.valorContratoDeclarado),
      status: compararValor(e.valorContratoHiscon, e.valorContratoDeclarado),
    },
    {
      campo: 'Valor creditado ao beneficiário',
      hiscon: NAO_APRESENTADO,
      documento: moeda(e.valorCreditado),
      status: e.valorCreditado === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Data do crédito',
      hiscon: NAO_APRESENTADO,
      documento: campoSeguro(e.dataCredito),
      status: e.dataCredito === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Conta destinatária',
      hiscon: NAO_APRESENTADO,
      documento: campoSeguro(e.contaDestinataria),
      status: e.contaDestinataria === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Titularidade da conta',
      hiscon: NAO_APRESENTADO,
      documento: campoSeguro(e.titularidade),
      status: e.titularidade === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Valor refinanciado',
      hiscon: NAO_APRESENTADO,
      documento: moeda(e.valorRefinanciado),
      status: e.valorRefinanciado === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Valor de quitação',
      hiscon: NAO_APRESENTADO,
      documento: moeda(e.valorQuitacao),
      status: e.valorQuitacao === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Troco liberado',
      hiscon: NAO_APRESENTADO,
      documento: moeda(e.trocoLiberado),
      status: e.trocoLiberado === null ? 'NAO_APRESENTADO' : 'NAO_APLICAVEL',
    },
    {
      campo: 'Quantidade de parcelas',
      hiscon: campoSeguro(e.parcelasHiscon),
      documento: NAO_APRESENTADO,
      status: 'NAO_APLICAVEL',
    },
    {
      campo: 'Valor da parcela',
      hiscon: moeda(e.valorParcelaHiscon),
      documento: NAO_APRESENTADO,
      status: 'NAO_APLICAVEL',
    },
  ];
  const divergencias = itens.filter((i) => i.status === 'DIVERGE').length;
  return {
    itens,
    divergencias,
    observacao:
      'O crédito financeiro é um elemento do caso e não constitui, por si, comprovação automática da autoria da contratação. Divergências apontadas são fatos técnicos, sujeitos à revisão do perito.',
  };
}
