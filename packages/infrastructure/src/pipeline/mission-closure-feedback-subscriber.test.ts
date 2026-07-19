// ─────────────────────────────────────────────────────────────────────────────
// MISSION CLOSURE FEEDBACK HOOK (GO-LIVE 11D) — prova o fio ligado:
//   Mission → ENCERRADA → registrarEncerramento() → Store persistido →
//   Painel atualizado; e o encerramento NÃO falha mesmo se o feedback falhar.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import { toUuid } from '@reconstrua/domain';
import type { EncerramentoAutomatico, StoredEvent } from '@reconstrua/application';
import {
  ESTRATEGIAS_CONSIGNADO_INSS,
  InMemoryAtendimentoStore,
  ObservabilityRuntime,
  ProductionFeedbackLoop,
  montarPainelDoArquiteto,
} from '@reconstrua/application';
import { MissionClosureFeedbackSubscriber, defaultEncerramentoResolver, type EncerramentoResolver } from './mission-closure-feedback-subscriber.js';

const NOW = new Date('2026-07-19T00:00:00.000Z');
class TestClock implements Clock {
  now(): Date { return NOW; }
}
class SeqUuid implements UuidGenerator {
  private n = 0;
  next(): Uuid { this.n += 1; return toUuid(`00000000-0000-4000-8000-${String(this.n).padStart(12, '0')}`); }
}

function evento(over: Partial<StoredEvent>): StoredEvent {
  return {
    id: 'e1', streamType: 'operational-state', streamId: 'st-1', version: 1, eventType: 'StateRepresented',
    isRelevant: true, payload: { terminalState: 'ENCERRADA', missionId: 'M-1', chatId: '5511999@c', correlationId: 'corr-1', strategyRef: 'EST-CONSIG-REVISAO-001', decisionId: 'dec-abc12345', advogado: 'dra. ana' },
    provenance: { factRef: null, actor: 'AHRI', decisionType: null, fundamento: null, operationalRuleRef: 'RO-X' },
    previousHash: null, hash: 'h', occurredAt: NOW, recordedAt: NOW, globalSeq: 1,
    ...over,
  };
}

function harness(over: { resolver?: EncerramentoResolver; loop?: ProductionFeedbackLoop } = {}) {
  const store = new InMemoryAtendimentoStore();
  const loop = over.loop ?? new ProductionFeedbackLoop(store);
  const observability = new ObservabilityRuntime();
  const sub = new MissionClosureFeedbackSubscriber({ loop, resolver: over.resolver ?? defaultEncerramentoResolver, observability, uuid: new SeqUuid(), clock: new TestClock() });
  return { store, loop, observability, sub };
}

describe('GO-LIVE 11D · o hook dispara no encerramento e alimenta o painel', () => {
  it('ENCERRADA ⇒ registrarEncerramento ⇒ store persistido ⇒ painel atualizado', async () => {
    const { store, sub } = harness();

    // Painel vazio antes.
    expect(montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, await store.listar()).totalAtendimentos).toBe(0);

    await sub.handle(evento({}));

    const persistidos = await store.listar();
    expect(persistidos).toHaveLength(1);
    expect(persistidos[0]?.estrategiaEscolhida).toBe('EST-CONSIG-REVISAO-001');
    expect(persistidos[0]?.auditoria).toMatchObject({ missionId: 'M-1', decisionId: 'dec-abc12345', correlationId: 'corr-1', cliente: '5511999@c', advogado: 'dra. ana' });

    const painel = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, persistidos);
    expect(painel.totalAtendimentos).toBe(1);
    expect(painel.taxaAcerto).toBe(1); // encerramento automático = confirmada
  });

  it('ignora eventos que não são encerramento de missão', async () => {
    const { store, sub } = harness();
    await sub.handle(evento({ payload: { terminalState: null } }));
    await sub.handle(evento({ streamType: 'document', payload: { terminalState: 'ENCERRADA' } }));
    expect(await store.listar()).toHaveLength(0);
  });

  it('resolver sem dados mínimos (sem correlationId/cliente) ⇒ no-op silencioso', async () => {
    const { store, sub } = harness();
    await sub.handle(evento({ payload: { terminalState: 'ENCERRADA', missionId: 'M-9' } }));
    expect(await store.listar()).toHaveLength(0);
  });
});

