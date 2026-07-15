// ─────────────────────────────────────────────────────────────────────────────
// Clock — port de tempo. O domínio nunca lê o relógio do sistema diretamente;
// recebe um Clock. A implementação concreta (relógio real, relógio de teste)
// vive na infraestrutura.
// `Date` é primitiva da linguagem (não é tecnologia de infra).
// ─────────────────────────────────────────────────────────────────────────────

export interface Clock {
  now(): Date;
}
