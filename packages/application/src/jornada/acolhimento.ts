// ─────────────────────────────────────────────────────────────────────────────
// ACOLHIMENTO ANTES DO PEDIDO (2026-09-24, caso REAL Angela 11 95707-5533)
//
// O dono, lendo o atendimento: "a AHRI virou psicóloga, interrogadora". No meio
// da coleta a cliente escreveu "Tenho empréstimo consignado que eu fiz" e
// recebeu de volta, seca, a MESMA cobrança do CPF — como se ninguém tivesse
// lido o que ela disse. É isso que faz o atendimento soar a interrogatório:
// perguntar sem nunca responder.
//
// Os roteiros de COLETA saem VERBATIM por decreto (caso Maria Aparecida: o
// humanizador reescreveu a triagem e DERRUBOU o pedido do CPF). Então aqui o
// acolhimento não reescreve nada: é UMA frase que vem ANTES do roteiro, que
// segue intacto. A frase é do LLM; esta peneira é determinística e, em
// qualquer dúvida, descarta — e o roteiro sai sozinho, como hoje.
// ─────────────────────────────────────────────────────────────────────────────
import { similarity } from '../conversation/phrasing.js';
import { pareceCobrancaDeDocumento } from '../conversation/sales-conversation-policy.js';
import {
  capturarCpf,
  ehChamamento,
  ehFalaDeAnalisePronta,
  ehFalaDePrazoOuAnalise,
  ehPedidoDeConfirmacao,
  ehSaudacaoPura,
} from './jornada-comercial.js';

/** O que o cliente disse pede resposta antes do próximo pedido?
 *
 *  Uma frase de verdade (4+ palavras) que não é saudação, não é chamamento
 *  ("alguém aí?") e não é o dado que acabamos de pedir — nesses casos o próprio
 *  roteiro já responde, e acrescentar conversa só atrasa. */
export function mereceAcolhimento(texto: string): boolean {
  const t = texto.trim();
  if (t === '' || ehSaudacaoPura(t) || ehChamamento(t)) return false;
  if (capturarCpf(t) !== null) return false;
  return t.split(/\s+/).filter((p) => p !== '').length >= 4;
}

/** Promessa é assunto do advogado, nunca de uma frase de acolhimento. */
const PROMESSA =
  /\bgaranto\b|\bcom certeza voc[êe]\b|\bvoc[êe] (vai|ir[áa]) receber\b|\bindeniza[çc][ãa]o\b|\bde volta o (dinheiro|valor)\b/i;

/** O PEDIDO é do roteiro. A frase que o antecede não fala de documento nenhum —
 *  senão ela duplica a cobrança ou, pior, a contradiz ("você já mandou"). */
const ASSUNTO_DO_ROTEIRO = /\bCPF\b|\bHISCON\b|\bextrato\b|\bdocumento\b|\bPDF\b|\banexo\b/i;

/** A frase pode ir na frente do roteiro? Uma reprovação = roteiro sozinho. */
export function acolhimentoAceitavel(texto: string, roteiro: string): boolean {
  const t = texto.trim();
  if (t === '' || t.length > 220) return false;
  if (t.includes('?')) return false; // a única pergunta do turno é a do roteiro
  if (/https?:\/\/|www\./i.test(t)) return false;
  if (/\d{4,}/.test(t)) return false; // prazo, valor, telefone: nada disso aqui
  if (ASSUNTO_DO_ROTEIRO.test(t)) return false;
  if (PROMESSA.test(t)) return false;
  if (pareceCobrancaDeDocumento(t) || ehFalaDePrazoOuAnalise(t)) return false;
  if (ehPedidoDeConfirmacao(t) || ehFalaDeAnalisePronta(t)) return false;
  // Dizer o roteiro com outras palavras não acolhe ninguém — só alonga.
  return similarity(t, roteiro) < 0.35;
}
