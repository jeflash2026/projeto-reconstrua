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
  /** UF (decreto 2026-07-29: captar Cidade E Estado) — extraída do texto da
   *  cidade quando o cliente informa ("Armazém - SC"); null quando não veio. */
  readonly estado: string | null;
  /** CPF (só dígitos) — decreto 2026-07-26. Sem ele a perícia não protocola o
   *  pedido administrativo nos bancos; coletado ANTES do HISCON. */
  readonly cpf: string | null;
  readonly consentiu: boolean;
  readonly recusou: boolean;
  /** O que o ÚLTIMO turno capturou (nuance de fraseado: "Prazer, X!"). */
  readonly ultimaCaptura:
    'nome' | 'cidade' | 'nome-cidade' | 'cpf' | 'consentimento' | 'adiamento' | null;
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
    estado: null,
    cpf: null,
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

// ── CPF (decreto 2026-07-26) ─────────────────────────────────────────────────
// Sem o CPF a perícia NÃO consegue protocolar o pedido administrativo nos
// bancos. Ele passa a ser coletado ANTES do HISCON (e cobrado de quem já
// entregou o HISCON sem CPF). Captura DETERMINÍSTICA com validação dos dígitos
// verificadores — indispensável porque um celular brasileiro também tem 11
// dígitos e seria capturado como CPF por qualquer checagem de comprimento.

function digitosVerificadoresOk(cpf: string): boolean {
  const d = cpf.split('').map(Number);
  const digito = (len: number): number => {
    let soma = 0;
    for (let i = 0; i < len; i += 1) soma += (d[i] ?? 0) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === d[9] && digito(10) === d[10];
}

/** O CPF (só dígitos) presente no texto, ou null. Aceita 000.000.000-00,
 *  00000000000 e variações com espaço; recusa repetidos e dígito inválido. */
export function capturarCpf(texto: string): string | null {
  for (const bruto of texto.match(/\d[\d.\s-]{9,17}\d/g) ?? []) {
    const so = bruto.replace(/\D/g, '');
    if (so.length !== 11) continue;
    if (/^(\d)\1{10}$/.test(so)) continue; // 111.111.111-11 e afins
    if (!digitosVerificadoresOk(so)) continue; // separa CPF de telefone
    return so;
  }
  return null;
}

export function interpretarInteresse(texto: string): 'sim' | 'nao' | 'incerto' {
  const t = texto.trim();
  // NEGAÇÃO tem precedência: "não quero" contém "quero" — sem precedência, a
  // recusa viraria consentimento (defeito pego em teste).
  if (NEGATIVAS.test(t)) return 'nao';
  if (AFIRMATIVAS.test(t)) return 'sim';
  // Caso REAL Gismar (62 9394-5682, 2026-07-30): a pergunta é "Você TEM
  // interesse?" e a resposta natural é "Tenho" — que não casava com nada,
  // virava 'incerto' e o reforço idêntico morria no guarda anti-eco: silêncio.
  // "Tenho"/"Tenho sim" SOZINHOS são SIM ("tenho uma dúvida" segue incerto).
  if (/^tenho(\s+sim)?[!.\s]*$/i.test(t)) return 'sim';
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
    // Caso REAL Maria Aparecida (48 8874-1409, 2026-07-29): a pessoa mandou a
    // CIDADE primeiro ("Armazém" virou o nome) e o NOME COMPLETO depois — que
    // era registrado como cidade. Quando o "nome" atual é UMA palavra e o novo
    // texto tem cara inequívoca de NOME COMPLETO (4+ palavras, sem termos de
    // cidade), os papéis se corrigem: o novo texto vira o nome e a palavra
    // única vai para a cidade.
    const candidatoNome = limparNome(t);
    if (
      !atual.nome.includes(' ') &&
      pareceNomeCompletoDePessoa(candidatoNome) &&
      pareceNome(candidatoNome)
    ) {
      return { nome: candidatoNome, cidade: atual.nome };
    }
    const cidade = limparCidade(t);
    return { nome: null, cidade: cidade !== '' ? cidade : null };
  }
  return { nome: null, cidade: null };
}

