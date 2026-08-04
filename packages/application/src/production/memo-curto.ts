// ─────────────────────────────────────────────────────────────────────────────
// MEMÓRIA CURTA DE LEITURA (2026-08-04) — as varreduras derivadas do sistema
// (todos os clientes com HISCON, potencial de todos, a mesa do humanizado) leem
// o TEXTO de todos os documentos e parseiam o HISCON cliente a cliente. O
// processo é SINGLE-THREAD: enquanto uma varredura corre, NADA mais anda — nem
// o login da secretária, nem a resposta da AHRI ao cliente no WhatsApp.
//
// Este envelope trata as duas causas do travamento:
//   • TTL — a mesma varredura não se repete a cada clique, refresh ou polling;
//   • VOO ÚNICO (single-flight) — N chamadas concorrentes compartilham UMA
//     execução; cinco abas abertas juntas não viram cinco varreduras.
//
// Nada é persistido: o dado segue 100% DERIVADO (Regra 1), envelhece no máximo
// o TTL e qualquer ação do painel pode zerar com invalidar().
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoCurto<T> {
  (): Promise<T>;
  /** Descarta o valor guardado — a próxima chamada recomputa do zero. */
  invalidar(): void;
}

/** Envelopa uma leitura CARA. ttlMs <= 0 desliga o cache (o padrão dos testes,
 *  que exigem recomputo determinístico), mantendo o voo único desligado também. */
export function memoCurto<T>(calcular: () => Promise<T>, ttlMs: number): MemoCurto<T> {
  let guardado: { em: number; valor: T } | null = null;
  let emVoo: Promise<T> | null = null;

  const executar = async (): Promise<T> => {
    if (ttlMs <= 0) return calcular();
    if (guardado !== null && Date.now() - guardado.em < ttlMs) return guardado.valor;
    // Já existe uma varredura correndo: espera A MESMA (nunca dispara outra).
    if (emVoo !== null) return emVoo;
    const voo = calcular().then((valor) => {
      guardado = { em: Date.now(), valor };
      return valor;
    });
    // Falha NÃO é guardada: o erro chega a todos os que esperavam e a próxima
    // chamada tenta de novo (nada de cachear indisponibilidade).
    emVoo = voo.finally(() => {
      emVoo = null;
    });
    return emVoo;
  };

  return Object.assign(executar, {
    invalidar: (): void => {
      guardado = null;
    },
  });
}
