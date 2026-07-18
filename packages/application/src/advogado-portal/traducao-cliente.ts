// ─────────────────────────────────────────────────────────────────────────────
// TRADUÇÃO HUMANIZADA (GO-LIVE-02 · Bloqueador 1) — o Portal NUNCA reproduz
// texto jurídico cru. O advogado continua escrevendo livremente (o original é o
// FATO, imutável — Lei 10); a AHRI gera UMA VEZ, na escrita, a versão para o
// cliente (`textoCliente`), persistida ao lado do original (evolução ADITIVA).
//
// Princípios homologados:
//  • A verdade permanece; a linguagem muda. O LLM só re-diz — jamais decide.
//  • Portal não interpreta (P3): a tradução acontece AQUI, nunca no render.
//  • Uma única verdade: balão do Portal e pacote de estado usam a MESMA frase.
//  • FAIL-CLOSED (Lei 9): sem tradução ⇒ o balão NÃO aparece (ausência declarada,
//    nunca juridiquês). O tick reprocessa pendentes até a tradução existir.
//  • ANTI-INVENÇÃO determinística: nenhum número na versão do cliente que não
//    exista no original — tradução que inventa é DESCARTADA (fica pendente).
// ─────────────────────────────────────────────────────────────────────────────
import { CLIENT_FACING_KINDS, type JuridicalEntry, type JuridicalWorkStore } from './juridical-work.js';

/** A voz que re-diz (adapter LLM na infraestrutura). Lança em falha. */
export interface TradutorClientePort {
  traduzir(original: string): Promise<string>;
}

/** Instrução ÚNICA da tradução (fonte única — a infraestrutura só transporta). */
export const PROMPT_TRADUCAO_CLIENTE =
  'Você é a AHRI, a inteligência que acompanha cada cliente do escritório com atenção e cuidado. ' +
  'Reescreva a anotação jurídica abaixo como VOCÊ contaria a novidade ao seu cliente, em primeira pessoa, com calor humano e em linguagem simples. ' +
  'REGRAS INVIOLÁVEIS: não adicione NENHUM fato, número, data ou valor que não esteja no texto original; ' +
  'não prometa resultados nem prazos; não emita opinião sobre chances do processo; ' +
  'não use juridiquês (explique em palavras comuns); 1 a 2 frases curtas; ' +
  'transmita tranquilidade quando o passo for normal do caminho. ' +
  'Responda APENAS com o texto reescrito, sem aspas nem comentários.';

/**
 * Guard ANTI-INVENÇÃO: toda sequência de dígitos da tradução precisa existir no
 * original. Determinístico — a verdade nunca depende do LLM.
 */
export function traducaoPreservaVerdade(original: string, traduzida: string): boolean {
  const numeros = traduzida.match(/\d+/g) ?? [];
  return numeros.every((n) => original.includes(n));
}

/** A entrada precisa de tradução? (dizível ao cliente e ainda sem versão humana) */
export function precisaTraducao(entry: JuridicalEntry): boolean {
  return (
    CLIENT_FACING_KINDS.includes(entry.kind) &&
    entry.kind !== 'numero_processo' &&
    (entry.textoCliente === undefined || entry.textoCliente === null || entry.textoCliente === '')
  );
}

export class TraducaoClienteRuntime {
  constructor(
    private readonly work: JuridicalWorkStore,
    /** null = LLM indisponível (offline): tudo fica pendente — fail-closed. */
    private readonly tradutor: TradutorClientePort | null,
    /** Missões vivas (derivadas da lista única) — universo do reprocessamento. */
    private readonly missoes: () => Promise<readonly string[]>,
    private readonly log?: (message: string) => void,
  ) {}

  /**
   * Traduz UMA entrada (chamada na escrita do advogado). Best-effort: falha ⇒
   * devolve a entrada intacta (pendente); NUNCA propaga erro ao fluxo do advogado.
   */
  async traduzir(entry: JuridicalEntry): Promise<JuridicalEntry> {
    if (!precisaTraducao(entry)) return entry;
    if (this.tradutor === null) return entry; // offline: pendente (fail-closed)
    try {
      const texto = (await this.tradutor.traduzir(entry.text)).trim();
      if (texto === '' || !traducaoPreservaVerdade(entry.text, texto)) {
        this.log?.(`tradução descartada (vazia ou inventou números) para ${entry.id}`);
        return entry; // descartada ⇒ permanece pendente; o tick tenta de novo
      }
      const traduzida: JuridicalEntry = { ...entry, textoCliente: texto };
      await this.work.save(traduzida);
      return traduzida;
    } catch (error) {
      this.log?.(`tradução falhou para ${entry.id}: ${error instanceof Error ? error.message : 'erro'}`);
      return entry;
    }
  }

  /** Reprocessa pendentes (roda no tick — nenhum balão nasce cru, só atrasa). */
  async reprocessarPendentes(): Promise<number> {
    if (this.tradutor === null) return 0;
    let traduzidas = 0;
    for (const missionId of await this.missoes()) {
      for (const entry of await this.work.byMission(missionId)) {
        if (!precisaTraducao(entry)) continue;
        const resultado = await this.traduzir(entry);
        if (resultado.textoCliente !== undefined && resultado.textoCliente !== null && resultado.textoCliente !== '') {
          traduzidas += 1;
        }
      }
    }
    return traduzidas;
  }
}