describe('GO-LIVE 11D · falha isolada — o encerramento NÃO falha se o feedback falhar', () => {
  it('registrarEncerramento lançando ⇒ handle NÃO propaga; observabilidade registra o erro', async () => {
    const loopQueFalha = {
      registrarEncerramento: (): Promise<never> => Promise.reject(new Error('store fora do ar')),
    } as unknown as ProductionFeedbackLoop;
    const { sub, observability } = harness({ loop: loopQueFalha });
    const errSpy = vi.spyOn(observability, 'error');

    // NÃO deve lançar — o encerramento da missão segue normalmente.
    await expect(sub.handle(evento({}))).resolves.toBeUndefined();

    const registrouFalha = errSpy.mock.calls.some((c) => c[0] === 'feedback-loop' && String(c[1]).includes('result=fail'));
    expect(registrouFalha).toBe(true);
  });

  it('auditoria de sucesso registra missionId, decisionId, correlationId, feedbackId e resultado', async () => {
    const { sub, observability } = harness();
    const evSpy = vi.spyOn(observability, 'event');
    await sub.handle(evento({}));
    const linha = evSpy.mock.calls.find((c) => c[0] === 'feedback-loop');
    expect(linha).toBeDefined();
    const detalhe = String(linha?.[1]);
    expect(detalhe).toContain('mission=M-1');
    expect(detalhe).toContain('decision=dec-abc12345');
    expect(detalhe).toContain('corr=corr-1');
    expect(detalhe).toContain('feedback=');
    expect(detalhe).toContain('result=ok');
  });
});

describe('GO-LIVE 11D · resolver default usa exclusivamente dados existentes', () => {
  it('extrai do payload; strategyRef cai na RO quando ausente', () => {
    const auto = defaultEncerramentoResolver(evento({ payload: { terminalState: 'ENCERRADA', chatId: 'c', correlationId: 'k' } })) as EncerramentoAutomatico;
    expect(auto.cliente).toBe('c');
    expect(auto.correlationId).toBe('k');
    expect(auto.strategyRef).toBe('RO-X'); // sem strategyRef no payload ⇒ operationalRuleRef
    expect(auto.decisionId).toBeNull();
  });
});

describe('GO-LIVE 12A · evento ENRIQUECIDO ⇒ registro COMPLETO sem consultas adicionais', () => {
  // O payload que o CloseMission (12A) publica na ORIGEM, autossuficiente.
  const enriquecido = evento({
    payload: {
      terminalState: 'ENCERRADA', missionId: 'M-7', cliente: 'CLI-7', correlationId: 'corr-7',
      decisionId: 'dec-77777777', strategyRef: 'EST-CONSIG-CARTAO-RMC-001', confidence: 'alta', advogado: 'dr. bruno',
      documentosRecebidos: ['HISCON'], documentosFaltantes: ['extrato da RMC / cartão consignado'],
      fatosAprendidos: ['problema_principal=cartao_rmc'], tempoDaMissao: 90_000,
    },
  });

  it('o resolver monta o AtendimentoEncerrado COMPLETO só com o evento', () => {
    const auto = defaultEncerramentoResolver(enriquecido) as EncerramentoAutomatico;
    expect(auto).toMatchObject({
      missionId: 'M-7', cliente: 'CLI-7', correlationId: 'corr-7', decisionId: 'dec-77777777',
      strategyRef: 'EST-CONSIG-CARTAO-RMC-001', confianca: 'alta', advogado: 'dr. bruno',
      documentosRecebidos: ['HISCON'], documentosFaltantes: ['extrato da RMC / cartão consignado'],
      fatosAprendidos: ['problema_principal=cartao_rmc'], tempoAteDecisaoMs: 90_000,
    });
  });

  it('o painel apresenta EXATAMENTE os dados provenientes do evento', async () => {
    const { store, sub } = harness();
    await sub.handle(enriquecido);
    const painel = montarPainelDoArquiteto(ESTRATEGIAS_CONSIGNADO_INSS, await store.listar());

    expect(painel.totalAtendimentos).toBe(1);
    expect(painel.estrategiasMaisUtilizadas[0]).toEqual({ chave: 'EST-CONSIG-CARTAO-RMC-001', ocorrencias: 1 });
    expect(painel.documentosMaisFaltantes[0]).toEqual({ chave: 'extrato da RMC / cartão consignado', ocorrencias: 1 });
    expect(painel.tempoMedioAteDecisaoMs).toBe(90_000);
    expect(painel.confiancaMedia).toBe(1); // 'alta' vindo do evento

    const persistido = (await store.listar())[0];
    expect(persistido?.auditoria).toMatchObject({ missionId: 'M-7', decisionId: 'dec-77777777', correlationId: 'corr-7', cliente: 'CLI-7', advogado: 'dr. bruno' });
  });
});
