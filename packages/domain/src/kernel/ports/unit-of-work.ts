// ─────────────────────────────────────────────────────────────────────────────
// UnitOfWork — port de fronteira transacional. Garante atomicidade entre gravar
// eventos e registrar efeitos (nada se perde — Lei 3). Interface apenas. Puro.
// ─────────────────────────────────────────────────────────────────────────────

export interface UnitOfWork {
  /** Executa `work` dentro de uma unidade atômica; confirma no sucesso, desfaz na falha. */
  run<T>(work: () => Promise<T>): Promise<T>;
}
