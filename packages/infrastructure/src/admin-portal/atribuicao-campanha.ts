// ─────────────────────────────────────────────────────────────────────────────
// ATRIBUIÇÃO DE CAMPANHA (2026-08-12) — de onde vem cada cliente, de verdade.
//
// A página "Campanhas" nasceu como espaço reservado: o campo campaignAttribution
// existia, começava vazio e NUNCA foi escrito por ninguém. Dizia "sem fonte de
// dados" porque era literalmente verdade.
//
// A fonte sempre esteve ali, sem ninguém ler: a landing escreve a origem DENTRO
// da primeira mensagem que o cliente manda — "Olá! Vim pelo site (X) e quero
// entender meu benefício do INSS", onde X vem da URL da visita. Basta ler a
// primeira mensagem de cada conversa.
//
// E a atribuição só vale alguma coisa se for cruzada com o FUNIL: campanha boa
// não é a que traz mais gente, é a que traz gente que fecha. Por isso cada
// origem vem com contatos → HISCON → confirmados → documentação completa.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';

/** "Olá! Vim pelo site (black-friday) e quero..." → "black-friday". */
const MARCA_DE_ORIGEM = /vim pelo site \(([^)]{1,80})\)/i;

/** Rótulos das origens que a landing gera sozinha (sem nome de campanha). */
const ROTULOS: Readonly<Record<string, string>> = {
  'google-ads': 'Google Ads',
  'meta-ads': 'Meta Ads',
  organico: 'Site (sem campanha)',
};

export interface LinhaCampanha {
  readonly origem: string;
  readonly rotulo: string;
  readonly contatos: number;
  readonly entregaramHiscon: number;
  readonly confirmaram: number;
  readonly fecharam: number;
  /** % dos contatos desta origem que chegaram à documentação completa. */
  readonly taxaDeFechamento: number;
}

export interface AtribuicaoCampanhas {
  readonly geradoEm: string;
  readonly disponivel: boolean;
  readonly linhas: readonly LinhaCampanha[];
  /** Conversas sem a marca de origem: vieram por indicação, pelo número direto,
   *  ou entraram antes de a landing carimbar a campanha. Não é falha — é o
   *  tamanho honesto do que a atribuição NÃO alcança. */
  readonly semOrigem: number;
}

export interface ContatoParaAtribuir {
  readonly chatId: string;
  readonly clienteId: string;
}

export interface AtribuicaoDeps {
  readonly clock: Clock;
  readonly contatos: () => Promise<readonly ContatoParaAtribuir[]>;
  /** As primeiras mensagens da conversa (ordem cronológica) — a marca de origem
   *  está na primeira que o cliente escreve. */
  readonly inicioDaConversa: (chatId: string) => Promise<readonly string[]>;
  /** chatIds que entregaram HISCON legível. */
  readonly comHiscon: () => Promise<ReadonlySet<string>>;
  /** clienteIds que confirmaram o parecer (disseram SIM). */
  readonly confirmados: () => Promise<ReadonlySet<string>>;
  /** chatIds com documentação 100% completa na mesa. */
  readonly fechados: () => Promise<ReadonlySet<string>>;
}

export class AtribuicaoDeCampanha {
  constructor(private readonly deps: AtribuicaoDeps) {}

  async gerar(): Promise<AtribuicaoCampanhas> {
    const [contatos, comHiscon, confirmados, fechados] = await Promise.all([
      this.deps.contatos(),
      this.deps.comHiscon(),
      this.deps.confirmados(),
      this.deps.fechados(),
    ]);

    const porOrigem = new Map<
      string,
      { contatos: number; hiscon: number; confirmou: number; fechou: number }
    >();
    let semOrigem = 0;

    for (const c of contatos) {
      const inicio = await this.deps.inicioDaConversa(c.chatId).catch(() => []);
      const origem = origemDe(inicio);
      if (origem === null) {
        semOrigem += 1;
        continue;
      }
      const linha = porOrigem.get(origem) ?? { contatos: 0, hiscon: 0, confirmou: 0, fechou: 0 };
      linha.contatos += 1;
      if (comHiscon.has(c.chatId)) linha.hiscon += 1;
      if (confirmados.has(c.clienteId)) linha.confirmou += 1;
      if (fechados.has(c.chatId)) linha.fechou += 1;
      porOrigem.set(origem, linha);
    }

    const linhas = [...porOrigem.entries()]
      .map(([origem, l]) => ({
        origem,
        rotulo: ROTULOS[origem] ?? origem,
        contatos: l.contatos,
        entregaramHiscon: l.hiscon,
        confirmaram: l.confirmou,
        fecharam: l.fechou,
        taxaDeFechamento: l.contatos === 0 ? 0 : Math.round((l.fechou / l.contatos) * 1000) / 10,
      }))
      // Quem FECHA vem primeiro; empate desempata por volume. É a ordem da
      // decisão de onde investir — não a ordem alfabética.
      .sort((a, b) => b.fecharam - a.fecharam || b.contatos - a.contatos);

    return {
      geradoEm: this.deps.clock.now().toISOString(),
      disponivel: linhas.length > 0,
      linhas,
      semOrigem,
    };
  }
}

/** A origem carimbada pela landing na primeira mensagem do cliente. */
export function origemDe(mensagens: readonly string[]): string | null {
  for (const texto of mensagens) {
    const achado = MARCA_DE_ORIGEM.exec(texto);
    const bruto = achado?.[1]?.trim();
    if (bruto !== undefined && bruto !== '') return bruto.toLowerCase();
  }
  return null;
}
