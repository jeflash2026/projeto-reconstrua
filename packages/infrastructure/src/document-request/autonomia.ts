// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST AUTONOMIA (15C-4 · Partes 1 e 2) — os mecanismos que fecham o
// ciclo sem intervenção humana:
//
//  • RESOLUÇÃO DA CONFIRMAÇÃO (aoReceberTexto): o cliente respondeu à pergunta
//    "é a Procuração ou o Extrato?" — a Document Intelligence identifica a
//    candidata pela resposta; UMA identificada ⇒ associar(…, 'confirmacao-
//    cliente') e as demais retornam a PENDENTE; "não sei"/ambíguo ⇒ permanece
//    AWAITING_CONFIRMATION. JAMAIS adivinhar.
//
//  • SLA AUTOMÁTICO (varredura): pela reminderPolicy da ENTIDADE (24h/48h/72h/
//    semanal), lembra o cliente até received/cancelled. registrarLembrete é
//    feito ANTES do envio — falha de envio nunca duplica mensagem (o próximo
//    ciclo respeita lastReminderAt). Nunca lembra RECEIVED/CANCELLED (guarda do
//    aggregate).
//
// Falha ISOLADA em tudo: nada aqui derruba a conversa nem o tick. Toda transição
// é do aggregate; nenhuma verdade paralela (o contexto de confirmação é só o
// DocumentId aguardando resposta — efêmero, apagado ao resolver).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { DocumentRequestState, ReminderPolicy } from '@reconstrua/domain';
import type { ConversationGateway, DocumentRequestRuntime, DocumentRequestStore, ObservabilityRuntime } from '@reconstrua/application';
import { mensagemDeLembrete } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import { NS_CONFIRMACOES } from './document-arrival-subscriber.js';

const HORA = 60 * 60 * 1000;
const INTERVALO: Readonly<Record<Exclude<ReminderPolicy, 'nenhum'>, number>> = {
  '24h': 24 * HORA,
  '48h': 48 * HORA,
  '72h': 72 * HORA,
  semanal: 7 * 24 * HORA,
};

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Document Intelligence da RESPOSTA: qual candidata a resposta identifica?
 * Pontua por tokens do documentName presentes na resposta; só decide quando
 * EXATAMENTE UMA candidata tem a maior pontuação (>0). Ambíguo/zero ⇒ null.
 */
export function identificarCandidata(resposta: string, candidatas: readonly DocumentRequestState[]): DocumentRequestState | null {
  const texto = normalizar(resposta);
  if (texto === '') return null;
  const pontuadas = candidatas.map((c) => {
    const tokens = normalizar(c.documentName).split(' ').filter((t) => t.length > 2);
    const pontos = tokens.filter((t) => texto.includes(t)).length;
    return { c, pontos };
  });
  const max = Math.max(...pontuadas.map((p) => p.pontos));
  if (max === 0) return null; // "não sei" / nada reconhecível ⇒ jamais adivinhar
  const vencedoras = pontuadas.filter((p) => p.pontos === max);
  return vencedoras.length === 1 ? (vencedoras[0] as { c: DocumentRequestState }).c : null;
}

export interface AutonomiaDeps {
  readonly store: DocumentRequestStore;
  readonly runtime: DocumentRequestRuntime;
  readonly gateway: ConversationGateway | null;
  readonly confirmacoes: JsonStore;
  readonly nomeDoCliente: ((chatId: string) => Promise<string | null>) | null;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class DocumentRequestAutonomia {
  constructor(private readonly deps: AutonomiaDeps) {}

  /** Parte 1 — o cliente respondeu; resolve a confirmação pendente (se houver). */
  async aoReceberTexto(chatId: string, texto: string, now: Date): Promise<void> {
    const d = this.deps;
    try {
      const ctx = (await d.confirmacoes.get(NS_CONFIRMACOES, chatId)) as { documentId?: string } | null;
      const documentId = typeof ctx?.documentId === 'string' ? ctx.documentId : null;
      if (documentId === null) return; // nada aguardando confirmação

      const aguardando = (await d.store.abertasDoCliente(chatId)).filter((s) => s.status === 'AWAITING_CONFIRMATION');
      if (aguardando.length === 0) {
        await d.confirmacoes.del(NS_CONFIRMACOES, chatId).catch(() => undefined);
        return;
      }

      const alvo = identificarCandidata(texto, aguardando);
      if (alvo === null) return; // "não sei"/ambíguo ⇒ permanece AWAITING; jamais adivinhar

      await d.runtime.associar(alvo.requestId, documentId, 'confirmacao-cliente', now);
      for (const outra of aguardando) {
        if (outra.requestId !== alvo.requestId) {
          await d.runtime.retornarPendente(outra.requestId, now, 'cliente indicou que o arquivo é outro documento');
        }
      }
      await d.confirmacoes.del(NS_CONFIRMACOES, chatId).catch(() => undefined);
      d.observability.event('document-request', `confirmacao-resolvida ${alvo.requestId} doc=${documentId}`, now);
    } catch (e) {
      d.observability.error('document-request', 'confirmacao', now, e instanceof Error ? e.message : String(e));
    }
  }

  /** Parte 2 — varredura de SLA: lembra quem está devendo, pela política da entidade. */
  async varredura(now: Date): Promise<void> {
    const d = this.deps;
    let abertas: readonly DocumentRequestState[];
    try {
      abertas = await d.store.abertas();
    } catch (e) {
      d.observability.error('document-request', 'sla:read-model', now, e instanceof Error ? e.message : String(e));
      return; // read model indisponível ⇒ nada a fazer neste ciclo (estado intacto)
    }
    for (const s of abertas) {
      try {
        if (s.reminderPolicy === 'nenhum') continue;
        const base = s.lastReminderAt ?? s.lastMessagedAt ?? s.createdAt;
        if (now.getTime() - base.getTime() < INTERVALO[s.reminderPolicy]) continue;

        // Registra ANTES de enviar: falha de envio nunca duplica (próximo ciclo
        // respeita lastReminderAt); o aggregate garante que só abertas lembram.
        const registrado = await d.runtime.registrarLembrete(s.requestId, now);
        if (registrado.isErr()) continue;

        if (d.gateway !== null) {
          const nome = d.nomeDoCliente !== null ? await d.nomeDoCliente(s.clientId).catch(() => null) : null;
          await d.gateway
            .sendText(s.clientId, mensagemDeLembrete(s, nome ?? ''))
            .then(() => { d.observability.event('document-request', `lembrete-entregue ${s.requestId}`, now); })
            .catch((e: unknown) => { d.observability.error('document-request', 'lembrete-falhou', now, `${s.requestId}: ${e instanceof Error ? e.message : String(e)}`); });
        }
      } catch (e) {
        d.observability.error('document-request', 'sla', now, e instanceof Error ? e.message : String(e));
      }
    }
  }
}
