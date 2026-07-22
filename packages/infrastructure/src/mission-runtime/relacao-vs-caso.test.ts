// ─────────────────────────────────────────────────────────────────────────────
// GO-LIVE 9B — RELACIONAMENTO ≠ CASO. Prova as quatro camadas da separação:
//  1. Truth Layer: caseExists/casePhase/caseTruth derivados SÓ do domínio.
//  2. Planner: RO-2D-RELATE × RO-2D-CASE-FOLLOW mutuamente exclusivas por fato.
//  3. Ausência declarada: o contexto do caso nunca é silêncio (tri-estado).
//  4. Fallback neutro: o degrade da expressão jamais afirma acompanhamento/caso.
// A nota "Acompanhado desde…" NÃO muda (a origem está certa; a interpretação não).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  buildFacts,
  emptySnapshot,
  RuleEvaluator,
  PACOTE_SEM_CASO,
  PACOTE_CASO_EM_ABERTURA,
  DEFAULT_PRODUCTION_CONFIG,
  ObservabilityRuntime,
  type PerceptView,
  type BrainMemoryView,
} from '@reconstrua/application';
import { createLlmBundle } from '../production/llm-adapters.js';
import { MISSION_RULE_CATALOG } from './mission-rule-catalog.js';
import {
  MissionKeyedSnapshotAdapter,
  ProjectionBackedMissionSnapshotAdapter,
} from '../executive-brain/projection-backed-mission-snapshot-adapter.js';

const TEXTO: PerceptView = {
  kind: 'text',
  sentiment: 'neutral',
  urgency: 'normal',
  hasArtifacts: false,
  artifactCount: 0,
  silenceMs: null,
};
const SEGUNDO_TURNO: BrainMemoryView = { turnCount: 3, lastOutboundAgoMs: 1000 };

describe('Truth Layer → Brain Facts (agnósticos de domínio)', () => {
  it('sem caso: emptySnapshot ⇒ caseExists=false, casePhase=sem_caso', () => {
    const f = buildFacts(TEXTO, emptySnapshot('chat-1'), SEGUNDO_TURNO);
    expect(f['caseExists']).toBe(false);
    expect(f['casePhase']).toBe('sem_caso');
    expect(f['caseTruth']).toBe(false);
  });

  it('com caso: snapshot com caseExists ⇒ fases abertura/em_andamento/encerrado', () => {
    const base = { ...emptySnapshot('m1'), caseExists: true };
    expect(buildFacts(TEXTO, base, SEGUNDO_TURNO)['casePhase']).toBe('abertura');
    expect(buildFacts(TEXTO, { ...base, truthEstablished: true }, SEGUNDO_TURNO)['casePhase']).toBe(
      'em_andamento',
    );
    expect(buildFacts(TEXTO, { ...base, stateCode: 'ENCERRADA' }, SEGUNDO_TURNO)['casePhase']).toBe(
      'encerrado',
    );
  });

  it('adapters: registro projetado OU identidade→missão ⇒ caseExists=true', async () => {
    const record = {
      missionId: 'm1',
      truthEstablished: false,
      terminalState: null,
      updatedAt: new Date(),
    };
    const store = {
      load: () => Promise.resolve(record),
      all: () => Promise.resolve([record]),
      save: () => Promise.resolve(),
    };
    const porMissao = await new MissionKeyedSnapshotAdapter(store).load('m1');
    expect(porMissao?.caseExists).toBe(true);

    // Identidade existe mas a projeção AINDA não alcançou (lag): caso mesmo assim EXISTE.
    const storeVazio = {
      load: () => Promise.resolve(null),
      all: () => Promise.resolve([]),
      save: () => Promise.resolve(),
    };
    const identities = {
      load: () => Promise.resolve({ chatId: 'c1', clienteId: 'c1', missionId: 'm1' }),
      save: () => Promise.resolve(),
    };
    const porChat = await new ProjectionBackedMissionSnapshotAdapter(
      storeVazio,
      identities as never,
    ).load('c1');
    expect(porChat?.caseExists).toBe(true);

    // Sem identidade ⇒ null ⇒ chamador usa emptySnapshot ⇒ caseExists=false.
    const semIdentidade = { load: () => Promise.resolve(null), save: () => Promise.resolve() };
    expect(
      await new ProjectionBackedMissionSnapshotAdapter(
        storeVazio as never,
        semIdentidade as never,
      ).load('c2'),
    ).toBeNull();
  });
});

