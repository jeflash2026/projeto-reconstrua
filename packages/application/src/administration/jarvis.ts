// ─────────────────────────────────────────────────────────────────────────────
// JARVIS DO FOUNDER CONSOLE (decreto 2026-07-29) — a parte PURA:
//
//  • interpretarComandoDistribuicao: reconhece o COMANDO administrativo
//    ("mova 20 contratos para o advogado X") de forma determinística;
//  • planejarDistribuicao: monta o plano — clientes da FASE 1 completa ainda
//    sem advogado, MÁXIMO 10 contratos por cliente, priorizando ATIVOS
//    primeiro (depois suspensos, depois os demais da janela), somando até o
//    alvo pedido. O plano é uma PROPOSTA: nada executa sem confirmação.
//
// A LLM nunca decide aqui: comando, seleção e contagem são determinísticos.
// ─────────────────────────────────────────────────────────────────────────────

/** Cliente elegível para distribuição (fase 1 completa, SEM advogado). */
export interface ClienteElegivel {
  readonly chatId: string;
  readonly missionId: string;
  readonly nome: string;
  /** Contratos NA JANELA de 5 anos, por situação. */
  readonly ativos: number;
  readonly suspensos: number;
  readonly outros: number;
  /** Contratos NA JANELA por banco — a régua do PESO (decreto 2026-07-30):
   *  o pedido administrativo sai em LOTES de até 3 contratos por banco. */
  readonly porBanco: Readonly<Record<string, number>>;
  /** Guia v2 (decreto 2026-08-04): os PROCESSOS do cliente já contados pela
   *  régua oficial (ativos 1=1; não-ativos 3=1 por banco+ano, teto 15).
   *  Presente ⇒ substitui o peso por lotes (a contagem única do negócio). */
  readonly processos?: number;
}

export interface ItemPlano {
  readonly chatId: string;
  readonly missionId: string;
  readonly nome: string;
  /** TODOS os contratos na janela deste cliente — o cliente vai INTEIRO. */
  readonly contratos: number;
  /** O PESO contado para o alvo: Σ por banco de ⌈contratos/3⌉ (lotes).
   *  SEM teto (decreto 2026-07-30: o dono removeu o máximo de 10 por
   *  cliente — todo contrato da janela vale). */
  readonly peso: number;
  readonly ativos: number;
  readonly suspensos: number;
  readonly outros: number;
}

export interface PlanoDistribuicao {
  /** O alvo pedido pelo dono — contado em PESO (lotes de 3 por banco). */
  readonly alvo: number;
  /** Soma REAL de contratos enviados (todos os contratos dos clientes). */
  readonly totalContratos: number;
  /** Soma dos pesos contados até o alvo. */
  readonly totalPeso: number;
  readonly itens: readonly ItemPlano[];
  /** Elegíveis que sobraram fora do plano (transparência do resumo). */
  readonly elegiveisRestantes: number;
}

/** Decreto 2026-07-30: o pedido administrativo sai em lotes de até 3 contratos
 *  do MESMO banco — 9 contratos do BMB = 3 lotes = peso 3 (todos os 9 vão). */
export const LOTE_POR_BANCO = 3;

/** O PESO de um cliente: Σ por banco de ⌈contratos/3⌉ (cada lote de até 3
 *  contratos do mesmo banco conta 1). SEM teto — decreto 2026-07-30: o dono
 *  removeu o máximo de 10 por cliente; todo contrato da janela de 5 anos vale. */
export function pesoDoCliente(porBanco: Readonly<Record<string, number>>): number {
  let peso = 0;
  for (const qtd of Object.values(porBanco)) {
    if (qtd > 0) peso += Math.ceil(qtd / LOTE_POR_BANCO);
  }
  return peso;
}

/** O plano determinístico: clientes com MAIS ATIVOS primeiro, somando PESO até
 *  o alvo (o cliente que cruza o alvo ENTRA inteiro — nunca fatiamos um
 *  cliente entre advogados; TODOS os contratos dele vão no envio). */
