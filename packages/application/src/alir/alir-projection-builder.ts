// ─────────────────────────────────────────────────────────────────────────────
// ALIR PROJECTION BUILDER (W1-01B · B-2). Monta o Aggregate Operacional a partir
// das FONTES REAIS, reutilizando SOMENTE produtores já existentes (ports). Não
// possui cache, interface, API, endpoint nem componente visual. Não executa negócio:
// apenas REPRESENTA o estado (Regra 2). Todo campo é reconstruível a partir das
// fontes oficiais (Regra 3).
//
// Composição parcial (Regra 5): compõe apenas os grupos pedidos (CORE/OPERATIONAL/
// EXTENSIONS) preservando a consistência do contrato. Observabilidade (Regra 6):
// cada composição devolve métricas (tempo, fontes, campos reconstruídos/indisponíveis,
// versão, hash). Capacidades (Regra 7): calculadas do estado, nunca fixas.
//
// Fontes NÃO conectadas nesta tarefa (identidade civil/origem, documentos enviados,
// qualidade Shadow, timeline, decisões, próxima ação, extensões) são reportadas como
// INDISPONÍVEIS — nunca inventadas. Serão ligadas nas tarefas/ondas próprias.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionIdentityMap } from '../mission-runtime/ports.js';
import { emptyIdentity, type MissionIdentity } from '../mission-runtime/types.js';
import type { MemoryStore } from '../living-memory/ports.js';
import type { ClientMemory } from '../living-memory/client-memory.js';
import type { MissionSnapshotPort } from '../executive-brain/ports.js';
import type { HumanRole } from '../executive-brain/mission-snapshot.js';
import type { WorkflowProgressStore } from '../go-live/workflow-runtime.js';
import type { SchedulerStore } from '../go-live/scheduler-runtime.js';
import type { HandoffStore } from '../go-live/human-handoff-runtime.js';
import type { AssignmentStore, JuridicalWorkStore } from '../advogado-portal/juridical-work.js';
import type { StaffStore } from '../admin-portal/staff-directory.js';
import {
  emptyALIR,
  ALIR_SCHEMA_VERSION,
  type ALIR,
  type ALIRHandoff,
  type ALIRHealthScore,
  type ALIRJuridicalItem,
  type ALIRPersonAttribute,
  type ALIRResponsavel,
} from './alir-contract.js';

/** Grupos do Aggregate que podem ser compostos parcialmente (Regra 5). */
export const ALIR_GROUPS = ['CORE', 'OPERATIONAL', 'EXTENSIONS'] as const;
export type ALIRGroup = (typeof ALIR_GROUPS)[number];

/** Ports reutilizados (todos já existentes). O Builder só LÊ; nunca escreve. */
export interface ALIRSources {
  readonly identities: MissionIdentityMap;
  readonly memory: MemoryStore;
  readonly snapshots: MissionSnapshotPort;
  readonly workflow: WorkflowProgressStore;
  readonly scheduler: SchedulerStore;
  readonly handoffs: HandoffStore;
  readonly assignments: AssignmentStore;
  readonly staff: StaffStore;
  readonly juridical: JuridicalWorkStore;
}

export interface ALIRComposeOptions {
  readonly groups?: readonly ALIRGroup[];
  readonly now?: Date;
}

/** Métricas de reconstrução (Regra 6). */
export interface ALIRCompositionMetrics {
  readonly clienteId: string;
  readonly chatId: string;
  readonly schemaVersion: number;
  readonly contentHash: string;
  readonly compositionMs: number;
  readonly groups: readonly ALIRGroup[];
  readonly sourcesConsulted: readonly string[];
  readonly fieldsReconstructed: readonly string[];
  readonly fieldsUnavailable: readonly string[];
}

export interface ALIRComposition {
  readonly alir: ALIR;
  readonly metrics: ALIRCompositionMetrics;
}

/** Fronteira mínima de composição — quem sabe compor o ALIR serve os consumidores. */
export interface ALIRComposer {
  compose(chatId: string, options?: ALIRComposeOptions): Promise<ALIRComposition>;
}

const HANDOFF_ROLES: readonly HumanRole[] = ['perito', 'advogado', 'operador', 'supervisor', 'administrador'];

// ── utilidades puras ─────────────────────────────────────────────────────────

function pushUnique(list: string[], ...items: string[]): void {
  for (const it of items) if (!list.includes(it)) list.push(it);
}

function latestAttributesByKey(memory: ClientMemory): ALIRPersonAttribute[] {
  const byKey = new Map<string, { value: string; at: number }>();
  for (const a of memory.attributes) {
    const at = a.source.at.getTime();
    const prev = byKey.get(a.key);
    if (prev === undefined || at >= prev.at) byKey.set(a.key, { value: a.value, at });
  }
  return [...byKey.entries()].map(([key, v]) => ({ key, value: v.value }));
}

