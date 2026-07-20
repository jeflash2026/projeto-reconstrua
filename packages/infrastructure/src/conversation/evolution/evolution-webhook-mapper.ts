// ─────────────────────────────────────────────────────────────────────────────
// EVOLUTION WEBHOOK MAPPER — traduz o payload bruto da Evolution API (Baileys)
// em `InboundEnvelope` normalizado. Cobre as doze naturezas de entrada. Puro e
// defensivo: JSON desconhecido é lido com os acessadores seguros (sem `any`).
//
// Não decide nada. Só percebe a forma da mensagem. Entradas irreconhecíveis → null.
// ─────────────────────────────────────────────────────────────────────────────
import type { InboundEnvelope, PerceptKind } from '@reconstrua/application';
import { asArray, asNumber, asRecord, asString, dig } from '../json.js';

const PHONE_IN_VCARD = /waid=(\d+)/i;
const TEL_IN_VCARD = /TEL[^:]*:([+\d][\d\s()-]+)/i;

function timestampToDate(raw: unknown): Date {
  const seconds = asNumber(raw);
  if (seconds === null) return new Date();
  return new Date(seconds * 1_000);
}

function extractPhones(vcard: string): readonly string[] {
  const phones: string[] = [];
  const waid = PHONE_IN_VCARD.exec(vcard);
  if (waid && waid[1]) phones.push(waid[1]);
  const tel = TEL_IN_VCARD.exec(vcard);
  if (tel && tel[1]) {
    const cleaned = tel[1].replace(/[^\d+]/g, '');
    if (cleaned !== '' && !phones.includes(cleaned)) phones.push(cleaned);
  }
  return phones;
}

interface Parsed {
  readonly kind: PerceptKind;
  readonly text: string | null;
  readonly mediaUrl: string | null;
  readonly mediaMimeType: string | null;
  readonly fileName: string | null;
  readonly location: InboundEnvelope['location'];
  readonly contact: InboundEnvelope['contact'];
  readonly reactionEmoji: string | null;
  readonly reactionToMessageId: string | null;
  readonly editedText: string | null;
  readonly deletedMessageId: string | null;
}

