// ─────────────────────────────────────────────────────────────────────────────
// DocumentRequestAggregate (GO-LIVE 15C · Workflow 2) — a SOLICITAÇÃO
// COMPLEMENTAR de documento como cidadã de primeira classe do domínio jurídico.
//
// O que esta entidade FAZ (e só isto):
//   • representa a NECESSIDADE documental decidida pelo ADVOGADO — nunca pela IA;
//   • PERTENCE a um Caso (Decisão 5): caseId é a identidade funcional; clientId
//     é apenas o canal de entrega (a conversa da AHRI);
//   • NÃO armazena o documento (Decisão 6): cumpre-se por referência
//     `fulfilledBy` (DocumentId do subsistema documental) — jamais caminhos de
//     arquivo/uploads;
//   • ciclo de vida próprio (máquina de estados abaixo), com REABERTURA
//     (Decisão 7): nunca apagar, nunca recriar — reabrir preservando o histórico;
//   • SLA próprio (dueAt/reminderPolicy): a política de lembrete pertence à
//     entidade, não ao fluxo de conversa;
//   • auditoria completa: createdBy/createdAt/updatedAt + history append-only.
//
// O que NÃO faz: não conversa, não decide conteúdo, não lê documentos, não
// escolhe canais — camadas de aplicação/conversa apenas EXECUTAM o que aqui
// está decidido.
//
// Estados:  PENDING ⇄ AWAITING_CONFIRMATION → RECEIVED ⇄ REOPENED  · CANCELLED
// (CANCELLED é terminal; RECEIVED pode ser reaberto; REOPENED comporta-se como
//  pendência: cobra, SLA ativo, pode ser associado de novo.)
// ─────────────────────────────────────────────────────────────────────────────
import { AggregateRoot } from '../kernel/aggregate-root.js';
import { Result } from '../kernel/result.js';
import { DocumentRequestId } from './document-request-id.js';
import {
  DocumentRequestCancelled,
  DocumentRequestConfirmationAsked,
  DocumentRequestCreated,
  DocumentRequestMessaged,
  DocumentRequestReceived,
  DocumentRequestReminded,
  DocumentRequestReopened,
} from './document-request-events.js';

export type DocumentRequestStatus =
  'PENDING' | 'AWAITING_CONFIRMATION' | 'RECEIVED' | 'REOPENED' | 'CANCELLED';
export type DocumentRequestOrigin = 'painel-advogado' | 'sistema';
export type DocumentRequestPriority = 'normal' | 'alta';
export type ReminderPolicy = 'nenhum' | '24h' | '48h' | '72h' | 'semanal';
export type ComoAssociado = 'unica' | 'ia' | 'confirmacao-cliente';

export interface DocumentRequestHistoryEntry {
  readonly at: Date;
  readonly por: string;
  readonly de: DocumentRequestStatus | null;
  readonly para: DocumentRequestStatus;
  readonly nota: string | null;
}

/** Snapshot serializável do estado (read model / reidratação). */
export interface DocumentRequestState {
  readonly requestId: string;
  readonly caseId: string; // identidade FUNCIONAL (Decisão 5)
  readonly clientId: string;
  readonly lawyerId: string;
  readonly documentName: string;
  readonly optionalMessage: string | null;
  readonly origin: DocumentRequestOrigin;
  readonly priority: DocumentRequestPriority;
  readonly requestedBy: string;
  readonly status: DocumentRequestStatus;
  readonly receivedAt: Date | null;
  readonly fulfilledBy: string | null; // DocumentId (Decisão 6) — nunca arquivo
  readonly dueAt: Date | null;
  readonly reminderPolicy: ReminderPolicy;
  readonly lastReminderAt: Date | null;
  /** Correção 1 — a AHRI já iniciou a comunicação desta solicitação? (por abertura) */
  readonly lastMessagedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly history: readonly DocumentRequestHistoryEntry[];
}

