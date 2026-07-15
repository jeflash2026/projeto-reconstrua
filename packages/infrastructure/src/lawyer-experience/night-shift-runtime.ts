// ─────────────────────────────────────────────────────────────────────────────
// PREPARAÇÃO NOTURNA — durante a madrugada (cron do dono), a AHRI prepara o dia:
// varre os processos de cada advogado ativo, ABRE os pontos de decisão que
// dependem dele (parar/explicar/contextualizar/fundamentar/aguardar), destaca
// riscos (prazos) e deixa a fila pronta. DETERMINÍSTICA; toda parada tem
// fundamento; nada jurídico é decidido — só preparado.
// ─────────────────────────────────────────────────────────────────────────────
import type { AssembledAdvogadoOperation } from '../advogado-portal/build-advogado-operation.js';
import type { DecisionGateRuntime, ProductivityRuntime } from '@reconstrua/application';

export interface NightShiftReport {
  readonly ranAt: Date;
  readonly advogados: number;
  readonly missionsPrepared: number;
  readonly decisionsOpened: number;
  readonly risksHighlighted: number;
}

export class NightShiftRuntime {
  constructor(
    private readonly op: AssembledAdvogadoOperation,
    private readonly gate: DecisionGateRuntime,
    private readonly productivity: ProductivityRuntime,
  ) {}

  async run(now: Date): Promise<NightShiftReport> {
    await this.op.projector.refresh();
    const advogados = (await this.op.staff.list('advogado')).filter((m) => m.active);

    let missionsPrepared = 0;
    let decisionsOpened = 0;
    let risksHighlighted = 0;

    for (const advogado of advogados) {
      const assignments = await this.op.work.myMissions(advogado.id);
      for (const assignment of assignments) {
        missionsPrepared += 1;
        const missionId = assignment.missionId;
        const entries = await this.op.work.missionEntries(advogado.id, missionId);
        const docs = this.op.projector.allDocuments().filter((d) => d.missionId === missionId);

        // 1) Documentação presente e distribuição ainda não marcada → PARAR e pedir
        //    confirmação (o marco é do advogado; a AHRI só prepara).
        const hasDistribuicao = entries.some((e) => e.kind === 'distribuicao');
        if (docs.length > 0 && !hasDistribuicao) {
          const opened = await this.gate.open({
            advogadoId: advogado.id,
            missionId,
            type: 'confirm_distribution',
            explanation:
              'A documentação reconhecida está presente e não há marco de distribuição. A AHRI parou aqui: marcar distribuição é competência sua.',
            context: docs.map((d) => `documento reconhecido: ${d.contentReference ?? d.documentId} (${d.recognizedAt.toISOString()})`),
            fundamento: 'DF-09; INV-AD — marco jurídico é do advogado; RO-R7-001 (parada legítima)',
          });
          if (opened.createdAt.getTime() === now.getTime() || opened.status === 'open') decisionsOpened += 1;
        }

        // 2) Prazo vencido → PARAR para análise jurídica (nunca decidir por ele).
        const overdue = entries.filter((e) => e.kind === 'prazo' && !e.done && e.dueAt !== null && e.dueAt.getTime() < now.getTime());
        for (const prazo of overdue) {
          risksHighlighted += 1;
          await this.gate.open({
            advogadoId: advogado.id,
            missionId,
            type: 'juridical_review',
            explanation: `O prazo "${prazo.text}" venceu. A AHRI parou aqui: a providência é análise jurídica sua.`,
            context: [`prazo registrado por você em ${prazo.createdAt.toISOString()}`, `vencimento: ${prazo.dueAt?.toISOString() ?? ''}`],
            fundamento: 'DF-09; INV-AD — estratégia processual é humana; RO-R7-001',
          });
          decisionsOpened += 1;
        }
      }
      await this.productivity.record(advogado.id, 'relevant_changes', assignments.length, now);
    }

    this.op.observability.event('night-shift', 'run', now, `decisões abertas: ${String(decisionsOpened)}`);
    return { ranAt: now, advogados: advogados.length, missionsPrepared, decisionsOpened, risksHighlighted };
  }
}
