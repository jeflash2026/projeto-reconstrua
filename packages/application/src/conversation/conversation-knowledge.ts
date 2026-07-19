// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION KNOWLEDGE (GO-LIVE 9G) — o CONHECIMENTO adquirido na conversa.
//
// A memória (9F) lembra o FIO (perguntas/respostas). Esta camada aprende FATOS:
// nunca guarda perguntas, nunca respostas literais — apenas fatos estruturados
// {factKey, valor, origem, confiança}.
//
// NÃO persistente POR CONSTRUÇÃO: derivada da conversa ativa a cada turno —
// nasce da conversa e morre com ela. Fato que muda durante a conversa é
// ATUALIZADO (a detecção mais recente vence).
//
// GENÉRICA: este motor conhece apenas fatos. Os fatos ESPECÍFICOS do domínio
// (consignado INSS hoje; AHRI Business/Life amanhã) vêm de um CATÁLOGO de
// detectores fornecido pelo produto — trocar o catálogo troca o domínio.
//
// Detecção determinística: cada detector avalia a RESPOSTA do cliente (e a
// pergunta que a antecedeu, quando precisa de contexto — ex.: "Sim" só vira
// fato diante da pergunta certa). Sem LLM; testável; auditável.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationContextView, MemoryEntry } from './ports.js';

export type ConfiancaDoFato = 'alta' | 'media';

export interface FatoAprendido {
  readonly factKey: string;
  readonly valor: string;
  /** De onde o fato nasceu (trecho curto da resposta — auditável). */
  readonly origem: string;
  readonly confianca: ConfiancaDoFato;
}

export interface DeteccaoDeFato {
  readonly valor: string;
  readonly confianca?: ConfiancaDoFato;
}

export interface DetectorDeFato {
  readonly factKey: string;
  /** Avalia UMA resposta do cliente (com a pergunta anterior, se precisar). */
  readonly detectar: (resposta: string, perguntaAnterior: string | null) => DeteccaoDeFato | null;
}

export type CatalogoDeConhecimento = readonly DetectorDeFato[];

function curto(s: string, max = 70): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function ultimaPerguntaDe(texto: string | null): string | null {
  if (texto === null) return null;
  const qs = texto.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => s.endsWith('?'));
  return qs[qs.length - 1] ?? null;
}

/** Aprende os fatos da conversa ativa. Determinística; o fato mais recente vence. */
export function aprenderDaConversa(
  context: ConversationContextView,
  catalogo: CatalogoDeConhecimento,
): readonly FatoAprendido[] {
  const entries: readonly MemoryEntry[] = [...(context.recentEntries ?? [])].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  );

  const aprendidos = new Map<string, FatoAprendido>();
  let perguntaAnterior: string | null = null;

  const aprender = (resposta: string, pergunta: string | null): void => {
    const normalizada = resposta.toLowerCase();
    for (const detector of catalogo) {
      const hit = detector.detectar(normalizada, pergunta?.toLowerCase() ?? null);
      if (hit !== null) {
        // Fato que muda durante a conversa é ATUALIZADO (o mais recente vence).
        aprendidos.set(detector.factKey, {
          factKey: detector.factKey,
          valor: hit.valor,
          origem: `resposta do cliente: «${curto(resposta)}»`,
          confianca: hit.confianca ?? 'alta',
        });
      }
    }
  };

  for (const e of entries) {
    if (e.kind === 'outbound') {
      perguntaAnterior = ultimaPerguntaDe(e.text) ?? perguntaAnterior;
    } else if (e.kind === 'inbound' && e.text !== null && e.text !== '') {
      aprender(e.text, perguntaAnterior);
    }
  }

  // O inbound corrente (percept do turno) também ensina — idempotente se já logado.
  const atual = context.lastPercept?.envelope?.text ?? null;
  if (atual !== null && atual !== '') aprender(atual, perguntaAnterior);

  return [...aprendidos.values()];
}

/** Resumo compacto p/ condução e fraseado: "beneficio=aposentadoria; …". */
export function resumoDoConhecimento(fatos: readonly FatoAprendido[]): string | null {
  if (fatos.length === 0) return null;
  return fatos.map((f) => `${f.factKey}=${f.valor}`).join('; ');
}
