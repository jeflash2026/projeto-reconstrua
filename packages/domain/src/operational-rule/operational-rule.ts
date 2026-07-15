// ─────────────────────────────────────────────────────────────────────────────
// OperationalRuleAggregate — agregado da Entidade 12 (REGRA OPERACIONAL). Deriva
// EXCLUSIVAMENTE do Livro Mestre (Entidade 12; DF-13; DF-09; Lei 4; Lei Geral das
// RO; OPERATIONAL_STANDARD; Volume 03 R1–R9 como contexto, não como execução).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a EXISTÊNCIA de uma Regra Operacional aprovada — fábrica
//     `approve`, emite OperationalRuleApproved (DF-13; item 1/7);
//   • guarda, de forma imutável, os DEZ ELEMENTOS da DF-13 (INV-RO-01) como DADOS;
//   • guarda o fundamento superior citado no Canon (item 11/19; INV-RO-02);
//   • é datada/aprovada por responsável (auditabilidade — Lei 4; Art. 14º).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO EXECUTA a regra — NÃO avalia critério de execução/bloqueio, NÃO dispara
//     eventos, NÃO roda R1–R9 (a execução é da automação/AHRI, fora daqui);
//   • NÃO decide (item 4/16; DF-09) — "nunca decisão humana";
//   • NÃO altera Verdade nem Estado (não os conhece) — sem mutadores;
//   • NÃO verifica semanticamente a não-contradição com o Canon (Governança/G3) —
//     apenas exige o fundamento citado (INV-RO-02 é cross-entity);
//   • NÃO implementa workflow de versionamento (a versão é um campo, não um fluxo);
//   • NÃO referencia AHRI(14)/OPERAÇÃO(11)/EVENTO(04) por identidade — eventos de
//     entrada/saída são descritores de tipo; responsável é ponteiro genérico.
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { OperationalRuleId } from './operational-rule-id.js';
import type { ApprovalResponsibleRef } from './refs.js';
import { RuleCode, RuleDefinition, RuleVersion, CanonFoundation } from './value-objects.js';
import type { RuleDefinitionFields } from './value-objects.js';
import { OperationalRuleApproved } from './operational-rule-events.js';

/** Entrada de aprovação da Regra Operacional — os dez elementos da DF-13 + fundamento. */
export interface OperationalRuleApprovalInput {
  readonly id: OperationalRuleId;
  readonly code: string; // elemento 1 (identificador único RO-Rn-NNN)
  readonly definition: RuleDefinitionFields; // elementos 2–8
  readonly approvedBy: ApprovalResponsibleRef; // elemento 9 (responsável pela aprovação)
  readonly version: string; // elemento 10 (histórico de versões)
  readonly canonFoundation: string; // fundamento superior citado (item 11/19; INV-RO-02)
  readonly approvedAt: Date; // datação (auditabilidade)
}

interface OperationalRuleProps {
  readonly id: OperationalRuleId;
  readonly code: RuleCode;
  readonly definition: RuleDefinition;
  readonly approvedBy: ApprovalResponsibleRef;
  readonly version: RuleVersion;
  readonly canonFoundation: CanonFoundation;
  readonly approvedAt: Date;
}

const APPROVAL_ID = 'INV-RO-01';
const APPROVAL_REF = 'Entidade 12; DF-13 (elemento 9: responsável pela aprovação)';
const AUDIT_ID = 'RO-AUDITAVEL';
const AUDIT_REF = 'Entidade 12; Lei 4; Art. 14º';

export class OperationalRuleAggregate extends AggregateRoot<OperationalRuleId> {
  private constructor(private readonly props: OperationalRuleProps) {
    super(props.id);
  }

  /**
   * Materializa a existência de uma Regra Operacional aprovada (DF-13). NÃO executa
   * a regra: assembla o registro imutável dos dez elementos + fundamento e valida
   * sua boa-formação.
   */
  static approve(
    input: OperationalRuleApprovalInput,
  ): Result<OperationalRuleAggregate, CanonViolationError> {
    // INV-RO-01 (elemento 1) — identificador único.
    const code = RuleCode.create(input.code);
    if (code.isErr()) {
      return Result.err(code.unwrapErr());
    }
    // INV-RO-01 (elementos 2–8) — definição completa.
    const definition = RuleDefinition.create(input.definition);
    if (definition.isErr()) {
      return Result.err(definition.unwrapErr());
    }
    // INV-RO-01 (elemento 9) — responsável pela aprovação.
    if (input.approvedBy == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: APPROVAL_ID,
          canonReference: APPROVAL_REF,
          message: 'Regra Operacional sem responsável pela aprovação (DF-13, elemento 9).',
        }),
      );
    }
    // INV-RO-01 (elemento 10) — histórico de versões.
    const version = RuleVersion.create(input.version);
    if (version.isErr()) {
      return Result.err(version.unwrapErr());
    }
    // INV-RO-02 — fundamento superior citado (item 11/19).
    const canonFoundation = CanonFoundation.create(input.canonFoundation);
    if (canonFoundation.isErr()) {
      return Result.err(canonFoundation.unwrapErr());
    }
    // Auditabilidade — datação válida (Lei 4; Art. 14º).
    if (!(input.approvedAt instanceof Date) || Number.isNaN(input.approvedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUDIT_ID,
          canonReference: AUDIT_REF,
          message: 'Regra Operacional sem datação de aprovação válida (Lei 4; Art. 14º).',
        }),
      );
    }

    const rule = new OperationalRuleAggregate({
      id: input.id,
      code: code.unwrap(),
      definition: definition.unwrap(),
      approvedBy: input.approvedBy,
      version: version.unwrap(),
      canonFoundation: canonFoundation.unwrap(),
      approvedAt: new Date(input.approvedAt.getTime()),
    });

    rule.addDomainEvent(new OperationalRuleApproved(input.id.toString(), rule.props.approvedAt));
    return Result.ok(rule);
  }

  /** Verdadeiro se os dez elementos da DF-13 estão presentes (INV-RO-01). */
  hasTenElements(): boolean {
    const d = this.props.definition;
    return (
      this.props.code.value.length > 0 &&
      d.name.length > 0 &&
      d.objective.length > 0 &&
      d.executionCriterion.length > 0 &&
      d.blockingCriterion.length > 0 &&
      d.inputEvent.length > 0 &&
      d.outputEvent.length > 0 &&
      d.producedEvidence.length > 0 &&
      this.props.approvedBy != null &&
      this.props.version.value.length > 0
    );
  }

  // Acessores imutáveis. Nenhum executor de critério, disparo de evento, decisão ou
  // mutador de Verdade/Estado (item 4/16; INV-RO-02).
  get code(): RuleCode {
    return this.props.code;
  }
  get definition(): RuleDefinition {
    return this.props.definition;
  }
  get approvedBy(): ApprovalResponsibleRef {
    return this.props.approvedBy;
  }
  get version(): RuleVersion {
    return this.props.version;
  }
  get canonFoundation(): CanonFoundation {
    return this.props.canonFoundation;
  }
  get approvedAt(): Date {
    return new Date(this.props.approvedAt.getTime());
  }
}
