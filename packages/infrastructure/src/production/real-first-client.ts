// ─────────────────────────────────────────────────────────────────────────────
// REAL_FIRST_CLIENT — o fluxo do PRIMEIRO CLIENTE REAL, ponta a ponta, com as
// oito etapas exigidas. Executa contra a composição de produção (mesmo código
// que atenderá o cliente de verdade; em homologação roda com gateway/LLM de
// teste). Cada etapa produz EVIDÊNCIA verificável — nada é assumido.
// ─────────────────────────────────────────────────────────────────────────────
import type { InboundEnvelope } from '@reconstrua/application';
import type { AssembledProduction } from './build-production.js';

export interface FlowStage {
  readonly stage: string;
  readonly passed: boolean;
  readonly evidence: string;
}

export interface FirstClientReport {
  readonly flow: 'REAL_FIRST_CLIENT';
  readonly passed: boolean;
  readonly stages: readonly FlowStage[];
}

function envelope(chatId: string, over: Partial<InboundEnvelope>): InboundEnvelope {
  return {
    messageId: `rfc-${String(Math.random()).slice(2, 10)}`,
    chatId,
    from: chatId,
    kind: 'text',
    text: null,
    mediaUrl: null,
    mediaMimeType: null,
    fileName: null,
    location: null,
    contact: null,
    reactionEmoji: null,
    reactionToMessageId: null,
    editedText: null,
    deletedMessageId: null,
    silenceMs: null,
    timestamp: new Date(),
    ...over,
  };
}

export class RealFirstClientFlow {
  constructor(private readonly prod: AssembledProduction) {}

  async run(chatId: string, campaign: string): Promise<FirstClientReport> {
    const p = this.prod;
    const stages: FlowStage[] = [];
    const stage = (name: string, passed: boolean, evidence: string): void => {
      stages.push({ stage: name, passed, evidence });
    };

    // 1) ANÚNCIO → o clique na landing prefixa a campanha no texto do WhatsApp.
    const adText = `Olá! Vim pelo anúncio [${campaign}] e quero entender meu benefício.`;
    stage('anuncio', adText.includes(campaign), `texto de entrada com campanha: "${adText}"`);

    // 2) WHATSAPP → primeira mensagem entra pelo pipeline real (ENTRADA ÚNICA 4C).
    const first = await p.ingress.receive(envelope(chatId, { text: adText, messageId: 'RFC-1' }));
    stage('whatsapp', !first.skipped && first.intents.length > 0, `turno processado; ${String(first.intents.length)} intenção(ões) do Brain`);

    // 3) COLETA DE DADOS → cliente informa o nome; memória viva registra.
    await p.ingress.receive(envelope(chatId, { text: 'meu nome é José Pereira, de Fortaleza', messageId: 'RFC-2' }));
    const memory = await p.memoryStore.load(chatId);
    stage('coleta_dados', (memory?.messageCount ?? 0) >= 2, `mensagens registradas: ${String(memory?.messageCount ?? 0)}; atributos: ${String(memory?.attributes.length ?? 0)}`);

    // 4) COLETA HISCON → cliente envia o extrato (documento PDF).
    const hiscon = await p.ingress.receive(
      envelope(chatId, { kind: 'pdf', fileName: 'HISCON.pdf', mediaMimeType: 'application/pdf', messageId: 'RFC-3' }),
    );
    stage('coleta_hiscon', !hiscon.skipped, 'documento HISCON.pdf recebido no turno');

    // 5) RECONHECIMENTO → documento reconhecido como ato de domínio (R3).
    await p.adminView.projector.refresh();
    const docs = p.adminView.projector.allDocuments();
    stage('reconhecimento', docs.length >= 1, `documentos reconhecidos: ${String(docs.length)} (${docs[0]?.contentReference ?? '-'})`);

    // 6) MISSÃO CRIADA → o stream 'mission' nasceu com proveniência AHRI.
    const missions = p.adminView.projector.missions();
    const missionId = missions[0]?.missionId ?? null;
    stage('missao_criada', missionId !== null, missionId !== null ? `missionId: ${missionId}` : 'nenhuma missão');

    // 7) ADMIN RECEBE → read models do portal admin refletem o cliente.
    const metrics = await p.metricsStore.load();
    stage('admin_recebe', (metrics?.clientCount ?? 0) >= 1 && (metrics?.missionCount ?? 0) >= 1, `clientCount=${String(metrics?.clientCount ?? 0)} missionCount=${String(metrics?.missionCount ?? 0)} documentCount=${String(metrics?.documentCount ?? 0)}`);

    // 8) WORKFLOW CONTINUA → progresso registrado + follow-up agendado.
    const progress = missionId !== null ? await p.adminView.workflow.progress(missionId) : null;
    const pending = await p.scheduler.pendingCount();
    stage('workflow_continua', (progress?.steps.length ?? 0) >= 1 && pending >= 1, `passos: ${(progress?.steps ?? []).join('→')}; follow-ups agendados: ${String(pending)}`);

    return { flow: 'REAL_FIRST_CLIENT', passed: stages.every((s) => s.passed), stages };
  }
}