export interface CriarDocumentRequestInput {
  readonly requestId: DocumentRequestId;
  readonly caseId: string;
  readonly clientId: string;
  readonly lawyerId: string;
  readonly documentName: string;
  readonly optionalMessage?: string;
  readonly origin?: DocumentRequestOrigin;
  readonly priority?: DocumentRequestPriority;
  readonly requestedBy: string;
  readonly dueAt?: Date;
  readonly reminderPolicy?: ReminderPolicy;
  readonly createdAt: Date;
}

const ABERTOS: readonly DocumentRequestStatus[] = ['PENDING', 'AWAITING_CONFIRMATION', 'REOPENED'];
const STATUS_VALIDOS: ReadonlySet<string> = new Set([
  'PENDING',
  'AWAITING_CONFIRMATION',
  'RECEIVED',
  'REOPENED',
  'CANCELLED',
]);
const POLITICAS_VALIDAS: ReadonlySet<string> = new Set(['nenhum', '24h', '48h', '72h', 'semanal']);

/** Heurística de segurança da Decisão 6: refs com cara de caminho/upload são rejeitadas. */
function pareceCaminhoDeArquivo(ref: string): boolean {
  return /[\\/]|\.(pdf|png|jpe?g|docx?)$/i.test(ref);
}

export class DocumentRequestAggregate extends AggregateRoot<DocumentRequestId> {
  private constructor(private props: Mutable<DocumentRequestState>) {
    super(DocumentRequestId.fromString(props.requestId));
  }

  // ── Fábricas ────────────────────────────────────────────────────────────────

  static criar(input: CriarDocumentRequestInput): Result<DocumentRequestAggregate, Error> {
    const documentName = input.documentName.trim();
    if (documentName === '')
      return Result.err(
        new Error('documentName é obrigatório — o advogado precisa nomear o documento'),
      );
    // Decisão 5 — a solicitação SEMPRE pertence a um Caso.
    if (input.caseId.trim() === '')
      return Result.err(
        new Error('caseId é obrigatório — a solicitação pertence a um Caso Jurídico'),
      );
    if (input.clientId.trim() === '')
      return Result.err(new Error('clientId é obrigatório — canal de entrega da AHRI'));

    const state: Mutable<DocumentRequestState> = {
      requestId: input.requestId.toString(),
      caseId: input.caseId,
      clientId: input.clientId,
      lawyerId: input.lawyerId,
      documentName,
      optionalMessage: input.optionalMessage?.trim() ? input.optionalMessage.trim() : null,
      origin: input.origin ?? 'painel-advogado',
      priority: input.priority ?? 'normal',
      requestedBy: input.requestedBy,
      status: 'PENDING',
      receivedAt: null,
      fulfilledBy: null,
      dueAt: input.dueAt ?? null,
      reminderPolicy: input.reminderPolicy ?? 'nenhum',
      lastReminderAt: null,
      lastMessagedAt: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      createdBy: input.lawyerId,
      history: [
        {
          at: input.createdAt,
          por: input.lawyerId,
          de: null,
          para: 'PENDING',
          nota: `criada: ${documentName}`,
        },
      ],
    };
    const agg = new DocumentRequestAggregate(state);
    agg.addDomainEvent(new DocumentRequestCreated(state.requestId, input.createdAt));
    return Result.ok(agg);
  }

