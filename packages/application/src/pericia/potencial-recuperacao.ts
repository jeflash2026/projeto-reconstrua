// ─────────────────────────────────────────────────────────────────────────────
// POTENCIAL DE RECUPERAÇÃO (decreto 2026-07-21) — o que o cliente JÁ PAGOU de
// parcelas consignadas até hoje, contrato a contrato do HISCON:
//   parcelas descontadas (da COMPETÊNCIA INÍCIO até a competência ATUAL,
//   limitadas pela quantidade contratada e pela COMPETÊNCIA FIM) × valor da
//   parcela — somado por cliente.
// É o teto do que pode ser objeto de restituição; a procedência é análise do
// perito/advogado. Cálculo PURO e determinístico — nada de rede ou persistência.
// ─────────────────────────────────────────────────────────────────────────────
import type { ContratoHiscon } from './hiscon-parser.js';

/** Competência → índice absoluto de meses (ano×12+mês). Aceita os dois formatos
 *  do Meu INSS: "03/2026" (mm/aaaa, Formato A) e "02/02/26" (dd/mm/aa, Formato B
 *  em "Início de Desconto"). null se ilegível. */
function mesAbsoluto(competencia: string | null): number | null {
  if (competencia === null) return null;
  const t = competencia.trim();
  const mmAaaa = /^(\d{2})\/(\d{4})$/.exec(t);
  if (mmAaaa !== null) {
    const mes = Number(mmAaaa[1]);
    const ano = Number(mmAaaa[2]);
    return mes >= 1 && mes <= 12 ? ano * 12 + (mes - 1) : null;
  }
  const ddMmAa = /^\d{2}\/(\d{2})\/(\d{2}|\d{4})$/.exec(t);
  if (ddMmAa !== null) {
    const mes = Number(ddMmAa[1]);
    const aa = Number(ddMmAa[2]);
    const ano = ddMmAa[2]?.length === 4 ? aa : aa >= 70 ? 1900 + aa : 2000 + aa;
    return mes >= 1 && mes <= 12 ? ano * 12 + (mes - 1) : null;
  }
  return null;
}

/** Parcelas JÁ descontadas até `hoje` (inclusive a competência corrente).
 *  GARANTIA 100% REAL (processo judicial — decreto 2026-07-22): só conta quando
 *  os dados são COERENTES. Sem início legível ⇒ 0; início no futuro ⇒ 0; e —
 *  crucial — SEM um LIMITE confiável (competência de fim OU quantidade de
 *  parcelas) ⇒ 0: não se EXTRAPOLA de início até hoje, porque não há como afirmar
 *  quantas parcelas foram descontadas (um contrato encerrado seria contado como
 *  ativo por anos). Nunca inventa; na dúvida, NÃO conta. */
export function parcelasDescontadasAteHoje(contrato: ContratoHiscon, hoje: Date): number {
  const inicio =
    mesAbsoluto(contrato.competenciaInicio) ??
    (contrato.dataPrimeiroDesconto !== null
      ? contrato.dataPrimeiroDesconto.getUTCFullYear() * 12 +
        contrato.dataPrimeiroDesconto.getUTCMonth()
      : null);
  if (inicio === null) return 0;
  const atual = hoje.getUTCFullYear() * 12 + hoje.getUTCMonth();
  const decorridas = atual - inicio + 1; // a competência de início conta
  if (decorridas <= 0) return 0; // desconto ainda não começou (início no futuro)

  const fim = mesAbsoluto(contrato.competenciaFim);
  const qtde = contrato.qtdeParcelas;
  // Sem fim NEM quantidade legível não há teto confiável ⇒ não extrapola (0).
  if (fim === null && qtde === null) return 0;

  let parcelas = decorridas;
  if (fim !== null) parcelas = Math.min(parcelas, fim - inicio + 1);
  if (qtde !== null) parcelas = Math.min(parcelas, qtde);
  return Math.max(0, parcelas);
}

/** Valor de parcela CONFIÁVEL para o cálculo, ou null (não conta). Uma parcela
 *  mensal jamais excede o valor emprestado (quando legível) — se exceder, o campo
 *  foi lido errado (o valor do empréstimo caiu na casa da parcela), então NÃO é
 *  usado: fica DECLARADO como "sem valor legível", nunca somado com dado inventado. */
export function valorParcelaConfiavel(contrato: ContratoHiscon): number | null {
  const vp = contrato.valorParcela;
  if (vp === null || vp <= 0) return null;
  if (
    contrato.valorEmprestado !== null &&
    contrato.valorEmprestado > 0 &&
    vp > contrato.valorEmprestado
  )
    return null;
  return vp;
}

export interface PotencialDeContrato {
  readonly contrato: string;
  readonly bancoNome: string | null;
  readonly parcelasDescontadas: number;
  readonly valorParcela: number | null;
  /** parcelas × valor da parcela; null quando o HISCON não traz o valor. */
  readonly valorDescontado: number | null;
}

export interface PotencialDeRecuperacao {
  readonly total: number;
  /** Contratos SEM valor de parcela legível (entram como 0 — declarado, nunca escondido). */
  readonly contratosSemValor: number;
  readonly porContrato: readonly PotencialDeContrato[];
}

/** Soma do já-descontado de TODOS os contratos do documento (decreto: o
 *  potencial considera o benefício inteiro, não só a janela de 5 anos). */
export function potencialDeRecuperacao(
  contratos: readonly ContratoHiscon[],
  hoje: Date,
): PotencialDeRecuperacao {
  const porContrato: PotencialDeContrato[] = [];
  let total = 0;
  let contratosSemValor = 0;
  for (const c of contratos) {
    const parcelas = parcelasDescontadasAteHoje(c, hoje);
    const parcela = valorParcelaConfiavel(c);
    const valor = parcela !== null ? parcelas * parcela : null;
    if (valor === null) contratosSemValor += 1;
    else total += valor;
    porContrato.push({
      contrato: c.contrato,
      bancoNome: c.bancoNome,
      parcelasDescontadas: parcelas,
      valorParcela: parcela,
      valorDescontado: valor,
    });
  }
  return { total, contratosSemValor, porContrato };
}
