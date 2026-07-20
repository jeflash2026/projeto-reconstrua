// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST (GO-LIVE 15C · Workflow 2) — testes: entidade com trilha
// completa; PENDING→RECEIVED; a AHRI executa (mensagem ao cliente com o nome do
// advogado e o documento), coleta associa o arquivo à pendência mais antiga e
// produz a notificação ao advogado; sem pendência ⇒ null (nada inventado).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  InMemoryDocumentRequestStore,
  coletarDocumento,
  criarSolicitacao,
  mensagemAoCliente,
  notificacaoAoAdvogado,
  registrarRecebimento,
} from './document-request.js';

const NOW = new Date('2026-07-20T10:00:00.000Z');
const DEPOIS = new Date('2026-07-20T11:00:00.000Z');

function nova(over: Partial<Parameters<typeof criarSolicitacao>[0]> = {}) {
  return criarSolicitacao(
    {
      requestId: 'REQ-1', caseId: 'CASE-1', clientId: '5511999@c', lawyerId: 'ADV-1',
      documentName: 'Procuração', requestedBy: 'Dr. João Silva', ...over,
    },
    NOW,
  );
}

describe('15C · DocumentRequest — entidade e máquina de estados', () => {
  it('criação: status=PENDING com todos os campos mínimos e trilha', () => {
    const r = nova({ optionalMessage: 'Precisamos para o protocolo.' });
    expect(r).toMatchObject({
      requestId: 'REQ-1', caseId: 'CASE-1', clientId: '5511999@c', lawyerId: 'ADV-1',
      documentName: 'Procuração', optionalMessage: 'Precisamos para o protocolo.',
      requestedBy: 'Dr. João Silva', status: 'PENDING', createdAt: NOW,
      receivedAt: null, receivedDocumentRef: null,
    });
  });

  it('documentName vazio é rejeitado (o advogado precisa nomear o documento)', () => {
    expect(() => nova({ documentName: '   ' })).toThrow('documentName é obrigatório');
  });

  it('PENDING → RECEIVED associa o arquivo e sela o recebimento', () => {
    const recebida = registrarRecebimento(nova(), 'doc-abc123', DEPOIS);
    expect(recebida.status).toBe('RECEIVED');
    expect(recebida.receivedAt).toEqual(DEPOIS);
    expect(recebida.receivedDocumentRef).toBe('doc-abc123');
  });

  it('receber duas vezes é erro (transição única)', () => {
    const recebida = registrarRecebimento(nova(), 'doc-1', DEPOIS);
    expect(() => registrarRecebimento(recebida, 'doc-2', DEPOIS)).toThrow('não está PENDING');
  });
});

describe('15C · mensagens — a AHRI executa, nunca inventa', () => {
  it('mensagem ao CLIENTE segue o formato do decreto (advogado + documento)', () => {
    const m = mensagemAoCliente(nova(), 'Jessé');
    expect(m).toContain('Olá, Jessé.');
    expect(m).toContain('Dr. João Silva, responsável pelo seu processo, solicitou um documento complementar');
    expect(m).toContain('Documento solicitado:\nProcuração');
    expect(m).toContain('Assim que possível, envie por aqui.');
  });

  it('mensagem opcional do advogado entra quando existir', () => {
    expect(mensagemAoCliente(nova({ optionalMessage: 'Modelo em anexo no cartório.' }), 'Jessé')).toContain('Modelo em anexo no cartório.');
    expect(mensagemAoCliente(nova(), 'Jessé')).not.toContain('undefined');
  });

  it('notificação ao ADVOGADO após o recebimento (formato do decreto)', () => {
    const recebida = registrarRecebimento(nova(), 'doc-1', DEPOIS);
    const n = notificacaoAoAdvogado(recebida, 'Jessé Rodrigues');
    expect(n).toContain('O cliente Jessé Rodrigues acabou de enviar o documento solicitado:');
    expect(n).toContain('Procuração.');
    expect(n).toContain('já está disponível para análise no painel');
  });
});

describe('15C · coleta — associar o arquivo do cliente à solicitação pendente', () => {
  it('associa à pendência MAIS ANTIGA, atualiza PENDING→RECEIVED e notifica', async () => {
    const store = new InMemoryDocumentRequestStore();
    await store.salvar(nova({ requestId: 'REQ-1', documentName: 'Procuração' }));
    await store.salvar(criarSolicitacao({ requestId: 'REQ-2', caseId: 'CASE-1', clientId: '5511999@c', lawyerId: 'ADV-1', documentName: 'Carta de Concessão', requestedBy: 'Dr. João Silva' }, DEPOIS));

    const resultado = await coletarDocumento(store, '5511999@c', 'Jessé Rodrigues', 'doc-999', DEPOIS);
    expect(resultado?.request.requestId).toBe('REQ-1'); // a mais antiga
    expect(resultado?.request.status).toBe('RECEIVED');
    expect(resultado?.request.receivedDocumentRef).toBe('doc-999');
    expect(resultado?.notificarAdvogado).toContain('Jessé Rodrigues');
    expect(resultado?.notificarAdvogado).toContain('Procuração.');

    // Persistido: REQ-1 RECEIVED; REQ-2 continua pendente (próxima coleta).
    expect((await store.porId('REQ-1'))?.status).toBe('RECEIVED');
    expect((await store.pendentesDoCliente('5511999@c')).map((r) => r.requestId)).toEqual(['REQ-2']);
  });

  it('sem solicitação pendente ⇒ null (o documento segue o Workflow 1; nada inventado)', async () => {
    const store = new InMemoryDocumentRequestStore();
    expect(await coletarDocumento(store, '5511999@c', 'Jessé', 'doc-1', NOW)).toBeNull();
  });

  it('painel do advogado: doCaso lista a trilha completa do caso', async () => {
    const store = new InMemoryDocumentRequestStore();
    await store.salvar(nova({ requestId: 'REQ-1' }));
    await store.salvar(criarSolicitacao({ requestId: 'REQ-3', caseId: 'CASE-2', clientId: 'x', lawyerId: 'ADV-1', documentName: 'Extrato', requestedBy: 'Dra. Ana' }, NOW));
    const doCaso = await store.doCaso('CASE-1');
    expect(doCaso.map((r) => r.requestId)).toEqual(['REQ-1']);
  });
});