  /**
   * Correção 2 — REIDRATAÇÃO SEGURA: valida as invariantes mínimas antes de
   * materializar. JSON corrompido/estado incoerente ⇒ erro EXPLÍCITO para a
   * camada superior; nunca um aggregate inválido em memória.
   */
  static fromState(state: DocumentRequestState): Result<DocumentRequestAggregate, Error> {
    const invalido = (msg: string): Result<DocumentRequestAggregate, Error> =>
      Result.err(new Error(`reidratação inválida (${state.requestId || 'sem id'}): ${msg}`));

    if (!state.caseId?.trim()) return invalido('caseId obrigatório');
    if (!state.clientId?.trim()) return invalido('clientId obrigatório');
    if (!state.documentName?.trim()) return invalido('documentName obrigatório');
    if (!STATUS_VALIDOS.has(state.status))
      return invalido(`status desconhecido: ${String(state.status)}`);
    if (!POLITICAS_VALIDAS.has(state.reminderPolicy))
      return invalido(`reminderPolicy desconhecida: ${String(state.reminderPolicy)}`);
    if (state.dueAt !== null && Number.isNaN(state.dueAt.getTime()))
      return invalido('dueAt inválida');
    // fulfilledBy coerente com o estado: RECEIVED ⇔ cumprida por DocumentId.
    if (state.status === 'RECEIVED' && (state.fulfilledBy === null || state.receivedAt === null)) {
      return invalido('RECEIVED sem fulfilledBy/receivedAt');
    }
    if (state.status !== 'RECEIVED' && state.fulfilledBy !== null) {
      return invalido(`fulfilledBy presente em status ${state.status}`);
    }
    if (state.fulfilledBy !== null && pareceCaminhoDeArquivo(state.fulfilledBy)) {
      return invalido('fulfilledBy parece caminho de arquivo (Decisão 6)');
    }
    return Result.ok(new DocumentRequestAggregate({ ...state, history: [...state.history] }));
  }

  // ── Transições ──────────────────────────────────────────────────────────────

  /**
   * Correção 1 — a AHRI iniciou a comunicação com o cliente sobre ESTA
   * solicitação. Mudança OBSERVÁVEL do domínio (não evento técnico): emite
   * DocumentRequestMessaged, atualiza updatedAt e o history. Duplicidade
   * desnecessária é impedida: uma mensagem inicial por ABERTURA (a reabertura
   * zera e permite mensagear de novo).
   */
  registrarMensagemEnviada(now: Date): Result<void, Error> {
    if (!ABERTOS.includes(this.props.status)) {
      return Result.err(
        new Error(`mensagem só para solicitações abertas (status=${this.props.status})`),
      );
    }
    if (this.props.lastMessagedAt !== null) {
      return Result.err(
        new Error('mensagem inicial já registrada para esta abertura — duplicidade desnecessária'),
      );
    }
    this.props.lastMessagedAt = now;
    this.props.updatedAt = now;
    this.props.history = [
      ...this.props.history,
      {
        at: now,
        por: 'ahri',
        de: this.props.status,
        para: this.props.status,
        nota: 'mensagem enviada ao cliente',
      },
    ];
    this.addDomainEvent(new DocumentRequestMessaged(this.props.requestId, now));
    return Result.ok(undefined);
  }

  /** Múltiplas pendências + dúvida ⇒ aguarda a confirmação do cliente. */
  aguardarConfirmacao(now: Date): Result<void, Error> {
    if (this.props.status !== 'PENDING' && this.props.status !== 'REOPENED') {
      return Result.err(
        new Error(`só pendências aguardam confirmação (status=${this.props.status})`),
      );
    }
    this.transicionar(
      'AWAITING_CONFIRMATION',
      'ahri',
      now,
      'dúvida na associação — confirmando com o cliente',
    );
    this.addDomainEvent(new DocumentRequestConfirmationAsked(this.props.requestId, now));
    return Result.ok(undefined);
  }

  /** Cliente negou ("é outro documento") ⇒ volta a pendente. */
  retornarPendente(now: Date, nota: string): Result<void, Error> {
    if (this.props.status !== 'AWAITING_CONFIRMATION') {
      return Result.err(
        new Error(`só AWAITING_CONFIRMATION retorna a pendente (status=${this.props.status})`),
      );
    }
    this.transicionar('PENDING', 'ahri', now, nota);
    return Result.ok(undefined);
  }

