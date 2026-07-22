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
  readonly ultimaCaptura: 'nome' | 'cidade' | 'nome-cidade' | 'consentimento' | 'adiamento' | null;
  /** O turno respondeu só o ACK (registro processando) e a PROGRESSÃO ainda
   *  não foi falada — a classificação tardia deve enviá-la sozinha. */
  readonly aguardandoProgressao: boolean;
  /** Caso Denise (2026-07-21): quantas vezes o cliente ADIOU o envio nesta
   *  espera — 1º aviso ganha resposta completa; repetições, um "Combinado!"
   *  curto (nunca a mesma cobrança de novo). Zera quando um documento chega. */
  readonly avisosDeAdiamento: number;
  /** Caso Lucas (2026-07-22): o cliente DESISTIU ("vou deixar quieto") — a
   *  cobrança de documento CESSA; despedida respeitosa uma vez, e o canal fica
   *  humano (LLM) até ele retomar (interesse novo ou documento chegando). */
  readonly desistiu: boolean;
  /** ESCADA DE COBRANÇA (2026-07-22, conversas mudas em produção): a cobrança
   *  determinística era IDÊNTICA a cada turno e o guard anti-eco silenciava a
   *  conversa para sempre. 1ª cobrança = padrão; 2ª = reforço com oferta de
   *  ajuda; 3ª+ = a conversa humana (LLM) assume. Zera quando documento chega. */
  readonly cobrancasSeguidas: number;
  readonly atualizadoEm: Date;
}

export function novaJornada(chatId: string, now: Date): JornadaRecord {
  return {
    chatId,
    nome: null,
    cidade: null,
    consentiu: false,
    recusou: false,
    ultimaCaptura: null,
    aguardandoProgressao: false,
    avisosDeAdiamento: 0,
    desistiu: false,
    cobrancasSeguidas: 0,
    atualizadoEm: now,
  };
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
const AFIRMATIVAS =
  /\b(sim|quero|pode|claro|vamos|aceito|bora|com certeza|isso|positivo|tenho interesse|ok|okay|beleza|demorou|manda|pode sim|quero sim)\b/i;
const NEGATIVAS =
  /\b(n[ãa]o|nao quero|agora n[ãa]o|depois|talvez mais tarde|sem interesse|deixa)\b/i;

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
  // Caso Marileide (2026-07-22): saudações INICIAIS caem antes de qualquer
  // análise — "Boa tarde, meu nome é João" tem vírgula de saudação, não de
  // separação nome/cidade; sem esta limpeza, "Boa tarde" virava o nome.
  const t = texto
    .trim()
    .replace(/^(ol[áa]|oi+|opa|hey)[,!.\s]+/i, '')
    .replace(/^(bom\s+dia|boa\s+tarde|boa\s+noite)[,!.\s]+/i, '')
    .trim();
  if (t === '' || ehSaudacaoPura(t)) return { nome: null, cidade: null };

  const limparCidade = (s: string): string =>
    s
      .replace(/^(sou\s+de|moro\s+em|de|da|do|em)\s+/i, '')
      .replace(/\s*[-–]\s*[A-Z]{2}$/u, (m) => m)
      .trim();
  // Caso Marileide (2026-07-22, cliente real): "Olá bom dia meu nome completo
  // Marileide…" — saudações e preâmbulos ("meu nome completo") precisam cair
  // ANTES do filtro pareceNome, senão o nome legítimo é rejeitado por tamanho.
  const limparNome = (s: string): string =>
    s
      .replace(/^(ol[áa]|oi+|opa)[,!.\s]+/i, '')
      .replace(/^(bom\s+dia|boa\s+tarde|boa\s+noite)[,!.\s]+/i, '')
      .replace(
        /^(me\s+chamo|meu\s+nome\s+completo\s+(?:[ée]\s+)?|meu\s+nome\s+[ée]\s+|meu\s+nome\s+|sou\s+a\s+|sou\s+o\s+|sou\s+)/i,
        '',
      )
      .trim();

  // "Isabel Rodrigues eu sou de santa ernestina" (SEM vírgula) — o conector
  // "sou de"/"moro em" separa nome e cidade na mesma frase.
  const conector = /^(.+?)[\s,]+(?:eu\s+)?(?:sou\s+de|moro\s+em)\s+(.+)$/i.exec(t);
  if (conector) {
    const nome = limparNome(conector[1] ?? '');
    const cidade = limparCidade(conector[2] ?? '');
    if (nome !== '' && pareceNome(nome) && cidade !== '') return { nome, cidade };
  }

  const virgula = t.indexOf(',');
  if (virgula > 0) {
    const nome = limparNome(t.slice(0, virgula));
    const cidade = limparCidade(t.slice(virgula + 1));
    return {
      nome: nome !== '' && pareceNome(nome) ? nome : null,
      cidade: cidade !== '' ? cidade : null,
    };
  }
  if (atual.nome === null) {
    const nome = limparNome(t);
    return { nome: nome !== '' && pareceNome(nome) ? nome : null, cidade: null };
  }
  if (atual.cidade === null) {
    const cidade = limparCidade(t);
    return { nome: null, cidade: cidade !== '' ? cidade : null };
  }
  return { nome: null, cidade: null };
}