/** Serialização canônica (chaves ordenadas; ignora campos voláteis) para o hash. */
function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => k !== 'projectedAt' && k !== 'contentHash')
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a 32-bit (determinístico; para versionamento/divergência, não criptográfico). */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Hash estável do conteúdo do ALIR (exclui campos voláteis). */
export function stableContentHash(alir: ALIR): string {
  return fnv1a(canonical(alir));
}

// ── health score (representacional; determinístico) ────────────────────────────

/** Saúde operacional do caso — SÍNTESE representacional (não é decisão de negócio). */
export function computeALIRHealthScore(alir: ALIR): ALIRHealthScore {
  const m = alir.operational.missao;
  if (m.terminalState === 'ENCERRADA') {
    return { score: 100, band: 'GREEN', reasons: ['caso encerrado'] };
  }
  let score = 100;
  const reasons: string[] = [];
  if (alir.operational.operacao.handoffsAbertos.length > 0) {
    score -= 30;
    reasons.push('escalonamento humano aberto');
  }
  if (alir.operational.documentos.pendentes.length > 0) {
    score -= 20;
    reasons.push('documentos pendentes');
  }
  if (m.missionId !== null && !m.truthEstablished) {
    score -= 15;
    reasons.push('verdade operacional não estabelecida');
  }
  if (score < 0) score = 0;
  const band: ALIRHealthScore['band'] = score >= 70 ? 'GREEN' : score >= 40 ? 'YELLOW' : 'RED';
  return { score, band, reasons };
}

// ── o Builder ─────────────────────────────────────────────────────────────────

export class ALIRProjectionBuilder {
  constructor(private readonly sources: ALIRSources) {}

  async compose(chatId: string, options: ALIRComposeOptions = {}): Promise<ALIRComposition> {
    const startedMs = Date.now();
    const now = options.now ?? new Date();
    const requested = options.groups ?? [...ALIR_GROUPS];
    const wantCore = requested.includes('CORE');
    const wantOperational = requested.includes('OPERATIONAL');
    const wantExtensions = requested.includes('EXTENSIONS');

    const sourcesConsulted: string[] = ['identities'];
    const reconstructed: string[] = ['clienteId', 'chatId', 'projectedAt', 'schemaVersion'];
    const unavailable: string[] = [];

    const identity = (await this.sources.identities.load(chatId)) ?? emptyIdentity(chatId);
    const clienteId = identity.clienteId ?? chatId;
    let alir = emptyALIR(clienteId, chatId, now);

    let memory: ClientMemory | null = null;
    if (wantCore || wantOperational) {
      sourcesConsulted.push('client-memory');
      memory = await this.sources.memory.load(chatId);
    }

    if (wantCore) {
      alir = this.applyCore(alir, identity, memory, reconstructed, unavailable);
    }
    if (wantOperational) {
      alir = await this.applyOperational(alir, identity, memory, sourcesConsulted, reconstructed, unavailable);
    }
    if (wantExtensions) {
      pushUnique(
        unavailable,
        'extensions.pericia',
        'extensions.estagioComercial',
        'extensions.comercial',
        'extensions.financeiro',
        'extensions.escritorio',
        'extensions.portalCliente',
      );
    }

    // Computados de agregado só fazem sentido quando o estado operacional foi composto.
    if (wantOperational) {
      const healthScore = computeALIRHealthScore(alir);
      alir = { ...alir, healthScore };
      pushUnique(reconstructed, 'healthScore');
    }

    const contentHash = stableContentHash(alir);
    alir = { ...alir, contentHash };
    pushUnique(reconstructed, 'contentHash');

    const metrics: ALIRCompositionMetrics = {
      clienteId,
      chatId,
      schemaVersion: ALIR_SCHEMA_VERSION,
      contentHash,
      compositionMs: Date.now() - startedMs,
      groups: requested,
      sourcesConsulted,
      fieldsReconstructed: reconstructed,
      fieldsUnavailable: unavailable,
    };
    return { alir, metrics };
  }

  private applyCore(
    alir: ALIR,
    identity: MissionIdentity,
    memory: ClientMemory | null,
    reconstructed: string[],
    unavailable: string[],
  ): ALIR {
    const atributos = memory !== null ? latestAttributesByKey(memory) : [];
    pushUnique(reconstructed, 'core.pessoa.personId');
    if (memory !== null) pushUnique(reconstructed, 'core.pessoa.atributos');
    else pushUnique(unavailable, 'core.pessoa.atributos');
    // Sem produtor conectado nesta tarefa (stream person):
    pushUnique(unavailable, 'core.pessoa.identidadeCivil', 'core.pessoa.origemReconhecimento');

    return {
      ...alir,
      core: {
        pessoa: {
          personId: identity.personId,
          identidadeCivil: null,
          origemReconhecimento: null,
          atributos,
        },
      },
    };
  }

