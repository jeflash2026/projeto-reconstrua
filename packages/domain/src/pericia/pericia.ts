// ─────────────────────────────────────────────────────────────────────────────
// PericiaAggregate — agregado da Entidade 13 (PERÍCIA). Deriva EXCLUSIVAMENTE do
// Livro Mestre (Entidade 13; DF-17; DF-10; DF-09; Lei 2; Art. 11º/14º; e o gênero
// Etapa Operacional 09, do qual a Perícia é espécie).
//
// O que esta entidade FAZ (e só isto):
//   • MATERIALIZA a EXISTÊNCIA da fase pericial como etapa especializada da missão
//     — fábrica `frame` (enquadrar a fase técnica — item 5/16), emite PericiaFramed;
//   • vincula a etapa à Missão (INV-PE-03; item 11) e à Etapa Operacional (09) que
//     especializa (INV-PE-01; item 3 — "espécie de Etapa");
//   • aponta o Perito responsável pela condução técnica, por identidade (itens 18/19);
//   • é datada (quando a fase pericial se instala — item 7; auditabilidade).
//
// O que esta entidade NÃO faz (por fidelidade ao Canon e às restrições do fundador):
//   • NÃO executa perícia nem produz a prova (item 16; DF-10 — isso é do PERITO);
//   • NÃO é o PERITO nem se confunde com ele (INV-PE-01/02; item 13) — é etapa, não papel;
//   • NÃO cria Verdade (item 16; a Verdade nasce do Conhecimento — E8);
//   • NÃO altera o Estado (é espécie de Etapa; a Etapa jamais altera o Estado —
//     INV-ET-02; a mudança é R6/Evento Relevante);
//   • NÃO decide juridicamente (item 17; DF-09); NÃO interpreta automaticamente;
//   • NÃO executa R6 (evolução) — só enquadra o marco;
//   • NÃO modela a coleção de documentos/eventos periciais (item 12 "pode possuir…
//     referenciados" — relação opcional/workflow, fora); NÃO antecipa PERITO(16).
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { CanonViolationError } from '../kernel/errors/canon-violation-error.js';
import type { PericiaId } from './pericia-id.js';
import type { PericiaMissionRef, SpecializedStageRef, PericiaPeritoRef } from './refs.js';
import { PericiaFramed } from './pericia-events.js';

/** Entrada de enquadramento da Perícia (Entidade 13; itens 3/7/11/18/19). */
export interface PericiaFramingInput {
  readonly id: PericiaId;
  readonly mission: PericiaMissionRef; // etapa de exatamente uma Missão (INV-PE-03)
  readonly specializedStage: SpecializedStageRef; // Etapa (09) que especializa (INV-PE-01)
  readonly perito: PericiaPeritoRef; // perito responsável — nominal (itens 18/19)
  readonly framedAt: Date; // quando a fase pericial se instala (item 7)
}

interface PericiaProps {
  readonly id: PericiaId;
  readonly mission: PericiaMissionRef;
  readonly specializedStage: SpecializedStageRef;
  readonly perito: PericiaPeritoRef;
  readonly framedAt: Date;
}

const MISSION_ID = 'PE-DE-MISSAO';
const MISSION_REF = 'Entidade 13; item 11/22; INV-PE-03; Lei 2';
const STAGE_ID = 'PE-ESPECIALIZA-ETAPA';
const STAGE_REF = 'Entidade 13; item 3/11/22; INV-PE-01; DF-17';
const PERITO_ID = 'PE-PERITO-RESPONSAVEL';
const PERITO_REF = 'Entidade 13; itens 18/19; DF-10';
const DATE_ID = 'PE-DATADA';
const DATE_REF = 'Entidade 13, item 7; Art. 14º';

export class PericiaAggregate extends AggregateRoot<PericiaId> {
  private constructor(private readonly props: PericiaProps) {
    super(props.id);
  }

  /**
   * Enquadra a fase pericial como etapa especializada da missão (item 5/16). NÃO
   * executa a perícia nem produz a prova: assembla o marco imutável e valida sua
   * boa-formação (missão, etapa especializada, perito responsável, datação).
   */
  static frame(input: PericiaFramingInput): Result<PericiaAggregate, CanonViolationError> {
    // INV-PE-03 (parcial) — etapa de exatamente uma Missão.
    if (input.mission == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: MISSION_ID,
          canonReference: MISSION_REF,
          message: 'A Perícia é etapa de uma Missão; a Missão é obrigatória (INV-PE-03; não existe perícia sem missão).',
        }),
      );
    }
    // INV-PE-01 — é etapa: especializa uma Etapa Operacional (09).
    if (input.specializedStage == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: STAGE_ID,
          canonReference: STAGE_REF,
          message: 'A Perícia é espécie de Etapa Operacional; a Etapa especializada é obrigatória (INV-PE-01).',
        }),
      );
    }
    // Perito responsável — bem enquadrada (item 19); nominal, distinto da entidade PERITO (INV-PE-02).
    if (input.perito == null) {
      return Result.err(
        new CanonViolationError({
          invariantId: PERITO_ID,
          canonReference: PERITO_REF,
          message: 'Perícia sem perito responsável identificado (item 19).',
        }),
      );
    }
    // Datação — quando a fase se instala (item 7; Art. 14º).
    if (!(input.framedAt instanceof Date) || Number.isNaN(input.framedAt.getTime())) {
      return Result.err(
        new CanonViolationError({
          invariantId: DATE_ID,
          canonReference: DATE_REF,
          message: 'Perícia enquadrada sem datação válida (item 7; Art. 14º).',
        }),
      );
    }

    const pericia = new PericiaAggregate({
      id: input.id,
      mission: input.mission,
      specializedStage: input.specializedStage,
      perito: input.perito,
      framedAt: new Date(input.framedAt.getTime()),
    });

    pericia.addDomainEvent(new PericiaFramed(input.id.toString(), pericia.props.framedAt));
    return Result.ok(pericia);
  }

  // Acessores imutáveis. Nenhuma produção de prova, decisão, interpretação, papel
  // humano ou alteração de Estado/Verdade (INV-PE-01/02; itens 16/17).
  get mission(): PericiaMissionRef {
    return this.props.mission;
  }
  /** A Etapa Operacional (09) que esta Perícia especializa (INV-PE-01; item 3). */
  get specializedStage(): SpecializedStageRef {
    return this.props.specializedStage;
  }
  /** Identidade do perito responsável — NÃO a entidade PERITO (16); a Perícia é etapa (INV-PE-02). */
  get perito(): PericiaPeritoRef {
    return this.props.perito;
  }
  get framedAt(): Date {
    return new Date(this.props.framedAt.getTime());
  }
}
