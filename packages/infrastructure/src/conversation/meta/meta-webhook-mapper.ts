// ─────────────────────────────────────────────────────────────────────────────
// META WEBHOOK MAPPER (decreto 2026-07-31) — traduz o payload OFICIAL da Meta
// Cloud API em `InboundEnvelope` normalizado — o MESMO envelope da Evolution e
// do webchat: todo o pipeline (ingress, jornada, onboarding, perícia) é
// agnóstico de canal. Puro e defensivo: JSON desconhecido é lido com os
// acessadores seguros (sem `any`); entrada irreconhecível ⇒ ignorada.
//
// FORMA (campo 'messages'): entry[].changes[].value.messages[] — cada mensagem
// traz { from: '5511...', id: 'wamid...', timestamp: '<segundos>', type, ... }.
// Recibos de entrega (value.statuses) NÃO são mensagens — ignorados.
//
// IDENTIDADE: chatId = `${from}@s.whatsapp.net` — o MESMO JID do WhatsApp da
// Evolution. Cliente que já conversava pelo número antigo continua sendo a
// MESMA conversa/história ao escrever no número oficial.
//
// MÍDIA: a Meta NÃO manda bytes no webhook — manda um media ID (baixado depois
// pelo gateway). O mapper devolve o ID junto do envelope, para o runtime.
// ─────────────────────────────────────────────────────────────────────────────
import type { InboundEnvelope, PerceptKind } from '@reconstrua/application';
import { asArray, asNumber, asRecord, asString, dig } from '../json.js';

export interface MetaInbound {
  readonly envelope: InboundEnvelope;
  /** Media ID do Graph quando a mensagem carrega mídia (baixar via gateway). */
  readonly mediaId: string | null;
}

function timestampToDate(raw: unknown): Date {
  const seconds = asNumber(raw) ?? Number(asString(raw) ?? '');
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date();
  return new Date(seconds * 1_000);
}

function envelopeBase(
  messageId: string,
  chatId: string,
  timestamp: Date,
): Omit<InboundEnvelope, 'kind'> {
  return {
    messageId,
    chatId,
    from: chatId,
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
    timestamp,
  };
}

function mapMessage(message: Record<string, unknown>): MetaInbound | null {
  const id = asString(message['id']);
  const from = asString(message['from']);
  if (id === null || from === null) return null;
  const chatId = `${from.replace(/\D/g, '')}@s.whatsapp.net`;
  const base = envelopeBase(id, chatId, timestampToDate(message['timestamp']));
  const type = asString(message['type']) ?? '';

  if (type === 'text') {
    const body = asString(dig(message, ['text', 'body']));
    if (body === null) return null;
    return { envelope: { ...base, kind: 'text', text: body }, mediaId: null };
  }

  if (type === 'document') {
    const doc = asRecord(message['document']);
    if (!doc) return null;
    const mime = asString(doc['mime_type']);
    const kind: PerceptKind = mime === 'application/pdf' ? 'pdf' : 'document';
    return {
      envelope: {
        ...base,
        kind,
        text: asString(doc['caption']),
        mediaMimeType: mime,
        fileName: asString(doc['filename']),
      },
      mediaId: asString(doc['id']),
    };
  }

  if (type === 'image') {
    const image = asRecord(message['image']);
    if (!image) return null;
    return {
      envelope: {
        ...base,
        kind: 'image',
        text: asString(image['caption']),
        mediaMimeType: asString(image['mime_type']),
      },
      mediaId: asString(image['id']),
    };
  }

  if (type === 'audio') {
    const audio = asRecord(message['audio']);
    return {
      envelope: {
        ...base,
        kind: 'audio',
        text: null,
        mediaMimeType: audio ? asString(audio['mime_type']) : null,
      },
      mediaId: audio ? asString(audio['id']) : null,
    };
  }

  if (type === 'location') {
    const location = asRecord(message['location']);
    const lat = location ? asNumber(location['latitude']) : null;
    const lng = location ? asNumber(location['longitude']) : null;
    if (lat === null || lng === null) return null;
    return {
      envelope: {
        ...base,
        kind: 'location',
        text: null,
        location: {
          latitude: lat,
          longitude: lng,
          name: location ? asString(location['name']) : null,
        },
      },
      mediaId: null,
    };
  }

  if (type === 'contacts') {
    const first = asRecord(asArray(message['contacts'])?.[0]);
    if (!first) return null;
    const phones = (asArray(first['phones']) ?? [])
      .map((p) => {
        const rec = asRecord(p);
        return rec ? (asString(rec['wa_id']) ?? asString(rec['phone'])) : null;
      })
      .filter((p): p is string => p !== null && p !== '');
    return {
      envelope: {
        ...base,
        kind: 'contact',
        text: null,
        contact: {
          displayName: asString(dig(first, ['name', 'formatted_name'])) ?? '',
          phones,
        },
      },
      mediaId: null,
    };
  }

  if (type === 'reaction') {
    const reaction = asRecord(message['reaction']);
    if (!reaction) return null;
    return {
      envelope: {
        ...base,
        kind: 'reaction',
        text: null,
        reactionEmoji: asString(reaction['emoji']),
        reactionToMessageId: asString(reaction['message_id']),
      },
      mediaId: null,
    };
  }

  // sticker, interactive, button, system, unsupported… — sem tratamento (v1).
  return null;
}

/**
 * Mapeia um POST do webhook oficial → lista de entradas normalizadas. Um único
 * POST pode carregar VÁRIAS mensagens (e/ou recibos, que são ignorados).
 */
export function mapMetaWebhook(payload: unknown): readonly MetaInbound[] {
  const root = asRecord(payload);
  if (!root) return [];
  const resultado: MetaInbound[] = [];
  for (const entryRaw of asArray(root['entry']) ?? []) {
    const entry = asRecord(entryRaw);
    for (const changeRaw of entry ? (asArray(entry['changes']) ?? []) : []) {
      const change = asRecord(changeRaw);
      if (!change || asString(change['field']) !== 'messages') continue;
      const value = asRecord(change['value']);
      for (const messageRaw of value ? (asArray(value['messages']) ?? []) : []) {
        const message = asRecord(messageRaw);
        if (!message) continue;
        const mapped = mapMessage(message);
        if (mapped !== null) resultado.push(mapped);
      }
    }
  }
  return resultado;
}
