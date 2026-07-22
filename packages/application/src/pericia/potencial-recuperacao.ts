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
 *  Sem competência de início legível ⇒ 0 (nunca inventa). */
export function parcelasDescontadasAteHoje(contrato: ContratoHiscon, hoje: Date): number {
  const inicio =
    mesAbsoluto(contrato.competenciaInicio) ??
    (contrato.dataPrimeiroDesconto !== null
      ? contrato.dataPrimeiroDesconto.getUTCFullYear() * 12 +
        contrato.dataPrimeiroDesconto.getUTCMonth()
      : null);
  if (inicio === null) return 0;
  const atual = hoje.getUTCFullYear() * 12 + hoje.getUTCMonth();
  let parcelas = atual - inicio + 1; // a competência de início conta
  if (parcelas < 0) return 0; // desconto ainda não começou
  const fim = mesAbsoluto(contrato.competenciaFim);
  if (fim !== null) parcelas = Math.min(parcelas, fim - inicio + 1);
  if (contrato.qtdeParcelas !== null) parcelas = Math.min(parcelas, contrato.qtdeParcelas);
  return Math.max(0, parcelas);
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
    const valor = c.valorParcela !== null ? parcelas * c.valorParcela : null;
    if (valor === null) contratosSemValor += 1;
    else total += valor;
    porContrato.push({
      contrato: c.contrato,
      bancoNome: c.bancoNome,
      parcelasDescontadas: parcelas,
      valorParcela: c.valorParcela,
      valorDescontado: valor,
    });
  }
  return { total, contratosSemValor, porContrato };
}
