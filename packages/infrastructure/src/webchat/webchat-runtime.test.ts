// ─────────────────────────────────────────────────────────────────────────────
// WEBCHAT (decreto 2026-07-30) — o canal próprio da AHRI usa o MESMO fluxo do
// WhatsApp: texto pela mesma entrada única; PDF pelo mesmo media store (sha256
// + media-message-ref ANTES do turno); histórico da mesma memória de conversa.
// E o router de gateway: `@webchat` NUNCA vai à Evolution.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import type {
  ConversationGateway,
  InboundEnvelope,
  MemoryEntry,
  OutboundReceipt,
} from '@reconstrua/application';
import { InMemoryJsonStore } from '../production/json-store.js';
import type { StoredBlob } from '../media/media-store-port.js';
import type { MediaReference } from '../media/media-reference-store.js';
import { WebchatRuntime, normalizarTelefoneWebchat } from './webchat-runtime.js';
import { WebchatGatewayRouter, ehChatWeb } from './webchat-gateway-router.js';

const NOW = new Date('2026-07-30T12:00:00Z');
// %PDF-1.4 mínimo (o magic é o que importa para o portão).
const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');

function montar(entradas: MemoryEntry[] = []): {
  runtime: WebchatRuntime;
  recebidos: InboundEnvelope[];
  blobs: Map<string, StoredBlob>;
  refs: Map<string, MediaReference>;
} {
  const recebidos: InboundEnvelope[] = [];
  const blobs = new Map<string, StoredBlob>();
  const refs = new Map<string, MediaReference>();
  const runtime = new WebchatRuntime({
    json: new InMemoryJsonStore(),
    clock: { now: () => NOW },
    ingress: () => ({
      receive: (envelope) => {
        recebidos.push(envelope);
        return Promise.resolve({});
      },
    }),
    conversas: { recent: () => Promise.resolve(entradas) },
    media: {
      has: (sha) => Promise.resolve(blobs.has(sha)),
      put: (blob) => {
        blobs.set(blob.sha256, blob);
        return Promise.resolve();
      },
      read: (sha) => Promise.resolve(blobs.get(sha) ?? null),
    },
    references: {
      save: (r) => {
        refs.set(r.messageId, r);
        return Promise.resolve();
      },
      byMessageId: (id) => Promise.resolve(refs.get(id) ?? null),
    },
  });
  return { runtime, recebidos, blobs, refs };
}

describe('normalizarTelefoneWebchat', () => {
  it('aceita DDD+número (com ou sem 55) e recusa o resto', () => {
    expect(normalizarTelefoneWebchat('48 99999-9999')).toBe('5548999999999');
    expect(normalizarTelefoneWebchat('(11) 3333-4444')).toBe('551133334444');
    expect(normalizarTelefoneWebchat('5548999999999')).toBe('5548999999999');
    expect(normalizarTelefoneWebchat('999')).toBe(null);
    expect(normalizarTelefoneWebchat('abc')).toBe(null);
  });
});