function parseMessage(message: Record<string, unknown>): Parsed | null {
  const base = {
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
  } as const;

  // Reação
  const reaction = asRecord(message['reactionMessage']);
  if (reaction) {
    return {
      ...base,
      kind: 'reaction',
      reactionEmoji: asString(reaction['text']),
      reactionToMessageId: asString(dig(reaction, ['key', 'id'])),
    };
  }

  // Protocolo: REVOKE (exclusão) e MESSAGE_EDIT (edição)
  const protocol = asRecord(message['protocolMessage']);
  if (protocol) {
    const type = asString(protocol['type']) ?? '';
    if (type === 'REVOKE') {
      return { ...base, kind: 'delete', deletedMessageId: asString(dig(protocol, ['key', 'id'])) };
    }
    if (type.includes('EDIT')) {
      const edited =
        asString(dig(protocol, ['editedMessage', 'conversation'])) ??
        asString(dig(protocol, ['editedMessage', 'extendedTextMessage', 'text']));
      return { ...base, kind: 'edit', editedText: edited };
    }
  }

  // Edição no formato editedMessage
  const editedContainer = asRecord(message['editedMessage']);
  if (editedContainer) {
    const inner = asRecord(editedContainer['message']) ?? editedContainer;
    const edited =
      asString(inner['conversation']) ??
      asString(dig(inner, ['extendedTextMessage', 'text'])) ??
      asString(dig(inner, ['protocolMessage', 'editedMessage', 'conversation']));
    return { ...base, kind: 'edit', editedText: edited };
  }

  // Imagem
  const image = asRecord(message['imageMessage']);
  if (image) {
    return {
      ...base,
      kind: 'image',
      text: asString(image['caption']),
      mediaUrl: asString(image['url']),
      mediaMimeType: asString(image['mimetype']),
    };
  }

  // Áudio
  const audio = asRecord(message['audioMessage']);
  if (audio) {
    return {
      ...base,
      kind: 'audio',
      mediaUrl: asString(audio['url']),
      mediaMimeType: asString(audio['mimetype']),
    };
  }

  // Documento (pdf vs. genérico pelo mimetype)
  const document = asRecord(message['documentMessage']) ?? asRecord(message['documentWithCaptionMessage']);
  if (document) {
    const inner = asRecord(document['message']);
    const doc = inner ? (asRecord(inner['documentMessage']) ?? document) : document;
    const mimetype = asString(doc['mimetype']);
    const kind: PerceptKind = mimetype === 'application/pdf' ? 'pdf' : 'document';
    return {
      ...base,
      kind,
      text: asString(doc['caption']),
      mediaUrl: asString(doc['url']),
      mediaMimeType: mimetype,
      fileName: asString(doc['fileName']),
    };
  }

  // Localização
  const location = asRecord(message['locationMessage']);
  if (location) {
    const lat = asNumber(location['degreesLatitude']);
    const lng = asNumber(location['degreesLongitude']);
    if (lat !== null && lng !== null) {
      return {
        ...base,
        kind: 'location',
        location: { latitude: lat, longitude: lng, name: asString(location['name']) },
      };
    }
  }

  // Contato (único ou array)
  const contact = asRecord(message['contactMessage']);
  if (contact) {
    const vcard = asString(contact['vcard']) ?? '';
    return {
      ...base,
      kind: 'contact',
      contact: {
        displayName: asString(contact['displayName']) ?? '',
        phones: extractPhones(vcard),
      },
    };
  }
  const contactsArray = asRecord(message['contactsArrayMessage']);
  if (contactsArray) {
    const list = asArray(contactsArray['contacts']) ?? [];
    const first = asRecord(list[0]);
    const vcard = first ? (asString(first['vcard']) ?? '') : '';
    return {
      ...base,
      kind: 'contact',
      contact: {
        displayName: (first ? asString(first['displayName']) : null) ?? '',
        phones: extractPhones(vcard),
      },
    };
  }

  // Texto (extended ou simples)
  const extendedText = asString(dig(message, ['extendedTextMessage', 'text']));
  if (extendedText !== null) {
    return { ...base, kind: 'text', text: extendedText };
  }
  const conversation = asString(message['conversation']);
  if (conversation !== null) {
    return { ...base, kind: 'text', text: conversation };
  }

  return null;
}

/**
 * Mapeia um evento `messages.upsert` da Evolution → InboundEnvelope. Ignora
 * mensagens próprias (`fromMe`) e payloads irreconhecíveis (devolve `null`).
 */
export function mapEvolutionUpsert(payload: unknown): InboundEnvelope | null {
  const root = asRecord(payload);
  if (!root) return null;

  const data = asRecord(root['data']);
  if (!data) return null;

  const key = asRecord(data['key']);
  if (!key) return null;

  if (asRecord(data['message']) === null) return null;
  const fromMe = key['fromMe'] === true;
  if (fromMe) return null;

  const chatId = asString(key['remoteJid']);
  const messageId = asString(key['id']);
  if (chatId === null || messageId === null) return null;

  const message = asRecord(data['message']);
  if (!message) return null;

  const parsed = parseMessage(message);
  if (!parsed) return null;

  // CAUSA RAIZ GO-LIVE (2026-07-20, achada pela instrumentação de missão): em
  // chat DIRETO a Evolution envia participant como STRING VAZIA — e `'' ?? x`
  // devolve ''. O envelope saía com from='' ⇒ R1 rejeitava a Pessoa
  // ("Identidade civil ausente", DF-23) ⇒ nenhuma missão, nenhum evento,
  // onboarding eternamente pedindo o HISCON. Vazio/ausente ⇒ o remetente é o
  // próprio chat (o comportamento correto de conversa 1:1).
  const participant = asString(key['participant']);
  return {
    messageId,
    chatId,
    from: participant !== null && participant !== '' ? participant : chatId,
    kind: parsed.kind,
    text: parsed.text,
    mediaUrl: parsed.mediaUrl,
    mediaMimeType: parsed.mediaMimeType,
    fileName: parsed.fileName,
    location: parsed.location,
    contact: parsed.contact,
    reactionEmoji: parsed.reactionEmoji,
    reactionToMessageId: parsed.reactionToMessageId,
    editedText: parsed.editedText,
    deletedMessageId: parsed.deletedMessageId,
    silenceMs: null,
    timestamp: timestampToDate(data['messageTimestamp']),
  };
}
