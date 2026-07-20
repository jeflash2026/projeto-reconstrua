// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST (GO-LIVE 15C · WORKFLOW 2) — Solicitação COMPLEMENTAR do
// ADVOGADO. Este fluxo NÃO é automático: só existe quando o advogado, pelo
// painel, cria formalmente uma solicitação. A AHRI NUNCA decide quais documentos
// complementares pedir — ela apenas EXECUTA solicitações do advogado:
// conversa com o cliente, coleta, associa o arquivo, atualiza o status
// (PENDING → RECEIVED) e notifica o advogado.
//
// Independente do Workflow 1 (documentação obrigatória: HISCON + RG/CNH +
// comprovante de endereço), que vale para 100% dos clientes.
// Rastreabilidade completa: toda solicitação é uma entidade própria, com autor,
// caso, cliente, documento, mensagem opcional e trilha de datas.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentRequestStatus = 'PENDING' | 'RECEIVED';

export interface DocumentRequest {
  readonly requestId: string;
  readonly caseId: string;
  readonly clientId: string; // chatId do cliente (canal AHRI)
  readonly lawyerId: string;
  readonly documentName: string; // texto livre do advogado (ex.: 'Procuração')
  readonly optionalMessage: string | null;
  readonly createdAt: Date;
  readonly requestedBy: string; // nome do advogado (exibição/mensagem)
  readonly status: DocumentRequestStatus;
  /** Preenchidos no recebimento (PENDING → RECEIVED). */
  readonly receivedAt: Date | null;
  readonly receivedDocumentRef: string | null; // referência do arquivo associado
}

export interface NovaSolicitacao {
  readonly requestId: string;
  readonly caseId: string;
  readonly clientId: string;
  readonly lawyerId: string;
  readonly documentName: string;
  readonly optionalMessage?: string;
  readonly requestedBy: string;
}

/** Cria a solicitação (status=PENDING). Nome do documento é obrigatório. */
export function criarSolicitacao(input: NovaSolicitacao, now: Date): DocumentRequest {
  const documentName = input.documentName.trim();
  if (documentName === '') throw new Error('documentName é obrigatório');
  return {
    requestId: input.requestId,
    caseId: input.caseId,
    clientId: input.clientId,
    lawyerId: input.lawyerId,
    documentName,
    optionalMessage: input.optionalMessage?.trim() ? input.optionalMessage.trim() : null,
    createdAt: now,
    requestedBy: input.requestedBy,
    status: 'PENDING',
    receivedAt: null,
    receivedDocumentRef: null,
  };
}

/** PENDING → RECEIVED: associa o arquivo e sela o recebimento. Idempotente-safe:
 *  receber duas vezes é erro (o chamador decide como tratar). */
export function registrarRecebimento(request: DocumentRequest, documentRef: string, now: Date): DocumentRequest {
  if (request.status !== 'PENDING') throw new Error(`solicitação ${request.requestId} não está PENDING (status=${request.status})`);
  return { ...request, status: 'RECEIVED', receivedAt: now, receivedDocumentRef: documentRef };
}

// ── Store (porta) + adapter de referência em memória ──────────────────────────
export interface DocumentRequestStore {
  salvar(request: DocumentRequest): Promise<void>;
  /** Atualiza (mesmo requestId). */
  atualizar(request: DocumentRequest): Promise<void>;
  porId(requestId: string): Promise<DocumentRequest | null>;
  /** Solicitações PENDENTES de um cliente (para associar um arquivo que chega). */
  pendentesDoCliente(clientId: string): Promise<readonly DocumentRequest[]>;
  /** Todas as solicitações de um caso (painel do advogado). */
  doCaso(caseId: string): Promise<readonly DocumentRequest[]>;
}

export class InMemoryDocumentRequestStore implements DocumentRequestStore {
  private readonly porIdMap = new Map<string, DocumentRequest>();
  salvar(request: DocumentRequest): Promise<void> {
    this.porIdMap.set(request.requestId, request);
    return Promise.resolve();
  }
  atualizar(request: DocumentRequest): Promise<void> {
    this.porIdMap.set(request.requestId, request);
    return Promise.resolve();
  }
  porId(requestId: string): Promise<DocumentRequest | null> {
    return Promise.resolve(this.porIdMap.get(requestId) ?? null);
  }
  pendentesDoCliente(clientId: string): Promise<readonly DocumentRequest[]> {
    return Promise.resolve([...this.porIdMap.values()].filter((r) => r.clientId === clientId && r.status === 'PENDING').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
  }
  doCaso(caseId: string): Promise<readonly DocumentRequest[]> {
    return Promise.resolve([...this.porIdMap.values()].filter((r) => r.caseId === caseId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
  }
}

// ── Mensagens (autoradas; a AHRI entrega — nunca inventa) ─────────────────────

/** A mensagem que a AHRI envia ao CLIENTE ao receber um DocumentRequest. */
export function mensagemAoCliente(request: DocumentRequest, clienteNome: string): string {
  const extra = request.optionalMessage ? `\n\n${request.optionalMessage}` : '';
  return (
    `Olá, ${clienteNome}.\n\n` +
    `${request.requestedBy}, responsável pelo seu processo, solicitou um documento complementar para dar continuidade ao andamento da ação.\n\n` +
    `Documento solicitado:\n${request.documentName}${extra}\n\n` +
    `Assim que possível, envie por aqui.`
  );
}

/** A notificação ao ADVOGADO após o recebimento e associação do documento. */
export function notificacaoAoAdvogado(request: DocumentRequest, clienteNome: string): string {
  return (
    `O cliente ${clienteNome} acabou de enviar o documento solicitado:\n\n` +
    `${request.documentName}.\n\n` +
    `O documento já está disponível para análise no painel.`
  );
}

// ── Coleta: associar um arquivo que chega à solicitação pendente ──────────────

export interface ResultadoDaColeta {
  readonly request: DocumentRequest; // já RECEIVED
  readonly notificarAdvogado: string; // a mensagem pronta para o WhatsApp do advogado
}

/**
 * Quando o cliente envia um documento: identifica a solicitação pendente MAIS
 * ANTIGA do cliente, associa o arquivo, atualiza PENDING→RECEIVED e produz a
 * notificação ao advogado. null = não há solicitação pendente (o documento
 * segue o fluxo normal do Workflow 1 — nada é inventado).
 */
export async function coletarDocumento(
  store: DocumentRequestStore,
  clientId: string,
  clienteNome: string,
  documentRef: string,
  now: Date,
): Promise<ResultadoDaColeta | null> {
  const pendentes = await store.pendentesDoCliente(clientId);
  const alvo = pendentes[0];
  if (alvo === undefined) return null;
  const recebida = registrarRecebimento(alvo, documentRef, now);
  await store.atualizar(recebida);
  return { request: recebida, notificarAdvogado: notificacaoAoAdvogado(recebida, clienteNome) };
}
