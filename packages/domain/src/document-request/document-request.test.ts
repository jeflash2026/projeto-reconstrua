// ─────────────────────────────────────────────────────────────────────────────
// DocumentRequestAggregate (15C) — testes do ciclo de vida: pertence a um CASO
// (Decisão 5); cumpre-se por DocumentId, nunca arquivo (Decisão 6); REABRE
// preservando histórico (Decisão 7); SLA na entidade; history append-only.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { DocumentRequestAggregate } from './document-request.js';
import { DocumentRequestId } from './document-request-id.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const T1 = new Date('2026-07-20T11:00:00.000Z');
const T2 = new Date('2026-07-20T12:00:00.000Z');
const ID = DocumentRequestId.fromString('00000000-0000-4000-8000-000000000001');

function criar(over: Partial<Parameters<typeof DocumentRequestAggregate.criar>[0]> = {}) {
  return DocumentRequestAggregate.criar({
    requestId: ID, caseId: 'CASE-1', clientId: '5511999@c', lawyerId: 'ADV-1',
    documentName: 'Procuração', requestedBy: 'Dr. João Silva', createdAt: NOW, ...over,
  });
}

describe('15C · criação (Decisão 5: pertence a um Caso)', () => {
  it('cria PENDING com auditoria e history inicial; emite created', () => {
    const agg = criar({ priority: 'alta', reminderPolicy: '48h', dueAt: T2 }).unwrap();
    const s = agg.toState();
    expect(s).toMatchObject({ caseId: 'CASE-1', status: 'PENDING', priority: 'alta', reminderPolicy: '48h', createdBy: 'ADV-1', fulfilledBy: null });
    expect(s.history).toHaveLength(1);
    expect(agg.pullDomainEvents().map((e) => e.eventName)).toEqual(['document-request.created']);
  });

  it('caseId é obrigatório — a solicitação nunca pertence só ao cliente', () => {
    expect(criar({ caseId: '  ' }).isErr()).toBe(true);
    expect(criar({ documentName: ' ' }).isErr()).toBe(true);
  });
});

describe('15C · associação (Decisão 6: DocumentId, nunca arquivo)', () => {
  it('associa por DocumentId ⇒ RECEIVED com selo e evento', () => {
    const agg = criar().unwrap();
    agg.pullDomainEvents();
    expect(agg.associar('doc-abc-123', 'unica', T1).isOk()).toBe(true);
    const s = agg.toState();
    expect(s.status).toBe('RECEIVED');
    expect(s.fulfilledBy).toBe('doc-abc-123');
    expect(s.receivedAt).toEqual(T1);
    expect(agg.pullDomainEvents().map((e) => e.eventName)).toEqual(['document-request.received']);
  });

  it('REJEITA caminho de arquivo/upload como fulfilledBy', () => {
    const agg = criar().unwrap();
    expect(agg.associar('/uploads/procuracao.pdf', 'unica', T1).isErr()).toBe(true);
    expect(agg.associar('procuracao.pdf', 'ia', T1).isErr()).toBe(true);
    expect(agg.toState().status).toBe('PENDING'); // nada mudou
  });

  it('associar duas vezes é erro (RECEIVED não está aberta)', () => {
    const agg = criar().unwrap();
    agg.associar('doc-1', 'unica', T1);
    expect(agg.associar('doc-2', 'unica', T2).isErr()).toBe(true);
  });
});

describe('15C · confirmação com o cliente (Decisão 1)', () => {
  it('PENDING → AWAITING_CONFIRMATION → (nega) PENDING → (confirma) RECEIVED', () => {
    const agg = criar().unwrap();
    expect(agg.aguardarConfirmacao(T1).isOk()).toBe(true);
    expect(agg.status).toBe('AWAITING_CONFIRMATION');
    expect(agg.retornarPendente(T1, 'cliente disse que é outro').isOk()).toBe(true);
    expect(agg.status).toBe('PENDING');
    agg.aguardarConfirmacao(T1);
    expect(agg.associar('doc-9', 'confirmacao-cliente', T2).isOk()).toBe(true);
    expect(agg.status).toBe('RECEIVED');
  });
});

describe('15C · reabertura (Decisão 7: nunca apagar, nunca recriar)', () => {
  it('RECEIVED → REOPENED preserva o vínculo anterior no history e reinicia o SLA', () => {
    const agg = criar().unwrap();
    agg.associar('doc-errado', 'ia', T1);
    expect(agg.reabrir('documento incorreto', 'ADV-1', T2).isOk()).toBe(true);
    const s = agg.toState();
    expect(s.status).toBe('REOPENED');
    expect(s.fulfilledBy).toBeNull();
    expect(s.receivedAt).toBeNull();
    expect(s.lastReminderAt).toBeNull(); // SLA reinicia
    expect(s.history.map((h) => h.para)).toEqual(['PENDING', 'RECEIVED', 'REOPENED']); // nada apagado
    expect(s.history.at(-1)?.nota).toContain('doc-errado'); // vínculo anterior preservado
    // REOPENED comporta-se como pendência: pode associar de novo.
    expect(agg.estaAberta()).toBe(true);
    expect(agg.associar('doc-certo', 'unica', T2).isOk()).toBe(true);
    expect(agg.toState().fulfilledBy).toBe('doc-certo');
  });

  it('só RECEIVED reabre', () => {
    const agg = criar().unwrap();
    expect(agg.reabrir('x', 'ADV-1', T1).isErr()).toBe(true);
  });
});

