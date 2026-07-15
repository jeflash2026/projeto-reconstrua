// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION INTENT — a ÚNICA coisa que o Runtime de Conversa executa.
//
// A Conversa NÃO decide. Ela recebe Intenções JÁ decididas pelo Executive Brain
// (Camada 2, determinístico, sem LLM) e apenas as executa como linguagem viva e
// entrega humana. Cada Intenção carrega sua PROVENIÊNCIA (`operationalRuleRef` +
// `fundamento`) — porque toda atuação da AHRI nasce de uma Regra Operacional
// (INV-AH-02; RO-R7-001; ADR-0002A decisão 5). A Conversa jamais cria Intenção.
//
// A Intenção NÃO carrega o texto: o texto é FRASEADO pelo LLM de expressão a
// partir da Intenção + contexto. A decisão está aqui; a linguagem, na Conversa.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A diretiva operacional decidida pelo Brain. Mapeia o "saber" da AHRI (spec 2B:
 * quando falar/esperar/perguntar/explicar/calar/insistir/mudar de assunto/
 * aguardar documentos/avisar prazos/acompanhar) e as saídas do Brain (ADR-0002A
 * §4.2: SPEAK/WAIT/CHARGE/ESCALATE/REQUEST_DOCUMENT/STOP/RESUME).
 */
export type IntentDirective =
  | 'speak' // falar (o ato específico vem em `speechAct`)
  | 'wait' // esperar — silêncio ativo (não fala)
  | 'await_documents' // aguardar documentos (pode pedir)
  | 'notify_deadline' // avisar prazo
  | 'accompany' // simplesmente acompanhar — presença, sem falar
  | 'insist' // insistir/cobrar
  | 'change_subject' // mudar de assunto
  | 'stop' // parar de conversar
  | 'resume' // retomar
  | 'handoff'; // escalar a humano — a Conversa cala (Notification cuida)

/** O ato de fala, quando a diretiva fala. Guia o LLM de expressão (não o decide). */
export type SpeechAct =
  | 'greet'
  | 'ask'
  | 'explain'
  | 'inform'
  | 'reassure'
  | 'follow_up'
  | 'request_document'
  | 'deadline_warning'
  | 'redirect';

export type IntentUrgency = 'low' | 'normal' | 'high';

/** A Intenção formada pelo Executive Brain. Imutável. */
export interface ConversationIntent {
  readonly id: string;
  readonly chatId: string;
  readonly directive: IntentDirective;
  /** Presente quando a diretiva fala; `null` quando é silenciosa (wait/stop/…). */
  readonly speechAct: SpeechAct | null;
  /** Assunto a tratar (derivado da Verdade/Etapa pelo Brain) — nunca inventado aqui. */
  readonly topic: string | null;
  /** Referências operacionais (docs, prazos) — do Brain, jamais fabricadas na Conversa. */
  readonly references: readonly string[];
  readonly urgency: IntentUrgency;
  /** PROVENIÊNCIA: qual Regra Operacional produziu esta intenção (INV-AH-02). */
  readonly operationalRuleRef: string | null;
  /** Fundamento constitucional/operacional da decisão. */
  readonly fundamento: string | null;
  /** Dica de tempo do Brain (ms), opcional; a humanização respeita e ajusta. */
  readonly timingHintMs: number | null;
  readonly formedAt: Date;
}

/** Uma diretiva produz fala (mensagem de saída)? As demais são silêncio/handoff. */
export function intentSpeaks(directive: IntentDirective): boolean {
  switch (directive) {
    case 'speak':
    case 'await_documents':
    case 'notify_deadline':
    case 'insist':
    case 'change_subject':
      return true;
    case 'wait':
    case 'accompany':
    case 'stop':
    case 'resume':
    case 'handoff':
      return false;
  }
}