  private async applyOperational(
    alir: ALIR,
    identity: MissionIdentity,
    memory: ClientMemory | null,
    sourcesConsulted: string[],
    reconstructed: string[],
    unavailable: string[],
  ): Promise<ALIR> {
    const missionId = identity.missionId;
    pushUnique(
      reconstructed,
      'operational.missao.missionId',
      'operational.missao.caseId',
      'operational.missao.processId',
    );

    let missao = alir.operational.missao;
    let operacao = alir.operational.operacao;
    let juridico = alir.operational.juridico;

    if (missionId !== null) {
      sourcesConsulted.push('mission-snapshot');
      const snap = await this.sources.snapshots.load(missionId);
      const stateCode = snap?.stateCode ?? null;
      const terminalState = stateCode === 'ENCERRADA' ? 'ENCERRADA' : null;

      sourcesConsulted.push('workflow');
      const progress = await this.sources.workflow.load(missionId);

      sourcesConsulted.push('scheduler');
      const pending = (await this.sources.scheduler.all())
        .filter((t) => t.missionId === missionId && t.status === 'pending')
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
      const firstDue = pending[0];

      missao = {
        missionId,
        caseId: identity.caseId,
        processId: identity.processId,
        stageCode: snap?.stageCode ?? null,
        stateCode,
        truthEstablished: snap?.truthEstablished ?? false,
        terminalState,
        progresso: progress !== null ? [...progress.steps] : [],
        acompanhamento: {
          pendentes: pending.length,
          proximoVencimentoAt: firstDue !== undefined ? firstDue.dueAt : null,
        },
      };
      pushUnique(
        reconstructed,
        'operational.missao.stageCode',
        'operational.missao.stateCode',
        'operational.missao.truthEstablished',
        'operational.missao.terminalState',
        'operational.missao.progresso',
        'operational.missao.acompanhamento',
      );

      sourcesConsulted.push('handoff');
      const handoffsAbertos = await this.collectHandoffs(missionId);
      sourcesConsulted.push('assignments');
      const assignment = await this.sources.assignments.byMission(missionId);
      sourcesConsulted.push('staff');
      const responsaveis: ALIRResponsavel[] = [];
      if (assignment !== null) {
        const member = await this.sources.staff.byId(assignment.advogadoId);
        if (member !== null) responsaveis.push({ id: member.id, role: member.role, name: member.name });
      }
      operacao = {
        handoffsAbertos,
        atribuicao:
          assignment !== null
            ? { advogadoId: assignment.advogadoId, assignedBy: assignment.assignedBy, assignedAt: assignment.assignedAt }
            : null,
        responsaveis,
      };
      pushUnique(
        reconstructed,
        'operational.operacao.handoffsAbertos',
        'operational.operacao.atribuicao',
        'operational.operacao.responsaveis',
      );

      sourcesConsulted.push('juridical');
      const entries = await this.sources.juridical.byMission(missionId);
      const pendencias: ALIRJuridicalItem[] = entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        text: e.text,
        dueAt: e.dueAt,
        done: e.done,
      }));
      const processoEntries = entries
        .filter((e) => e.kind === 'numero_processo')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const processoLatest = processoEntries[0];
      juridico = {
        processoRef: processoLatest !== undefined ? processoLatest.text : null,
        pendencias,
      };
      pushUnique(reconstructed, 'operational.juridico.processoRef', 'operational.juridico.pendencias');
    }

    // documentos.pendentes é do cliente (memória), independe de missão
    const pendentes = memory !== null ? [...memory.documentsPending] : [];
    if (memory !== null) pushUnique(reconstructed, 'operational.documentos.pendentes');
    else pushUnique(unavailable, 'operational.documentos.pendentes');
    // enviados: sem port de listagem por missão nesta tarefa
    pushUnique(unavailable, 'operational.documentos.enviados');

    // AHRI (memória; independe de missão)
    const ahri =
      memory !== null
        ? {
            estiloConversa: memory.conversationStyle,
            tempoRespostaMedioMs: memory.avgResponseMs,
            primeiroContatoAt: memory.firstContactAt,
            ultimoContatoAt: memory.lastContactAt,
            qualidade: null,
          }
        : alir.operational.ahri;
    if (memory !== null) {
      pushUnique(
        reconstructed,
        'operational.ahri.estiloConversa',
        'operational.ahri.tempoRespostaMedioMs',
        'operational.ahri.primeiroContatoAt',
        'operational.ahri.ultimoContatoAt',
      );
    }
    // Fontes ainda não conectadas nesta tarefa:
    pushUnique(
      unavailable,
      'operational.ahri.qualidade',
      'operational.timeline',
      'operational.decisoes',
      'operational.proximaAcao',
    );

    return {
      ...alir,
      operational: {
        missao,
        documentos: { enviados: [], pendentes },
        ahri,
        operacao,
        juridico,
        timeline: [],
        decisoes: [],
        proximaAcao: null,
      },
    };
  }

  private async collectHandoffs(missionId: string): Promise<readonly ALIRHandoff[]> {
    const out: ALIRHandoff[] = [];
    for (const role of HANDOFF_ROLES) {
      const open = await this.sources.handoffs.openByRole(role);
      for (const t of open) {
        if (t.missionId === missionId) {
          out.push({ id: t.id, role: t.role, reasonCode: t.reasonCode, status: t.status });
        }
      }
    }
    return out;
  }
}
