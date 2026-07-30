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
}

export interface ItemPlano {
  readonly chatId: string;
  readonly missionId: string;
  readonly nome: string;
  /** TODOS os contratos na janela deste cliente — o cliente vai INTEIRO. */
  readonly contratos: number;
  /** O PESO contado para o alvo: Σ por banco de ⌈contratos/3⌉ (lotes),
   *  com o teto de 10 por cliente (decreto fundador do Jarvis). */
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

export const PESO_MAXIMO_POR_CLIENTE = 10;
/** Decreto 2026-07-30: o pedido administrativo sai em lotes de até 3 contratos
 *  do MESMO banco — 9 contratos do BMB = 3 lotes = peso 3 (todos os 9 vão). */
export const LOTE_POR_BANCO = 3;

/** O PESO de um cliente: Σ por banco de ⌈contratos/3⌉ (cada lote de até 3
 *  contratos do mesmo banco conta 1), com o teto por cliente. */
export function pesoDoCliente(
  porBanco: Readonly<Record<string, number>>,
  maxPorCliente = PESO_MAXIMO_POR_CLIENTE,
): number {
  let peso = 0;
  for (const qtd of Object.values(porBanco)) {
    if (qtd > 0) peso += Math.ceil(qtd / LOTE_POR_BANCO);
  }
  return Math.min(peso, maxPorCliente);
}

/** O plano determinístico: clientes com MAIS ATIVOS primeiro, somando PESO até
 *  o alvo (o cliente que cruza o alvo ENTRA inteiro — nunca fatiamos um
 *  cliente entre advogados; TODOS os contratos dele vão no envio). */
export function planejarDistribuicao(
  elegiveis: readonly ClienteElegivel[],
  alvo: number,
  maxPorCliente = PESO_MAXIMO_POR_CLIENTE,
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
    const peso = pesoDoCliente(c.porBanco, maxPorCliente);
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
  /\b(mova|mover|movimenta?r?|aloque|alocar|distribua|distribuir|separe|separar|envie|enviar|mande|mandar|atribua|atribuir|encaminhe|encaminhar|destine|destinar)\b/i;

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
