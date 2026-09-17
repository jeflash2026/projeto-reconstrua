// ─────────────────────────────────────────────────────────────────────────────
// PARÂMETROS COMERCIAIS DO PROCESSO — a FONTE ÚNICA dos números que o Painel
// Jurídico e o Painel do Investidor têm de usar iguais. Mudar aqui muda nos
// dois lugares (e nas contas do Jarvis), sem dois valores brigando no código.
//
// Decisão do dono em 2026-09-17: a parte da EMPRESA é 49% (antes 50%).
// ─────────────────────────────────────────────────────────────────────────────

/** Valor BASE de um processo: a média histórica (raramente sai menos que isso).
 *  Vale como referência até a execução dizer o valor real. */
export const VALOR_REFERENCIA_PROCESSO = 10_000;

/** A parte da EMPRESA no valor do processo — o cliente fica com o resto. */
export const PARTE_DA_EMPRESA = 0.49;

/** Quanto cada processo conta para o investidor (R$ 4.900): é a parte da
 *  empresa sobre a base, e é isso que o crédito antecipado compra. */
export const REFERENCIA_DO_INVESTIDOR =
  Math.round(VALOR_REFERENCIA_PROCESSO * PARTE_DA_EMPRESA * 100) / 100;
