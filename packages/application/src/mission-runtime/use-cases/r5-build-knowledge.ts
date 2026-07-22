// ─────────────────────────────────────────────────────────────────────────────
// R5 — CONSTRUIR CONHECIMENTO. O "conhecimento" da missão são as estruturas Caso
// (05) e Processo (06). Executa `CaseAggregate.recognize` e `ProcessAggregate.recognize`
// (Processo decorre do Caso). Persiste CaseRecognized + ProcessRecognized. Idempotente
// por conversa (uma vez construído o conhecimento base, pula).
// ─────────────────────────────────────────────────────────────────────────────
import {
  CaseAggregate,
  CaseId,
  CaseMissionRef,
  CaseResponsibleRef,
  ProcessAggregate,
  ProcessCaseRef,
  ProcessId,
  ProcessMissionRef,
  ProcessResponsibleRef,
} from '@reconstrua/domain';
import { foundedProvenance } from '../provenance.js';
import { failedOutcome, skippedOutcome, type UseCaseOutcome } from '../types.js';
import {
  persistNew,
  type MissionContext,
  type MissionUseCase,
  type UseCaseDeps,
} from '../use-case.js';

export class BuildKnowledgeUseCase implements MissionUseCase {
  readonly name = 'BuildKnowledge';
  readonly streamType = 'case';
  constructor(private readonly deps: UseCaseDeps) {}

  async execute(ctx: MissionContext): Promise<UseCaseOutcome> {
    if (ctx.identity.missionId === null) {
      return failedOutcome(this.name, this.streamType, 'pré-condição ausente: Missão (INV-CA-01)');
    }
    if (ctx.identity.caseId !== null) {
      return skippedOutcome(this.name, this.streamType, ctx.identity.caseId, {
        caseId: ctx.identity.caseId,
        processId: ctx.identity.processId,
      });
    }

    const caseId = this.deps.uuid.next();
    const caseResult = CaseAggregate.recognize({
      id: CaseId.fromUuid(caseId),
      mission: CaseMissionRef.fromString(ctx.identity.missionId),
      legalContext: 'Contexto operacional da missão em construção a partir dos documentos.',
      legalFoundation: 'Fundamento a apurar com base nas evidências reconhecidas.',
      recognizedAt: ctx.now,
      recognizedBy: CaseResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
    });
    if (caseResult.isErr())
      return failedOutcome(this.name, this.streamType, caseResult.unwrapErr().message);
    const caseAppend = await persistNew(
      this.deps.appender,
      'case',
      caseId,
      caseResult.unwrap(),
      true,
      foundedProvenance(ctx.intent, ctx.identity.missionId),
      { missionId: ctx.identity.missionId },
    );

    const processId = this.deps.uuid.next();
    const processResult = ProcessAggregate.recognize({
      id: ProcessId.fromUuid(processId),
      mission: ProcessMissionRef.fromString(ctx.identity.missionId),
      legalFoundation: 'Fundamento processual a apurar a partir do Caso.',
      derivesFromCase: ProcessCaseRef.fromString(caseId),
      recognizedAt: ctx.now,
      recognizedBy: ProcessResponsibleRef.fromString(this.deps.config.ahriResponsibleId),
    });
    if (processResult.isErr())
      return failedOutcome(this.name, 'process', processResult.unwrapErr().message);
    const processAppend = await persistNew(
      this.deps.appender,
      'process',
      processId,
      processResult.unwrap(),
      true,
      foundedProvenance(ctx.intent, caseId),
      { missionId: ctx.identity.missionId, caseId },
    );

    return {
      useCase: this.name,
      ok: true,
      skipped: false,
      streamType: 'case',
      streamId: caseId,
      appended: caseAppend.events.length + processAppend.events.length,
      eventTypes: [
        ...caseAppend.events.map((e) => e.eventType),
        ...processAppend.events.map((e) => e.eventType),
      ],
      identityPatch: { caseId, processId },
      error: null,
    };
  }
}