// Termos comuns de NOME DE CIDADE — impedem que uma cidade longa ("São José do
// Rio Preto") seja confundida com nome de pessoa na correção acima.
const TERMOS_DE_CIDADE =
  /\b(s[ãa]o|santa|santo|nova|novo|porto|rio|campo|campos|vila|serra|alto|alta|lagoa|praia|monte|barra|ribeir[ãa]o|cachoeira|feira|jardim|fora|grande|verde|branca|branco|preto|preta)\b/i;

/** Cara INEQUÍVOCA de nome completo de pessoa: 4+ palavras, só letras, sem
 *  termos típicos de cidade. (3 palavras é ambíguo — "Juiz de Fora".) */
export function pareceNomeCompletoDePessoa(s: string): boolean {
  const t = s.trim();
  const palavras = t.split(/\s+/);
  if (palavras.length < 4 || palavras.length > 8) return false;
  if (!/^[\p{L}][\p{L}'´.\s]*$/u.test(t)) return false;
  return !TERMOS_DE_CIDADE.test(t);
}

// ── CIDADE + ESTADO (decreto 2026-07-29) ─────────────────────────────────────
const UFS: ReadonlySet<string> = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

// Caso REAL Humberto (16 99747-7435, 2026-07-30): o cliente respondeu a cidade
// e o estado em DUAS bolhas ("Ribeirão preto" e depois "São Paulo") e por
// extenso — o fluxo não entendia "São Paulo" como UF e travava num loop de
// "Cidade - UF". Estados POR EXTENSO agora são reconhecidos (desacentuados).
const ESTADO_POR_NOME: Readonly<Record<string, string>> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

function semAcento(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** A mensagem é SÓ um estado (UF "SP" ou nome "São Paulo")? Devolve a UF.
 *  Usado quando o cliente manda a cidade numa bolha e o estado na seguinte. */
export function capturarEstado(texto: string): string | null {
  const t = texto.trim().replace(/[.,;!]+$/, '');
  if (/^[A-Za-z]{2}$/.test(t) && UFS.has(t.toUpperCase())) return t.toUpperCase();
  return ESTADO_POR_NOME[semAcento(t)] ?? null;
}

/** Separa "Armazém - SC" / "Armazém/SC" / "Armazém SC" / "Ribeirão Preto São
 *  Paulo" em cidade + UF. Sem UF reconhecível, a cidade fica inteira e o
 *  estado é null. */
export function separarCidadeEstado(bruto: string): { cidade: string; estado: string | null } {
  const t = bruto.trim().replace(/[.,;]+$/, '');
  const separado = /^(.*?)\s*[-–,/]\s*([A-Za-z]{2})$/.exec(t);
  if (separado && UFS.has((separado[2] ?? '').toUpperCase())) {
    return { cidade: (separado[1] ?? '').trim(), estado: (separado[2] ?? '').toUpperCase() };
  }
  const palavras = t.split(/\s+/);
  const ultima = (palavras[palavras.length - 1] ?? '').toUpperCase();
  if (palavras.length >= 2 && ultima.length === 2 && UFS.has(ultima)) {
    return { cidade: palavras.slice(0, -1).join(' '), estado: ultima };
  }
  // Estado POR EXTENSO no fim ("Ribeirão Preto São Paulo", "Armazém - Santa
  // Catarina") — o nome mais LONGO primeiro ("Mato Grosso do Sul" antes de
  // "Mato Grosso"). A cidade precisa sobrar (senão "São Paulo" é só a cidade).
  const plano = semAcento(t.replace(/\s*[-–,/]\s*/g, ' '));
  const nomes = Object.keys(ESTADO_POR_NOME).sort((a, b) => b.length - a.length);
  for (const nome of nomes) {
    if (plano === nome) continue; // só o estado ⇒ não é cidade+estado
    if (plano.endsWith(` ${nome}`)) {
      const corte = plano.length - nome.length;
      // Recorta pelo comprimento equivalente no texto ORIGINAL normalizado de
      // separadores (mesmo tamanho após semAcento, que não altera comprimento).
      const original = t.replace(/\s*[-–,/]\s*/g, ' ');
      const cidade = original.slice(0, corte).trim();
      if (cidade !== '') return { cidade, estado: ESTADO_POR_NOME[nome] ?? null };
    }
  }
  return { cidade: t, estado: null };
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

// Caso Sidinei (2026-07-22, cliente real): comprovante enviado como LINK do
// Adobe Acrobat — link é texto, não arquivo; o sistema precisa dos BYTES do
// documento (Vision/perícia). A resposta certa é ORIENTAR como humana, nunca
// a cobrança repetida.
const LINK_EXTERNO = /https?:\/\/\S+/i;
export function ehLinkExterno(texto: string): boolean {
  return LINK_EXTERNO.test(texto);
}

// Decreto 2026-07-25: "vocês são de onde?" é pergunta de CONFIANÇA (o cliente
// quer saber se atendem a região dele). A resposta é CANÔNICA — a AHRI jamais
// improvisa geografia, jamais inventa endereço/filial e jamais diz que não
// atende alguém: a análise é nacional e o encaminhamento é para o advogado
// parceiro mais próximo DEPOIS da análise.
const PERGUNTA_DE_LOCALIZACAO =
  /\b(voc[êe]s?|empresa|escrit[óo]rio|projeto)\b[^?]{0,30}\b(s[ãa]o|fica|ficam|[ée]|de)\b[^?]{0,20}\bonde\b|\bonde\b[^?]{0,25}\b(voc[êe]s?|fica[m]?|localiza|sede|escrit[óo]rio|empresa)\b|\bde\s+(que|qual)\s+(cidade|estado|regi[ãa]o|lugar)\b|\bqual\s+([ao]\s+)?(cidade|estado|regi[ãa]o)\s+(de\s+)?voc[êe]s\b|\bvoc[êe]s\s+(atendem|trabalham)\b[^?]{0,25}\b(aqui|minha\s+cidade|meu\s+estado|regi[ãa]o|todo\s+brasil)\b|\batendem\s+(em|no|na)\b/i;
/** Pergunta de LOCALIZAÇÃO/abrangência ("vocês são de onde?", "atendem aqui?"). */
export function ehPerguntaDeLocalizacao(texto: string): boolean {
  return PERGUNTA_DE_LOCALIZACAO.test(texto);
}

// Decreto 2026-07-29 (caso Luana/avó): filho, neto ou familiar PODE cuidar da
// análise pelo idoso — a AHRI dispensou uma lead real dizendo "não dá para
// fazer com os dados da sua avó". A regra é o CONTRÁRIO: basta a documentação
// (CPF + HISCON) vir em nome do TITULAR do benefício; o familiar representa e
// acompanha tudo normalmente. Detector: parente com possessivo + contexto de
// "é para ele(a)"/benefício (evita falso positivo em "minha mãe me indicou").
// ATENÇÃO: o \b do JavaScript é ASCII — depois de "ó"/"á" o boundary FALHA
// ("minha avó", "dá"). Por isso o texto é DESACENTUADO antes do match.
const PARENTE_COM_POSSESSIVO =
  /\b(minha|meu)\s+(avo|vozinh[ao]|vo|mae|pai|sogr[ao]|ti[ao]|esposa|esposo|marido|mulher|irmao?|irma|cunhad[ao])\b/i;
const CONTEXTO_DE_TITULARIDADE =
  /\b(para|pra|pro|da|do|dela|dele|era|seria)\b|em\s+nome|benefici|consign|aposentad|analis|no\s+nome/i;
function desacentuar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
/** A pessoa quer a análise PARA UM FAMILIAR (avó, mãe, pai…)? */
export function ehSobreFamiliar(texto: string): boolean {
  const t = desacentuar(texto);
  return PARENTE_COM_POSSESSIVO.test(t) && CONTEXTO_DE_TITULARIDADE.test(t);
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
    !ehPerguntaDeDireito(texto) &&
    !ehPerguntaDeLocalizacao(texto) &&
    !ehSobreFamiliar(texto) &&
    !ehLinkExterno(texto)
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

/** Primeiro nome, para o tratamento das mensagens autoradas. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

// ── MENSAGENS AUTORADAS (o conteúdo do funil — a LLM nunca as decide) ─────────

// Decreto 2026-07-27: toda recusa de documento errado JÁ ENSINA o caminho — a
// AHRI identifica o que chegou, explica por que não serve e ORIENTA como tirar
// o HISCON, sem esperar o cliente pedir. O passo a passo é canônico e único.
export const PASSO_A_PASSO_HISCON =
  'Para tirar o HISCON é assim:\n' +
  '1. Entre no aplicativo ou site Meu INSS (meu.inss.gov.br) com o seu CPF e a senha do gov.br;\n' +
  '2. Na busca, procure por "Extrato de Empréstimos Consignados";\n' +
  '3. Gere o extrato e toque em BAIXAR (ícone de download) para salvar o PDF;\n' +
  '4. Me envie aqui o ARQUIVO PDF como anexo — não a foto da tela.\n\n' +
  'Se travar em algum desses passos, me diga em qual que eu te oriento.';

// Decreto 2026-07-29 (caso Maria Aparecida, 48 8874-1409): o humanizador do
// LLM REESCREVEU o roteiro da triagem e DERRUBOU o pedido do CPF ("preciso
// apenas do seu extrato…"), além de fundir as perguntas de nome e cidade. Os
// roteiros de COLETA da fase 1 (nome, cidade/estado, CPF, HISCON) saem
// VERBATIM — foram redigidos com cuidado e cada palavra importa. A humanização
// segue valendo para o resto (explicações, acolhimento, conversa livre).
// Caso REAL Humberto (2026-07-30): o humanizador também REESCREVEU o roteiro
// do CONSENTIMENTO — derrubou a explicação dos honorários por êxito e chegou a
// trocar a pergunta de interesse por uma cobrança de cidade inventada. O
// roteiro do consentimento ("análise gratuita") passa a sair VERBATIM também.
export function ehRoteiroDeColeta(roteiro: string): boolean {
  return /\bCPF\b|\bHISCON\b|nome completo|qual cidade|an[áa]lise gratuita/i.test(roteiro);
}

// Decreto 2026-07-22 (caso Lucas): tom de CONSULTORA JURÍDICA — profissional,
// claro e acolhedor, SEM emojis. Atendimento que transmite segurança.
export const MENSAGENS_JORNADA = {
  // Decreto Fluxo 2026-07-22: nome PRIMEIRO (registra), depois cidade, depois
  // a explicação com o modelo de honorários por ÊXITO.
  boasVindas:
    'Olá, seja bem-vindo(a) ao Projeto Reconstrua. Eu me chamo Ahri e sou a consultora responsável pelo seu atendimento — vou acompanhar o seu caso do início ao fim.\n\n' +
    'Para começarmos, pode me informar o seu nome completo?',
  pedirNomeECidade:
    'Para eu registrar o seu atendimento corretamente, pode me informar o seu nome completo?',
  // Decreto 2026-07-29: a pergunta pede CIDADE E ESTADO, com exemplo — "pergunta
  // mal a cidade" acabou; o formato guia a resposta ("Armazém - SC").
  pedirCidade: (nome: string): string =>
    `Prazer, ${primeiroNome(nome)}, é um gosto falar com você. E em qual cidade e estado você mora? Pode responder assim: Cidade - UF (por exemplo: Armazém - SC).`,
  pedirNome: 'E qual é o seu nome completo, por favor?',
  explicacaoConsentimento: (nome: string): string =>
    `${nome !== '' ? `Obrigada, ${nome}. ` : ''}Deixa eu te explicar como funciona o Projeto Reconstrua: nossa equipe analisa o seu consignado do INSS para verificar se existe alguma irregularidade nos descontos do seu benefício. Se encontrarmos algo fora do previsto, buscamos a revisão e a recuperação desses valores para você.\n\n` +
    'Sobre custos, para a sua total tranquilidade: a análise é gratuita. E se identificarmos que o seu caso é viável, você também não paga nada para dar entrada no processo — os honorários são do advogado e cobrados apenas ao final, somente em caso de êxito. Ou seja, você só tem algo a pagar se conseguirmos o resultado para você.\n\n' +
    'Você tem interesse em fazer essa análise gratuita?',
  reforcoConsentimento:
    'Só para eu confirmar: você tem interesse em fazer a análise gratuita do seu consignado?',
  recusa:
    'Sem problemas, respeito a sua decisão. Fico à disposição — se mudar de ideia ou tiver qualquer dúvida sobre a análise, é só me chamar por aqui.',
  // Decreto HISCON-ONLY + PDF-ONLY (2026-07-22): a análise precisa de UM
  // documento, e SÓ o ARQUIVO PDF serve — a foto/print do app vem incompleta
  // (sem todos os contratos e sem o valor das parcelas), e a análise não roda.
  // Decreto 2026-07-26 (CPF): a triagem começa anunciando as DUAS coisas — o
  // número do CPF (necessário para protocolar o pedido nos bancos) e o HISCON.
  // O CPF é pedido PRIMEIRO por ser instantâneo; o HISCON vem na sequência.
  iniciarTriagem: (): string =>
    'Ótimo, vamos começar.\n\n' +
    'Para a análise eu preciso de apenas duas coisas: o número do seu CPF e o seu extrato de empréstimos consignados do INSS (o HISCON), em PDF.\n\n' +
    'Vamos pela primeira: pode me informar o número do seu CPF, por favor?',
  // Pedido do CPF isolado (quando a triagem já começou e ele ainda falta).
  pedirCpf: (nome: string | null): string =>
    `${nome !== null && nome !== '' ? `${primeiroNome(nome)}, para` : 'Para'} eu registrar o seu atendimento e podermos solicitar os contratos junto aos bancos, preciso do número do seu CPF. Pode digitar aqui, por favor?`,
  cpfRegistradoPedirHiscon: (proximo: string): string =>
    'CPF registrado, obrigada.\n\n' +
    `Agora a segunda parte: preciso de ${proximo}. Você emite pelo aplicativo ou site Meu INSS, na opção "Extrato de Empréstimos Consignados".\n\n` +
    'Precisa ser o ARQUIVO em PDF, com todos os contratos — é só baixar e me enviar aqui como anexo.\n\n' +
    'Se precisar de ajuda para localizar essa opção, me avise que eu te explico o passo a passo, com calma.',
  cpfNaoReconhecido:
    'Não consegui ler o número do CPF. Pode me enviar apenas os 11 dígitos, por favor? Pode ser assim: 000.000.000-00.',
  // Pedido do HISCON quando o CPF já está registrado (triagem, 2ª parte).
  pedirHiscon: (proximo: string): string =>
    `Para a análise eu preciso de ${proximo}. Você consegue emitir pelo aplicativo ou site Meu INSS, na opção "Extrato de Empréstimos Consignados".\n\n` +
    'Importante: preciso do ARQUIVO em PDF (aquele que abre o documento completo, com todos os contratos) — a foto ou o print da tela não servem para a análise. É só baixar o PDF e me enviar aqui como anexo.\n\n' +
    'Precisa de ajuda para localizar essa opção e baixar o arquivo? Me avisa que eu te explico o passo a passo, com calma.',
  // Decreto 2026-07-26: cobrança do CPF a quem JÁ entregou o HISCON (disparo
  // autorizado pelo dono, 09:00 BRT). Texto ditado pelo dono.
  followUpCpf:
    'Bom dia! Já estamos em análise e estamos precisando do número do seu CPF para solicitar os contratos junto aos bancos. Quando puder, digite aqui, por favor.',
  // Caso 31 9448-7166 (2026-07-27): a cliente respondeu ao follow-up com o CPF e
  // a AHRI disse "não consegui entender a que ele se refere" — porque a jornada
  // dela já estava CONCLUIDA e a fala caía no LLM, que via um número solto. A
  // confirmação do CPF passa a ser AUTORADA em qualquer etapa.
  cpfRegistradoEmAnalise:
    'CPF recebido e registrado, obrigada! Já está tudo certo por aqui.\n\n' +
    'Seu caso segue em análise e, assim que houver qualquer novidade, eu te aviso por aqui mesmo.',
  aguardandoDocumento: (proximo: string): string =>
    `Estou aguardando: ${proximo}, no seu tempo. Lembrando que preciso do arquivo em PDF (a foto ou o print da tela não servem para a análise).`,
  // Escada de cobrança: o 2º pedido NUNCA repete o 1º — reforça e oferece ajuda.
  aguardandoDocumentoReforco: (proximo: string): string =>
    `Só reforçando: para dar sequência à sua análise, preciso de ${proximo} — o arquivo em PDF, que é o único formato que traz todos os contratos. Se estiver com dificuldade para baixar ou enviar, me avise que eu te oriento passo a passo.`,
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
    `Verifiquei aqui e esse arquivo não parece ser o documento que estou aguardando (${proximo}). Pode conferir e enviar novamente? Qualquer dúvida, me chame.` +
    // Decreto 2026-07-27: quando o pendente é o HISCON, a recusa JÁ ensina o caminho.
    (/HISCON/i.test(proximo) ? `\n\n${PASSO_A_PASSO_HISCON}` : ''),
  // Caso Maria José (2026-07-24): a cliente enviou um HISTÓRICO DE CRÉDITO. A AHRI
  // reconhece o documento e explica exatamente qual é o certo (o HISCON).
  historicoDeCreditoRecebido:
    'Recebi o seu documento, obrigada! Mas verifiquei aqui e ele é um HISTÓRICO DE CRÉDITO — não é o extrato de empréstimos consignados completo que preciso para a análise.\n\n' +
    'Para o seu caso eu preciso do HISTÓRICO DE EMPRÉSTIMOS CONSIGNADOS (o HISCON), com todos os contratos, em PDF.\n\n' +
    PASSO_A_PASSO_HISCON,
  // Caso 7582422298 (2026-07-25): a cliente enviou o PRINT da tela de CONSULTA/BUSCA
  // do consignado ("Empréstimo não encontrado"). A AHRI reconhece a tela e explica
  // o caminho certo, pedindo o PDF do extrato completo.
  telaConsultaHisconRecebida:
    'Recebi a sua imagem, obrigada! Mas verifiquei aqui e é o print da TELA DE CONSULTA/BUSCA do Meu INSS (inclusive aparece "empréstimo não encontrado") — essa tela é só o formulário de pesquisa e não traz os seus contratos, então a análise não roda com ela.\n\n' +
    'O que eu preciso é o HISTÓRICO DE EMPRÉSTIMOS CONSIGNADOS completo (o HISCON), em PDF, com todos os contratos.\n\n' +
    PASSO_A_PASSO_HISCON,
  // Decreto 2026-07-27 (caso Marcelo): HISCON SEM contratos na janela de 5 anos
  // não tem o que revisar — a AHRI agradece, dá a notícia (que é BOA para o
  // cliente) e encerra com a porta aberta; jamais pede o documento de novo.
  hisconSemContratos:
    'Recebi o seu extrato e fiz a verificação, obrigada! Tenho até uma boa notícia: não encontrei nenhum contrato de empréstimo consignado no seu benefício nos últimos 5 anos.\n\n' +
    'O nosso trabalho é justamente revisar contratos de consignado — como o seu extrato não tem contratos nesse período, não há nada para analisarmos no seu caso agora.\n\n' +
    'Se em algum momento você contratar um consignado, ou notar algum desconto no seu benefício que não reconheça, é só me chamar por aqui que a gente analisa. Fico à disposição!',
  // Caso 5521969515359 (2026-07-27): o cliente mandou o CONTRATO do empréstimo
  // feito com o banco e a AHRI o registrou como HISCON ("cadastro completo").
  // O contrato é papel do banco; a análise precisa do EXTRATO do INSS.
  contratoBancarioRecebido:
    'Recebi o seu documento, obrigada! Mas verifiquei aqui e ele é o CONTRATO do empréstimo feito com o banco — ele pode até ajudar mais adiante, mas não é o extrato de empréstimos consignados completo que preciso para a análise.\n\n' +
    'O que eu preciso é o HISTÓRICO DE EMPRÉSTIMOS CONSIGNADOS (o HISCON), com todos os seus contratos, em PDF.\n\n' +
    PASSO_A_PASSO_HISCON,
  // Caso Gelciana (2026-07-26): a cliente mandou a FOTO de uma tela de ERRO e a
  // AHRI aceitou como HISCON, declarando a etapa completa. Agora imagem NUNCA
  // vira HISCON e a AHRI diz o que enxergou — sem jamais sugerir foto como opção.
  fotoNaoEhHiscon:
    'Recebi a sua imagem, obrigada! Mas ela é uma FOTO da tela, e a análise não roda com foto — a imagem não traz a lista completa dos seus contratos.\n\n' +
    'O que eu preciso é o ARQUIVO em PDF do extrato de empréstimos consignados COMPLETO (o HISCON), enviado aqui como anexo.\n\n' +
    PASSO_A_PASSO_HISCON,
  // Decreto 2026-07-29 (caso Luana): a análise para um FAMILIAR é bem-vinda —
  // a AHRI jamais dispensa; a documentação vem em nome do TITULAR do benefício
  // e o familiar representa e acompanha tudo pelo próprio WhatsApp.
  analiseParaFamiliar:
    'Pode sim, sem problema nenhum! Muitos filhos, netos e familiares cuidam da análise pelos seus idosos — e você pode fazer tudo por aqui mesmo, me enviando a documentação EM NOME DO TITULAR do benefício.\n\n' +
    'Funciona assim: a análise é feita nos dados de quem recebe o benefício. Então eu vou precisar de duas coisas do TITULAR:\n' +
    '1. O CPF do titular;\n' +
    '2. O HISCON do titular — o extrato de empréstimos consignados completo, em PDF, baixado do Meu INSS dele(a).\n\n' +
    'A análise é gratuita e você acompanha tudo por aqui, representando o seu familiar normalmente.\n\n' +
    'Para começar, me diga o NOME COMPLETO do titular e a cidade onde ele(a) mora, por favor.',
  // Decreto 2026-07-25: "vocês são de onde?" — resposta CANÔNICA de abrangência.
  // Nunca improvisar geografia, nunca inventar endereço/filial, nunca dizer que
  // não atende a região de alguém: a análise é nacional e o encaminhamento ao
  // advogado parceiro mais próximo acontece DEPOIS da análise.
  localizacao:
    'O Projeto Reconstrua tem parcerias com advogados em todos os estados do Brasil, então trabalhamos com análise em todo o território nacional — inclusive na sua região.\n\n' +
    'Na prática funciona assim: nós fazemos a análise do seu consignado aqui e, quando ela fica pronta, encaminhamos o seu caso para um dos nossos advogados parceiros mais próximo de você.\n\n' +
    'Ou seja, você é atendido por um advogado da sua região, sem precisar sair de casa para começar.',
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
  // Caso Sidinei: documento mandado como LINK ⇒ orientação clara, nunca cobrança.
  linkDeDocumento: (proximo: string): string =>
    'Recebi o seu link, obrigada. Só que por segurança eu não consigo abrir documentos por link — preciso do ARQUIVO aqui na conversa mesmo.\n\n' +
    'É simples: abra o documento no aplicativo, toque em "Baixar" (ou "Salvar no celular") e depois me envie o arquivo em PDF como anexo aqui no WhatsApp. Preciso do PDF completo — a foto ou o print da tela não trazem todos os contratos e a análise não roda.\n\n' +
    `Estou aguardando: ${proximo}. Qualquer dificuldade, me avise que eu te oriento passo a passo.`,
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

  // Decreto 2026-07-25: "vocês são de onde?" tem resposta CANÔNICA em qualquer
  // etapa — a abrangência é nacional e o encaminhamento ao advogado parceiro
  // mais próximo é DEPOIS da análise. Nunca deixar o LLM improvisar geografia.
  if (ehPerguntaDeLocalizacao(entrada.texto)) return MENSAGENS_JORNADA.localizacao;

  // Decreto 2026-07-29 (caso Luana): análise PARA UM FAMILIAR é bem-vinda — a
  // documentação vem em nome do TITULAR e o familiar representa. Nunca dispensar.
  if (ehSobreFamiliar(entrada.texto)) return MENSAGENS_JORNADA.analiseParaFamiliar;

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

  // CPF ACABOU DE SER CAPTURADO — a confirmação é AUTORADA em QUALQUER etapa.
  // Caso 31 9448-7166 (2026-07-27): quem já entregou o HISCON está em CONCLUIDA,
  // onde a jornada calava e o LLM assumia; ele viu só um número solto e
  // respondeu "não consegui entender a que ele se refere" a um CPF que NÓS
  // acabáramos de pedir. Nunca mais: quem responde ao pedido é a jornada.
  if (r.ultimaCaptura === 'cpf' && etapa !== 'TRIAGEM') {
    return MENSAGENS_JORNADA.cpfRegistradoEmAnalise;
  }

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
      // Decreto 2026-07-26 (CPF): a triagem tem DUAS partes — CPF e depois o
      // HISCON. O consentimento abre anunciando as duas e pedindo o CPF.
      if (r.ultimaCaptura === 'consentimento')
        return prefixoDireito + MENSAGENS_JORNADA.iniciarTriagem();
      // CPF acabou de ser capturado ⇒ confirma e emenda o pedido do HISCON.
      if (r.ultimaCaptura === 'cpf')
        return prefixoDireito + MENSAGENS_JORNADA.cpfRegistradoPedirHiscon(proximo);
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
      // Caso Sidinei: LINK de documento ⇒ orientação de envio (antes da checagem
      // de pergunta — URLs contêm '?' e virariam delegação errada ao LLM).
      if (ehLinkExterno(entrada.texto)) return MENSAGENS_JORNADA.linkDeDocumento(proximo);
      const extraConjuge =
        /comprovante/i.test(proximo) && /não tenho|nao tenho|meu nome/i.test(entrada.texto)
          ? `\n\n${MENSAGENS_JORNADA.comprovanteConjuge}`
          : '';
      // Decreto: pergunta LIVRE do cliente ⇒ a conversa humana (LLM) responde e
      // retoma o foco — nunca a cobrança seca no lugar da resposta.
      if (prefixoDireito === '' && ehPerguntaLivre(entrada.texto)) return '';
      // ENQUANTO FALTAR O CPF, a cobrança da triagem é o CPF (não o HISCON): sem
      // ele a perícia não protocola o pedido administrativo nos bancos.
      if (r.cpf === null) {
        if (r.cobrancasSeguidas >= 3) return '';
        return prefixoDireito + MENSAGENS_JORNADA.pedirCpf(r.nome);
      }
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
