// ─────────────────────────────────────────────────────────────────────────────
// COBRANÇA DOCUMENTAL — A REGRA ÚNICA (2026-08-12).
//
// CASO REAL (Sandra Aparecida Barbosa): ela já tinha entregue RG, comprovante e
// extrato do INSS; faltava só a procuração. Mesmo assim recebeu um lembrete
// pedindo os QUATRO documentos, e respondeu "De novo eu já enviei" — a equipe
// teve de pedir desculpa e desdizer a própria mensagem no dia seguinte.
//
// CAUSA: existiam DUAS cobranças no sistema. O disparo em lote calculava o que
// faltava e usava o template com {{2}} cirúrgico; o botão do chat mandava um
// modelo com a lista dos quatro documentos FIXA no texto, sem olhar o cadastro.
// Duas regras para a mesma pergunta ⇒ uma delas está sempre errada.
//
// Este módulo é a ÚNICA fonte da resposta "o que falta para este cliente e o que
// dizer a ele". Quem cobra — lote ou botão — pergunta aqui.
// ─────────────────────────────────────────────────────────────────────────────

/** O que a mesa do Humanizado sabe sobre os documentos da fase 2. */
export interface DocsDaFase2 {
  readonly procuracao: boolean;
  readonly rg: boolean;
  readonly comprovante: boolean;
  /** 4º documento (decreto 2026-08-05) — ausente em cadastros antigos. */
  readonly extratoCredito?: boolean;
}

/** Ordem de cobrança e o nome que o cliente entende. A procuração vem primeiro:
 *  é a única que depende de ele imprimir, assinar e devolver. */
const DOCUMENTOS: readonly {
  readonly entregue: (d: DocsDaFase2) => boolean;
  readonly rotulo: string;
}[] = [
  { entregue: (d) => d.procuracao, rotulo: 'a procuração assinada' },
  { entregue: (d) => d.rg, rotulo: 'o RG (frente e verso)' },
  { entregue: (d) => d.comprovante, rotulo: 'o comprovante de endereço' },
  { entregue: (d) => d.extratoCredito === true, rotulo: 'o extrato do INSS dos últimos 3 meses' },
];

export interface CobrancaDocumental {
  /** Só o que ESTE cliente ainda deve, em linguagem de cliente. */
  readonly faltantes: readonly string[];
  /** A mesma lista escrita como frase: "o RG (frente e verso) e a procuração". */
  readonly lista: string;
  /** O cliente já entregou ALGUMA coisa? Decide o template. */
  readonly entregouAlgum: boolean;
  /** Nada falta — cobrar seria pedir o que já está na mão (o erro da Sandra). */
  readonly completo: boolean;
  /** `documentos_pendentes` cobra só o que falta ({{2}}); `contato_equipe` se
   *  apresenta e explica a lista inteira a quem ainda não mandou nada. */
  readonly template: 'documentos_pendentes' | 'contato_equipe';
}

export function cobrancaDocumental(docs: DocsDaFase2): CobrancaDocumental {
  const faltantes = DOCUMENTOS.filter((d) => !d.entregue(docs)).map((d) => d.rotulo);
  const entregouAlgum = DOCUMENTOS.some((d) => d.entregue(docs));
  return {
    faltantes,
    lista: comoFrase(faltantes),
    entregouAlgum,
    completo: faltantes.length === 0,
    template: entregouAlgum ? 'documentos_pendentes' : 'contato_equipe',
  };
}

/** "a, b e c" — vírgula entre os primeiros, "e" antes do último. */
function comoFrase(itens: readonly string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1] ?? ''}`;
}