export function planejarDistribuicao(
  elegiveis: readonly ClienteElegivel[],
  alvo: number,
): PlanoDistribuicao {
  const ordenados = [...elegiveis].sort(
    (a, b) =>
      b.ativos - a.ativos ||
      b.ativos + b.suspensos + b.outros - (a.ativos + a.suspensos + a.outros) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  );
  const itens: ItemPlano[] = [];
  let totalPeso = 0;
  let totalContratos = 0;
  for (const c of ordenados) {
    if (totalPeso >= alvo) break;
    const contratos = c.ativos + c.suspensos + c.outros;
    if (contratos === 0) continue;
    // Guia v2 (2026-08-04): quando os PROCESSOS já vêm contados pela régua
    // oficial, ELES são o peso; senão, o peso por lotes de banco (legado).
    const peso = c.processos ?? pesoDoCliente(c.porBanco);
    if (peso === 0) continue;
    itens.push({
      chatId: c.chatId,
      missionId: c.missionId,
      nome: c.nome,
      contratos,
      peso,
      ativos: c.ativos,
      suspensos: c.suspensos,
      outros: c.outros,
    });
    totalPeso += peso;
    totalContratos += contratos;
  }
  return {
    alvo,
    totalContratos,
    totalPeso,
    itens,
    elegiveisRestantes: Math.max(0, elegiveis.length - itens.length),
  };
}

// ── Comando administrativo ("mova 20 contratos para o advogado X") ────────────
export interface ComandoDistribuicao {
  readonly contratos: number;
  /** O nome do advogado citado no comando (livre) — null quando não citado. */
  readonly advogadoNome: string | null;
}

const VERBO_DISTRIBUIR =
  /\b(mova|mover|movimenta?r?|aloque|alocar|distribua|distribuir|separe|separar|envie|enviar|mande|mandar|atribua|atribuir|encaminhe|encaminhar|destine|destinar|organiz[ea]r?|monte|montar)\b/i;

