// ─────────────────────────────────────────────────────────────────────────────
// CARTÕES A PARTIR DO HISTÓRICO MENSAL (caso REAL Luiz Carlos da Cunha,
// 11 96902-9834, 2026-09-28).
//
// Há HISCONs em que o cartão consignado NÃO tem tabela de contratos: os cartões
// existem apenas na tabela "DESCONTOS DE CARTÃO", uma linha por competência. O
// leitor posicional pula essa tabela DE PROPÓSITO — contar linha mensal como
// contrato foi o que, no caso NYCOLLAS, transformou ~80 descontos em "87
// contratos" (número inventado num documento jurídico). A proteção está certa;
// o que faltava era o outro lado, e o próprio V2 anotava: "agregação fica p/ o
// futuro".
//
// Sem essa agregação, o cliente perde os cartões INTEIROS: o guia não vê RMC
// nem RCC (cada um vale 1 processo), o dossiê sai menor e o abate do advogado
// vem zerado. No HISCON do Luiz Carlos são 67 linhas mensais de DOIS cartões —
// 1 RCC e 1 RMC, ambos do BANCO PAN.
//
// A REGRA AQUI NÃO PODE INFLAR: agrupa-se por BANCO + MODALIDADE, que é
// exatamente a unidade do guia ("o RMC do banco X" = 1 processo). Por
// construção, no máximo dois cartões por banco — nunca um por linha. Os dados
// do cartão saem da competência MAIS RECENTE (o retrato atual) e as
// competências extremas viram início/fim de desconto, que é o que a janela de
// 5 anos consulta.
// ─────────────────────────────────────────────────────────────────────────────

/** O marcador que identifica UMA linha do histórico e a sua modalidade. */
const LINHA = /Desconto\s+de\s+cart[ãa]o\s*\((RMC|RCC)\)/gi;

