// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT ARRIVAL SUBSCRIBER (15C-3 · Parte 2) — ASSOCIAÇÃO INTELIGENTE.
// Observa os eventos do stream 'document' (o Reader/Mission Runtime reconheceu
// um documento) e associa à solicitação complementar do MESMO CASO (Decisão 5:
// payload.missionId === caseId):
//   • 1 aberta  ⇒ associação AUTOMÁTICA (comoAssociado=unica);
//   • várias    ⇒ Document Intelligence (nome do arquivo × documentName);
//                 exatamente UMA casa ⇒ associa (comoAssociado=ia);
//   • dúvida    ⇒ AWAITING_CONFIRMATION + a AHRI PERGUNTA ao cliente —
//                 received só após confirmação.
// Falha ISOLADA: nunca derruba o processamento do documento (padrão 11D).
// Nenhuma lógica de domínio duplicada: todas as transições são do aggregate.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { DocumentRequestState } from '@reconstrua/domain';
import type {
  ConversationGateway,
  DocumentRequestRuntime,
  DocumentRequestStore,
  EventSubscriber,
  ObservabilityRuntime,
  StoredEvent,
} from '@reconstrua/application';
import { perguntaDeConfirmacao } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

const ABERTAS = new Set(['PENDING', 'REOPENED']);

/** 15C-4 · Parte 1 — contexto da confirmação pendente (infra, efêmero): qual
 *  DocumentId aguarda a resposta do cliente. Nunca é verdade de domínio. */
export const NS_CONFIRMACOES = 'dr-confirmacoes';

/** Normaliza para comparação: minúsculas, sem acento, só letras/números. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** O arquivo "casa" com a solicitação? (todos os tokens do nome do documento
 *  aparecem no nome do arquivo — determinístico e auditável). */
export function arquivoCasaCom(fileName: string, documentName: string): boolean {
  const arquivo = normalizar(fileName);
  const tokens = normalizar(documentName)
    .split(' ')
    .filter((t) => t.length > 2);
  return tokens.length > 0 && tokens.every((t) => arquivo.includes(t));
}

export interface ArrivalDeps {
  readonly store: DocumentRequestStore;
  readonly runtime: DocumentRequestRuntime;
  readonly gateway: ConversationGateway | null; // pergunta de confirmação (best-effort)
  /** 15C-4: guarda o DocumentId que aguarda confirmação (p/ o resolver). */
  readonly confirmacoes?: JsonStore | null;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class DocumentArrivalSubscriber implements EventSubscriber {
  readonly name = 'document-request-arrival';
  // 13ª rodada: interestedIn é filtrado por event.eventType (não stream type).
  readonly interestedIn = ['document.recognized'];

  constructor(private readonly deps: ArrivalDeps) {}

  async handle(event: StoredEvent): Promise<void> {
    if (event.streamType !== 'document') return;
    const d = this.deps;
    const now = d.clock.now();
    try {
      const missionId =
        typeof event.payload['missionId'] === 'string' ? event.payload['missionId'] : null;
      if (missionId === null) return;
      const fileName =
        typeof event.payload['contentReference'] === 'string'
          ? event.payload['contentReference']
          : '';
      const documentId = event.streamId;

      const candidatas = (await d.store.doCaso(missionId)).filter((s) => ABERTAS.has(s.status));
      if (candidatas.length === 0) return; // sem pendência ⇒ Workflow 1 segue

      if (candidatas.length === 1) {
        const unica = candidatas[0] as DocumentRequestState;
        await d.runtime.associar(unica.requestId, documentId, 'unica', now);
        d.observability.event(
          'document-request',
          `associada unica=${unica.requestId} doc=${documentId}`,
          now,
        );
        return;
      }

      // Document Intelligence: o arquivo casa com exatamente UMA candidata?
      const casam = candidatas.filter((c) => arquivoCasaCom(fileName, c.documentName));
      if (casam.length === 1) {
        const alvo = casam[0] as DocumentRequestState;
        await d.runtime.associar(alvo.requestId, documentId, 'ia', now);
        d.observability.event(
          'document-request',
          `associada ia=${alvo.requestId} doc=${documentId} arquivo=${fileName}`,
          now,
        );
        return;
      }

      // DÚVIDA ⇒ AWAITING_CONFIRMATION + pergunta ao cliente (received só depois).
      for (const c of candidatas) await d.runtime.aguardarConfirmacao(c.requestId, now);
      const clientId = (candidatas[0] as DocumentRequestState).clientId;
      // 15C-4: registra QUAL documento aguarda a resposta (contexto do resolver).
      if (d.confirmacoes)
        await d.confirmacoes
          .put(NS_CONFIRMACOES, clientId, { documentId, askedAt: now.toISOString() })
          .catch(() => undefined);
      if (d.gateway !== null) {
        await d.gateway
          .sendText(clientId, perguntaDeConfirmacao(candidatas))
          .catch(() => undefined);
      }
      d.observability.event(
        'document-request',
        `confirmacao-pedida doc=${documentId} candidatas=${candidatas.length}`,
        now,
      );
    } catch (e) {
      // Falha isolada: o documento segue seu fluxo normal; só observamos.
      d.observability.error(
        'document-request',
        'arrival',
        now,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
