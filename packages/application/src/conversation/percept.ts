// ─────────────────────────────────────────────────────────────────────────────
// PERCEPT — a percepção estruturada e imutável de TUDO que chega do cliente.
// CAMADA 1 (Perception) da ADR-0002A: o mundo bruto (texto, áudio, imagem, pdf,
// documento, localização, contato, silêncio, timeout, reação, edição, exclusão)
// vira Percept. A Perception PERCEBE — não decide, não altera domínio, não inventa.
//
// O enriquecimento por LLM (`PerceptEnrichment`) é ENTENDIMENTO (resumo, emoção,
// urgência, sinais) — jamais uma decisão. Toda decisão pertence ao Executive Brain.
// ─────────────────────────────────────────────────────────────────────────────
import type { EventClassificationValue } from '@reconstrua/domain';

/** As doze naturezas de entrada que o Runtime percebe (spec 2B). */
export type PerceptKind =
  | 'text'
  | 'audio'
  | 'image'
  | 'pdf'
  | 'document'
  | 'location'
  | 'contact'
  | 'silence'
  | 'timeout'
  | 'reaction'
  | 'edit'
  | 'delete';

/** Coordenada geográfica percebida (localização). */
export interface PerceivedLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string | null;
}

/** Cartão de contato percebido. */
export interface PerceivedContact {
  readonly displayName: string;
  readonly phones: readonly string[];
}

/**
 * Envelope de entrada NORMALIZADO — a fronteira entre o provedor (Evolution) e o
 * núcleo. Campos ausentes são `null` explícito (nunca `undefined`), para que a
 * ausência seja um fato percebido e não um acidente.
 */
export interface InboundEnvelope {
  /** Id da mensagem no provedor — chave de IDEMPOTÊNCIA (nunca processar 2×). */
  readonly messageId: string;
  /** Id da conversa (JID/telefone) — a "sala" da conversa. */
  readonly chatId: string;
  /** Remetente. */
  readonly from: string;
  readonly kind: PerceptKind;
  readonly text: string | null;
  readonly mediaUrl: string | null;
  readonly mediaMimeType: string | null;
  readonly fileName: string | null;
  readonly location: PerceivedLocation | null;
  readonly contact: PerceivedContact | null;
  readonly reactionEmoji: string | null;
  readonly reactionToMessageId: string | null;
  readonly editedText: string | null;
  readonly deletedMessageId: string | null;
  /** Duração do silêncio (ms) — presente em percepções de silêncio/timeout. */
  readonly silenceMs: number | null;
  readonly timestamp: Date;
}

/** Emoção percebida (sinal, não veredito). */
export type PerceivedSentiment =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'anxious'
  | 'confused'
  | 'unknown';

/** Urgência percebida (sinal, não decisão de prioridade — isso é do Brain). */
export type PerceivedUrgency = 'low' | 'normal' | 'high' | 'unknown';

/**
 * Enriquecimento produzido pelo LLM de PERCEPÇÃO. É ENTENDIMENTO puro. Nunca
 * contém decisão, próxima ação, fato novo ou reconhecimento de documento (isso é
 * ato de domínio posterior, decidido pelo Brain — ADR-0002A §3, Camada 1).
 */
export interface PerceptEnrichment {
  readonly summary: string;
  readonly sentiment: PerceivedSentiment;
  readonly urgency: PerceivedUrgency;
  /** Sinal de intenção percebida (ex.: "parece pedir prazo") — SINAL, não decisão. */
  readonly detectedIntentSignal: string | null;
  /** Artefatos percebidos (ex.: "artefato documental percebido: possível RG"). */
  readonly detectedArtifacts: readonly string[];
  readonly language: string | null;
  /** RFC-0044: sinal de relevância de evento percebido (vocabulário fechado do
   *  domínio); é ENTENDIMENTO, montado como PerceivedFact na fronteira. Opcional —
   *  ausente = não percebido. */
  readonly perceivedRelevance?: EventClassificationValue;
}

/** A percepção completa e imutável de um turno de entrada. */
export interface Percept {
  readonly id: string;
  readonly envelope: InboundEnvelope;
  /** `null` para percepções puramente mecânicas (silêncio, timeout, exclusão). */
  readonly enrichment: PerceptEnrichment | null;
  readonly perceivedAt: Date;
}

/** Percepções mecânicas não passam pelo LLM de percepção (nada a "entender"). */
export function isMechanicalPercept(kind: PerceptKind): boolean {
  return kind === 'silence' || kind === 'timeout' || kind === 'delete';
}
