// ─────────────────────────────────────────────────────────────────────────────
// JORNADA COMERCIAL — MÁQUINA DE ESTADOS DETERMINÍSTICA (decreto 2026-07-20:
// "Pare de corrigir sintomas").
//
// A jornada — da primeira mensagem à ativação do Portal — é governada por UM
// runtime determinístico. A LLM NÃO decide nenhum passo: as respostas do funil
// são AUTORADAS aqui e derivadas de FATOS registrados. Fonte única da verdade:
//   • etapa (DERIVADA, nunca armazenada — impossível dessincronizar);
//   • nome e cidade (capturados deterministicamente do texto);
//   • consentimento (palavras de interesse, deterministicamente);
//   • documentos recebidos/pendentes/próximo (contabilidade onboarding-documental).
//
// Etapas (derivação pura em `derivarEtapa`):
//   IDENTIFICACAO → CONSENTIMENTO → TRIAGEM (RG f/v|CNH → comprovante → HISCON)
//   → CONCLUIDA (D2/Portal assume; a conversa livre volta a existir na análise).
// ─────────────────────────────────────────────────────────────────────────────

export type EtapaJornada = 'IDENTIFICACAO' | 'CONSENTIMENTO' | 'TRIAGEM' | 'CONCLUIDA';

/** O registro persistido da jornada (o que NÃO é derivável de outra fonte). */
export interface JornadaRecord {
  readonly chatId: string;
  readonly nome: string | null;
  readonly cidade: string | null;
  readonly consentiu: boolean;
  readonly recusou: boolean;
  /** O que o ÚLTIMO turno capturou (nuance de fraseado: "Prazer, X!"). */
  readonly ultimaCaptura: 'nome' | 'cidade' | 'nome-cidade' | 'consentimento' | null;
  /** O turno respondeu só o ACK (registro processando) e a PROGRESSÃO ainda
   *  não foi falada — a classificação tardia deve enviá-la sozinha. */
  readonly aguardandoProgressao: boolean;
  readonly atualizadoEm: Date;
}

export function novaJornada(chatId: string, now: Date): JornadaRecord {
  return { chatId, nome: null, cidade: null, consentiu: false, recusou: false, ultimaCaptura: null, aguardandoProgressao: false, atualizadoEm: now };
}

/** Os FATOS de que a derivação precisa (jornada + contabilidade documental). */
export interface FatosDaJornada {
  readonly registro: JornadaRecord;
  readonly docsRecebidos: number;
  readonly docsCompletos: boolean;
  /** Rótulo humano do próximo documento (contabilidade) — null se completa. */
  readonly proximoDocumento: string | null;
  /** O ÚLTIMO registro documental (rótulo + quando) — decide se a resposta do
   *  turno de documento fala o FATO ("recebi a frente, manda o verso") ou o
   *  ack ("registrando"). */
  readonly ultimoRegistrado: string | null;
  readonly ultimoRegistroEm: Date | null;
}

/** DERIVAÇÃO PURA da etapa — a etapa nunca é armazenada, nunca dessincroniza. */
export function derivarEtapa(f: FatosDaJornada): EtapaJornada {
  if (f.docsCompletos) return 'CONCLUIDA';
  // Documento já enviado = participação: consentimento implícito; a triagem manda.
  if (f.docsRecebidos > 0) return 'TRIAGEM';
  if (f.registro.nome === null || f.registro.cidade === null) return 'IDENTIFICACAO';
  if (!f.registro.consentiu) return 'CONSENTIMENTO';
  return 'TRIAGEM';
}

// ── Interpretações DETERMINÍSTICAS do texto do cliente ────────────────────────

const SAUDACOES = /^(oi+|ol[áa]+|bom dia|boa tarde|boa noite|hey|opa|e a[íi])[!.,\s]*$/i;
const AFIRMATIVAS = /\b(sim|quero|pode|claro|vamos|aceito|bora|com certeza|isso|positivo|tenho interesse|ok|okay|beleza|demorou|manda|pode sim|quero sim)\b/i;
const NEGATIVAS = /\b(n[ãa]o|nao quero|agora n[ãa]o|depois|talvez mais tarde|sem interesse|deixa)\b/i;

export function ehSaudacaoPura(texto: string): boolean {
  return SAUDACOES.test(texto.trim());
}

export function interpretarInteresse(texto: string): 'sim' | 'nao' | 'incerto' {
  const t = texto.trim();
  // NEGAÇÃO tem precedência: "não quero" contém "quero" — sem precedência, a
  // recusa viraria consentimento (defeito pego em teste).
  if (NEGATIVAS.test(t)) return 'nao';
  if (AFIRMATIVAS.test(t)) return 'sim';
  return 'incerto';
}

