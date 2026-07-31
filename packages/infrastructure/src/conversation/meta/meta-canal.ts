// ─────────────────────────────────────────────────────────────────────────────
// CANAL META (decreto 2026-07-31) — o runtime do canal OFICIAL:
//
//  • CanalDoChatStore (ns 'canal-do-chat'): registra por onde o cliente falou
//    por ÚLTIMO ('meta' | 'evolution'). A resposta sai SEMPRE pelo canal em que
//    o cliente está — quem escreve no número oficial recebe pelo oficial; quem
//    escreve no número da Evolution recebe pela Evolution. Sem registro ⇒
//    Evolution (o canal historicamente padrão).
//
//  • MetaCanalRuntime.processar(payload): mapeia o webhook oficial, registra o
//    canal e entrega cada mensagem à MESMA ENTRADA ÚNICA do WhatsApp/webchat.
//    MÍDIA (a Meta manda só o media ID): baixa pelo gateway, valida (allowlist,
//    20 MB, magic bytes — a MESMA régua da captura Evolution) e grava
//    referência+blob ANTES do turno (claim, como no webchat) — o
//    DocumentLinkSubscriber encontra o blob na primeira tentativa.
//
// Turno DESTACADO (mesma disciplina do webhook Evolution): nada bloqueia o ACK;
// falha vira log de observabilidade, nunca 5xx para a Meta.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { InboundEnvelope } from '@reconstrua/application';
import type { JsonStore } from '../../production/json-store.js';
import type { MediaReferenceStore } from '../../media/media-reference-store.js';
import type { MediaStorePort } from '../../media/media-store-port.js';
import type { MetaCloudGateway } from './meta-cloud-gateway.js';
import { mapMetaWebhook } from './meta-webhook-mapper.js';

export type CanalDeAtendimento = 'meta' | 'evolution';

const NS_CANAL = 'canal-do-chat';
const MIMES_PERMITIDOS: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB — a MESMA régua da captura
const MAGIC: Readonly<Record<string, readonly number[]>> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

interface RegistroCanal {
  readonly canal: CanalDeAtendimento;
  readonly em: string;
}

/** Último canal por chat. Escreve só quando muda (uma linha por chat). */
export class CanalDoChatStore {
  constructor(private readonly json: JsonStore) {}

  async registrar(chatId: string, canal: CanalDeAtendimento): Promise<void> {
    const atual = await this.canalDe(chatId);
    if (atual === canal) return;
    const registro: RegistroCanal = { canal, em: new Date().toISOString() };
    await this.json.put(NS_CANAL, chatId, registro);
  }

  async canalDe(chatId: string): Promise<CanalDeAtendimento | null> {
    const raw = (await this.json.get(NS_CANAL, chatId)) as RegistroCanal | null;
    return raw?.canal ?? null;
  }
}

export interface MetaCanalDeps {
  readonly gateway: MetaCloudGateway;
  readonly canais: CanalDoChatStore;
  /** A ENTRADA ÚNICA de produção — resolvida TARDE (é montada depois). */
  readonly ingress: () => { receive(envelope: InboundEnvelope): Promise<unknown> };
  readonly media: MediaStorePort;
  readonly references: MediaReferenceStore;
  readonly aoFalhar?: (mensagem: string) => void;
}

export class MetaCanalRuntime {
  constructor(private readonly deps: MetaCanalDeps) {}

  /** O cliente falou pelo número da EVOLUTION ⇒ a resposta volta por lá
   *  (last-write-wins: o canal é sempre o do ÚLTIMO contato do cliente). */
  chegouPelaEvolution(chatId: string): Promise<void> {
    return this.deps.canais.registrar(chatId, 'evolution');
  }

  /** Processa um POST do webhook oficial. ACK imediato: tudo é destacado. */
  processar(payload: unknown): void {
    for (const inbound of mapMetaWebhook(payload)) {
      void this.turno(inbound.envelope, inbound.mediaId).catch((error: unknown) => {
        this.deps.aoFalhar?.(
          `meta turno falhou chat=${inbound.envelope.chatId}: ${
            error instanceof Error ? error.message : 'falha'
          }`,
        );
      });
    }
  }

  private async turno(envelope: InboundEnvelope, mediaId: string | null): Promise<void> {
    // O cliente falou pelo canal oficial ⇒ a resposta sai pelo canal oficial.
    await this.deps.canais.registrar(envelope.chatId, 'meta');
    if (mediaId !== null) await this.capturarMidia(envelope, mediaId);
    await this.deps.ingress().receive(envelope);
  }

  /** Best-effort: mídia inválida NÃO cala a mensagem — o turno segue (o texto/
   *  classificação por fileName flui; a transcrição fica pendente, como na
   *  captura Evolution quando o base64 não vem). */
  private async capturarMidia(envelope: InboundEnvelope, mediaId: string): Promise<void> {
    try {
      const baixada = await this.deps.gateway.baixarMidia(mediaId);
      if (baixada === null) return;
      const mime = envelope.mediaMimeType ?? baixada.mime;
      if (!MIMES_PERMITIDOS.includes(mime)) {
        this.deps.aoFalhar?.(`meta midia mime nao permitido: ${mime}`);
        return;
      }
      const bytes = baixada.bytes;
      if (bytes.length > MAX_MEDIA_BYTES) {
        this.deps.aoFalhar?.(`meta midia excede 20 MB: ${String(bytes.length)} bytes`);
        return;
      }
      const magic = MAGIC[mime];
      if (magic !== undefined && !magic.every((b, i) => bytes[i] === b)) {
        this.deps.aoFalhar?.(`meta midia magic bytes nao conferem para ${mime}`);
        return;
      }
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      // Referência ANTES do turno (claim): vínculo documento↔blob nasce certo.
      await this.deps.references.save({
        messageId: envelope.messageId,
        sha256,
        mime,
        size: bytes.length,
      });
      if (!(await this.deps.media.has(sha256))) {
        await this.deps.media.put({ sha256, mime, size: bytes.length, bytes });
      }
    } catch (error) {
      this.deps.aoFalhar?.(
        `meta captura de midia falhou: ${error instanceof Error ? error.message : 'falha'}`,
      );
    }
  }
}
