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

/** Limpa um pedaço de banco/nome: separadores nas bordas, espaços colapsados. */
function limparPedaco(bruto: string): string {
  return bruto
    .replace(/^[\s\-–—:;,.]+/u, '')
    .replace(/[\s\-–—:;,]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reconhece o bloco de cadastro de processos — em LINHAS SEPARADAS ou TUDO
 *  NUMA LINHA SÓ (caso real 2026-08-31: o dono colou inline e o parser por
 *  linha não reconheceu; o texto caiu no narrador, que inventou confirmação).
 *  Tokeniza pelos nº CNJ: o trecho entre um CNJ e o próximo é o BANCO; um
 *  "Nome:" dentro do trecho abre um grupo novo (a ÚLTIMA linha antes dos
 *  dois-pontos é o nome — preâmbulos com ':' próprios são descartados).
 *  null = nenhum nº CNJ no texto (pergunta livre segue ao narrador). */
export function interpretarComandoProcessosJuridico(
  texto: string,
): ComandoProcessosJuridico | null {
  const matches = [...texto.matchAll(RE_CNJ)];
  if (matches.length === 0) return null;
  const clientes: { nome: string; processos: ProcessoDitado[] }[] = [];
  let atual: { nome: string; processos: ProcessoDitado[] } | null = null;
  let semCliente = 0;
  let cursor = 0;
  for (const m of matches) {
    const trecho = texto.slice(cursor, m.index);
    cursor = m.index + m[0].length;
    // Um "Nome:" no trecho abre um grupo: o nome é a ÚLTIMA LINHA do que vem
    // antes do último ':' (o preâmbulo "adicione no jurídico:" fica para trás).
    const ultimaLinhaCheia = (bloco: string): string => {
      const linhas = bloco
        .split(/\r?\n/)
        .map(limparPedaco)
        .filter((l) => l !== '');
      return linhas.pop() ?? '';
    };
    const doisPontos = trecho.lastIndexOf(':');
    let pedacoBanco = trecho;
    if (doisPontos !== -1) {
      const ultimaLinha = ultimaLinhaCheia(trecho.slice(0, doisPontos));
      // O nome pode dividir a linha com outro ':' (inline: "jurídico: Taís…").
      const candidato = limparPedaco(ultimaLinha.split(':').pop() ?? '');
      if (RE_NOME.test(candidato) && candidato.includes(' ')) {
        atual = { nome: candidato, processos: [] };
        clientes.push(atual);
      }
      pedacoBanco = trecho.slice(doisPontos + 1);
    }
    // O banco é a última linha CHEIA do pedaço (o CNJ pode estar na linha de
    // baixo do banco) — inline, é o pedaço inteiro entre um CNJ e o próximo.
    const banco = ultimaLinhaCheia(pedacoBanco).slice(0, 120);
    if (atual === null) {
      semCliente += 1;
      continue;
    }
    atual.processos.push({ banco: banco === '' ? 'BANCO (não informado)' : banco, numero: m[0] });
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
