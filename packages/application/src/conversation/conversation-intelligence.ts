// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION INTELLIGENCE (GO-LIVE 9E) — a condução do diálogo por CURIOSIDADE.
//
// Posição na arquitetura (decreto): Planner → Conversation Intelligence →
// Prompt Builder → Expression. Ela NÃO decide missão, NÃO altera fatos, NÃO
// toca Truth Layer/Brain Facts/Planner. Ela escolhe apenas o PRÓXIMO PASSO da
// conversa: responder, observar, UMA única curiosidade natural, esperar.
//
// GENÉRICA por construção (AHRI Business/Life/…): trabalha só com sinais
// universais — propósito percebido (vocabulário fechado), fatos conhecidos
// (presença de contexto factual), perguntas já feitas (mecânico, dos outbounds)
// e o objetivo do turno (intenção do Planner). NENHUM conceito de domínio.
//
// Disciplina obrigatória:
//  • uma resposta · UMA curiosidade no máximo · esperar;
//  • nunca duas perguntas; nunca virar entrevista;
//  • nunca perguntar o que já se sabe (fatos fornecidos) — minimizar esforço;
//  • nunca repetir pergunta já feita.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationIntent } from './intent.js';
import type { ConversationContextView } from './ports.js';
import { doseConversa, turnoSocial } from './conversation-dosage.js';
import { memoriaDaConversa } from './conversation-memory.js';
import { aprenderDaConversa, resumoDoConhecimento, type CatalogoDeConhecimento, type FatoAprendido } from './conversation-knowledge.js';
import { CATALOGO_CONSIGNADO_INSS } from './consignado-knowledge.js';

export type ModoDoTurno = 'social' | 'descoberta' | 'informativo';

export interface CondutaDoTurno {
  readonly modo: ModoDoTurno;
  /** Fatos dosados para o turno (herda a Camada de Conversação 9D). */
  readonly casoFatos: string | null;
  /** A conduta do turno — curta, um princípio; nunca um script. */
  readonly conduta: string;
  /** Perguntas já feitas pela AHRI (mecânico) — proibidas de repetir. */
  readonly perguntasJaFeitas: readonly string[];
  /** GO-LIVE 9F — o fio da conversa ativa ("perguntei X → respondeu Y"). */
  readonly fioDaConversa: string | null;
  /** GO-LIVE 9G — fatos APRENDIDOS na conversa (derivados; nunca persistidos). */
  readonly conhecimento: readonly FatoAprendido[];
  /** Resumo compacto do conhecimento ("beneficio=aposentadoria; …") p/ o fraseado. */
  readonly conhecimentoResumo: string | null;
}

/** Extrai, mecanicamente, as perguntas já feitas nos últimos outbounds. */
export function perguntasFeitas(recentOutboundTexts: readonly string[]): readonly string[] {
  return recentOutboundTexts
    .flatMap((t) => t.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.endsWith('?'))
    .slice(0, 6);
}

/** O próximo passo da conversa — determinístico; a curiosidade em si é fraseada
 *  pela Expression, mas SOB esta disciplina (no máximo uma; nunca redundante). */
export function conduzirTurno(
  intent: ConversationIntent,
  context: ConversationContextView,
  // GO-LIVE 9G: o catálogo é do DOMÍNIO (default = Reconstrua Consignado INSS);
  // AHRI Business/Life trocam apenas este parâmetro — o motor é genérico.
  catalogo: CatalogoDeConhecimento = CATALOGO_CONSIGNADO_INSS,
): CondutaDoTurno {
  const dose = doseConversa(intent, context);
  const purpose = context.lastPercept?.enrichment?.perceivedPurpose ?? 'unknown';

  // GO-LIVE 9F — Conversational Memory: a memória ATIVA do diálogo (derivada,
  // nunca persistida). Perguntas RESPONDIDAS são assunto encerrado; as feitas
  // (respondidas ∪ abertas ∪ janela recente) nunca podem ser repetidas.
  const memoria = memoriaDaConversa(intent, context);
  const jaFeitas = [
    ...new Set([
      ...memoria.perguntasRespondidas,
      ...memoria.perguntasAbertas,
      ...perguntasFeitas(context.recentOutboundTexts),
    ]),
  ].slice(0, 10);

  // GO-LIVE 9G — Conversation Knowledge: FATOS aprendidos na conversa ativa
  // (derivados; morrem com ela). A memória mantém o fio; o conhecimento, o que
  // já foi APRENDIDO — e o que foi aprendido jamais é perguntado de novo.
  const conhecimento = aprenderDaConversa(context, catalogo);
  const conhecimentoResumo = resumoDoConhecimento(conhecimento);

  if (turnoSocial(intent, context)) {
    // A pergunta "como posso ajudar?" É a única curiosidade do turno social.
    return {
      modo: 'social',
      casoFatos: dose.casoFatos,
      conduta: 'apenas retribua o cumprimento com calor humano e pergunte como pode ajudar — nada mais',
      perguntasJaFeitas: jaFeitas,
      fioDaConversa: memoria.fioDaConversa,
      conhecimento,
      conhecimentoResumo,
    };
  }

  // 9F — continuidade: cada resposta nasce da resposta ANTERIOR, nunca de um
  // turno isolado. O planejamento do turno: o que já descobrimos? o que falta?
  // qual a MENOR pergunta restante? Se nada falta — não perguntar.
  const continuidade =
    memoria.fioDaConversa !== null
      ? '; continue EXATAMENTE de onde a conversa parou — a próxima curiosidade nasce da última resposta da pessoa; ' +
        'nunca reabra assunto já respondido; nunca volte ao começo; se nada falta descobrir, apenas confirme com naturalidade e espere'
      : '';

  // 9G — condução pelo conhecimento: o já aprendido dirige a PRÓXIMA curiosidade.
  const aprendizado =
    conhecimentoResumo !== null
      ? '; use o CONHECIMENTO JÁ APRENDIDO para escolher a próxima curiosidade e JAMAIS pergunte algo cujo fato já foi aprendido'
      : '';

  if (purpose === 'question') {
    // A pessoa perguntou: responder é o centro; curiosidade só se faltar algo.
    return {
      modo: 'informativo',
      casoFatos: dose.casoFatos,
      conduta:
        'a MENOR resposta verdadeira: responda somente ao que a pessoa pediu; nunca antecipe informações não perguntadas; ' +
        'não pergunte nada que os FATOS fornecidos já respondem; se faltar algo essencial, faça NO MÁXIMO UMA pergunta e espere' +
        continuidade +
        aprendizado,
      perguntasJaFeitas: jaFeitas,
      fioDaConversa: memoria.fioDaConversa,
      conhecimento,
      conhecimentoResumo,
    };
  }

  // A pessoa trouxe algo (pedido/desabafo/incerto): DESCOBERTA por curiosidade.
  return {
    modo: 'descoberta',
    casoFatos: dose.casoFatos,
    conduta:
      'acolha o que a pessoa trouxe em UMA frase curta e humana; depois escolha UMA única curiosidade natural — a MENOR ' +
      'pergunta que mais ajuda a entender o que ela precisa — e espere a resposta; NUNCA faça duas perguntas; nunca vire ' +
      'entrevista; nunca antecipe explicações sobre empresa, serviços ou etapas; não pergunte o que os FATOS já dizem nem repita pergunta já feita' +
      continuidade +
      aprendizado,
    perguntasJaFeitas: jaFeitas,
    fioDaConversa: memoria.fioDaConversa,
    conhecimento,
    conhecimentoResumo,
  };
}
