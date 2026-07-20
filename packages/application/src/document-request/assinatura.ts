// ─────────────────────────────────────────────────────────────────────────────
// ASSINATURA (Decreto Tráfego Pago · Parte B1) — procuração e contrato de
// honorários são solicitações em que o ADVOGADO ANEXA o documento e a AHRI o
// ENVIA ao cliente para assinar e devolver. As demais solicitações seguem o
// fluxo 15C intacto (cliente envia direto; AHRI registra e notifica).
//
// Nada aqui toca o aggregate (15C congelado): o anexo é infraestrutura de
// entrega, chaveado pelo requestId; o ciclo de vida continua o mesmo
// (created → messaged → received quando o cliente devolver assinado).
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentRequestState } from '@reconstrua/domain';

export interface AnexoParaAssinatura {
  readonly fileName: string;
  readonly mimeType: string;
  readonly base64: string;
}

/** Porta de persistência do anexo (JsonStore/Pg em produção; por requestId). */
export interface AnexoStore {
  salvar(requestId: string, anexo: AnexoParaAssinatura): Promise<void>;
  porRequest(requestId: string): Promise<AnexoParaAssinatura | null>;
}

/** Porta de ENVIO de documento pelo WhatsApp (Evolution sendMedia em produção). */
export interface EnviadorDeDocumento {
  sendDocument(chatId: string, anexo: AnexoParaAssinatura, caption: string): Promise<void>;
}

/** Mensagem AUTORADA que acompanha o documento a assinar (nunca inventada). */
export function mensagemDeAssinatura(state: DocumentRequestState, clienteNome: string): string {
  const saudacao = clienteNome.trim() !== '' ? `Olá, ${clienteNome}.` : 'Olá!';
  const extra = state.optionalMessage ? `\n\n${state.optionalMessage}` : '';
  return (
    `${saudacao}\n\n` +
    `${state.requestedBy}, responsável pelo seu processo, enviou um documento que precisa da sua assinatura:\n` +
    `${state.documentName}${extra}\n\n` +
    `Estou te mandando o arquivo aqui em seguida. Assim que assinar, é só devolver por aqui mesmo que eu registro e aviso a equipe.`
  );
}