const BANCO = /(\d{3})\s*-\s*([A-Za-zÀ-ÿ0-9 .,'&/-]+?)\s+R\$/;
const COMPETENCIA = /(\d{2}\/\d{4})/;
/** O número do contrato fecha a coluna ANTES do banco, fatiado por espaços na
 *  extração linear ("62339999731203909 26 623 - BANCO PAN"). Ancorado no fim
 *  para não colar o "86" de uma taxa da linha anterior no começo do número. */
const NUMERO_ANTES_DO_BANCO = /(\d{10,})\s*(\d{1,4})?\s*$/;
/** Largura máxima de UMA linha do histórico, em caracteres (a real tem ~100). */
const LARGURA_DA_LINHA = 300;
/** Menos dígitos que isto não é número de contrato de cartão. */
const MINIMO_DE_DIGITOS = 12;
const VALORES = /R\$\s?[\d.]+,\d{2}/g;
/** A situação cola no saldo devedor: "R$11.919,69Encerrado". */
const SITUACAO = /R\$\s?[\d.]+,\d{2}\s*([A-Za-zÀ-ÿ]+)/;

export interface CartaoAgregado {
  readonly modalidade: 'RMC' | 'RCC';
  readonly banco: string;
  readonly numero: string;
  readonly situacao: string;
  readonly competenciaInicio: string;
  readonly competenciaFim: string;
  readonly valorDesconto: string;
  /** Quantas linhas mensais sustentam este cartão — só para auditoria/log. */
  readonly linhas: number;
}

function mes(competencia: string): number {
  const [mm, aaaa] = competencia.split('/');
  return Number(aaaa) * 12 + Number(mm);
}

/** O NÚMERO do cartão é o que as linhas mensais têm em COMUM.
 *
 *  Neste HISCON cada linha imprime o contrato com a competência colada no fim
 *  ("…3120390" + "9" + "26" = setembro/26), então o número de um mês só vale
 *  para aquele mês. O prefixo comum a todas as linhas é a parte que identifica
 *  o cartão — evidência do próprio documento, não dedução sobre o formato do
 *  número. Prefixo curto demais (bancos que numeram diferente) ⇒ fica o número
 *  da linha mais recente, como impresso. */
function numeroDoCartao(numeros: readonly string[]): string {
  const primeiro = numeros[0] ?? '';
  if (numeros.length === 1) return primeiro;
  let comum = primeiro;
  for (const n of numeros) {
    let i = 0;
    while (i < comum.length && i < n.length && comum[i] === n[i]) i += 1;
    comum = comum.slice(0, i);
  }
  return comum.length >= MINIMO_DE_DIGITOS ? comum : (numeros[numeros.length - 1] ?? primeiro);
}

/**
 * Lê a tabela "DESCONTOS DE CARTÃO" do texto LINEAR do PDF e devolve UM cartão
 * por banco + modalidade. Texto sem histórico ⇒ lista vazia (nunca inventa).
 */
export function cartoesDoHistoricoMensal(textoLinear: string): readonly CartaoAgregado[] {
  const porCartao = new Map<
    string,
    {
      modalidade: 'RMC' | 'RCC';
      banco: string;
      linhas: number;
      min: string;
      max: string;
      numeros: string[];
      situacao: string;
      valor: string;
    }
  >();

  LINHA.lastIndex = 0;
  let anterior = 0;
  let m: RegExpExecArray | null;
  while ((m = LINHA.exec(textoLinear)) !== null) {
    // O trecho ENTRE o marcador anterior e este é uma linha da tabela — mas
    // nunca mais que uma linha de largura: antes do PRIMEIRO marcador vem o
    // documento inteiro (páginas de empréstimo, cabeçalhos), e varrer tudo isso
    // fabricava um cartão que não existe. Uma linha real tem ~100 caracteres.
    const inicio = Math.max(anterior, m.index - LARGURA_DA_LINHA);
    const trecho = textoLinear.slice(inicio, m.index);
    anterior = m.index + m[0].length;

    const modalidade = (m[1] ?? '').toUpperCase() === 'RMC' ? 'RMC' : 'RCC';
    const mBanco = BANCO.exec(trecho);
    const mComp = COMPETENCIA.exec(trecho);
    const mNum = mBanco === null ? null : NUMERO_ANTES_DO_BANCO.exec(trecho.slice(0, mBanco.index));
    // Linha sem banco, competência ou número não é linha de cartão: fora. Um
    // dado faltando vale menos que um dado errado num documento jurídico.
    if (mBanco === null || mComp === null || mNum === null) continue;

    const banco = `${mBanco[1] ?? ''} - ${(mBanco[2] ?? '').replace(/\s+/g, ' ').trim()}`;
    const competencia = mComp[1] ?? '';
    const numero = `${mNum[1] ?? ''}${mNum[2] ?? ''}`;
    if (numero.length < MINIMO_DE_DIGITOS) continue;
    const valores = trecho.match(VALORES) ?? [];
    // O ÚLTIMO valor da linha é o desconto do mês (saldo e utilizado vêm antes).
    const valor = (valores[valores.length - 1] ?? '').replace(/\s/g, '');
    const situacao = (SITUACAO.exec(trecho)?.[1] ?? '').trim();

    const chave = `${mBanco[1] ?? ''}|${modalidade}`;
    const atual = porCartao.get(chave);
    if (atual === undefined) {
      porCartao.set(chave, {
        modalidade,
        banco,
        linhas: 1,
        min: competencia,
        max: competencia,
        numeros: [numero],
        situacao,
        valor,
      });
      continue;
    }
    atual.linhas += 1;
    atual.numeros.push(numero);
    if (mes(competencia) < mes(atual.min)) atual.min = competencia;
    // O retrato do cartão é o da competência MAIS RECENTE.
    if (mes(competencia) > mes(atual.max)) {
      atual.max = competencia;
      atual.situacao = situacao;
      atual.valor = valor;
    }
  }

  return [...porCartao.values()].map((c) => ({
    modalidade: c.modalidade,
    banco: c.banco,
    numero: numeroDoCartao(c.numeros),
    situacao: c.situacao,
    competenciaInicio: c.min,
    competenciaFim: c.max,
    valorDesconto: c.valor,
    linhas: c.linhas,
  }));
}

/** Os cartões no MESMO "Formato A" que o parseHisconDetalhado já lê. */
export function blocosDeCartao(cartoes: readonly CartaoAgregado[]): string {
  const partes: string[] = [];
  let secao = '';
  for (const c of cartoes) {
    const titulo = `CARTÃO ${c.modalidade}`;
    if (titulo !== secao) {
      secao = titulo;
      partes.push(titulo);
    }
    const linhas = [
      `CONTRATO: ${c.numero}`,
      `BANCO: ${c.banco}`,
      ...(c.situacao !== '' ? [`SITUAÇÃO: ${c.situacao}`] : []),
      `COMPETÊNCIA INÍCIO DE DESCONTO: ${c.competenciaInicio}`,
      `COMPETÊNCIA FIM DE DESCONTO: ${c.competenciaFim}`,
      ...(c.valorDesconto !== '' ? [`VALOR PARCELA: ${c.valorDesconto}`] : []),
    ];
    partes.push(linhas.join('\n'));
  }
  return partes.join('\n\n');
}

/** O texto já traz contratos de cartão lidos da tabela própria? */
export function jaTemCartoes(hiscon: string): boolean {
  return /CART[ÃA]O\s+(RMC|RCC)/i.test(hiscon);
}
