// ─────────────────────────────────────────────────────────────────────────────
// Testes do Relationship Runtime — continuidade humana: "quando comecei?", "quais
// documentos?", "lembra do meu pai?", "como ficou minha etapa?". SEM decidir.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { MemoryRuntime } from './memory-runtime.js';
import { RelationshipRuntime } from './relationship-runtime.js';
import type { ClientMemory } from './client-memory.js';
import type { MemoryStore } from './ports.js';

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

const CHAT = 'c1';
const T0 = new Date('2026-07-14T00:00:00.000Z');

async function seeded(): Promise<RelationshipRuntime> {
  const memory = new MemoryRuntime(new FakeStore());
  await memory.observeInbound(CHAT, T0); // firstContact
  await memory.rememberEvent(CHAT, 'M5', 'cliente falou do pai que está doente', new Date(T0.getTime() + 7 * 86_400_000));
  await memory.setPendingDocuments(CHAT, ['laudo médico', 'comprovante']);
  await memory.observeStageCompleted(CHAT, 'E9', 'PERICIA_AGENDADA', T0);
  return new RelationshipRuntime(memory);
}

describe('RelationshipRuntime', () => {
  it('"quando comecei?" → data do primeiro contato', async () => {
    const rel = await seeded();
    expect(await rel.whenStarted(CHAT)).toEqual(T0);
  });

  it('"quais documentos você pediu?" → pendências exatas', async () => {
    const rel = await seeded();
    expect(await rel.pendingDocuments(CHAT)).toEqual(['laudo médico', 'comprovante']);
  });

  it('"como ficou minha perícia?" → etapa atual', async () => {
    const rel = await seeded();
    expect(await rel.currentStage(CHAT)).toBe('PERICIA_AGENDADA');
  });

  it('"lembra que falei do meu pai?" → recupera o assunto lembrado', async () => {
    const rel = await seeded();
    const found = await rel.recallTopic(CHAT, 'pai');
    expect(found).toHaveLength(1);
    expect(found[0]?.description).toContain('pai');
  });

  it('monta um contexto de continuidade (dados, não decisão)', async () => {
    const rel = await seeded();
    const ctx = await rel.context(CHAT);
    expect(ctx.pendingDocuments).toHaveLength(2);
    expect(ctx.lastStageRef).toBe('PERICIA_AGENDADA');
    expect(ctx.summary).toContain('Documentos pendentes');
  });
});