const PERGUNTA_DE_DIREITO =
  /\bdireito\b|\bdireitos\b|me\s+enquadr|tenho\s+como|eleg[íi]v|fa[çc]o\s+jus/i;
export function ehPerguntaDeDireito(texto: string): boolean {
  return PERGUNTA_DE_DIREITO.test(texto);
}

// Caso Denise (2026-07-21, cliente real): "posso deixar p amanha nao estou em
// casa" recebia a MESMA cobrança de documento três vezes. ADIAMENTO é um fato
// da conversa: reconhecido deterministicamente, a resposta vira acolhimento
// ("sem problema, combinado!") — nunca a repetição da cobrança.
// ATENÇÃO: nunca usar \b ENCOSTADO em letra acentuada — em JS, "ã"/"á" não são
// "word chars" e `amanh[ãa]\b` jamais casa com "amanhã" (defeito pego em teste).
const ADIAMENTO =
  /\bamanh[ãa]|\bmais\s+tarde\b|\blogo\s+cedo\b|\bdepois\s+(te\s+)?(mando|envio)\b|\bassim\s+que\s+(chegar|puder|der|conseguir)\b|\bquando\s+(eu\s+)?(chegar|puder|der|conseguir)\b|\bn[ãa]o\s+(estou|to|t[ôo])\s+em\s+casa\b|\bhoje\s+n[ãa]o\s+(consigo|d[áa]|vai\s+dar)|\bs[óo]\s+(amanh[ãa]|[àa]\s+noite|de\s+manh[ãa]|semana\s+que\s+vem)|\bdeixa\s+(pra|para)\s+(amanh[ãa]|depois|mais\s+tarde)/i;
export function ehAdiamento(texto: string): boolean {
  return ADIAMENTO.test(texto);
}

// ── Caso Lucas (2026-07-22, cliente real perdido): "Cara de golpe isso" e
// "Na verdade vou deixar quieto" receberam TRÊS vezes a cobrança de documento.
// Decreto: desconfiança ganha resposta de SEGURANÇA; desistência ganha
// despedida respeitosa e a cobrança CESSA; pergunta ganha resposta humana
// (LLM) antes de voltar ao foco. Nunca mais trava robótica repetitiva.

const DESCONFIANCA =
  /\bgolpe\b|\bfraude\b|desconfi|suspeit|n[ãa]o\s+confio|engana[çc]|enrola[çc]|\b[ée]\s+seguro\b|\bisso\s+[ée]\s+verdade\b|\bverdade\s+isso\b|\bconfi[áa]vel\b|\bmedo\s+de\b|\bn[ãa]o\s+[ée]\s+golpe\b/i;
export function ehDesconfianca(texto: string): boolean {
  return DESCONFIANCA.test(texto);
}

const DESISTENCIA =
  /\bdeixa[r]?\s+quieto\b|\bdesisto\b|\bdesistir\b|\bn[ãa]o\s+quero\s+mais\b|\besquece\b|\bdeixa\s+(pra\s+l[áa]|isso)|\bpode\s+parar\b|\bn[ãa]o\s+tenho\s+(mais\s+)?interesse\b|\bperdi\s+o\s+interesse\b/i;
export function ehDesistencia(texto: string): boolean {
  return DESISTENCIA.test(texto);
}