describe('WebchatRuntime', () => {
  it('mesmo telefone ⇒ MESMO chatId (a conversa continua); texto entra pela entrada única', async () => {
    const { runtime, recebidos } = montar();
    const s1 = await runtime.abrirSessao('Maria Aparecida', '48 8874-1409 9');
    const s2 = await runtime.abrirSessao('Maria', '4888741409 9'.replace(' ', ''));
    if (!s1.ok || !s2.ok) throw new Error('sessão deveria abrir');
    const r = await runtime.receberTexto(s1.token, 'olá, quero revisar meu consignado');
    expect(r.ok).toBe(true);
    // O turno é assíncrono (fire-and-forget) — espera o microtask.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]?.chatId).toBe('5548887414099@webchat');
    expect(recebidos[0]?.kind).toBe('text');
    expect(recebidos[0]?.text).toBe('olá, quero revisar meu consignado');
  });

  it('valida a identificação (nome e telefone) e o token', async () => {
    const { runtime } = montar();
    expect((await runtime.abrirSessao('', '48999999999')).ok).toBe(false);
    expect((await runtime.abrirSessao('Maria', '123')).ok).toBe(false);
    expect((await runtime.receberTexto('token-inexistente', 'oi')).ok).toBe(false);
    expect((await runtime.historico('token-inexistente')).ok).toBe(false);
  });

  it('PDF: sha256 no MESMO media store + media-message-ref ANTES do turno', async () => {
    const { runtime, recebidos, blobs, refs } = montar();
    const s = await runtime.abrirSessao('João', '21 96979-0767');
    if (!s.ok) throw new Error('sessão deveria abrir');
    const r = await runtime.receberPdf(s.token, PDF_BASE64, 'hiscon.pdf');
    expect(r.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(recebidos).toHaveLength(1);
    const envelope = recebidos[0];
    expect(envelope?.kind).toBe('pdf');
    expect(envelope?.fileName).toBe('hiscon.pdf');
    // O vínculo nasce certo: messageId → sha256 já gravado, blob no store.
    const ref = refs.get(envelope?.messageId ?? '');
    expect(ref).toBeDefined();
    expect(blobs.has(ref?.sha256 ?? '')).toBe(true);
    expect(blobs.get(ref?.sha256 ?? '')?.mime).toBe('application/pdf');
  });

  it('recusa o que não é PDF (magic bytes) sem disparar turno', async () => {
    const { runtime, recebidos } = montar();
    const s = await runtime.abrirSessao('João', '21 96979-0767');
    if (!s.ok) throw new Error('sessão deveria abrir');
    const r = await runtime.receberPdf(
      s.token,
      Buffer.from('JFIF nada a ver').toString('base64'),
      'foto.jpg',
    );
    expect(r.ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(recebidos).toHaveLength(0);
  });

  it('histórico: a MESMA memória da conversa, cliente×ahri, doc sem texto vira aviso', async () => {
    const entrada = (kind: 'inbound' | 'outbound', text: string | null): MemoryEntry => ({
      id: `${kind}-${String(text)}`,
      chatId: '5548999999999@webchat',
      kind,
      at: NOW,
      text,
      intentDirective: null,
      operationalRuleRef: null,
      meta: {},
    });
    const { runtime } = montar([
      entrada('inbound', 'oi'),
      entrada('outbound', 'Olá! Eu sou a AHRI.'),
      entrada('inbound', null),
    ]);
    const s = await runtime.abrirSessao('Maria', '48 99999-9999');
    if (!s.ok) throw new Error('sessão deveria abrir');
    const h = await runtime.historico(s.token);
    if (!h.ok) throw new Error('histórico deveria abrir');
    expect(h.mensagens.map((m) => m.de)).toEqual(['cliente', 'ahri', 'cliente']);
    expect(h.mensagens[2]?.texto).toBe('[documento enviado]');
  });
});

describe('WebchatGatewayRouter', () => {
  function gatewayFake(): { enviados: string[]; gateway: ConversationGateway } {
    const enviados: string[] = [];
    const gateway: ConversationGateway = {
      sendText: (chatId): Promise<OutboundReceipt> => {
        enviados.push(chatId);
        return Promise.resolve({ providerMessageId: 'evo-1', sentAt: NOW });
      },
      setPresence: () => Promise.resolve(),
      sendReaction: () => Promise.resolve(),
      markRead: () => Promise.resolve(),
    };
    return { enviados, gateway };
  }

  it('`@webchat` NUNCA vai à Evolution; WhatsApp segue intocado', async () => {
    const { enviados, gateway } = gatewayFake();
    const router = new WebchatGatewayRouter(gateway, { now: () => NOW });
    const receipt = await router.sendText('5548999999999@webchat', 'resposta da AHRI');
    expect(receipt.providerMessageId.startsWith('wc-out-')).toBe(true);
    await router.sendText('5548999999999@s.whatsapp.net', 'resposta da AHRI');
    expect(enviados).toEqual(['5548999999999@s.whatsapp.net']);
    expect(ehChatWeb('5548999999999@webchat')).toBe(true);
    expect(ehChatWeb('5548999999999@s.whatsapp.net')).toBe(false);
  });

  it('preserva a detecção de capacidade sendDocument do gateway interno', () => {
    const { gateway } = gatewayFake();
    const semDocumento = new WebchatGatewayRouter(gateway, { now: () => NOW });
    expect(semDocumento.sendDocument).toBeUndefined();
    const comDocumento = new WebchatGatewayRouter(
      Object.assign(gatewayFake().gateway, { sendDocument: () => Promise.resolve() }),
      { now: () => NOW },
    );
    expect(typeof comDocumento.sendDocument).toBe('function');
  });
});
