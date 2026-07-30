// ─────────────────────────────────────────────────────────────────────────────
// WEBCHAT RUNTIME (decreto 2026-07-30) — o canal PRÓPRIO de atendimento da
// AHRI: o dono manda um LINK; o cliente abre a página, se identifica (nome +
// WhatsApp com DDD) e conversa com a MESMA AHRI do WhatsApp:
//
//  • chatId = `55<ddd><numero>@webchat` — o telefone continua sendo a
//    identidade (o recorte por estado via DDD e o contato posterior funcionam);
//  • TEXTO entra pela MESMA ENTRADA ÚNICA (TurnIngress) — mesma jornada,
//    mesmos guardrails, mesma memória; nada é duplicado para o canal web;
//  • PDF entra pelo MESMO media store (sha256 + media-message-ref) — o leitor
//    de HISCON, a perícia e as planilhas enxergam o documento como se tivesse
//    vindo do WhatsApp;
//  • a página lê a conversa da MEMÓRIA (ConversationStore) por polling — as
//    respostas da AHRI chegam lá pelo pipeline normal (o gateway router impede
//    só o desvio à Evolution).
//
// Sessão por TOKEN opaco (ns 'webchat-sessao'): o link é público, mas o
// histórico de cada conversa só sai com o token daquela sessão.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomBytes } from 'node:crypto';
import type { InboundEnvelope, MemoryEntry } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import type { MediaReferenceStore } from '../media/media-reference-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import { WEBCHAT_SUFFIX } from './webchat-gateway-router.js';

const NS_SESSAO = 'webchat-sessao';
const MAX_TEXTO = 4000;
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB — a MESMA régua da captura WhatsApp
const MAGIC_PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF

export interface SessaoWebchat {
  readonly token: string;
  readonly chatId: string;
  readonly nome: string;
  readonly criadaEm: string;
}

export interface MensagemWebchat {
  readonly de: 'cliente' | 'ahri';
  readonly texto: string;
  readonly em: string;
}

export interface WebchatDeps {
  readonly json: JsonStore;
  readonly clock: Clock;
  /** A ENTRADA ÚNICA de produção — resolvida TARDE (é montada depois). */
  readonly ingress: () => { receive(envelope: InboundEnvelope): Promise<unknown> };
  /** A memória da conversa — de onde a página lê o diálogo. */
  readonly conversas: { recent(chatId: string, limit: number): Promise<readonly MemoryEntry[]> };
  readonly media: MediaStorePort;
  readonly references: MediaReferenceStore;
  /** Falhas do turno assíncrono viram log — nunca derrubam o HTTP. */
  readonly aoFalhar?: (mensagem: string) => void;
}

/** Normaliza o telefone digitado: DDD+número (10-11 dígitos) ou já com 55. */
export function normalizarTelefoneWebchat(bruto: string): string | null {
  const dig = bruto.replace(/\D/g, '');
  if (dig.length === 10 || dig.length === 11) return `55${dig}`;
  if (dig.startsWith('55') && (dig.length === 12 || dig.length === 13)) return dig;
  return null;
}