const AGRADECIMENTO_PURO =
  /^(obrigad[oa]s?|obg|brigad[oa]o?|valeu|blz|beleza|ok(ay)?|t[áa]\s*(bom|bem)?|certo|entendi|tudo\s+bem|de\s+nada|👍|🙏)[!.,\s]*$/i;
export function ehAgradecimentoPuro(texto: string): boolean {
  return AGRADECIMENTO_PURO.test(texto.trim());
}

/** Pergunta LIVRE do cliente (não coberta pelas respostas canônicas): o decreto
 *  manda RESPONDER (LLM, tom de consultora) e depois voltar ao foco do funil. */
const PERGUNTA_LIVRE =
  /\?|^(como|quando|quanto|qual|quais|onde|quem|por\s*qu[eê]|pq|o\s*qu[eê])\b/i;
export function ehPerguntaLivre(texto: string): boolean {
  return PERGUNTA_LIVRE.test(texto.trim());
}

/** Este texto, na TRIAGEM, cairá na COBRANÇA de documento? (nenhum outro
 *  manejo o captura). O runtime usa para contar a escada de cobrança. */
export function vaiReceberCobranca(texto: string): boolean {
  return (
    !ehDesconfianca(texto) &&
    !ehDesistencia(texto) &&
    !ehAdiamento(texto) &&
    !ehAgradecimentoPuro(texto) &&
    !ehPerguntaLivre(texto) &&
    !ehPerguntaDeDireito(texto)
  );
}

/** Um candidato a NOME precisa PARECER nome: sem '?', sem dígitos, até 6
 *  palavras e sem vocabulário do funil ("posso ter mais informações…" NUNCA é
 *  nome — defeito real do primeiro contato da Denise). */
