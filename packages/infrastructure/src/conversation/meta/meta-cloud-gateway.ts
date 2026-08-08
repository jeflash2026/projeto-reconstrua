// ─────────────────────────────────────────────────────────────────────────────
// META CLOUD GATEWAY (decreto 2026-07-31) — adapter de `ConversationGateway`
// sobre a API OFICIAL do WhatsApp (Meta Cloud API / Graph). O canal oficial é a
// resposta definitiva ao ban: quem entrega as mensagens é a própria Meta — sem
// QR code, sem instância, sem deslogar sozinho. Sem lógica de conversa: só
// transporte. HTTP é injetado (testável sem rede).
//
// Endpoints (Graph API):
//   POST /{v}/{phoneNumberId}/messages   texto, documento, reação, read receipt
//   POST /{v}/{phoneNumberId}/media      upload de mídia (multipart) → { id }
//   GET  /{v}/{mediaId}                  metadados da mídia recebida → { url }
//   GET  {url}                           bytes da mídia (Bearer)
//
// REGRA DA META (janela de 24h): resposta a cliente que escreveu ⇒ livre;
// mensagem iniciada pelo negócio fora da janela ⇒ exige TEMPLATE aprovado. O
// gateway NÃO decide isso — ele transporta; o erro da Meta (ex.: 131047
// re-engagement) vira log de observabilidade pelo `aoFalhar`.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationGateway, OutboundReceipt, PresenceState } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import { asArray, asNumber, asRecord, asString, dig } from '../json.js';

export interface MetaCloudConfig {
  /** Token permanente (System User) com escopo whatsapp_business_messaging. */
  readonly token: string;
  /** Phone Number ID do número oficial (NÃO é o telefone — é o id do Graph). */
  readonly phoneNumberId: string;
  /** Versão do Graph (default v23.0). */
  readonly graphVersion?: string | undefined;
}

export interface MetaHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** Port HTTP mínimo do canal Meta (JSON + multipart + bytes) — injetável. */
export interface MetaHttp {
  postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
  ): Promise<MetaHttpResponse>;
  getJson(url: string, headers: Readonly<Record<string, string>>): Promise<MetaHttpResponse>;
  getBytes(
    url: string,
    headers: Readonly<Record<string, string>>,
  ): Promise<{ readonly status: number; readonly bytes: Uint8Array }>;
  /** Upload multipart de UM arquivo + campos de formulário. */
  postForm(
    url: string,
    headers: Readonly<Record<string, string>>,
    file: {
      readonly fieldName: string;
      readonly fileName: string;
      readonly mime: string;
      readonly bytes: Uint8Array;
    },
    fields: Readonly<Record<string, string>>,
  ): Promise<MetaHttpResponse>;
}