  /** Decisão 6 — cumpre-se por REFERÊNCIA documental (DocumentId), nunca arquivo. */
  associar(fulfilledBy: string, comoAssociado: ComoAssociado, now: Date): Result<void, Error> {
    if (!ABERTOS.includes(this.props.status)) {
      return Result.err(new Error(`solicitação não está aberta (status=${this.props.status})`));
    }
    const ref = fulfilledBy.trim();
    if (ref === '') return Result.err(new Error('fulfilledBy (DocumentId) é obrigatório'));
    if (pareceCaminhoDeArquivo(ref)) {
      return Result.err(
        new Error(
          'fulfilledBy deve ser um DocumentId do subsistema documental — nunca caminho de arquivo/upload (Decisão 6)',
        ),
      );
    }
    this.props.fulfilledBy = ref;
    this.props.receivedAt = now;
    this.transicionar('RECEIVED', 'ahri', now, `cumprida por DocumentId=${ref} (${comoAssociado})`);
    this.addDomainEvent(new DocumentRequestReceived(this.props.requestId, now));
    return Result.ok(undefined);
  }

  /** Decisão 7 — REABRIR (documento incorreto): nunca apagar, nunca recriar. */
  reabrir(motivo: string, por: string, now: Date): Result<void, Error> {
    if (this.props.status !== 'RECEIVED') {
      return Result.err(new Error(`só RECEIVED pode ser reaberta (status=${this.props.status})`));
    }
    const anterior = this.props.fulfilledBy;
    this.props.fulfilledBy = null; // o vínculo anterior fica preservado no history
    this.props.receivedAt = null;
    this.props.lastReminderAt = null; // SLA reinicia
    this.props.lastMessagedAt = null; // a AHRI volta a mensagear nesta abertura (Correção 1)
    this.transicionar(
      'REOPENED',
      por,
      now,
      `reaberta: ${motivo}${anterior ? ` (anterior: DocumentId=${anterior})` : ''}`,
    );
    this.addDomainEvent(new DocumentRequestReopened(this.props.requestId, now));
    return Result.ok(undefined);
  }

  /** Cancela qualquer solicitação aberta (condição de parada do SLA). */
  cancelar(motivo: string, por: string, now: Date): Result<void, Error> {
    if (!ABERTOS.includes(this.props.status)) {
      return Result.err(
        new Error(`só solicitações abertas podem ser canceladas (status=${this.props.status})`),
      );
    }
    this.transicionar('CANCELLED', por, now, `cancelada: ${motivo}`);
    this.addDomainEvent(new DocumentRequestCancelled(this.props.requestId, now));
    return Result.ok(undefined);
  }

  /** SLA — registra um lembrete automático enviado ao cliente. */
  registrarLembrete(now: Date): Result<void, Error> {
    if (!ABERTOS.includes(this.props.status)) {
      return Result.err(
        new Error(`lembrete só para solicitações abertas (status=${this.props.status})`),
      );
    }
    this.props.lastReminderAt = now;
    this.props.updatedAt = now;
    this.props.history = [
      ...this.props.history,
      {
        at: now,
        por: 'ahri',
        de: this.props.status,
        para: this.props.status,
        nota: 'lembrete automático enviado',
      },
    ];
    this.addDomainEvent(new DocumentRequestReminded(this.props.requestId, now));
    return Result.ok(undefined);
  }

  // ── Consulta ────────────────────────────────────────────────────────────────

  get status(): DocumentRequestStatus {
    return this.props.status;
  }

  estaAberta(): boolean {
    return ABERTOS.includes(this.props.status);
  }

  toState(): DocumentRequestState {
    return { ...this.props, history: [...this.props.history] };
  }

  // ── interno ─────────────────────────────────────────────────────────────────
  private transicionar(
    para: DocumentRequestStatus,
    por: string,
    now: Date,
    nota: string | null,
  ): void {
    const de = this.props.status;
    this.props.status = para;
    this.props.updatedAt = now;
    this.props.history = [...this.props.history, { at: now, por, de, para, nota }];
  }
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
