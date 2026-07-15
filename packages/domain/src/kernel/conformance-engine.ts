// ─────────────────────────────────────────────────────────────────────────────
// ConformanceEngine — registro central que mapeia cada invariante do Livro Mestre
// (por id) à sua implementação e referência normativa. Serve à Suíte de
// Conformidade (R9/G9): permite verificar COBERTURA — se toda invariante exigida
// pelo Canon possui uma implementação registrada. Puro.
//
// Não contém nenhuma invariante concreta; é o mecanismo. As invariantes reais
// serão registradas ao lado de cada entidade, em sprints futuras.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invariant } from './invariant.js';

export interface ConformanceEntry {
  readonly id: string;
  readonly canonReference: string;
  readonly description: string;
}

export class ConformanceRegistry {
  private readonly entries = new Map<string, ConformanceEntry>();

  /** Registra uma invariante. Ids duplicados são rejeitados (garantia de unicidade). */
  register<T>(invariant: Invariant<T>): void {
    if (this.entries.has(invariant.id)) {
      throw new Error(`Invariante já registrada: ${invariant.id}`);
    }
    this.entries.set(invariant.id, {
      id: invariant.id,
      canonReference: invariant.canonReference,
      description: invariant.description,
    });
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  all(): ReadonlyArray<ConformanceEntry> {
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
  }

  /**
   * Dado o conjunto de ids exigidos pelo Livro Mestre, retorna os que ainda NÃO
   * possuem implementação registrada. Vazio = cobertura completa.
   */
  missing(requiredCanonIds: ReadonlyArray<string>): string[] {
    return requiredCanonIds.filter((id) => !this.entries.has(id));
  }

  /**
   * Retorna ids registrados que NÃO constam da lista exigida (implementações
   * órfãs — potencial regra inventada fora do Canon).
   */
  orphans(requiredCanonIds: ReadonlyArray<string>): string[] {
    const required = new Set(requiredCanonIds);
    return this.all()
      .map((entry) => entry.id)
      .filter((id) => !required.has(id));
  }
}