/** Adapter de produção sobre o `fetch` global (Node 22). */
export class FetchMetaHttp implements MetaHttp {
  async postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
  ): Promise<MetaHttpResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await parseBody(response) };
  }

  async getJson(url: string, headers: Readonly<Record<string, string>>): Promise<MetaHttpResponse> {
    const response = await fetch(url, { headers });
    return { status: response.status, body: await parseBody(response) };
  }

  async getBytes(
    url: string,
    headers: Readonly<Record<string, string>>,
  ): Promise<{ status: number; bytes: Uint8Array }> {
    const response = await fetch(url, { headers });
    return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
  }

  async postForm(
    url: string,
    headers: Readonly<Record<string, string>>,
    file: { fieldName: string; fileName: string; mime: string; bytes: Uint8Array },
    fields: Readonly<Record<string, string>>,
  ): Promise<MetaHttpResponse> {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append(file.fieldName, new Blob([file.bytes], { type: file.mime }), file.fileName);
    const response = await fetch(url, { method: 'POST', headers, body: form });
    return { status: response.status, body: await parseBody(response) };
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Extrai o número (sem sufixo @s.whatsapp.net) do JID quando presente. */
function toNumber(chatId: string): string {
  const at = chatId.indexOf('@');
  return at === -1 ? chatId : chatId.slice(0, at);
}

/** Mensagem de erro legível do corpo do Graph (ex.: janela de 24h expirada). */
function erroDoGraph(body: unknown): string {
  const error = asRecord(dig(body, ['error']));
  if (!error) return typeof body === 'string' ? body.slice(0, 300) : 'erro desconhecido';
  const code = asNumber(error['code']) ?? asString(error['code']) ?? '';
  const message = asString(error['message']) ?? '';
  const detail = asString(dig(error, ['error_data', 'details'])) ?? '';
  return `code=${String(code)} ${message}${detail === '' ? '' : ` — ${detail}`}`.trim();
}

export class MetaCloudGateway implements ConversationGateway {
  constructor(
    private readonly http: MetaHttp,
    private readonly config: MetaCloudConfig,
    private readonly clock: Clock,
    /** Falha de transporte vira log (mesma semântica best-effort do Evolution). */
    private readonly aoFalhar?: (mensagem: string) => void,
  ) {}

  private base(): string {
    return `https://graph.facebook.com/${this.config.graphVersion ?? 'v23.0'}`;
  }

  private messagesUrl(): string {
    return `${this.base()}/${this.config.phoneNumberId}/messages`;
  }

  private headers(): Readonly<Record<string, string>> {
    return { authorization: `Bearer ${this.config.token}` };
  }

  private falha(operacao: string, body: unknown): void {
    this.aoFalhar?.(`meta ${operacao} falhou: ${erroDoGraph(body)}`);
  }

  async sendText(chatId: string, text: string): Promise<OutboundReceipt> {
    const response = await this.http.postJson(this.messagesUrl(), this.headers(), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber(chatId),
      type: 'text',
      text: { body: text },
    });
    if (response.status >= 400) this.falha('sendText', response.body);
    const first = asRecord(asArray(dig(response.body, ['messages']))?.[0]);
    return {
      providerMessageId: (first ? asString(first['id']) : null) ?? '',
      sentAt: this.clock.now(),
    };
  }

  /** Envia DOCUMENTO (base64→upload→mensagem). Método ADITIVO — satisfaz
   *  EnviadorDeDocumento por estrutura, como no EvolutionGateway. */
  async sendDocument(
    chatId: string,
    anexo: { readonly fileName: string; readonly mimeType: string; readonly base64: string },
    caption: string,
  ): Promise<void> {
    const clean = anexo.base64.includes(',')
      ? anexo.base64.slice(anexo.base64.indexOf(',') + 1)
      : anexo.base64;
    const bytes = new Uint8Array(Buffer.from(clean, 'base64'));
    const upload = await this.http.postForm(
      `${this.base()}/${this.config.phoneNumberId}/media`,
      this.headers(),
      { fieldName: 'file', fileName: anexo.fileName, mime: anexo.mimeType, bytes },
      { messaging_product: 'whatsapp', type: anexo.mimeType },
    );
    const mediaId = asString(dig(upload.body, ['id']));
    if (upload.status >= 400 || mediaId === null) {
      this.falha('media upload', upload.body);
      return;
    }
    const response = await this.http.postJson(this.messagesUrl(), this.headers(), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber(chatId),
      type: 'document',
      document: { id: mediaId, filename: anexo.fileName, caption },
    });
    if (response.status >= 400) this.falha('sendDocument', response.body);
  }

  /** TEMPLATE aprovado (decreto 2026-08-05, canal humanizado): a ÚNICA forma de
   *  iniciar conversa fora da janela de 24h. `variaveis` preenche os {{1}},
   *  {{2}}… do corpo (ex.: o primeiro nome do cliente). `documento` preenche o
   *  cabeçalho de DOCUMENTO do modelo (ex.: envio_procuracao — o PDF da
   *  procuração viaja DENTRO do template e atravessa a janela). Devolve se a
   *  Meta ACEITOU — o chamador mostra o erro à secretária em vez de fingir que
   *  enviou. */
  async sendTemplate(
    chatId: string,
    nome: string,
    idioma = 'pt_BR',
    variaveis: readonly string[] = [],
    documento?: { readonly fileName: string; readonly mimeType: string; readonly base64: string },
  ): Promise<boolean> {
    const components: unknown[] = [];
    if (documento !== undefined) {
      const clean = documento.base64.includes(',')
        ? documento.base64.slice(documento.base64.indexOf(',') + 1)
        : documento.base64;
      const bytes = new Uint8Array(Buffer.from(clean, 'base64'));
      const upload = await this.http.postForm(
        `${this.base()}/${this.config.phoneNumberId}/media`,
        this.headers(),
        { fieldName: 'file', fileName: documento.fileName, mime: documento.mimeType, bytes },
        { messaging_product: 'whatsapp', type: documento.mimeType },
      );
      const mediaId = asString(dig(upload.body, ['id']));
      if (upload.status >= 400 || mediaId === null) {
        this.falha('template media upload', upload.body);
        return false;
      }
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: { id: mediaId, filename: documento.fileName } }],
      });
    }
    if (variaveis.length > 0) {
      components.push({
        type: 'body',
        parameters: variaveis.map((texto) => ({ type: 'text', text: texto })),
      });
    }
    const response = await this.http.postJson(this.messagesUrl(), this.headers(), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber(chatId),
      type: 'template',
      template: {
        name: nome,
        language: { code: idioma },
        ...(components.length > 0 ? { components } : {}),
      },
    });
    if (response.status >= 400) {
      this.falha('sendTemplate', response.body);
      return false;
    }
    return true;
  }

  /** ÁUDIO (decreto 2026-08-06, chat humanizado): upload + mensagem de voz.
   *  A Meta só aceita OGG/Opus (mono), AAC, MP4, MPEG ou AMR. */
  async sendAudio(
    chatId: string,
    anexo: { readonly mimeType: string; readonly base64: string },
  ): Promise<boolean> {
    const clean = anexo.base64.includes(',')
      ? anexo.base64.slice(anexo.base64.indexOf(',') + 1)
      : anexo.base64;
    const bytes = new Uint8Array(Buffer.from(clean, 'base64'));
    const upload = await this.http.postForm(
      `${this.base()}/${this.config.phoneNumberId}/media`,
      this.headers(),
      { fieldName: 'file', fileName: 'audio.ogg', mime: anexo.mimeType, bytes },
      { messaging_product: 'whatsapp', type: anexo.mimeType },
    );
    const mediaId = asString(dig(upload.body, ['id']));
    if (upload.status >= 400 || mediaId === null) {
      this.falha('audio upload', upload.body);
      return false;
    }
    const response = await this.http.postJson(this.messagesUrl(), this.headers(), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber(chatId),
      type: 'audio',
      audio: { id: mediaId },
    });
    if (response.status >= 400) {
      this.falha('sendAudio', response.body);
      return false;
    }
    return true;
  }

  /** A API oficial não tem presença livre ("digitando…" avulso) — no-op seguro. */
  setPresence(_chatId: string, _state: PresenceState): Promise<void> {
    return Promise.resolve();
  }

  async sendReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    const response = await this.http.postJson(this.messagesUrl(), this.headers(), {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber(chatId),
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    });
    if (response.status >= 400) this.falha('sendReaction', response.body);
  }

  async markRead(_chatId: string, messageId: string): Promise<void> {
    const response = await this.http.postJson(this.messagesUrl(), this.headers(), {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
    if (response.status >= 400) this.falha('markRead', response.body);
  }

  /** Baixa a mídia recebida (webhook traz só o media ID): metadados → bytes. */
  async baixarMidia(
    mediaId: string,
  ): Promise<{ readonly bytes: Uint8Array; readonly mime: string } | null> {
    const meta = await this.http.getJson(`${this.base()}/${mediaId}`, this.headers());
    const url = asString(dig(meta.body, ['url']));
    const mime = asString(dig(meta.body, ['mime_type']));
    if (meta.status >= 400 || url === null) {
      this.falha('media metadata', meta.body);
      return null;
    }
    const conteudo = await this.http.getBytes(url, this.headers());
    if (conteudo.status >= 400 || conteudo.bytes.length === 0) {
      this.aoFalhar?.(`meta media download falhou: status=${String(conteudo.status)}`);
      return null;
    }
    return { bytes: conteudo.bytes, mime: mime ?? 'application/octet-stream' };
  }
}
