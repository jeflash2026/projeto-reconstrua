// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST RUNTIME (15C-1 · Parte 2) — os CASOS DE USO da solicitação
// complementar. Orquestra: reidrata (fromState SEGURO — Correção 2) → transiciona
// pelo AGGREGATE (todas as invariantes lá) → persiste o estado no read model →
// PUBLICA os eventos de domínio (porta). Nenhuma regra duplicada aqui.
// ─────────────────────────────────────────────────────────────────────────────
import { DocumentRequestAggregate, DocumentRequestId, Result } from '@reconstrua/domain';
import type {
  ComoAssociado,
  CriarDocumentRequestInput,
  DocumentRequestState,
  DomainEvent,
} from '@reconstrua/domain';
import type { DocumentRequestStore } from './document-request.js';

/** Porta de publicação dos eventos de domínio (Event Store na produção). */
export interface DocumentRequestEventPublisher {
  publicar(
    requestId: string,
    events: readonly DomainEvent[],
    estado: DocumentRequestState,
  ): Promise<void>;
}

export class DocumentRequestRuntime {
  constructor(
    private readonly store: DocumentRequestStore,
    private readonly eventos: DocumentRequestEventPublisher | null = null,
  ) {}

  async criar(
    input: Omit<CriarDocumentRequestInput, 'requestId'> & { readonly requestId: string },
  ): Promise<Result<DocumentRequestState, Error>> {
    const criado = DocumentRequestAggregate.criar({
      ...input,
      requestId: DocumentRequestId.fromString(input.requestId),
    });
    if (criado.isErr()) return Result.err(criado.unwrapErr());
    return this.persistir(criado.unwrap());
  }

  registrarMensagem(requestId: string, now: Date): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.registrarMensagemEnviada(now));
  }

  associar(
    requestId: string,
    documentId: string,
    comoAssociado: ComoAssociado,
    now: Date,
  ): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.associar(documentId, comoAssociado, now));
  }

  aguardarConfirmacao(requestId: string, now: Date): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.aguardarConfirmacao(now));
  }

  retornarPendente(
    requestId: string,
    now: Date,
    nota: string,
  ): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.retornarPendente(now, nota));
  }

  reabrir(
    requestId: string,
    motivo: string,
    por: string,
    now: Date,
  ): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.reabrir(motivo, por, now));
  }

  cancelar(
    requestId: string,
    motivo: string,
    por: string,
    now: Date,
  ): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.cancelar(motivo, por, now));
  }

  registrarLembrete(requestId: string, now: Date): Promise<Result<DocumentRequestState, Error>> {
    return this.transicionar(requestId, (agg) => agg.registrarLembrete(now));
  }

  // ── interno ─────────────────────────────────────────────────────────────────
  private async transicionar(
    requestId: string,
    mutacao: (agg: DocumentRequestAggregate) => Result<void, Error>,
  ): Promise<Result<DocumentRequestState, Error>> {
    const state = await this.store.porId(requestId);
    if (state === null) return Result.err(new Error(`solicitação ${requestId} não encontrada`));
    const reidratado = DocumentRequestAggregate.fromState(state); // Correção 2 — nunca aggregate inválido
    if (reidratado.isErr()) return Result.err(reidratado.unwrapErr());
    const agg = reidratado.unwrap();
    const resultado = mutacao(agg);
    if (resultado.isErr()) return Result.err(resultado.unwrapErr());
    return this.persistir(agg);
  }

  private async persistir(
    agg: DocumentRequestAggregate,
  ): Promise<Result<DocumentRequestState, Error>> {
    const estado = agg.toState();
    await this.store.salvar(estado);
    const events = agg.pullDomainEvents();
    if (this.eventos !== null && events.length > 0) {
      // Best-effort: publicação de auditoria nunca derruba a operação já persistida.
      await this.eventos.publicar(estado.requestId, events, estado).catch(() => undefined);
    }
    return Result.ok(estado);
  }
}
