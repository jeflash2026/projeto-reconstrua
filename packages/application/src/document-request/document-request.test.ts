// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST · aplicação (15C-1) — testes: read model por CASO (Decisão 5),
// resumo para o MissionSnapshot (Decisão B) e mensagens autoradas (cliente,
// confirmação, lembrete de SLA, notificação ao advogado). A entidade e o ciclo
// de vida vivem no domínio (testados lá).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { DocumentRequestAggregate, DocumentRequestId, toUuid } from '@reconstrua/domain';
import type { DocumentRequestState } from '@reconstrua/domain';
import type { MissionSnapshot } from '../executive-brain/mission-snapshot.js';
import { emptySnapshot } from '../executive-brain/mission-snapshot.js';
import {
  InMemoryDocumentRequestStore,
  mensagemAoCliente,
  mensagemDeLembrete,
  notificacaoAoAdvogado,
  perguntaDeConfirmacao,
  resumoDocumentRequests,
} from './document-request.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
let n = 0;
function estado(
  over: {
    documentName?: string;
    priority?: 'normal' | 'alta';
    caseId?: string;
    clientId?: string;
    mutar?: (a: DocumentRequestAggregate) => void;
  } = {},
): DocumentRequestState {
  n += 1;
  const agg = DocumentRequestAggregate.criar({
    requestId: DocumentRequestId.fromUuid(
      toUuid(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`),
    ),
    caseId: over.caseId ?? 'CASE-1',
    clientId: over.clientId ?? '5511999@c',
    lawyerId: 'ADV-1',
    documentName: over.documentName ?? 'Procuração',
    requestedBy: 'Dr. João Silva',
    createdAt: new Date(NOW.getTime() + n * 60_000),
    ...(over.priority ? { priority: over.priority } : {}),
  }).unwrap();
  over.mutar?.(agg);
  return agg.toState();
}

describe('15C-1 · read model por CASO', () => {
  it('doCaso é a consulta principal (Decisão 5); abertas incluem REOPENED', async () => {
    const store = new InMemoryDocumentRequestStore();
    await store.salvar(estado({ documentName: 'Procuração' }));
    await store.salvar(
      estado({ documentName: 'Carta', mutar: (a) => void a.associar('doc-1', 'unica', NOW) }),
    ); // RECEIVED
    await store.salvar(
      estado({
        documentName: 'Extrato',
        mutar: (a) => {
          a.associar('doc-2', 'ia', NOW);
          a.reabrir('incorreto', 'ADV-1', NOW);
        },
      }),
    ); // REOPENED
    await store.salvar(estado({ documentName: 'Outro caso', caseId: 'CASE-2' }));

    expect((await store.doCaso('CASE-1')).map((s) => s.documentName)).toEqual([
      'Procuração',
      'Carta',
      'Extrato',
    ]);
    const abertas = await store.abertasDoCliente('5511999@c');
    expect(abertas.map((s) => s.documentName)).toEqual(['Procuração', 'Extrato', 'Outro caso']); // RECEIVED fora; REOPENED dentro
  });
});

describe('15C-1 · resumo para o MissionSnapshot (Decisão B)', () => {
  it('conta abertas, prioridade mais alta, aguardando confirmação e a última', () => {
    const states = [
      estado({ documentName: 'Procuração' }),
      estado({
        documentName: 'Extrato',
        priority: 'alta',
        mutar: (a) => void a.aguardarConfirmacao(NOW),
      }),
      estado({ documentName: 'Carta', mutar: (a) => void a.associar('doc-1', 'unica', NOW) }), // RECEIVED — fora
    ];
    const resumo = resumoDocumentRequests(states);
    expect(resumo.totalPendentes).toBe(2);
    expect(resumo.prioridadeMaisAlta).toBe('alta');
    expect(resumo.aguardandoConfirmacao).toBe(1);
    expect(resumo.ultimaSolicitacao?.documentName).toBe('Extrato'); // a mais recente aberta
    expect(resumo.ultimaSolicitacao?.requestedBy).toBe('Dr. João Silva');
  });

  it('sem abertas ⇒ resumo vazio; e o shape ENCAIXA no MissionSnapshot', () => {
    const vazio = resumoDocumentRequests([
      estado({ mutar: (a) => void a.cancelar('x', 'ADV-1', NOW) }),
    ]);
    expect(vazio).toEqual({
      totalPendentes: 0,
      prioridadeMaisAlta: null,
      aguardandoConfirmacao: 0,
      ultimaSolicitacao: null,
    });
    // Single Source of Truth: o resumo é exatamente o campo do snapshot.
    const snap: MissionSnapshot = {
      ...emptySnapshot('m1'),
      documentRequests: resumoDocumentRequests([estado({})]),
    };
    expect(snap.documentRequests?.totalPendentes).toBe(1);
  });
});

describe('15C-1 · mensagens autoradas', () => {
  it('cliente / confirmação / lembrete / advogado — formatos do decreto', () => {
    const s = estado({ documentName: 'Procuração' });
    expect(mensagemAoCliente(s, 'Jessé')).toContain(
      'Seu caso já foi estudado e encontramos algumas irregularidades',
    );
    expect(mensagemAoCliente(s, 'Jessé')).toContain(
      'o(a) Dr(a). Dr. João Silva precisa do seguinte documento:',
    );
    expect(mensagemAoCliente(s, 'Jessé')).toContain('Procuração');
    expect(perguntaDeConfirmacao([s, estado({ documentName: 'Carta de Concessão' })])).toBe(
      'Recebi seu arquivo! Só confirmando: ele é **Procuração** ou **Carta de Concessão**?',
    );
    expect(mensagemDeLembrete(s, 'Jessé')).toContain(
      'Passando para lembrar: Dr. João Silva aguarda a Procuração',
    );
    const recebida = estado({
      documentName: 'Procuração',
      mutar: (a) => void a.associar('doc-1', 'unica', NOW),
    });
    expect(notificacaoAoAdvogado(recebida, 'Jessé Rodrigues')).toContain(
      'O cliente Jessé Rodrigues acabou de enviar o documento solicitado:',
    );
    expect(notificacaoAoAdvogado(recebida, 'Jessé Rodrigues')).toContain(
      'disponível para análise no painel',
    );
  });
});