/** Reconhece o comando de distribuição. null = não é comando (pergunta livre). */
export function interpretarComandoDistribuicao(texto: string): ComandoDistribuicao | null {
  if (!VERBO_DISTRIBUIR.test(texto)) return null;
  const quantidade = /(\d{1,4})\s*contratos?\b/i.exec(texto);
  if (!quantidade) return null;
  const contratos = Number(quantidade[1]);
  if (!Number.isFinite(contratos) || contratos <= 0) return null;
  // "para o advogado Fulano" / "pro Dr. Fulano" / "ao advogado X" — o resto da
  // frase após a preposição é o nome citado (casado depois contra o cadastro).
  const advogado =
    /\b(?:para|pro|ao|à|a)\s+(?:o\s+|a\s+)?(?:advogad[oa]\s+|dr\.?\s+|dra\.?\s+)?([\p{L}][\p{L}\s.'-]{1,60})\s*$/iu.exec(
      texto.trim(),
    );
  const advogadoNome = advogado?.[1]?.trim() ?? null;
  return { contratos, advogadoNome };
}

// ── Comando de MENSAGEM DITADA (decreto 2026-07-30, fim dos automáticos):
// "mande a mensagem para <cliente>: <texto>" — o ÚNICO jeito da AHRI falar
// proativamente com um cliente é o dono ditar o texto e confirmar o plano.
// O texto sai EXATAMENTE como ditado (nunca humanizado, nunca reescrito). ─────
export interface ComandoMensagem {
  /** Quem recebe (nome como no cadastro, ou número com DDD). */
  readonly destinatario: string;
  /** O texto EXATO ditado pelo dono. */
  readonly texto: string;
}

/** Reconhece "mande/envie a mensagem para <cliente>: <texto>". null = não é. */
export function interpretarComandoMensagem(texto: string): ComandoMensagem | null {
  const m =
    // Separador OBRIGATÓRIO ':' (ou travessão) — nunca '-', que aparece em
    // telefones ("48 99999-9999") e cortaria o destinatário no meio.
    /^\s*(?:ahri[,\s]+)?(?:mand[ea]|envi[ea]|dispar[ea])\s+(?:a\s+|uma\s+|essa\s+|esta\s+)?mensagem\s+(?:para|pro|pra|ao)\s+(?:o\s+|a\s+)?(?:cliente\s+)?(.+?)\s*[:—]\s*([\s\S]+?)\s*$/i.exec(
      texto,
    );
  if (!m) return null;
  const destinatario = (m[1] ?? '').trim();
  const corpo = (m[2] ?? '').trim();
  if (destinatario === '' || corpo === '') return null;
  return { destinatario, texto: corpo };
}

// ── Comando de RELATÓRIO NOMINAL (decreto 2026-07-30, caso real: "gere um
// relatório contendo nome e telefone desses 25 clientes de são paulo") ───────
// O Jarvis respondia que "não tem a lista nominal". Agora tem: o comando é
// reconhecido deterministicamente e o RELATÓRIO sai direto dos Read Models —
// a LLM não participa (nome e telefone são dados exatos, nunca narrados).
export type RecorteRelatorio = 'fase1' | 'sem-cpf' | 'hiscon';

export interface ComandoRelatorio {
  /** UF citada no pedido ("de são paulo", "em SP") — null = Brasil inteiro. */
  readonly uf: string | null;
  readonly recorte: RecorteRelatorio;
}

const GATILHO_RELATORIO =
  /\b(relat[óo]rio|lista(?:gem)?|listar|relacione|relacao)\b[\s\S]*\bclientes?\b|\bclientes?\b[\s\S]*\b(relat[óo]rio|lista(?:gem)?|listar|relacione|relacao)\b/i;

/** Reconhece o pedido de relatório nominal de clientes. null = não é. */
export function interpretarComandoRelatorio(
  texto: string,
  acharUf: (t: string) => string | null,
): ComandoRelatorio | null {
  if (!GATILHO_RELATORIO.test(texto)) return null;
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const recorte: RecorteRelatorio = /sem\s+cpf|falta(?:ndo)?\s+(?:so\s+)?(?:o\s+)?cpf/.test(t)
    ? 'sem-cpf'
    : /\bcpf\b/.test(t) || /fase\s*1/.test(t)
      ? 'fase1'
      : 'hiscon';
  return { uf: acharUf(texto), recorte };
}

// ── Comando de COBRANÇA DE CPF (decreto 2026-07-29, caso real: "consegue
// disparar mensagem solicitando o cpf para esses 28 clientes?") ──────────────
// Reconhece o pedido de disparar a cobrança de CPF para quem JÁ entregou o
// HISCON e ainda não informou o número. Cuidado deliberado: perguntas de
// CONTAGEM ("quantos clientes já enviaram o cpf?") NÃO são comando — exigimos
// um verbo de cobrança, ou um verbo de disparo acompanhado de "mensagem/
// cobrança/pedido/solicitando/pedindo" — nunca a palavra CPF sozinha.
const VERBO_COBRAR_CPF =
  /\bcobr(?:e|a|ar|ando|anca)\w*\b|\b(?:dispar\w+|envi(?:e|a|ar)|mand(?:e|a|ar)|solicit(?:e|a|ar)|pec(?:a|am)|pedir|fac(?:a|am))\b[^.?!]*\b(?:mensagem|mensagens|cobranca|pedido|aviso|lembrete|solicitando|pedindo|cobrando)\b/;

/** Reconhece o comando de cobrança de CPF. false = pergunta livre. */
export function interpretarComandoCobrancaCpf(texto: string): boolean {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!/\bcpf\b/.test(t)) return false;
  return VERBO_COBRAR_CPF.test(t);
}

// ── Comando de CADASTRO DE PROCESSOS no Painel Jurídico (decreto 2026-08-31):
// o dono cola no Jarvis o bloco "Nome do Cliente:" seguido de linhas
// "BANCO X - 0000000-00.0000.0.00.0000" (cada banco = 1 processo, a regra do
// negócio) e a AHRI cadastra tudo no Painel Jurídico automaticamente.
// Reconhecimento 100% determinístico: o nº CNJ de 20 dígitos é a assinatura
// inconfundível do comando — nenhuma LLM decide nada aqui. ───────────────────
export interface ProcessoDitado {
  /** O réu/banco como escrito na linha (ex.: "BANCO ITAU"). */
  readonly banco: string;
  /** O nº CNJ como escrito (pontuação preservada para exibição). */
  readonly numero: string;
}

export interface ClienteComProcessos {
  readonly nome: string;
  readonly processos: readonly ProcessoDitado[];
}

export interface ComandoProcessosJuridico {
  /** Grupos na ordem do texto — cada "Nome:" abre um grupo. */
  readonly clientes: readonly ClienteComProcessos[];
  /** Linhas de processo SEM um "Nome do cliente:" acima (erro de formato). */
  readonly semCliente: number;
}

