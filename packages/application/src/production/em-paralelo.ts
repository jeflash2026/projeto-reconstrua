// ─────────────────────────────────────────────────────────────────────────────
// EM PARALELO — percorre uma coleção com um TETO de trilhas simultâneas.
//
// (2026-10-26) `ClientesList.list()` compunha os 1.832 clientes em fila
// indiana: um `await` por cliente, cada um com várias idas ao banco. O tempo
// era a soma de tudo. O pool do Postgres tem 10 conexões, então o remédio não
// é soltar 1.832 promessas de uma vez — é um teto que ocupe o pool sem
// afogá-lo, deixando folga para o resto do tráfego.
//
// A ORDEM da saída é a da entrada, sempre: quem chama continua podendo
// confiar no índice. O primeiro erro propaga, como na fila indiana.
// ─────────────────────────────────────────────────────────────────────────────

/** Percorre `itens` com no máximo `limite` chamadas simultâneas de `fn`. */
export async function emParalelo<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const total = itens.length;
  const saida = new Array<R>(total);
  if (total === 0) return saida;

  const trilhas = Math.max(1, Math.min(Math.floor(limite), total));
  let proximo = 0;

  const trabalhar = async (): Promise<void> => {
    for (;;) {
      const i = proximo;
      proximo += 1;
      if (i >= total) return;
      const item: T = itens[i] as T;
      saida[i] = await fn(item, i);
    }
  };

  await Promise.all(Array.from({ length: trilhas }, () => trabalhar()));
  return saida;
}
