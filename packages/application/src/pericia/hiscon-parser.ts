// ─────────────────────────────────────────────────────────────────────────────
// PARSER DO HISCON (Decreto Dossiê Pericial, 2026-07-21) — extração
// DETERMINÍSTICA dos contratos do texto transcrito do Histórico de Empréstimo
// Consignado do INSS. Formato real (produção): blocos "CONTRATO: ..." com
// campos rotulados linha a linha, dentro de seções (EMPRÉSTIMOS BANCÁRIOS /
// CARTÃO RMC / CARTÃO RCC). "Migrado" aparece em ORIGEM DA AVERBAÇÃO
// ("Migrado do contrato X CBC: NNN") — contratos migrados NÃO precisam de
// pedido administrativo e vão direto ao ADVOGADO (destinação SEMPRE manual
// do admin). Nada aqui decide: o parser só organiza fatos para o PERITO.
// ─────────────────────────────────────────────────────────────────────────────

export type ModalidadeContrato = 'EMPRESTIMO' | 'RMC' | 'RCC';

export interface ContratoHiscon {
  readonly contrato: string;
  readonly bancoCodigo: string | null;
  readonly bancoNome: string | null;
  readonly situacao: string | null;
  readonly origemAverbacao: string | null;
  /** ORIGEM DA AVERBAÇÃO contém "Migrado" ⇒ sem pedido administrativo. */
  readonly migrado: boolean;
  readonly migradoDoContrato: string | null;
  /** "… CBC: 329" — o código do BANCO DE ORIGEM da migração. */
  readonly migradoDoCbc: string | null;
  readonly modalidade: ModalidadeContrato;
  readonly dataInclusao: Date | null;
  readonly competenciaInicio: string | null;
  readonly competenciaFim: string | null;
  readonly qtdeParcelas: number | null;
  readonly valorParcela: number | null;
  readonly valorEmprestado: number | null;
  readonly valorLiberado: number | null;
  readonly iof: number | null;
  readonly cetMensal: number | null;
  readonly cetAnual: number | null;
  readonly taxaJurosMensal: number | null;
  readonly taxaJurosAnual: number | null;
  readonly valorPago: number | null;
  readonly dataPrimeiroDesconto: Date | null;
}

export interface MargensHiscon {
  readonly baseCalculo: number | null;
  readonly maximoComprometimento: number | null;
  readonly totalComprometido: number | null;
  readonly extrapolada: number | null;
}

export interface HisconExtraido {
  readonly beneficiario: string | null;
  readonly numeroBeneficio: string | null;
  readonly situacaoBeneficio: string | null;
  readonly especieBeneficio: string | null;
  readonly bancoPagamento: string | null;
  readonly margens: MargensHiscon;
  readonly contratos: readonly ContratoHiscon[];
}

// ── helpers puros ─────────────────────────────────────────────────────────────