// O nº CNJ completo — a âncora do tokenizador (global).
const RE_CNJ = /\d{7}-?\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/gu;
// Nome de cliente plausível: 2+ palavras de letras, tamanho humano.
const RE_NOME = /^[\p{L}][\p{L}' .-]{2,118}[\p{L}.]$/u;
// Frase de ABERTURA nunca é cliente (caso real 2026-09-10: "Segue a lista dos
// processos distribuídos:" virou cliente e engoliu 23 processos de 9 pessoas).
const RE_PREAMBULO =
  /\b(segue|seguem|lista|processos?|adicion\w*|add|cadastr\w*|seguintes?|abaixo|distribu\w*|jur[ií]dico|perfil|clientes?)\b/iu;
// Instituição nunca é cliente ("BANCO X:" / "CEF ⇥ nº" são o RÉU do processo).
const RE_INSTITUICAO = /\b(banco|bank|financeira|caixa|cef|cr[eé]dito)\b/iu;

/** Limpa um pedaço de banco/nome: separadores, marcadores e negrito nas bordas. */
function limparPedaco(bruto: string): string {
  return bruto
    .replace(/^[\s\-–—:;,.•*]+/u, '')
    .replace(/[\s\-–—:;,•*]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ehNomeDeCliente(candidato: string): boolean {
  return (
    RE_NOME.test(candidato) &&
    candidato.includes(' ') &&
    !/\s[-–—]\s/u.test(candidato) &&
    !RE_PREAMBULO.test(candidato) &&
    !RE_INSTITUICAO.test(candidato)
  );
}

/** "GILDETE DOS SANTOS" → "Gildete dos Santos" (só quando veio TODO em caixa alta). */
export function nomeApresentavel(nome: string): string {
  if (nome !== nome.toUpperCase()) return nome;
  const particulas = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return nome
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && particulas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

function chaveDoNome(nome: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Reconhece o bloco de cadastro de processos nos formatos que o dono cola:
 *   • "Nome:" + linhas "BANCO - nº" (em linhas separadas ou TUDO numa linha só);
 *   • "*NOME*" em negrito (WhatsApp) + linhas "BANCO ⇥ nº";
 *   • planilha colada: "NOME ⇥ BANCO ⇥ nº" — o nome na 1ª coluna abre o
 *     cliente e as linhas seguintes sem nome continuam nele.
 *  Tokeniza pelos nº CNJ (assinatura inconfundível); em cada trecho entre dois
 *  números, o ÚLTIMO cabeçalho de cliente vence e o resto é o banco. Frase de
 *  abertura e nome de instituição nunca viram cliente.
 *  null = nenhum nº CNJ no texto (pergunta livre segue ao narrador). */
export function interpretarComandoProcessosJuridico(
  texto: string,
): ComandoProcessosJuridico | null {
  const matches = [...texto.matchAll(RE_CNJ)];
  if (matches.length === 0) return null;
  const clientes: { nome: string; processos: ProcessoDitado[] }[] = [];
  const porChave = new Map<string, { nome: string; processos: ProcessoDitado[] }>();
  let atual: { nome: string; processos: ProcessoDitado[] } | null = null;
  const abrir = (nomeBruto: string): void => {
    const nome = nomeApresentavel(nomeBruto);
    const chave = chaveDoNome(nome);
    const existente = porChave.get(chave);
    if (existente !== undefined) {
      atual = existente;
      return;
    }
    const novo = { nome, processos: [] as ProcessoDitado[] };
    porChave.set(chave, novo);
    clientes.push(novo);
    atual = novo;
  };
  let semCliente = 0;
  let cursor = 0;
  for (const m of matches) {
    const trecho = texto.slice(cursor, m.index);
    cursor = m.index + m[0].length;

    // Cabeçalhos no trecho: "*NOME*" (negrito) e "Nome:" (dois-pontos). O que
    // termina MAIS ADIANTE vence — a abertura com ':' fica para trás.
    let cabecalho: { nome: string; fim: number } | null = null;
    const considerar = (bruto: string, fim: number): void => {
      const nome = limparPedaco(bruto);
      if (ehNomeDeCliente(nome) && (cabecalho === null || fim > cabecalho.fim))
        cabecalho = { nome, fim };
    };
    for (const b of trecho.matchAll(/\*([^*\n]{3,120})\*/gu))
      considerar(b[1] ?? '', b.index + b[0].length);
    for (let k = trecho.indexOf(':'); k !== -1; k = trecho.indexOf(':', k + 1)) {
      const inicio = Math.max(trecho.lastIndexOf('\n', k - 1), trecho.lastIndexOf(':', k - 1)) + 1;
      considerar(trecho.slice(inicio, k), k + 1);
    }
    const achado = cabecalho as { nome: string; fim: number } | null;
    if (achado !== null) abrir(achado.nome);
    let pedacoBanco = achado !== null ? trecho.slice(achado.fim) : trecho;
    // Caso real 2026-09-17: "adicione no juridico: FRANCISCO NUNES DA SILVA Banco
    // Mercantil do Brasil - nº" — o nome colado ao banco, sem dois-pontos. Sem
    // cliente aberto, o que vem ANTES da 1ª instituição abre o cliente.
    if (achado === null && (atual as { nome: string } | null) === null) {
      const resto = trecho.slice(Math.max(trecho.lastIndexOf(':'), trecho.lastIndexOf('\n')) + 1);
      const instituicao = /\b(banco|bank|financeira|caixa|cef)\b/iu.exec(resto);
      const nome = instituicao !== null ? limparPedaco(resto.slice(0, instituicao.index)) : '';
      if (instituicao !== null && ehNomeDeCliente(nome)) {
        abrir(nome);
        pedacoBanco = resto.slice(instituicao.index);
      }
    }

    // O banco é a última linha CHEIA do pedaço (o nº pode estar na linha de
    // baixo). Colunas por TAB ou 2+ espaços: "NOME ⇥ BANCO" abre o cliente.
    const linhas = pedacoBanco.split(/\r?\n/).filter((l) => limparPedaco(l) !== '');
    const colunas = (linhas.pop() ?? '')
      .split(/\t+| {2,}/)
      .map(limparPedaco)
      .filter((c) => c !== '');
    let colunasBanco = colunas;
    if (colunas.length >= 2 && ehNomeDeCliente(colunas[0] ?? '')) {
      abrir(colunas[0] ?? '');
      colunasBanco = colunas.slice(1);
    }
    const banco = colunasBanco.join(' - ').slice(0, 120);
    const alvo = atual as { nome: string; processos: ProcessoDitado[] } | null;
    if (alvo === null) {
      semCliente += 1;
      continue;
    }
    alvo.processos.push({ banco: banco === '' ? 'BANCO (não informado)' : banco, numero: m[0] });
  }
  return { clientes: clientes.filter((c) => c.processos.length > 0), semCliente };
}

/** Casa o nome citado no comando com o cadastro (contains, sem acentos). */
export function casarAdvogadoPorNome<T extends { readonly name: string }>(
  citado: string | null,
  advogados: readonly T[],
): T | null {
  if (citado === null || citado.trim() === '') return null;
  const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const alvo = norm(citado);
  const primeiroDoAlvo = alvo.split(/\s+/)[0] ?? '';
  return (
    advogados.find((a) => norm(a.name) === alvo) ??
    advogados.find((a) => norm(a.name).includes(alvo) || alvo.includes(norm(a.name))) ??
    advogados.find((a) => {
      const primeiro = norm(a.name).split(/\s+/)[0] ?? '';
      return primeiro !== '' && alvo.split(/\s+/).includes(primeiro);
    }) ??
    // Tolerância a grafia (caso real: cadastro "Cornlélio", comando "Cornélio"):
    // os 4+ primeiros caracteres do primeiro nome coincidem.
    advogados.find((a) => {
      const primeiro = norm(a.name).split(/\s+/)[0] ?? '';
      return (
        primeiroDoAlvo.length >= 4 &&
        primeiro.length >= 4 &&
        primeiro.slice(0, 4) === primeiroDoAlvo.slice(0, 4)
      );
    }) ??
    null
  );
}

// ── Comando de CARTEIRA DE INVESTIDOR (2026-09-16): "adicione 250 mil em
// crédito ao investidor João" — a AHRI propõe os processos que cobrem o crédito
// (a parte da empresa em cada um, espalhados por advogado, cliente e banco)
// e NADA é alocado sem a confirmação do dono. Reconhecimento determinístico:
// ("carteira" ou "crédito") + verbo + (investidor, ou processo sem advogado) +
// um valor ou uma quantidade de processos. ────────────────────────────────────
export interface ComandoCarteiraInvestidor {
  /** O CRÉDITO pedido (a parte da empresa em cada processo); null = por quantidade. */
  readonly valor: number | null;
  /** Quantidade explícita ("25 processos"); null = deduzida do valor. */
  readonly processos: number | null;
  /** O investidor citado (livre) — casado depois contra o cadastro. */
  readonly investidorNome: string | null;
}

const VERBO_CARTEIRA =
  /\b(add|adicion\w*|acrescent\w*|cri[ae]\w*|mont\w*|destin\w*|aloc\w*|aloqu\w*|coloc\w*|separ\w*|ger[ae]\w*|prepar\w*|faca|fazer|faz|abr[ae]\w*|vend\w*|pass[ae]\w*|atribu\w*|inclu\w*)\b/;

function numeroBr(bruto: string): number {
  // "250.000,50" → 250000.5 · "1,5" → 1.5 · "250.000" → 250000
  const t = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  return /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, '')) : Number(t);
}

/** O valor em reais citado ("250 mil", "R$ 250.000", "1,5 milhão"). */
export function lerValorEmReais(texto: string): number | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const escala = /(\d+(?:[.,]\d+)*)\s*(mil\b|k\b|milhao\b|milhoes\b|mi\b)/.exec(t);
  if (escala !== null) {
    const n = numeroBr(escala[1] ?? '');
    const fator = escala[2] === 'mil' || escala[2] === 'k' ? 1e3 : 1e6;
    const v = n * fator;
    return Number.isFinite(v) && v >= 1_000 ? Math.round(v) : null;
  }
  const cheio = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,})(?:,\d{2})?/.exec(t);
  if (cheio !== null && !/\d{7}-?\d{2}\.\d{4}/.test(t)) {
    const v = numeroBr(cheio[1] ?? '');
    return Number.isFinite(v) && v >= 1_000 ? v : null;
  }
  return null;
}