describe('15C · Correção 1 — registrarMensagemEnviada (mudança observável do domínio)', () => {
  it('emite messaged, atualiza updatedAt e history; duplicidade é impedida', () => {
    const agg = criar().unwrap();
    agg.pullDomainEvents();
    expect(agg.registrarMensagemEnviada(T1).isOk()).toBe(true);
    const s = agg.toState();
    expect(s.lastMessagedAt).toEqual(T1);
    expect(s.updatedAt).toEqual(T1);
    expect(s.history.at(-1)?.nota).toBe('mensagem enviada ao cliente');
    expect(agg.pullDomainEvents().map((e) => e.eventName)).toEqual(['document-request.messaged']);
    // duplicidade desnecessária:
    expect(agg.registrarMensagemEnviada(T2).isErr()).toBe(true);
  });

  it('reabertura zera lastMessagedAt — a AHRI mensageia de novo na nova abertura', () => {
    const agg = criar().unwrap();
    agg.registrarMensagemEnviada(T1);
    agg.associar('doc-1', 'unica', T1);
    agg.reabrir('incorreto', 'ADV-1', T2);
    expect(agg.toState().lastMessagedAt).toBeNull();
    expect(agg.registrarMensagemEnviada(T2).isOk()).toBe(true);
  });

  it('mensagem só para solicitações abertas', () => {
    const agg = criar().unwrap();
    agg.cancelar('x', 'ADV-1', T1);
    expect(agg.registrarMensagemEnviada(T2).isErr()).toBe(true);
  });
});

describe('15C · Correção 2 — reidratação SEGURA (fromState valida invariantes)', () => {
  const base = () => criar().unwrap().toState();

  it('estado válido reidrata; estado corrompido retorna ERRO explícito', () => {
    expect(DocumentRequestAggregate.fromState(base()).isOk()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), caseId: ' ' }).isErr()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), clientId: '' }).isErr()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), documentName: '' }).isErr()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), status: 'QUALQUER' as never }).isErr()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), reminderPolicy: '96h' as never }).isErr()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), dueAt: new Date('invalida') }).isErr()).toBe(true);
  });

  it('fulfilledBy coerente com o estado: RECEIVED exige; abertas proíbem; caminho rejeitado', () => {
    expect(DocumentRequestAggregate.fromState({ ...base(), status: 'RECEIVED' }).isErr()).toBe(true); // sem fulfilledBy
    expect(DocumentRequestAggregate.fromState({ ...base(), fulfilledBy: 'doc-1' }).isErr()).toBe(true); // PENDING com fulfilledBy
    expect(DocumentRequestAggregate.fromState({ ...base(), status: 'RECEIVED', fulfilledBy: '/tmp/a.pdf', receivedAt: T1 }).isErr()).toBe(true);
    expect(DocumentRequestAggregate.fromState({ ...base(), status: 'RECEIVED', fulfilledBy: 'doc-1', receivedAt: T1 }).isOk()).toBe(true);
  });

  it('a mensagem de erro identifica a solicitação e a causa', () => {
    const r = DocumentRequestAggregate.fromState({ ...base(), caseId: '' });
    expect(r.isErr()).toBe(true);
    expect(r.unwrapErr().message).toContain('reidratação inválida');
    expect(r.unwrapErr().message).toContain('caseId obrigatório');
  });
});

describe('15C · cancelamento e SLA', () => {
  it('cancela qualquer aberta (PENDING/AWAITING/REOPENED); CANCELLED é terminal', () => {
    const agg = criar().unwrap();
    expect(agg.cancelar('não é mais necessário', 'ADV-1', T1).isOk()).toBe(true);
    expect(agg.status).toBe('CANCELLED');
    expect(agg.associar('doc-1', 'unica', T2).isErr()).toBe(true);
    expect(agg.cancelar('de novo', 'ADV-1', T2).isErr()).toBe(true);
  });

  it('lembrete de SLA: atualiza lastReminderAt, entra no history e emite reminded', () => {
    const agg = criar({ reminderPolicy: '24h' }).unwrap();
    agg.pullDomainEvents();
    expect(agg.registrarLembrete(T1).isOk()).toBe(true);
    const s = agg.toState();
    expect(s.lastReminderAt).toEqual(T1);
    expect(s.history.at(-1)?.nota).toBe('lembrete automático enviado');
    expect(agg.pullDomainEvents().map((e) => e.eventName)).toEqual(['document-request.reminded']);
    // lembretes param quando não está mais aberta:
    agg.associar('doc-1', 'unica', T2);
    expect(agg.registrarLembrete(T2).isErr()).toBe(true);
  });
});