/** "R$1.586,62" → 1586.62; vazio/traço ⇒ null. */
export function dinheiro(valor: string | null): number | null {
  if (valor === null) return null;
  const limpo = valor.replace(/[R$\s.]/g, '').replace(',', '.');
  if (limpo === '' || limpo === '-') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** "96" → 96 (contagens). */
function inteiro(valor: string | null): number | null {
  if (valor === null) return null;
  const n = Number.parseInt(valor.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** "1,97" → 1.97 (taxas). */
function taxa(valor: string | null): number | null {
  if (valor === null) return null;
  const n = Number(valor.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** "27/02/26" ou "27/02/2026" → Date (século pivotado em 70). */
export function dataCurta(valor: string | null): Date | null {
  if (valor === null) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(valor.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const aa = Number(m[3]);
  const ano = m[3]?.length === 4 ? aa : aa >= 70 ? 1900 + aa : 2000 + aa;
  const d = new Date(Date.UTC(ano, mm - 1, dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Valor após "RÓTULO:" ou "RÓTULO |" na linha (null se ausente/vazio) — o
 *  HISCON real usa ":" nos blocos de contrato e "|" nas tabelas de margem. */
function campo(bloco: string, rotulo: string): string | null {
  const re = new RegExp(`^${rotulo}\\s*[:|]?\\s*(.*)$`, 'im');
  const m = re.exec(bloco);
  if (!m) return null;
  const v = (m[1] ?? '').trim();
  return v === '' ? null : v;
}

/** "753 - NOVO BANCO CONTINENTAL S A" → {codigo, nome}. */
function banco(valor: string | null): { codigo: string | null; nome: string | null } {
  if (valor === null) return { codigo: null, nome: null };
  const m = /^(\d{1,4})\s*-\s*(.+)$/.exec(valor.trim());
  if (!m) return { codigo: null, nome: valor.trim() };
  return { codigo: m[1] ?? null, nome: (m[2] ?? '').trim() };
}

/** Modalidade da SEÇÃO corrente a partir do cabeçalho mais recente acima. */
function modalidadeDaSecao(cabecalho: string): ModalidadeContrato {
  const c = cabecalho.toUpperCase();
  if (/\bRMC\b|RESERVA DE MARGEM/.test(c)) return 'RMC';
  if (/\bRCC\b/.test(c)) return 'RCC';
  return 'EMPRESTIMO';
}

// ── o parser ──────────────────────────────────────────────────────────────────

export function parseHisconDetalhado(texto: string): HisconExtraido {
  const margens: MargensHiscon = {
    baseCalculo: dinheiro(campo(texto, 'BASE DE C[ÁA]LCULO')),
    maximoComprometimento: dinheiro(campo(texto, 'M[ÁA]XIMO DE COMPROMETIMENTO PERMITIDO')),
    totalComprometido: dinheiro(campo(texto, 'TOTAL COMPROMETIDO')),
    extrapolada: dinheiro(campo(texto, 'MARGEM EXTRAPOLADA\\*{0,3}')),
  };

  // Nome do beneficiário: a linha isolada logo antes do bloco "Benefício".
  const nomeMatch = /EMPR[ÉE]STIMO CONSIGNADO\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s*\n/.exec(texto);

  const contratos: ContratoHiscon[] = [];
  // Divide por "CONTRATO:" preservando a posição para descobrir a seção.
  const re = /^CONTRATO\s*:\s*(\S+)\s*$/gim;
  const inicios: Array<{ contrato: string; indice: number }> = [];
  for (let m = re.exec(texto); m !== null; m = re.exec(texto)) {
    inicios.push({ contrato: m[1] ?? '', indice: m.index });
  }
  for (let i = 0; i < inicios.length; i += 1) {
    const atual = inicios[i];
    if (atual === undefined) continue;
    const fim = inicios[i + 1]?.indice ?? texto.length;
    const bloco = texto.slice(atual.indice, fim);
    // Cabeçalho de seção: último título de bloco ANTES deste contrato.
    const antes = texto.slice(0, atual.indice);
    const secoes =
      antes.match(
        /^(EMPR[ÉE]STIMOS BANC[ÁA]RIOS|CART[ÃA]O DE CR[ÉE]DITO[^\n]*|.*\bRMC\b[^\n]*|.*\bRCC\b[^\n]*)$/gim,
      ) ?? [];
    const secao = secoes[secoes.length - 1] ?? 'EMPRÉSTIMOS BANCÁRIOS';

    const origem = campo(bloco, 'ORIGEM DA AVERBA[ÇC][ÃA]O');
    const migradoDe = origem !== null ? /Migrado do contrato\s+(\S+)/i.exec(origem) : null;
    const cbcDe = origem !== null ? /CBC:\s*(\d+)/i.exec(origem) : null;
    const b = banco(campo(bloco, 'BANCO'));
    contratos.push({
      contrato: atual.contrato,
      bancoCodigo: b.codigo,
      bancoNome: b.nome,
      situacao: campo(bloco, 'SITUA[ÇC][ÃA]O'),
      origemAverbacao: origem,
      migrado: origem !== null && /\bmigrado\b/i.test(origem),
      migradoDoContrato: migradoDe?.[1] ?? null,
      migradoDoCbc: cbcDe?.[1] ?? null,
      modalidade: modalidadeDaSecao(secao),
      dataInclusao: dataCurta(campo(bloco, 'DATA INCLUS[ÃA]O')),
      competenciaInicio: campo(bloco, 'COMPET[ÊE]NCIA IN[ÍI]CIO DE DESCONTO'),
      competenciaFim: campo(bloco, 'COMPET[ÊE]NCIA FIM DE DESCONTO'),
      qtdeParcelas: inteiro(campo(bloco, 'QTDE PARCELAS')),
      valorParcela: dinheiro(campo(bloco, 'VALOR PARCELA')),
      valorEmprestado: dinheiro(campo(bloco, 'VALOR EMPRESTADO')),
      valorLiberado: dinheiro(campo(bloco, 'VALOR LIBERADO')),
      iof: dinheiro(campo(bloco, 'IOF')),
      cetMensal: taxa(campo(bloco, 'CET MENSAL')),
      cetAnual: taxa(campo(bloco, 'CET ANUAL')),
      taxaJurosMensal: taxa(campo(bloco, 'TAXA JUROS MENSAL')),
      taxaJurosAnual: taxa(campo(bloco, 'TAXA JUROS ANUAL')),
      valorPago: dinheiro(campo(bloco, 'VALOR PAGO\\*{0,2}')),
      dataPrimeiroDesconto: dataCurta(campo(bloco, 'DATA PRIMEIRO DESCONTO')),
    });
  }

  return {
    beneficiario: nomeMatch?.[1]?.trim() ?? null,
    numeroBeneficio: campo(texto, 'N[ºo°]? ?Benef[íi]cio'),
    situacaoBeneficio: campo(texto, 'Situa[çc][ãa]o'),
    especieBeneficio: campo(texto, 'Benef[íi]cio\\s*\\n\\s*([A-ZÀ-Ú ]+)') ?? extrairEspecie(texto),
    bancoPagamento: campo(texto, 'Pago em'),
    margens,
    contratos,
  };
}

function extrairEspecie(texto: string): string | null {
  const m = /Benef[íi]cio\s*\n+\s*([A-ZÀ-Ú][A-ZÀ-Ú\s]+?)\s*\n/.exec(texto);
  return m?.[1]?.trim() ?? null;
}

// ── visões para o PERITO e para o ADMIN ──────────────────────────────────────

/** Contratos incluídos nos últimos N anos (5 = janela pericial padrão). */
export function contratosDaJanela(
  contratos: readonly ContratoHiscon[],
  hoje: Date,
  anos = 5,
): readonly ContratoHiscon[] {
  const corte = new Date(
    Date.UTC(hoje.getUTCFullYear() - anos, hoje.getUTCMonth(), hoje.getUTCDate()),
  );
  return contratos.filter(
    (c) => c.dataInclusao === null || c.dataInclusao.getTime() >= corte.getTime(),
  );
}

export interface BancoComContratos {
  readonly bancoCodigo: string | null;
  readonly bancoNome: string;
  readonly contratos: readonly ContratoHiscon[];
}

export function agruparPorBanco(
  contratos: readonly ContratoHiscon[],
): readonly BancoComContratos[] {
  const porBanco = new Map<string, ContratoHiscon[]>();
  for (const c of contratos) {
    const chave = c.bancoNome ?? 'BANCO NÃO IDENTIFICADO';
    const lista = porBanco.get(chave) ?? [];
    lista.push(c);
    porBanco.set(chave, lista);
  }
  return [...porBanco.entries()]
    .map(([nome, lista]) => ({
      bancoCodigo: lista[0]?.bancoCodigo ?? null,
      bancoNome: nome,
      contratos: lista,
    }))
    .sort((a, z) => a.bancoNome.localeCompare(z.bancoNome));
}

/** Contratos MIGRADOS: sem pedido administrativo — destinação DIRETA (manual). */
export function contratosMigrados(contratos: readonly ContratoHiscon[]): readonly ContratoHiscon[] {
  return contratos.filter((c) => c.migrado);
}

/** O MAPA de uma migração: DE contrato X @ banco de origem → PARA contrato Y @
 *  banco atual. O nome do banco de origem é resolvido pelo CÓDIGO (CBC) quando
 *  algum contrato do próprio documento pertence a ele — nunca inventado. */
export interface MigracaoDeContrato {
  readonly deContrato: string | null;
  readonly deBancoCodigo: string | null;
  readonly deBancoNome: string | null;
  readonly paraContrato: string;
  readonly paraBancoCodigo: string | null;
  readonly paraBancoNome: string | null;
  readonly dataInclusao: Date | null;
}

export function mapaDeMigracoes(
  contratos: readonly ContratoHiscon[],
  todosParaResolucao: readonly ContratoHiscon[] = contratos,
): readonly MigracaoDeContrato[] {
  const nomePorCodigo = new Map<string, string>();
  for (const c of todosParaResolucao) {
    if (c.bancoCodigo !== null && c.bancoNome !== null)
      nomePorCodigo.set(c.bancoCodigo, c.bancoNome);
  }
  return contratos
    .filter((c) => c.migrado)
    .map((c) => ({
      deContrato: c.migradoDoContrato,
      deBancoCodigo: c.migradoDoCbc,
      deBancoNome: c.migradoDoCbc !== null ? (nomePorCodigo.get(c.migradoDoCbc) ?? null) : null,
      paraContrato: c.contrato,
      paraBancoCodigo: c.bancoCodigo,
      paraBancoNome: c.bancoNome,
      dataInclusao: c.dataInclusao,
    }));
}

/** Contratos que exigem PEDIDO ADMINISTRATIVO (fila do perito): consignado/RMC/RCC não migrados. */
export function contratosParaPedidoAdministrativo(
  contratos: readonly ContratoHiscon[],
): readonly ContratoHiscon[] {
  return contratos.filter((c) => !c.migrado);
}

// ── indícios de estratégia (SINAL para o perito — nunca conclusão jurídica) ──

export interface IndicioDeEstrategia {
  readonly estrategiaRef: string;
  readonly titulo: string;
  readonly contratos: readonly string[];
  readonly fundamentoFactual: string;
}

/** Casamento DETERMINÍSTICO contrato→estratégia por fatos do próprio HISCON.
 *  `tetoJurosMensal` é PARÂMETRO (o teto legal muda; ausente ⇒ sem indício de juros). */
export function indiciosDeEstrategias(
  extraido: HisconExtraido,
  opts: { readonly tetoJurosMensal?: number | null } = {},
): readonly IndicioDeEstrategia[] {
  const out: IndicioDeEstrategia[] = [];
  const c = extraido.contratos;

  const rmcRcc = c.filter((x) => x.modalidade === 'RMC' || x.modalidade === 'RCC');
  if (rmcRcc.length > 0) {
    out.push({
      estrategiaRef: 'EST-CONSIG-CARTAO-RMC-001',
      titulo: 'Cartão consignado / RMC-RCC — verificar se foi vendido como empréstimo',
      contratos: rmcRcc.map((x) => x.contrato),
      fundamentoFactual: `${String(rmcRcc.length)} contrato(s) nas modalidades RMC/RCC no HISCON`,
    });
  }

  const refin = c.filter(
    (x) => x.origemAverbacao !== null && /refinanciamento|portabilidade/i.test(x.origemAverbacao),
  );
  if (refin.length > 0) {
    out.push({
      estrategiaRef: 'EST-CONSIG-PORTABILIDADE-001',
      titulo: 'Refinanciamento/portabilidade — verificar anuência do beneficiário',
      contratos: refin.map((x) => x.contrato),
      fundamentoFactual: `${String(refin.length)} contrato(s) com averbação por refinanciamento/portabilidade`,
    });
  }

  if (extraido.margens.extrapolada !== null && extraido.margens.extrapolada > 0) {
    out.push({
      estrategiaRef: 'EST-CONSIG-MARGEM-001',
      titulo: 'Margem extrapolada — descontos além do limite legal',
      contratos: [],
      fundamentoFactual: `Margem extrapolada de R$ ${extraido.margens.extrapolada.toFixed(2)} no resumo do benefício`,
    });
  }

  const { totalComprometido, maximoComprometimento } = extraido.margens;
  if (
    totalComprometido !== null &&
    maximoComprometimento !== null &&
    totalComprometido >= maximoComprometimento &&
    maximoComprometimento > 0
  ) {
    out.push({
      estrategiaRef: 'EST-CONSIG-SUPERENDIVIDAMENTO-001',
      titulo: 'Comprometimento no teto — indício de superendividamento',
      contratos: [],
      fundamentoFactual: `Total comprometido (R$ ${totalComprometido.toFixed(2)}) atinge o máximo permitido (R$ ${maximoComprometimento.toFixed(2)})`,
    });
  }

  const teto = opts.tetoJurosMensal ?? null;
  if (teto !== null) {
    const acima = c.filter((x) => x.taxaJurosMensal !== null && x.taxaJurosMensal > teto);
    if (acima.length > 0) {
      out.push({
        estrategiaRef: 'EST-CONSIG-JUROS-001',
        titulo: `Taxa de juros mensal acima do teto configurado (${String(teto)}% a.m.)`,
        contratos: acima.map((x) => x.contrato),
        fundamentoFactual: `${String(acima.length)} contrato(s) com taxa mensal acima de ${String(teto)}%`,
      });
    }
  }

  return out;
}
