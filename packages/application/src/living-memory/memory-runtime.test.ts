// ─────────────────────────────────────────────────────────────────────────────
// Testes da Memória Viva — acúmulo com RASTREABILIDADE (toda entrada tem fonte),
// velocidade média de resposta, emoções, documentos e recall. Determinístico.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { MemoryRuntime } from './memory-runtime.js';
import type { ClientMemory } from './client-memory.js';
import type { MemoryAttributeExtractorPort, MemoryStore, ProposedAttribute } from './ports.js';

class FakeStore implements MemoryStore {
  private readonly m = new Map<string, ClientMemory>();
  load(id: string): Promise<ClientMemory | null> {
    return Promise.resolve(this.m.get(id) ?? null);
  }
  save(mem: ClientMemory): Promise<void> {
    this.m.set(mem.chatId, mem);
    return Promise.resolve();
  }
  all(): Promise<readonly ClientMemory[]> {
    return Promise.resolve([...this.m.values()]);
  }
}
class FakeExtractor implements MemoryAttributeExtractorPort {
  extract(text: string): Promise<readonly ProposedAttribute[]> {
    return Promise.resolve(
      text.includes('João') ? [{ key: 'name', value: 'João', confidence: 0.9 }] : [],
    );
  }
}

const CHAT = '5511999999999@s.whatsapp.net';
const T0 = new Date('2026-07-14T00:00:00.000Z');

describe('MemoryRuntime', () => {
  it('mede a velocidade média de resposta do cliente', async () => {
    const rt = new MemoryRuntime(new FakeStore());
    await rt.observeOutbound(CHAT, T0);
    await rt.observeInbound(CHAT, new Date(T0.getTime() + 5_000));
    await rt.observeOutbound(CHAT, new Date(T0.getTime() + 10_000));
    await rt.observeInbound(CHAT, new Date(T0.getTime() + 25_000)); // 15000ms
    const memory = await rt.recall(CHAT);
    expect(memory.avgResponseMs).toBe(10_000); // (5000 + 15000)/2
    expect(memory.messageCount).toBe(2);
    expect(memory.firstContactAt).toEqual(new Date(T0.getTime() + 5_000));
  });

  it('lembra atributos com RASTREABILIDADE (fonte obrigatória)', async () => {
    const rt = new MemoryRuntime(new FakeStore(), new FakeExtractor());
    await rt.observeText(CHAT, 'M1', 'meu nome é João', T0);
    const memory = await rt.recall(CHAT);
    expect(memory.attributes).toHaveLength(1);
    expect(memory.attributes[0]?.value).toBe('João');
    expect(memory.attributes[0]?.source.ref).toBe('M1'); // rastreável
    expect(memory.attributes[0]?.source.kind).toBe('conversation');
  });

  it('registra emoções percebidas (ignora neutro) com fonte', async () => {
    const rt = new MemoryRuntime(new FakeStore());
    await rt.observeEmotion(CHAT, 'P1', 'anxious', T0);
    await rt.observeEmotion(CHAT, 'P2', 'neutral', T0);
    const memory = await rt.recall(CHAT);
    expect(memory.emotionsObserved).toHaveLength(1);
    expect(memory.emotionsObserved[0]?.sentiment).toBe('anxious');
    expect(memory.emotionsObserved[0]?.source.ref).toBe('P1');
  });

  it('lembra documentos enviados (com fonte) e os remove dos pendentes', async () => {
    const rt = new MemoryRuntime(new FakeStore());
    await rt.setPendingDocuments(CHAT, ['RG', 'CPF']);
    await rt.observeDocumentSent(CHAT, 'E1', 'RG', T0);
    const memory = await rt.recall(CHAT);
    expect(memory.documentsSent).toHaveLength(1);
    expect(memory.documentsSent[0]?.source.ref).toBe('E1');
    expect(memory.documentsPending).toEqual(['CPF']);
  });
});
