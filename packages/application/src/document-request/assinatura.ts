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
import { saudacaoPorHorario } from './document-request.js';

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

/** Mensagem AUTORADA que acompanha o documento a assinar (nunca inventada).
 *  Saudação por horário + o Dr(a) responsável (state.requestedBy = NOME) + o
 *  convite para baixar, assinar e devolver. O arquivo segue logo em seguida. */
export function mensagemDeAssinatura(
  state: DocumentRequestState,
  clienteNome: string,
  now: Date = new Date(),
): string {
  const saud = saudacaoPorHorario(now);
  const abertura = clienteNome.trim() !== '' ? `${saud}, ${clienteNome.trim()}.` : `${saud}!`;
  const extra = state.optionalMessage ? `\n\n${state.optionalMessage}` : '';
  return (
    `${abertura}\n\n` +
    `Seu caso já foi estudado e encontramos algumas irregularidades. Agora o(a) Dr(a). ` +
    `${state.requestedBy} precisa coletar a sua assinatura no documento a seguir:\n\n` +
    `${state.documentName}${extra}\n\n` +
    `Vou te enviar o arquivo aqui em seguida — é só baixar, assinar e devolver por aqui mesmo. ` +
    `Assim que você devolver, eu registro e aviso o(a) Dr(a). ${state.requestedBy}.`
  );
}
