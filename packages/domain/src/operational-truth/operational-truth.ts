// ─────────────────────────────────────────────────────────────────────────────
// OperationalTruthAggregate — agregado da Entidade 07 (VERDADE OPERACIONAL).
// Deriva EXCLUSIVAMENTE do Livro Mestre (Entidade 07; E8; Lei nº 6; Lei 1/2;
// DF-02/03/05/08; INV-E8-01..07; Art. 14º).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA o RESULTADO de uma síntese já realizada — fábrica `synthesize`,
//     emite OperationalTruthSynthesized (a Verdade nasce por síntese — E8);
//   • vincula a síntese a exatamente uma Missão (Lei 2; item 1);
//   • preserva, de forma imutável e datada, a justificativa de cadeia demonstrável
//     (INV-E8-02/L06) e a incerteza declarada quando existir (INV-E8-07);
//   • registra a rastreabilidade da síntese: responsável + momento (INV-E8-06;
//     DF-09; Art. 14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO executa R5 — NÃO avalia as quatro condições de legitimidade, NÃO calcula
//     nem verifica a cadeia, NÃO decide "Verdade construída/preservada" (isso é R5);
//   • NÃO possui estado operacional nem "vigência" mutável — cada síntese é imutável;
//     a revisão é uma NOVA síntese (E8-L04); a unicidade da vigente é do event-store
//     /projeção (INV-VO-01);
//   • NÃO contém o conteúdo do estado — "possui nada; é síntese" (item 12); ESTADO(08)
//     e ETAPA(09) são posteriores e NÃO são referenciados (não antecipar);
//   • NÃO referencia o Evento veicular (E8-L08 é causação de R5/Event Store);
//   • NÃO agrega métricas/KPIs (INV-VO-05; DF-03); NÃO decide (item 16);
//   • NÃO é produzida por interface (INV-VO-03; DF-08) — construtor privado + fábrica.
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { OperationalTruthId } from './operational-truth-id.js';
import type { OperationalTruthMissionRef, SynthesisResponsibleRef } from './refs.js';
import { ChainJustification, DeclaredUncertainty } from './value-objects.js';
import { OperationalTruthSynthesized } from './operational-truth-events.js';

/** Entrada de síntese da Verdade Operacional (Entidade 07; E8; itens 1/7/14). */
export interface OperationalTruthSynthesisInput {
  readonly id: OperationalTruthId;
  readonly mission: OperationalTruthMissionRef; // exatamente uma (Lei 2; item 1)
  readonly chainJustification: string; // cadeia demonstrável (INV-E8-02; E8-L06)
  readonly declaredUncertainty?: string; // opcional — incerteza declarada (INV-E8-07)
  readonly synthesizedAt: Date; // datação (E8-L03)
  readonly synthesizedBy: SynthesisResponsibleRef; // responsável (INV-E8-06; DF-09; Art. 14º)
}

interface OperationalTruthProps {
  readonly id: OperationalTruthId;
  readonly mission: OperationalTruthMissionRef;
  readonly chainJustification: ChainJustification;
  readonly declaredUncertainty: DeclaredUncertainty | null;
  readonly synthesizedAt: Date;
  readonly synthesizedBy: SynthesisResponsibleRef;
}

const TRACE_ID = 'VO-RASTREABILIDADE';
const TRACE_REF = 'INV-E8-06; DF-09; DF-13; Art. 14º; E8-L03 (datação)';
const MISSION_ID = 'VO-POR-MISSAO';
const MISSION_REF = 'Entidade 07, item 1; Lei 2; INV-VO-01';

export class OperationalTruthAggregate extends AggregateRoot<OperationalTruthId> {
  private constructor(private readonly props: OperationalTruthProps) {
    super(props.id);
  }

  /**
   * Materializa o RESULTADO de uma síntese já realizada conforme R5 (a Verdade
   * nasce por síntese — E8). NÃO executa R5 nem avalia legitimidade: assembla o
   * snapshot imutável e valida sua boa-formação estrutural.
   */
  static synthesize(
    input: OperationalTruthSynthesisInput,
  ): Result<OperationalTruthAggregate, CanonViolationError> {
    // Por missão — a Verdade é calculada para exatamente uma Missão (Lei 2; item 1).
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'A Verdade Operacional é calculada por Missão; a Missão é obrigatória (Lei 2).',
        }),
      );
    }
    // Rastreabilidade da síntese — responsável e datação (INV-E8-06; DF-09; Art. 14º).
    if (input.synthesizedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Síntese sem responsável identificado (INV-E8-06; DF-09; Art. 14º).',
        }),
      );
    }
    if (!(input.synthesizedAt instanceof Date) || Number.isNaN(input.synthesizedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: TRACE_ID,
          canonReference: TRACE_REF,
          message: 'Síntese sem datação válida (E8-L03; Art. 14º).',
        }),
      );
    }
    // Cadeia demonstrável — justificativa presente (INV-E8-02; E8-L06).
    const chainJustification = ChainJustification.create(input.chainJustification);
    if (chainJustification.isErr()) {
      return Result.err(chainJustification.unwrapErr());
    }
    // Incerteza declarada — OPCIONAL; quando presente, substantiva (INV-E8-07).
    let declaredUncertainty: DeclaredUncertainty | null = null;
    if (input.declaredUncertainty !== undefined) {
      const parsed = DeclaredUncertainty.create(input.declaredUncertainty);
      if (parsed.isErr()) {
        return Result.err(parsed.unwrapErr());
      }
      declaredUncertainty = parsed.unwrap();
    }

    const truth = new OperationalTruthAggregate({
      id: input.id,
      mission: input.mission,
      chainJustification: chainJustification.unwrap(),
      declaredUncertainty,
      synthesizedAt: new Date(input.synthesizedAt.getTime()),
      synthesizedBy: input.synthesizedBy,
    });

    truth.addDomainEvent(
      new OperationalTruthSynthesized(input.id.toString(), truth.props.synthesizedAt),
    );
    return Result.ok(truth);
  }

  // Acessores imutáveis. Nenhum estado operacional, "vigência" mutável, conteúdo de
  // Estado/Etapa, agregação/KPI, decisão ou execução de síntese (INV-VO-03/05; item 12/16).
  get mission(): OperationalTruthMissionRef {
    return this.props.mission;
  }
  get chainJustification(): ChainJustification {
    return this.props.chainJustification;
  }
  /** Incerteza declarada; null quando não há incerteza (INV-E8-07; opcional). */
  get declaredUncertainty(): DeclaredUncertainty | null {
    return this.props.declaredUncertainty;
  }
  get synthesizedAt(): Date {
    return new Date(this.props.synthesizedAt.getTime());
  }
  get synthesizedBy(): SynthesisResponsibleRef {
    return this.props.synthesizedBy;
  }
}
