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
}

export interface ItemPlano {
  readonly chatId: string;
  readonly missionId: string;
  readonly nome: string;
  /** Contratos contados para este cliente (máx. 10; ativos primeiro). */
  readonly contratos: number;
  readonly ativos: number;
  readonly suspensos: number;
  readonly outros: number;
}

export interface PlanoDistribuicao {
  readonly alvo: number;
  readonly totalContratos: number;
  readonly itens: readonly ItemPlano[];
  /** Elegíveis que sobraram fora do plano (transparência do resumo). */
  readonly elegiveisRestantes: number;
}

export const MAX_CONTRATOS_POR_CLIENTE = 10;

/** Conta os contratos de UM cliente para o plano: até `max`, ATIVOS primeiro. */
function contarParaOPlano(
  c: ClienteElegivel,
  max: number,
): { contratos: number; ativos: number; suspensos: number; outros: number } {
  const ativos = Math.min(c.ativos, max);
  const suspensos = Math.min(c.suspensos, max - ativos);
  const outros = Math.min(c.outros, max - ativos - suspensos);
  return { contratos: ativos + suspensos + outros, ativos, suspensos, outros };
}

/** O plano determinístico: clientes com MAIS ATIVOS primeiro, somando até o
 *  alvo (o cliente que cruza o alvo ENTRA inteiro — nunca fatiamos um cliente
 *  entre advogados). */
export function planejarDistribuicao(
  elegiveis: readonly ClienteElegivel[],
  alvo: number,
  maxPorCliente = MAX_CONTRATOS_POR_CLIENTE,
): PlanoDistribuicao {
  const ordenados = [...elegiveis].sort(
    (a, b) =>
      b.ativos - a.ativos ||
      b.ativos + b.suspensos + b.outros - (a.ativos + a.suspensos + a.outros) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  );
  const itens: ItemPlano[] = [];
  let total = 0;
  for (const c of ordenados) {
    if (total >= alvo) break;
    const contagem = contarParaOPlano(c, maxPorCliente);
    if (contagem.contratos === 0) continue;
    itens.push({ chatId: c.chatId, missionId: c.missionId, nome: c.nome, ...contagem });
    total += contagem.contratos;
  }
  return {
    alvo,
    totalContratos: total,
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
