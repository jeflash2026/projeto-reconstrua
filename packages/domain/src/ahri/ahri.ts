// ─────────────────────────────────────────────────────────────────────────────
// AhriAggregate — agregado da Entidade 14 (AHRI). Deriva EXCLUSIVAMENTE do Livro
// Mestre (Entidade 14; DF-09; DF-13; Art. 13º/15º; E9-L06; E10; R7/R8 como
// contexto — não execução; Lei 4).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a assunção de responsabilidade OPERACIONAL de uma missão pela
//     AHRI — fábrica `assumeOperationalResponsibility`, emite
//     AhriOperationalResponsibilityAssumed (DF-09);
//   • referencia a Regra Operacional (12) que fundamenta a atuação (INV-AH-02);
//   • guarda o registro DF-09 (DECISOR: AHRI / TIPO: Decisão Operacional
//     Automatizada / FUNDAMENTO citado) — item 14; INV-AH-02;
//   • é datada e auditável (Lei 4; Art. 14º).
//
// O que esta entidade NÃO faz (salvaguarda IA×humano — estrutural; DF-09):
//   • NÃO decide (final, jurídica ou de qualquer natureza) — INV-AH-01/03; SEM método;
//   • NÃO pratica ato privativo de advogado/perito, NÃO assina, NÃO emite parecer — INV-AH-03;
//   • NÃO cria Realidade/Evidência/Documento/Evento/Conhecimento/Verdade/Fato — INV-AH-04;
//   • NÃO executa comportamento cognitivo (E9), NÃO raciocina, NÃO declara incerteza
//     (E10) — isso é de outra camada; a entidade só registra a assunção;
//   • NÃO atua sob R7/R8, NÃO aciona papéis humanos (OPERAÇÃO/R7 — recomendação R1);
//   • NÃO referencia SUPERVISOR nem papéis (relação de interação, fora).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { AhriId } from './ahri-id.js';
import type { AhriMissionRef, GoverningRuleRef } from './refs.js';
import { AutomatedDecisionRecord } from './value-objects.js';
import { AhriOperationalResponsibilityAssumed } from './ahri-events.js';

/** Entrada de assunção de responsabilidade operacional pela AHRI (Entidade 14; DF-09). */
export interface AhriResponsibilityInput {
  readonly id: AhriId;
  readonly mission: AhriMissionRef; // missão da responsabilidade operacional (item 12)
  readonly governingRule: GoverningRuleRef; // Regra Operacional (12) que fundamenta (INV-AH-02)
  readonly fundamento: string; // FUNDAMENTO do registro DF-09 (Regra Constitucional + RO)
  readonly assumedAt: Date; // datação (auditabilidade)
}

interface AhriProps {
  readonly id: AhriId;
  readonly mission: AhriMissionRef;
  readonly governingRule: GoverningRuleRef;
  readonly record: AutomatedDecisionRecord;
  readonly assumedAt: Date;
}

const MISSION_ID = 'AH-DE-MISSAO';
const MISSION_REF = 'Entidade 14; item 12; DF-09';
const RULE_ID = 'INV-AH-02';
const RULE_REF = 'Entidade 14; INV-AH-02; item 11; DF-09; DF-13';
const AUDIT_ID = 'AH-AUDITAVEL';
const AUDIT_REF = 'Entidade 14; Lei 4; Art. 14º';

export class AhriAggregate extends AggregateRoot<AhriId> {
  private constructor(private readonly props: AhriProps) {
    super(props.id);
  }

  /**
   * Registra a assunção de responsabilidade operacional de uma missão pela AHRI
   * (DF-09). NÃO executa comportamento cognitivo nem decide: assembla o marco
   * imutável (missão + Regra Operacional + registro DF-09) e valida a boa-formação.
   */
  static assumeOperationalResponsibility(
    input: AhriResponsibilityInput,
  ): Result<AhriAggregate, CanonViolationError> {
    // item 12 — responsabilidade operacional de exatamente uma Missão.
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message:
            'A AHRI assume responsabilidade operacional de uma Missão; a Missão é obrigatória (item 12).',
        }),
      );
    }
    // INV-AH-02 — a atuação referencia uma Regra Operacional.
    if (input.governingRule == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: RULE_ID,
          canonReference: RULE_REF,
          message:
            'Toda atuação da AHRI referencia ao menos uma Regra Operacional (INV-AH-02; DF-09).',
        }),
      );
    }
    // INV-AH-02 — registro DECISOR/TIPO/FUNDAMENTO (DF-09).
    const record = AutomatedDecisionRecord.create(input.fundamento);
    if (record.isErr()) {
      return Result.err(record.unwrapErr());
    }
    // Auditabilidade — datação válida (Lei 4; Art. 14º).
    if (!(input.assumedAt instanceof Date) || Number.isNaN(input.assumedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: AUDIT_ID,
          canonReference: AUDIT_REF,
          message: 'Assunção de responsabilidade da AHRI sem datação válida (Lei 4; Art. 14º).',
        }),
      );
    }

    const ahri = new AhriAggregate({
      id: input.id,
      mission: input.mission,
      governingRule: input.governingRule,
      record: record.unwrap(),
      assumedAt: new Date(input.assumedAt.getTime()),
    });

    ahri.addDomainEvent(
      new AhriOperationalResponsibilityAssumed(input.id.toString(), ahri.props.assumedAt),
    );
    return Result.ok(ahri);
  }

  // Acessores imutáveis. NENHUM método de decisão (final/jurídica), ato privativo,
  // assinatura, parecer ou criação de fato/verdade (INV-AH-01/03/04; DF-09).
  get mission(): AhriMissionRef {
    return this.props.mission;
  }
  get governingRule(): GoverningRuleRef {
    return this.props.governingRule;
  }
  get record(): AutomatedDecisionRecord {
    return this.props.record;
  }
  get assumedAt(): Date {
    return new Date(this.props.assumedAt.getTime());
  }
}