describe('Planner: o topic de CASO exige o fato caseExists (nunca conversa/memória)', () => {
  const evaluator = new RuleEvaluator();
  const rule = (ref: string) =>
    MISSION_RULE_CATALOG.find((r) => r.ref === ref) ??
    (() => {
      throw new Error(ref);
    })();

  it('SEM caso: RELATE aplica; CASE-FOLLOW não (mesmo com memória/conversa longa)', () => {
    const facts = buildFacts(TEXTO, emptySnapshot('chat-1'), {
      turnCount: 50,
      lastOutboundAgoMs: 10,
    }); // relação longa!
    expect(evaluator.evaluate(rule('RO-2D-RELATE'), facts).applicable).toBe(true);
    expect(evaluator.evaluate(rule('RO-2D-CASE-FOLLOW'), facts).applicable).toBe(false);
  });

  it('COM caso: CASE-FOLLOW aplica; RELATE não', () => {
    const facts = buildFacts(TEXTO, { ...emptySnapshot('m1'), caseExists: true }, SEGUNDO_TURNO);
    expect(evaluator.evaluate(rule('RO-2D-CASE-FOLLOW'), facts).applicable).toBe(true);
    expect(evaluator.evaluate(rule('RO-2D-RELATE'), facts).applicable).toBe(false);
  });

  it('vocabulário separado: RELATE fala de relacionamento; só CASE-FOLLOW fala de caso', () => {
    const relate = rule('RO-2D-RELATE');
    const follow = rule('RO-2D-CASE-FOLLOW');
    expect(relate.action.kind === 'conversation' && relate.action.topic).toBe('relacionamento');
    expect(follow.action.kind === 'conversation' && follow.action.topic).toBe(
      'acompanhamento do caso',
    );
    // o catálogo inteiro: NENHUMA outra regra de conversa usa topic de caso
    const outras = MISSION_RULE_CATALOG.filter(
      (r) => r.ref !== 'RO-2D-CASE-FOLLOW' && r.action.kind === 'conversation',
    );
    expect(
      outras.every(
        (r) =>
          !/caso|processo|acompanhamento/i.test(
            (r.action.kind === 'conversation' ? r.action.topic : '') ?? '',
          ),
      ),
    ).toBe(true);
  });
});

describe('Ausência declarada + fallback neutro', () => {
  it('os textos tri-estado declaram o fato — sem caso nunca vira silêncio interpretável', () => {
    expect(PACOTE_SEM_CASO).toContain('NÃO possui caso');
    expect(PACOTE_SEM_CASO).toContain('Não existe acompanhamento de caso');
    expect(PACOTE_CASO_EM_ABERTURA).toContain('NÃO existe processo em andamento');
  });

  it('degrade da expressão (LLM caído) é NEUTRO: jamais afirma acompanhamento/caso/processo', async () => {
    const config = {
      ...DEFAULT_PRODUCTION_CONFIG,
      llm: {
        ...DEFAULT_PRODUCTION_CONFIG.llm,
        provider: 'anthropic' as const,
        anthropicApiKey: 'sk-ant-teste',
      },
    };
    const httpQueFalha = { postJson: () => Promise.reject(new Error('rede fora')) };
    const bundle = createLlmBundle({
      config,
      http: httpQueFalha,
      observability: new ObservabilityRuntime(() => undefined),
      clock: { now: () => new Date('2026-07-19T12:00:00.000Z') },
    });
    const texto = await bundle.expression.phrase({
      intent: {
        id: 'i1',
        chatId: 'c1',
        directive: 'speak',
        speechAct: 'explain',
        topic: 'relacionamento',
        references: [],
        urgency: 'normal',
        operationalRuleRef: 'RO-2D-RELATE',
        fundamento: 'x',
        timingHintMs: null,
        formedAt: new Date(),
      },
      context: { lastPercept: null, casoFatos: null, recentOutboundTexts: [] } as never,
      avoidPhrases: [],
      styleGuidance: 'neutro',
    });
    // Correção GO-LIVE (teste real): o fallback pede a repetição (mantém a
    // conversa viva) — e continua NEUTRO: nada de acompanhamento/caso/processo.
    expect(texto).toContain('instabilidade');
    expect(texto).toContain('mandar sua última mensagem de novo');
    expect(texto).not.toMatch(/acompanhand|processo|caso/i);
  });

  it('degrade DENTRO da triagem: o fallback CONTINUA a coleta (pede o próximo documento)', async () => {
    const config = {
      ...DEFAULT_PRODUCTION_CONFIG,
      llm: {
        ...DEFAULT_PRODUCTION_CONFIG.llm,
        provider: 'anthropic' as const,
        anthropicApiKey: 'sk-ant-teste',
      },
    };
    const bundle = createLlmBundle({
      config,
      http: { postJson: () => Promise.reject(new Error('rede fora')) },
      observability: new ObservabilityRuntime(() => undefined),
      clock: { now: () => new Date('2026-07-19T12:00:00.000Z') },
    });
    const texto = await bundle.expression.phrase({
      intent: {
        id: 'i1',
        chatId: 'c1',
        directive: 'speak',
        speechAct: 'explain',
        topic: 'documentos',
        references: [],
        urgency: 'normal',
        operationalRuleRef: 'RO-2D-DOC-ACK',
        fundamento: 'x',
        timingHintMs: null,
        formedAt: new Date(),
      },
      context: {
        lastPercept: null,
        casoFatos: null,
        recentOutboundTexts: [],
        onboardingDocumental: {
          recebidos: [],
          faltando: ['RG (frente e verso) ou CNH'],
          proximo: 'RG (frente e verso) ou CNH',
        },
      } as never,
      avoidPhrases: [],
      styleGuidance: 'neutro',
    });
    expect(texto).toContain('me manda o próximo documento: RG (frente e verso) ou CNH');
  });
});