const PARADAS_NOME = new Set([
  'com',
  'de',
  'em',
  'no',
  'na',
  'e',
  'que',
  'do',
  'da',
  'por',
  'para',
  'valor',
]);

function nomeAposMarcador(texto: string, marcador: RegExp): string | null {
  const m = marcador.exec(texto);
  if (m === null) return null;
  const palavras: string[] = [];
  for (const p of texto.slice(m.index + m[0].length).split(/\s+/)) {
    const limpa = p.replace(/[,.;:!?]+$/, '');
    if (limpa === '' || !/^\p{L}[\p{L}'-]*$/u.test(limpa)) break;
    if (PARADAS_NOME.has(limpa.toLowerCase()) && palavras.length > 0) {
      // "dos Santos" continua o nome; "com 250 mil" encerra.
      if (/^d[aeo]s?$/i.test(limpa)) {
        palavras.push(limpa);
        continue;
      }
      break;
    }
    if (PARADAS_NOME.has(limpa.toLowerCase())) break;
    palavras.push(limpa);
    if (palavras.length >= 5 || p !== limpa) break;
  }
  while (palavras.length > 0 && /^d[aeo]s?$/i.test(palavras[palavras.length - 1] ?? ''))
    palavras.pop();
  return palavras.length > 0 ? palavras.join(' ') : null;
}

/** Reconhece o comando de carteira de investidor. null = não é. */
export function interpretarComandoCarteiraInvestidor(
  texto: string,
): ComandoCarteiraInvestidor | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!/\b(carteira|credito)\b/.test(t) || !VERBO_CARTEIRA.test(t)) return null;
  const citaInvestidor = /\binvestidor/.test(t);
  // Sem "investidor": só "carteira" + processo, e nunca carteira de advogado.
  if (!citaInvestidor && (!/\bcarteira\b/.test(t) || !/\bprocess/.test(t) || /\badvogad/.test(t)))
    return null;
  const qtd = /(\d{1,4})\s*process(?:o|os)\b/.exec(t);
  const processos = qtd !== null ? Number(qtd[1]) : null;
  const valor = lerValorEmReais(texto);
  if ((processos === null || processos <= 0) && valor === null) return null;
  const investidorNome =
    nomeAposMarcador(texto, /\binvestidor(?:a)?\s+(?:chamad[oa]\s+)?/iu) ??
    nomeAposMarcador(
      texto,
      /\b(?:para|pro|ao|à)\s+(?:o\s+|a\s+)?(?:sr\.?\s+|sra\.?\s+)?(?=\p{Lu})/u,
    );
  return {
    valor,
    processos: processos !== null && processos > 0 ? processos : null,
    investidorNome,
  };
}