/** Captura determinística de NOME e CIDADE de uma mensagem da etapa de
 *  identificação. "Isabel, sou de Santa Ernestina - SP" ⇒ ambos; "Isabel" ⇒
 *  nome; com nome já conhecido, o texto vira a cidade. Saudações puras não
 *  capturam nada. */
export function capturarIdentificacao(
  texto: string,
  atual: { nome: string | null; cidade: string | null },
): { nome: string | null; cidade: string | null } {
  const t = texto.trim();
  if (t === '' || ehSaudacaoPura(t)) return { nome: null, cidade: null };

  const limparCidade = (s: string): string =>
    s.replace(/^(sou\s+de|moro\s+em|de|da|do|em)\s+/i, '').replace(/\s*[-–]\s*[A-Z]{2}$/u, (m) => m).trim();
  const limparNome = (s: string): string => s.replace(/^(me\s+chamo|meu\s+nome\s+[ée]|sou\s+a|sou\s+o|sou)\s+/i, '').trim();

  // "Isabel Rodrigues eu sou de santa ernestina" (SEM vírgula) — o conector
  // "sou de"/"moro em" separa nome e cidade na mesma frase.
  const conector = /^(.+?)[\s,]+(?:eu\s+)?(?:sou\s+de|moro\s+em)\s+(.+)$/i.exec(t);
  if (conector) {
    const nome = limparNome(conector[1] ?? '');
    const cidade = limparCidade(conector[2] ?? '');
    if (nome !== '' && cidade !== '') return { nome, cidade };
  }

  const virgula = t.indexOf(',');
  if (virgula > 0) {
    const nome = limparNome(t.slice(0, virgula));
    const cidade = limparCidade(t.slice(virgula + 1));
    return { nome: nome !== '' ? nome : null, cidade: cidade !== '' ? cidade : null };
  }
  if (atual.nome === null) {
    const nome = limparNome(t);
    return { nome: nome !== '' ? nome : null, cidade: null };
  }
  if (atual.cidade === null) {
    const cidade = limparCidade(t);
    return { nome: null, cidade: cidade !== '' ? cidade : null };
  }
  return { nome: null, cidade: null };
}

const PERGUNTA_DE_DIREITO = /\bdireito\b|\bdireitos\b|me\s+enquadr|tenho\s+como|eleg[íi]v|fa[çc]o\s+jus/i;
export function ehPerguntaDeDireito(texto: string): boolean {
  return PERGUNTA_DE_DIREITO.test(texto);
}

// ── MENSAGENS AUTORADAS (o conteúdo do funil — a LLM nunca as decide) ─────────

export const MENSAGENS_JORNADA = {
  boasVindas:
    'Oi! 😊 Seja muito bem-vindo(a)! Me chamo Ahri e a partir de agora vou te acompanhar do começo ao fim dessa jornada.\n\n' +
    'Pra gente começar, pode me dizer seu nome completo e a cidade onde você mora?',
  pedirNomeECidade: 'Pra eu te ajudar direitinho, me conta seu nome completo e a cidade onde você mora? 😊',
  pedirCidade: (nome: string): string => `Prazer, ${nome}! 😊 E de qual cidade você fala?`,
  pedirNome: 'E qual é o seu nome completo? 😊',
  explicacaoConsentimento: (nome: string): string =>
    `${nome !== '' ? `Prazer, ${nome}! ` : ''}Deixa eu te explicar rapidinho como funciona: nossa equipe analisa o seu consignado do INSS pra verificar se existe alguma irregularidade nos descontos do benefício. Se encontrarmos algo fora do previsto, aí sim é possível buscar a revisão e a recuperação desses valores.\n\n` +
    'A análise é gratuita e sem compromisso — e só depois dela dá pra saber se existe algum direito no seu caso.\n\n' +
    'Você tem interesse em fazer essa análise?',
  reforcoConsentimento: 'Só me confirma: você tem interesse em fazer a análise gratuita do seu consignado? 😊',
  recusa:
    'Sem problemas! 😊 Fico à disposição — se mudar de ideia ou tiver qualquer dúvida sobre a análise, é só me chamar por aqui.',
  iniciarTriagem: (proximo: string): string =>
    'Que ótimo! Vamos começar então 😊\n\n' +
    `Vou precisar de apenas três documentos, um por vez — nada complicado. O primeiro: ${proximo}. Pode mandar foto ou print.`,
  aguardandoDocumento: (proximo: string): string =>
    `Estou aguardando: ${proximo}. Pode mandar foto ou print por aqui mesmo, no seu tempo. 😊`,
  ackDocumento:
    'Recebi aqui! 📄 Só um instante que já estou registrando — assim que concluir, te confirmo o próximo passo.',
  documentoRegistrado: (registrado: string, proximo: string): string =>
    `Recebi! ✅ Registrado: ${registrado}. Agora me manda, por favor: ${proximo}.`,
  documentoRegistradoCompleto: (registrado: string): string =>
    `Recebi! ✅ Registrado: ${registrado}. Com isso sua documentação inicial está completa — já te mando os próximos passos. 🎉`,
  comprovanteConjuge:
    'Se você não tiver um comprovante de endereço no seu nome, o do seu cônjuge também vale, viu? 😊',
} as const;

