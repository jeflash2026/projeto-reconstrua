// ─────────────────────────────────────────────────────────────────────────────
// LAWYER NOTIFIER (15C-4 · Parte 3) — ENTREGA ao advogado:
//   received → NotificationChannel → WhatsApp → Advogado.
//
// • Canais por advogado (modelo NotificationChannel — Decisão 3 da arquitetura),
//   persistidos em JsonStore (namespace 'canais-notificacao').
// • Subscriber dos eventos 'document-request' (só received): DEDUP por
//   requestId+versão — reentrega do dispatcher nunca duplica a mensagem.
// • Registro de CADA tentativa: entregue | falhou | sem-canal (namespace
//   'dr-entregas') + observabilidade. Falhas ficam NA INFRAESTRUTURA — nenhuma
//   exceção chega ao domínio; o painel atualiza independentemente.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type {
  ConversationGateway,
  DocumentRequestStore,
  EventSubscriber,
  ObservabilityRuntime,
  StoredEvent,
} from '@reconstrua/application';
import { notificacaoAoAdvogado } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

export interface NotificationChannel {
  readonly tipo: 'whatsapp' | 'email';
  readonly endereco: string;
  readonly preferido: boolean;
  readonly verificadoEm: string | null;
}

const NS_CANAIS = 'canais-notificacao';
export const NS_ENTREGAS = 'dr-entregas';

/** Canais de notificação por advogado (JsonStore; Pg em produção). */
export class JsonNotificationChannelStore {
  constructor(private readonly json: JsonStore) {}
  async canaisDe(lawyerId: string): Promise<readonly NotificationChannel[]> {
    const raw = await this.json.get(NS_CANAIS, lawyerId);
    return Array.isArray(raw) ? (raw as NotificationChannel[]) : [];
  }
  async definir(lawyerId: string, canais: readonly NotificationChannel[]): Promise<void> {
    await this.json.put(NS_CANAIS, lawyerId, canais);
  }
}

export interface RegistroDeEntrega {
  readonly requestId: string;
  readonly resultado: 'entregue' | 'falhou' | 'sem-canal';
  readonly canal: string | null; // tipo:endereço-mascarado
  readonly tentativa: number;
  readonly em: string;
  readonly erro: string | null;
}

function mascarar(endereco: string): string {
  return endereco.length <= 4 ? '****' : `…${endereco.slice(-4)}`;
}

export interface NotifierDeps {
  readonly store: DocumentRequestStore;
  readonly canais: JsonNotificationChannelStore;
  readonly gateway: ConversationGateway | null;
  readonly entregas: JsonStore;
  readonly nomeDoCliente: ((chatId: string) => Promise<string | null>) | null;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class LawyerNotifierSubscriber implements EventSubscriber {
  readonly name = 'document-request-lawyer-notifier';
  // 13ª rodada: interestedIn é filtrado por event.eventType (não stream type).
  readonly interestedIn = ['document-request.received'];

  constructor(private readonly deps: NotifierDeps) {}

  async handle(event: StoredEvent): Promise<void> {
    if (event.streamType !== 'document-request' || event.eventType !== 'document-request.received')
      return;
    const d = this.deps;
    const now = d.clock.now();
    const dedupKey = `${event.streamId}:v${String(event.version)}`;
    try {
      // DEDUP: reentrega do mesmo evento nunca duplica a notificação.
      if ((await d.entregas.get(NS_ENTREGAS, dedupKey)) !== null) return;

      const state = await d.store.porId(event.streamId);
      if (state === null) return;

      const canais = await d.canais.canaisDe(state.lawyerId);
      const canal =
        canais.find((c) => c.tipo === 'whatsapp' && c.preferido) ??
        canais.find((c) => c.tipo === 'whatsapp') ??
        null;

      let registro: RegistroDeEntrega;
      if (canal === null || d.gateway === null) {
        registro = {
          requestId: state.requestId,
          resultado: 'sem-canal',
          canal: null,
          tentativa: 1,
          em: now.toISOString(),
          erro: null,
        };
      } else {
        const nome =
          d.nomeDoCliente !== null ? await d.nomeDoCliente(state.clientId).catch(() => null) : null;
        try {
          await d.gateway.sendText(
            canal.endereco,
            notificacaoAoAdvogado(state, nome ?? state.clientId.split('@')[0] ?? state.clientId),
          );
          registro = {
            requestId: state.requestId,
            resultado: 'entregue',
            canal: `whatsapp:${mascarar(canal.endereco)}`,
            tentativa: 1,
            em: now.toISOString(),
            erro: null,
          };
        } catch (e) {
          registro = {
            requestId: state.requestId,
            resultado: 'falhou',
            canal: `whatsapp:${mascarar(canal.endereco)}`,
            tentativa: 1,
            em: now.toISOString(),
            erro: e instanceof Error ? e.message : String(e),
          };
        }
      }
      await d.entregas.put(NS_ENTREGAS, dedupKey, registro);
      if (registro.resultado === 'falhou')
        d.observability.error(
          'document-request',
          'notificacao-advogado',
          now,
          `${state.requestId}: ${registro.erro ?? ''}`,
        );
      else
        d.observability.event(
          'document-request',
          `notificacao-advogado ${registro.resultado} ${state.requestId}`,
          now,
        );
    } catch (e) {
      // Falha tratada AQUI — nada chega ao domínio nem ao dispatcher.
      d.observability.error(
        'document-request',
        'notifier',
        now,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