export function pareceNome(s: string): boolean {
  const t = s.trim();
  if (t === '' || t.length > 60) return false;
  if (/[?!0-9@#/\\]/.test(t)) return false;
  if (t.split(/\s+/).length > 6) return false;
  if (
    /\b(posso|pode|informa[cç][ãa]o|informa[cç][õo]es|an[áa]lise|consignado|benef[íi]cio|d[úu]vida|ajuda|documento|como\s+funciona|quero\s+saber|sobre\s+isso|gostaria)\b/i.test(
      t,
    )
  )
    return false;
  return true;
}

// ── MENSAGENS AUTORADAS (o conteúdo do funil — a LLM nunca as decide) ─────────

// Decreto 2026-07-22 (caso Lucas): tom de CONSULTORA JURÍDICA — profissional,
// claro e acolhedor, SEM emojis. Atendimento que transmite segurança.
export const MENSAGENS_JORNADA = {
  boasVindas:
    'Olá, seja bem-vindo(a) ao Projeto Reconstrua. Eu me chamo Ahri e sou a consultora responsável pelo seu atendimento — vou acompanhar o seu caso do início ao fim.\n\n' +
    'Para começarmos, pode me informar o seu nome completo e a cidade onde mora?',
  pedirNomeECidade:
    'Para eu registrar o seu atendimento corretamente, pode me informar o seu nome completo e a cidade onde mora?',
  pedirCidade: (nome: string): string => `Prazer, ${nome}. E de qual cidade você fala?`,
  pedirNome: 'E qual é o seu nome completo, por favor?',
  explicacaoConsentimento: (nome: string): string =>
    `${nome !== '' ? `Prazer, ${nome}. ` : ''}Deixa eu te explicar como funciona: nossa equipe analisa o seu consignado do INSS para verificar se existe alguma irregularidade nos descontos do benefício. Se encontrarmos algo fora do previsto, é possível buscar a revisão e a recuperação desses valores.\n\n` +
    'A análise é gratuita e sem compromisso — e só depois dela é possível saber se existe algum direito no seu caso.\n\n' +
    'Você tem interesse em fazer essa análise?',
  reforcoConsentimento:
    'Só para eu confirmar: você tem interesse em fazer a análise gratuita do seu consignado?',
  recusa:
    'Sem problemas, respeito a sua decisão. Fico à disposição — se mudar de ideia ou tiver qualquer dúvida sobre a análise, é só me chamar por aqui.',
  iniciarTriagem: (proximo: string): string =>
    'Ótimo, vamos começar.\n\n' +
    `Vou precisar de três documentos, um por vez. O primeiro: ${proximo}. Pode enviar foto ou print por aqui mesmo.`,
  aguardandoDocumento: (proximo: string): string =>
    `Estou aguardando: ${proximo}. Pode enviar foto ou print por aqui, no seu tempo.`,
  // Escada de cobrança: o 2º pedido NUNCA repete o 1º — reforça e oferece ajuda.
  aguardandoDocumentoReforco: (proximo: string): string =>
    `Só reforçando: para dar sequência à sua análise, preciso de ${proximo}. Se estiver com qualquer dificuldade para enviar (foto, tamanho do arquivo, formato), me avise que eu te oriento.`,
  ackDocumento:
    'Recebi o documento. Um instante enquanto faço o registro — assim que concluir, te confirmo o próximo passo.',
  documentoRegistrado: (registrado: string, proximo: string): string =>
    `Registrado: ${registrado}. Agora preciso de: ${proximo}.`,
  documentoRegistradoCompleto: (registrado: string): string =>
    `Registrado: ${registrado}. Com isso a sua documentação inicial está completa — já te envio os próximos passos.`,
  comprovanteConjuge:
    'Se você não tiver um comprovante de endereço no seu nome, o do seu cônjuge também vale.',
  // Caso Denise: adiamento reconhecido ⇒ acolhimento, nunca a cobrança de novo.
  adiamentoOk: (proximo: string): string =>
    `Sem problema nenhum, combinado. Quando você conseguir, é só enviar o ${proximo} por aqui mesmo. Fico à disposição.`,
  adiamentoOkCurto: 'Combinado. Fico no aguardo — qualquer coisa, estou por aqui.',
  documentoNaoIdentificado: (proximo: string): string =>
    `Verifiquei aqui e essa imagem não parece ser o documento que estou aguardando (${proximo}). Pode conferir e enviar novamente? Qualquer dúvida, me chame.`,
  // Caso Lucas: desconfiança ("cara de golpe") ⇒ resposta de SEGURANÇA.
  seguranca:
    'Sua cautela é correta — e desconfiar é importante mesmo. Alguns pontos para a sua segurança:\n\n' +
    '1. A análise é gratuita: você não paga nada, em nenhuma etapa.\n' +
    '2. Nunca pedimos senhas, códigos de verificação ou qualquer pagamento.\n' +
    '3. Este é o canal oficial do Projeto Reconstrua — você pode confirmar no nosso site: projetoreconstrua.com.br.\n' +
    '4. Seus documentos são usados exclusivamente para a análise do seu benefício, conforme a Lei Geral de Proteção de Dados (LGPD).\n\n' +
    'Se preferir, posso esclarecer qualquer dúvida antes de você enviar qualquer documento. Estou à disposição.',
  // Caso Lucas: desistência ⇒ despedida respeitosa, cobrança CESSA.
  despedidaRespeitosa:
    'Entendo e respeito a sua decisão. Se mudar de ideia ou quiser esclarecer qualquer dúvida sobre a análise, é só mandar uma mensagem por aqui — este canal fica à sua disposição. Obrigada pelo contato.',
  socialCurto: 'Por nada. Qualquer dúvida, estou à disposição.',
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
      return MENSAGENS_JORNADA.documentoRegistrado(
        f.ultimoRegistrado,
        f.proximoDocumento ?? 'o documento pendente',
      );
    }
    return MENSAGENS_JORNADA.ackDocumento;
  }

  // Caso Lucas: DESCONFIANÇA tem prioridade máxima em QUALQUER etapa — quem
  // acha que é golpe não manda documento; primeiro segurança, depois funil.
  if (ehDesconfianca(entrada.texto)) return MENSAGENS_JORNADA.seguranca;

  // Pergunta de direito/elegibilidade tem resposta canônica, em qualquer etapa.
  const prefixoDireito = ehPerguntaDeDireito(entrada.texto)
    ? 'É possível, mas somente conseguimos afirmar após analisar gratuitamente o seu HISCON (histórico de empréstimos consignados do INSS). '
    : '';

  // Decreto de humanização (2026-07-22): pergunta LIVRE do cliente, em QUALQUER
  // etapa (fora o primeiro contato), vai para a conversa humana (LLM) — que
  // responde de verdade e retoma o passo pendente. Cobrança seca no lugar de
  // resposta é comportamento de robô.
  const perguntaLivre =
    !entrada.primeiroContato && prefixoDireito === '' && ehPerguntaLivre(entrada.texto);

  switch (etapa) {
    case 'IDENTIFICACAO': {
      if (entrada.primeiroContato) return prefixoDireito + MENSAGENS_JORNADA.boasVindas;
      if (perguntaLivre) return '';
      if (r.nome !== null && r.cidade === null) {
        // A nuance do decreto: "muito prazer Isabel, e de que cidade você fala?"
        return prefixoDireito + MENSAGENS_JORNADA.pedirCidade(r.nome);
      }
      if (r.nome === null && r.cidade !== null) return prefixoDireito + MENSAGENS_JORNADA.pedirNome;
      return prefixoDireito + MENSAGENS_JORNADA.pedirNomeECidade;
    }
    case 'CONSENTIMENTO': {
      if (
        r.ultimaCaptura === 'nome' ||
        r.ultimaCaptura === 'cidade' ||
        r.ultimaCaptura === 'nome-cidade'
      ) {
        // Identificação recém-completa ⇒ explicação + pergunta de interesse (uma mensagem).
        return prefixoDireito + MENSAGENS_JORNADA.explicacaoConsentimento(r.nome ?? '');
      }
      if (perguntaLivre) return '';
      if (r.recusou) return prefixoDireito + MENSAGENS_JORNADA.recusa;
      return prefixoDireito + MENSAGENS_JORNADA.reforcoConsentimento;
    }
    case 'TRIAGEM': {
      const proximo = f.proximoDocumento ?? 'o documento pendente';
      if (r.ultimaCaptura === 'consentimento')
        return prefixoDireito + MENSAGENS_JORNADA.iniciarTriagem(proximo);
      // Caso Lucas: DESISTÊNCIA ⇒ despedida respeitosa; a cobrança CESSA.
      if (ehDesistencia(entrada.texto)) return MENSAGENS_JORNADA.despedidaRespeitosa;
      // Cliente desistiu antes: nada de cobrança. Agradecimento ganha cortesia
      // breve; o resto vai para a conversa humana (LLM) — porta sempre aberta.
      if (r.desistiu) {
        if (ehAgradecimentoPuro(entrada.texto)) return MENSAGENS_JORNADA.socialCurto;
        return '';
      }
      // Caso Denise: "posso deixar p amanhã" ⇒ acolhimento (1º aviso completo;
      // repetição ganha o "Combinado!" curto) — NUNCA a mesma cobrança de novo.
      if (ehAdiamento(entrada.texto)) {
        return r.avisosDeAdiamento > 1
          ? MENSAGENS_JORNADA.adiamentoOkCurto
          : MENSAGENS_JORNADA.adiamentoOk(proximo);
      }
      // Agradecimento/confirmação curta NÃO merece cobrança — cortesia breve.
      if (ehAgradecimentoPuro(entrada.texto)) return MENSAGENS_JORNADA.socialCurto;
      const extraConjuge =
        /comprovante/i.test(proximo) && /não tenho|nao tenho|meu nome/i.test(entrada.texto)
          ? `\n\n${MENSAGENS_JORNADA.comprovanteConjuge}`
          : '';
      // Decreto: pergunta LIVRE do cliente ⇒ a conversa humana (LLM) responde e
      // retoma o foco — nunca a cobrança seca no lugar da resposta.
      if (prefixoDireito === '' && ehPerguntaLivre(entrada.texto)) return '';
      // ESCADA DE COBRANÇA: 1ª = padrão; 2ª = reforço com oferta de ajuda;
      // 3ª+ = a conversa humana (LLM) assume — o eco idêntico morreu aqui.
      if (r.cobrancasSeguidas >= 3) return '';
      if (r.cobrancasSeguidas === 2)
        return (
          prefixoDireito + MENSAGENS_JORNADA.aguardandoDocumentoReforco(proximo) + extraConjuge
        );
      return prefixoDireito + MENSAGENS_JORNADA.aguardandoDocumento(proximo) + extraConjuge;
    }
    case 'CONCLUIDA':
      // A jornada terminou: quem fala é a conversa normal (análise/D2/Portal).
      return '';
  }
}