/** A ENTRADA de um turno, já normalizada pelo runtime. */
export interface EntradaDoTurno {
  readonly tipo: 'texto' | 'documento';
  readonly texto: string;
  readonly primeiroContato: boolean;
  /** Quando a mensagem foi enviada (percept) — compara com ultimoRegistroEm. */
  readonly timestamp: Date | null;
}

/** O documento DESTE turno já está registrado na contabilidade? (fato puro) */
export function registroDoTurnoConcluido(f: FatosDaJornada, entrada: EntradaDoTurno): boolean {
  return (
    entrada.tipo === 'documento' &&
    f.ultimoRegistroEm !== null &&
    entrada.timestamp !== null &&
    f.ultimoRegistroEm.getTime() >= entrada.timestamp.getTime()
  );
}

/**
 * A RESPOSTA AUTORADA do turno — decisão 100% determinística.
 * A LLM não participa: dado o mesmo estado e a mesma entrada, a mesma resposta.
 */
export function responderTurno(f: FatosDaJornada, entrada: EntradaDoTurno): string {
  const etapa = derivarEtapa(f);
  const r = f.registro;

  // Documento enviado — a correção do decreto de diagnóstico: a resposta
  // CONSULTA o estado. Registro deste turno JÁ concluído (a espera in-turn
  // aterrissou a classificação antes da expressão) ⇒ fala o FATO:
  // "Recebi a frente do RG. Agora envie o verso." Ainda processando ⇒ ack
  // (e a progressão tardia fala sozinha — marcador aguardandoProgressao).
  if (entrada.tipo === 'documento') {
    if (registroDoTurnoConcluido(f, entrada) && f.ultimoRegistrado !== null) {
      if (f.docsCompletos) return MENSAGENS_JORNADA.documentoRegistradoCompleto(f.ultimoRegistrado);
      return MENSAGENS_JORNADA.documentoRegistrado(f.ultimoRegistrado, f.proximoDocumento ?? 'o documento pendente');
    }
    return MENSAGENS_JORNADA.ackDocumento;
  }

  // Pergunta de direito/elegibilidade tem resposta canônica, em qualquer etapa.
  const prefixoDireito = ehPerguntaDeDireito(entrada.texto)
    ? 'É possível, mas somente conseguimos afirmar após analisar gratuitamente o seu HISCON (histórico de empréstimos consignados do INSS). '
    : '';

  switch (etapa) {
    case 'IDENTIFICACAO': {
      if (entrada.primeiroContato) return prefixoDireito + MENSAGENS_JORNADA.boasVindas;
      if (r.nome !== null && r.cidade === null) {
        // A nuance do decreto: "muito prazer Isabel, e de que cidade você fala?"
        return prefixoDireito + MENSAGENS_JORNADA.pedirCidade(r.nome);
      }
      if (r.nome === null && r.cidade !== null) return prefixoDireito + MENSAGENS_JORNADA.pedirNome;
      return prefixoDireito + MENSAGENS_JORNADA.pedirNomeECidade;
    }
    case 'CONSENTIMENTO': {
      if (r.ultimaCaptura === 'nome' || r.ultimaCaptura === 'cidade' || r.ultimaCaptura === 'nome-cidade') {
        // Identificação recém-completa ⇒ explicação + pergunta de interesse (uma mensagem).
        return prefixoDireito + MENSAGENS_JORNADA.explicacaoConsentimento(r.nome ?? '');
      }
      if (r.recusou) return prefixoDireito + MENSAGENS_JORNADA.recusa;
      return prefixoDireito + MENSAGENS_JORNADA.reforcoConsentimento;
    }
    case 'TRIAGEM': {
      const proximo = f.proximoDocumento ?? 'o documento pendente';
      if (r.ultimaCaptura === 'consentimento') return prefixoDireito + MENSAGENS_JORNADA.iniciarTriagem(proximo);
      const extraConjuge = /comprovante/i.test(proximo) && /não tenho|nao tenho|meu nome/i.test(entrada.texto)
        ? `\n\n${MENSAGENS_JORNADA.comprovanteConjuge}`
        : '';
      return prefixoDireito + MENSAGENS_JORNADA.aguardandoDocumento(proximo) + extraConjuge;
    }
    case 'CONCLUIDA':
      // A jornada terminou: quem fala é a conversa normal (análise/D2/Portal).
      return '';
  }
}
