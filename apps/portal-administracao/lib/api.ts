// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API do Portal — o ÚNICO caminho de dados. Consome exclusivamente os
// READ MODELS servidos pela API (`/admin/*`); jamais o Event Store. Sem cache
// (`no-store`): tempo real por leitura fresca. Falha de rede vira estado explícito
// (`null`) — a UI mostra "API indisponível", nunca dado inventado.
// ─────────────────────────────────────────────────────────────────────────────

export const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function sendJson<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Tipos das respostas (espelham os read models da API) ──────────────────────
export interface DashboardData {
  activeClients: number;
  newClientsToday: number;
  awaitingDocuments: number;
  awaitingPericia: number;
  awaitingAdvogado: number;
  processesDistributed: number;
  avgHandlingMs: number | null;
  messageCount: number;
  documentCount: number;
  financialUnderAdministration: number | null;
  expectedFees: number | null;
  bottlenecks: string;
  alerts: string;
  health: ComponentHealth[];
  overall: string;
}

export interface ComponentHealth {
  component: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'FAILED';
  responseMs: number | null;
  queueDepth: number | null;
  memoryBytes: number | null;
  lastProcessedAt: string | null;
  detail: string | null;
  reportedAt: string;
}

export interface ClientRow {
  chatId: string;
  name: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  messageCount: number;
  pendingDocuments: string[];
  missions: string[];
}

export interface ClientDetail {
  memory: {
    chatId: string;
    attributes: Array<{ key: string; value: string; sourceMessageId: string; observedAt: string }>;
    rememberedEvents: Array<{ description: string; at: string }>;
    emotionsObserved: Array<{ sentiment: string; at: string }>;
    documentsSent: Array<{ reference: string; at: string }>;
    documentsPending: string[];
    stagesCompleted: Array<{ stageRef: string; at: string }>;
    conversationStyle: string | null;
    avgResponseMs: number | null;
    messageCount: number;
    firstContactAt: string | null;
    lastContactAt: string | null;
  };
  relationship: { summary: string; pendingDocuments: string[]; knownName: string | null; startedAt: string | null };
  conversation: Array<{ kind: string; text: string | null; at: string; intentDirective: string | null; operationalRuleRef: string | null }>;
  missions: Array<{ missionId: string; progress: { steps: string[] } | null }>;
}

export interface MissionRow {
  missionId: string;
  chatId: string | null;
  createdAt: string;
  eventCount: number;
  lastEventAt: string;
  truthCount: number;
  stateCount: number;
  stageCount: number;
  operationCount: number;
  projectionCount: number;
}

export interface TimelineEntry {
  globalSeq: number;
  at: string;
  recordedAt: string;
  streamType: string;
  streamId: string;
  eventType: string;
  isRelevant: boolean;
  actor: string | null;
  operationalRuleRef: string | null;
  fundamento: string | null;
  missionId: string | null;
}

export interface MissionDetail {
  missionId: string;
  chatId: string | null;
  timeline: TimelineEntry[];
  progress: { steps: string[] } | null;
}

export interface DocumentsData {
  recognized: Array<{ documentId: string; missionId: string | null; contentReference: string | null; mimeType: string | null; recognizedAt: string; status: string }>;
  pending: Array<{ chatId: string; document: string }>;
}

export interface StaffMember {
  id: string;
  role: string;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffData {
  members: StaffMember[];
  workload: { role: string; activeMembers: number; inactiveMembers: number; openHandoffs: number; avgQueuePerMember: number | null };
}

export interface FounderBriefing {
  greeting: string;
  newClients: number;
  newDocuments: number;
  newMissions: number;
  newProcesses: number;
  newStages: number;
  provenance: string;
}

export interface FounderAnswer {
  question: string;
  answer: string;
  available: boolean;
  provenance: string;
  isRecommendation: boolean;
}

export interface LogsData {
  events: TimelineEntry[];
  observations: Array<{ kind: string; component: string; name: string; value: number | null; detail: string | null; at: string }>;
}

export interface HealthData {
  overall: string;
  components: ComponentHealth[];
}
