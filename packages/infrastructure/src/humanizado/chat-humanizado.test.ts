// ─────────────────────────────────────────────────────────────────────────────
// Testes do CHAT DO CANAL HUMANIZADO (decreto 2026-08-05) — as garantias:
//  • entrada idempotente (a Meta reentrega webhooks; nada duplica);
//  • enviar texto grava a saída SÓ quando a Meta aceita; recusa vira erro
//    legível (janela de 24h → template);
//  • confirmar anexo recebido salva no docs-equipe (mesma porta do upload) e
//    sela a mensagem;
//  • resumo conta não lidas a partir do último "marcar lido".
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ChatHumanizadoService, type EnvioHumanizado } from './chat-humanizado.js';
import { DocsEquipeService } from '../docs-equipe/docs-equipe-service.js';
import { InMemoryJsonStore } from '../production/json-store.js';
import { InMemoryMediaStore } from '../media/in-memory-media-store.js';

const clock = { now: (): Date => new Date('2026-08-05T15:00:00Z') };
// %PDF — magic bytes válidos para o docs-equipe aceitar.
const PDF_BASE64 = Buffer.from('%PDF-1.4 conteudo').toString('base64');
const CHAT = '5541999999999@s.whatsapp.net';

function montar(aceita = true): {
  chat: ChatHumanizadoService;
  docs: DocsEquipeService;
  media: InMemoryMediaStore;
  enviados: string[];
} {
  const json = new InMemoryJsonStore();
  const media = new InMemoryMediaStore();
  const docs = new DocsEquipeService({ json, media, clock });
  const enviados: string[] = [];
  const envio: EnvioHumanizado = {
    sendText: (_chatId, text) => {
      enviados.push(text);
      return Promise.resolve({ providerMessageId: aceita ? 'wamid.OK' : '' });
    },
    sendDocument: () => Promise.resolve(),
    sendTemplate: () => Promise.resolve(aceita),
    sendAudio: () => Promise.resolve(aceita),
  };
  const chat = new ChatHumanizadoService({ json, media, clock, envio, docsEquipe: docs });
  return { chat, docs, media, enviados };
}

describe('ChatHumanizadoService', () => {
  it('entrada é idempotente por messageId (reentrega da Meta não duplica)', async () => {
    const { chat } = montar();
    const entrada = {
      messageId: 'wamid.1',
      chatId: CHAT,
      texto: 'boa tarde',
      tipo: 'texto' as const,
      nomeArquivo: null,
      midia: null,
      em: new Date('2026-08-05T14:00:00Z'),
    };
    await chat.registrarEntrada(entrada);
    await chat.registrarEntrada(entrada);
    expect((await chat.listar(CHAT)).mensagens).toHaveLength(1);
  });

  it('texto aceito grava a saída com autor; recusa vira erro legível SEM gravar', async () => {
    const ok = montar(true);
    const r1 = await ok.chat.enviarTexto(CHAT, 'ola, aqui e a equipe', 'Layara');
    expect(r1.ok).toBe(true);
    const mensagens = (await ok.chat.listar(CHAT)).mensagens;
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]?.autor).toBe('Layara');
    expect(ok.enviados).toEqual(['ola, aqui e a equipe']);

    const recusa = montar(false);
    const r2 = await recusa.chat.enviarTexto(CHAT, 'fora da janela', 'Layara');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain('template');
    expect((await recusa.chat.listar(CHAT)).mensagens).toHaveLength(0);
  });

  it('confirmar anexo recebido salva no docs-equipe e sela a mensagem', async () => {
    const { chat, docs, media } = montar();
    const bytes = Buffer.from('%PDF-1.4 procuracao assinada');
    const { createHash } = await import('node:crypto');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await media.put({
      sha256,
      mime: 'application/pdf',
      size: bytes.length,
      bytes: new Uint8Array(bytes),
    });
    await chat.registrarEntrada({
      messageId: 'wamid.doc',
      chatId: CHAT,
      texto: null,
      tipo: 'documento',
      nomeArquivo: 'procuracao.pdf',
      midia: { sha256, mime: 'application/pdf' },
      em: new Date(),
    });

    const r = await chat.confirmarDocumento(CHAT, 'wamid.doc', 'procuracao');
    expect(r.ok).toBe(true);
    const anexados = await docs.listar(CHAT);
    expect(anexados).toHaveLength(1);
    expect(anexados[0]?.tipo).toBe('procuracao');
    expect((await chat.listar(CHAT)).mensagens[0]?.confirmadoComo).toBe('procuracao');
    // Sem anexo (mensagem de texto) a confirmação é recusada.
    await chat.registrarEntrada({
      messageId: 'wamid.txt',
      chatId: CHAT,
      texto: 'segue',
      tipo: 'texto',
      nomeArquivo: null,
      midia: null,
      em: new Date(),
    });
    expect((await chat.confirmarDocumento(CHAT, 'wamid.txt', 'rg')).ok).toBe(false);
  });

  it('enviar documento valida magic bytes e guarda o blob (reabrível na conversa)', async () => {
    const { chat } = montar();
    const r = await chat.enviarDocumento(CHAT, { nome: 'proc.pdf', base64: PDF_BASE64 }, 'Layara');
    expect(r.ok).toBe(true);
    const m = (await chat.listar(CHAT)).mensagens[0];
    expect(m?.tipo).toBe('documento');
    expect(m?.sha256).not.toBeNull();
    expect((await chat.enviarDocumento(CHAT, { nome: 'x.txt', base64: 'bm90cGRm' }, 'L')).ok).toBe(
      false,
    );
  });

  it('resumo conta não lidas desde o último marcar lido', async () => {
    const { chat } = montar();
    await chat.registrarEntrada({
      messageId: 'wamid.a',
      chatId: CHAT,
      texto: 'oi',
      tipo: 'texto',
      nomeArquivo: null,
      midia: null,
      em: new Date('2026-08-05T14:00:00Z'),
    });
    const antes = (await chat.resumo())[0];
    expect(antes?.naoLidas).toBe(1);
    // Painéis inteligentes (2026-08-05): quem falou por último + silêncio do cliente.
    expect(antes?.ultimaDirecao).toBe('entrada');
    expect(antes?.ultimaEntradaEm).toBe('2026-08-05T14:00:00.000Z');
    await chat.marcarLido(CHAT);
    expect((await chat.resumo())[0]?.naoLidas).toBe(0);
    await chat.enviarTexto(CHAT, 'respondido', 'Layara');
    const depois = (await chat.resumo())[0];
    expect(depois?.ultimaDirecao).toBe('saida');
    expect(depois?.ultimaEntradaEm).toBe('2026-08-05T14:00:00.000Z');
  });

  it('sem gateway configurado, enviar devolve erro legível (nunca lança)', async () => {
    const json = new InMemoryJsonStore();
    const media = new InMemoryMediaStore();
    const docs = new DocsEquipeService({ json, media, clock });
    const chat = new ChatHumanizadoService({ json, media, clock, envio: null, docsEquipe: docs });
    const r = await chat.enviarTexto(CHAT, 'ola', 'Layara');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('não configurado');
  });
});