function novoMessageId(): string {
  return `wc-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

function envelopeBase(chatId: string, agora: Date): Omit<InboundEnvelope, 'kind' | 'text'> {
  return {
    messageId: novoMessageId(),
    chatId,
    from: chatId,
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
    timestamp: agora,
  };
}

export class WebchatRuntime {
  constructor(private readonly deps: WebchatDeps) {}

  /** Abre (ou retoma) a sessão: mesmo telefone ⇒ MESMA conversa de sempre. */
  async abrirSessao(
    nomeBruto: string,
    telefoneBruto: string,
  ): Promise<{ ok: true; token: string; nome: string } | { ok: false; error: string }> {
    const nome = nomeBruto.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (nome.length < 2) return { ok: false, error: 'informe o seu nome' };
    const telefone = normalizarTelefoneWebchat(telefoneBruto);
    if (telefone === null)
      return { ok: false, error: 'informe um WhatsApp válido com DDD (ex.: 48 99999-9999)' };
    const sessao: SessaoWebchat = {
      token: randomBytes(24).toString('hex'),
      chatId: `${telefone}${WEBCHAT_SUFFIX}`,
      nome,
      criadaEm: this.deps.clock.now().toISOString(),
    };
    await this.deps.json.put(NS_SESSAO, sessao.token, sessao);
    return { ok: true, token: sessao.token, nome };
  }

  private async sessao(token: string): Promise<SessaoWebchat | null> {
    if (token === '' || token.length > 64) return null;
    return ((await this.deps.json.get(NS_SESSAO, token)) as SessaoWebchat | null) ?? null;
  }

  /** Texto do cliente ⇒ a MESMA entrada única do WhatsApp (turno assíncrono,
   *  como o webhook: ACK imediato; a resposta aparece no polling). */
  async receberTexto(
    token: string,
    textoBruto: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const s = await this.sessao(token);
    if (s === null) return { ok: false, error: 'sessão inválida — recarregue a página' };
    const texto = textoBruto.trim().slice(0, MAX_TEXTO);
    if (texto === '') return { ok: false, error: 'mensagem vazia' };
    const envelope: InboundEnvelope = {
      ...envelopeBase(s.chatId, this.deps.clock.now()),
      kind: 'text',
      text: texto,
    };
    this.disparar(envelope);
    return { ok: true };
  }

  /** PDF do cliente ⇒ o MESMO media store da captura WhatsApp (sha256 +
   *  media-message-ref ANTES do turno — o vínculo documento↔blob nasce certo). */
  async receberPdf(
    token: string,
    base64: string,
    fileNameBruto: string | null,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const s = await this.sessao(token);
    if (s === null) return { ok: false, error: 'sessão inválida — recarregue a página' };
    let bytes: Buffer;
    try {
      const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
      bytes = Buffer.from(clean, 'base64');
    } catch {
      return { ok: false, error: 'arquivo inválido' };
    }
    if (bytes.length === 0) return { ok: false, error: 'arquivo vazio' };
    if (bytes.length > MAX_PDF_BYTES) return { ok: false, error: 'arquivo acima de 20 MB' };
    if (!MAGIC_PDF.every((b, i) => bytes[i] === b))
      return { ok: false, error: 'envie o documento em PDF (o HISCON completo baixado em PDF)' };

    const agora = this.deps.clock.now();
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const base = envelopeBase(s.chatId, agora);
    // Referência ANTES do turno (claim): o DocumentLinkSubscriber encontra o
    // blob na primeira tentativa — sem corrida captura×reconhecimento.
    await this.deps.references.save({
      messageId: base.messageId,
      sha256,
      mime: 'application/pdf',
      size: bytes.length,
    });
    if (!(await this.deps.media.has(sha256))) {
      await this.deps.media.put({
        sha256,
        mime: 'application/pdf',
        size: bytes.length,
        bytes: new Uint8Array(bytes),
      });
    }
    const fileName = (fileNameBruto ?? 'documento.pdf').replace(/[^\w.\- ]/g, '').slice(0, 120);
    const envelope: InboundEnvelope = {
      ...base,
      kind: 'pdf',
      text: null,
      mediaMimeType: 'application/pdf',
      fileName: fileName === '' ? 'documento.pdf' : fileName,
    };
    this.disparar(envelope);
    return { ok: true };
  }

  /** O diálogo para a página (polling): a MESMA memória que a AHRI usa. */
  async historico(
    token: string,
  ): Promise<{ ok: true; nome: string; mensagens: readonly MensagemWebchat[] } | { ok: false }> {
    const s = await this.sessao(token);
    if (s === null) return { ok: false };
    const entradas = await this.deps.conversas.recent(s.chatId, 80);
    const mensagens = entradas
      .filter((e) => e.kind === 'inbound' || e.kind === 'outbound')
      .map((e): MensagemWebchat => ({
        de: e.kind === 'inbound' ? 'cliente' : 'ahri',
        // Inbound sem texto = documento/mídia enviada pelo cliente. A data passa
        // por new Date(): stores legados podem hidratar `at` como string ISO.
        texto: e.text ?? '[documento enviado]',
        em: new Date(e.at).toISOString(),
      }));
    return { ok: true, nome: s.nome, mensagens };
  }

  /** Turno destacado (mesma disciplina do webhook: nada bloqueia o ACK). */
  private disparar(envelope: InboundEnvelope): void {
    void this.deps
      .ingress()
      .receive(envelope)
      .catch((error: unknown) => {
        this.deps.aoFalhar?.(
          `webchat turno falhou chat=${envelope.chatId}: ${error instanceof Error ? error.message : 'falha'}`,
        );
      });
  }
}
