// Caminho EXATO de produção: assembleExecutiveBrain(InMemoryRuleCatalog(PRODUCTION_RULE_CATALOG))
// + FullLoopBrainAdapter + enriquecimento NULL (perception degradada, como nos logs).
import { assembleExecutiveBrain } from './packages/infrastructure/dist/executive-brain/build-executive-brain.js';
import { InMemoryRuleCatalog } from './packages/infrastructure/dist/index.js';
import { PRODUCTION_RULE_CATALOG } from './packages/infrastructure/dist/production/production-rule-catalog.js';
import { FullLoopBrainAdapter } from './packages/infrastructure/dist/go-live/full-loop-brain-adapter.js';
import { InMemoryEventStore, assembleMissionRuntime } from './packages/infrastructure/dist/index.js';
import { createHash, randomUUID } from 'node:crypto';

const CHAT = '5517996332346@s.whatsapp.net';
const NOW = new Date('2026-07-20T17:35:47.000Z');
const clock = { now: () => NOW };
const uuid = { next: () => randomUUID() };
const hasher = { hash: (s) => createHash('sha256').update(s).digest('hex') };

const brainAssembly = assembleExecutiveBrain({ clock, uuid, rules: new InMemoryRuleCatalog(PRODUCTION_RULE_CATALOG) });
const eventStore = new InMemoryEventStore(hasher, uuid, clock);
const identityMap = { state: { chatId: CHAT, personId: null, clienteId: null, missionId: null, caseId: null, processId: null, latestTruthId: null, latestStateId: null, latestStageId: null, lastDocumentId: null, lastEventId: null }, async load() { return this.state; }, async save(i) { this.state = i; } };
const missionAssembly = assembleMissionRuntime({ eventStore, hasher, uuid, clock, identityMap });

const missionCalls = [];
const missionSpy = { execute: (facts, intents) => { missionCalls.push(intents.map((i) => i.useCase)); return missionAssembly.runtime.execute(facts, intents); } };

const fullLoop = new FullLoopBrainAdapter({
  brain: brainAssembly.brain,
  rules: brainAssembly.rules,
  snapshots: { load: async () => null },
  mission: missionSpy,
  outbox: { drainToIdle: async () => {} },
  notification: { consume: async () => {} },
  handoff: { consume: async () => {} },
  memoryIngestor: { ingestTurn: async () => {}, ingestOutbound: async () => {} },
  noteWriter: null,
  observability: { latency: () => {}, event: () => {}, error: (...a) => console.log('OBS:', a.join(' ')) },
  clock,
});

// enrichment NULL — a perception degradou (o erro real dos logs de produção).
const percept = {
  id: 'p1',
  envelope: { messageId: '3ADBE94C343125D2965D', chatId: CHAT, from: CHAT, kind: 'pdf', text: null, mediaUrl: 'https://mmg.whatsapp.net/x', mediaMimeType: 'application/pdf', fileName: 'extrato_emprestimo_consignado_completo_030726.pdf', location: null, contact: null, reactionEmoji: null, reactionToMessageId: null, editedText: null, deletedMessageId: null, silenceMs: null, timestamp: NOW },
  enrichment: null,
  perceivedAt: NOW,
};
const context = { chatId: CHAT, session: { chatId: CHAT, turns: 35, lastInboundAt: null, lastOutboundAt: new Date(NOW.getTime() - 60000) }, recentEntries: [], recentOutboundTexts: [], lastPercept: percept, silenceMs: null };

const intents = await fullLoop.decide({ percept, context });
console.log('conversa:', intents.map((i) => `${i.directive}[${i.operationalRuleRef}]`).join(', ') || '(nenhuma)');
console.log('mission.execute chamado com:', JSON.stringify(missionCalls));
console.log('identity.missionId:', identityMap.state.missionId);
