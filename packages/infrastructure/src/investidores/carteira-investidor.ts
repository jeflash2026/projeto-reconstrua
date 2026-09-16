// ─────────────────────────────────────────────────────────────────────────────
// CARTEIRA DO INVESTIDOR (2026-09-16) — a parte PURA do painel de investidores.
//
// O modelo (decisão do dono): o investidor compra, antecipado, um CRÉDITO sobre
// a PARTE DA EMPRESA no resultado de processos judiciais já distribuídos. Cada
// processo vale R$ 10.000 de REFERÊNCIA (raramente paga menos); a empresa fica
// com 50% e o cliente com 50% — cada processo conta R$ 5.000 para o investidor.
//
//  • Um crédito de R$ 250.000 recebe EXATAMENTE o equivalente em processos:
//    250.000 ÷ 5.000 = 50 processos.
//  • TETO: o investidor recebe no máximo o crédito + 20% (R$ 300.000). Se os
//    processos renderem mais, o excedente fica com a empresa. O teto vale por
//    carteira (cada crédito adicionado).
//  • O valor REAL entra pelo Jurídico: APURADO na execução (já se sabe quanto
//    o processo vai pagar, falta só o tempo processual), PAGO quando recebido,
//    ou encerrado SEM ÊXITO (zero).
//
// Regras fixas: cada processo pertence a UM investidor (nunca vendido duas
// vezes); o investidor vê o cliente só pelas INICIAIS (LGPD), o nº do
// processo, os bancos, o advogado responsável e a fase; nada de texto de
// publicação (traz nomes das partes).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AndamentoProcesso,
  LancamentoResultado,
  ResultadoProcesso,
} from '../juridico/juridico-service.js';

export const VALOR_REFERENCIA_PROCESSO = 10_000;
export const PARTE_DA_EMPRESA = 0.5;
/** Quanto cada processo conta para o investidor (R$ 5.000). */
export const REFERENCIA_DO_INVESTIDOR = VALOR_REFERENCIA_PROCESSO * PARTE_DA_EMPRESA;
/** O investidor recebe no máximo o crédito + 20%. */
export const LIMITE_SOBRE_CREDITO = 0.2;
/** Prazo usado na régua de maturação (o dono estima 1 ano e meio a 2 anos). */
export const PRAZO_ESTIMADO_MESES = 24;

const DIA_MS = 24 * 60 * 60 * 1000;

function centavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/** O teto de recebimento de um crédito (crédito + 20%). */
export function limiteDoCredito(credito: number): number {
  return centavos(credito * (1 + LIMITE_SOBRE_CREDITO));
}

// ── Identidade ────────────────────────────────────────────────────────────────

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du']);

/** "Maria Aparecida dos Santos" → "M. A. S." (partículas não entram). */
export function iniciaisDoNome(nome: string): string {
  const letras = nome
    .normalize('NFC')
    .split(/[\s.-]+/)
    .filter((p) => p !== '' && !PARTICULAS.has(p.toLowerCase()))
    .map((p) => p.charAt(0).toUpperCase());
  return letras.length === 0 ? '—' : `${letras.join('. ')}.`;
}

/** Formato CNJ legível a partir de qualquer grafia (20 dígitos). */
export function numeroCnj(numero: string): string {
  const d = numero.replace(/\D/g, '');
  if (d.length !== 20) return numero.trim();
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

// ── Seleção da carteira (proposta do Jarvis) ─────────────────────────────────

export interface ProcessoCandidato {
  readonly numero: string;
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly bancos: readonly string[];
  /** Advogado responsável (entrega do Admin); null = ainda sem advogado. */
  readonly advogado: string | null;
  /** Quando o processo foi cadastrado no Jurídico (1º contrato). */
  readonly cadastradoEm: string;
}

/** Quantos processos cobrem EXATAMENTE um crédito (R$ 5.000 cada, ≥ 1). */
export function processosParaCredito(credito: number): number {
  return Math.max(1, Math.round(credito / REFERENCIA_DO_INVESTIDOR));
}

/** Escolhe `quantidade` processos ESPALHANDO o risco: a cada escolha, o que
 *  menos repete advogado, cliente e banco já escolhidos; com advogado
 *  responsável antes de sem advogado; empate ⇒ o cadastrado há mais tempo
 *  (mais perto do resultado). Determinístico. */
export function selecionarProcessos(
  candidatos: readonly ProcessoCandidato[],
  quantidade: number,
): ProcessoCandidato[] {
  const restantes = [...candidatos].sort(
    (a, b) => a.cadastradoEm.localeCompare(b.cadastradoEm) || a.numero.localeCompare(b.numero),
  );
  const porAdvogado = new Map<string, number>();
  const porCliente = new Map<string, number>();
  const porBanco = new Map<string, number>();
  const escolhidos: ProcessoCandidato[] = [];
  const custo = (c: ProcessoCandidato): number => {
    const adv = c.advogado === null ? 1_000 : (porAdvogado.get(c.advogado) ?? 0) * 100;
    const cli = (porCliente.get(c.clienteId) ?? 0) * 10;
    const banco = Math.min(9, ...c.bancos.map((b) => porBanco.get(b) ?? 0));
    return adv + cli + banco;
  };
  while (escolhidos.length < quantidade && restantes.length > 0) {
    let melhor = 0;
    let melhorCusto = custo(restantes[0] as ProcessoCandidato);
    for (let i = 1; i < restantes.length; i += 1) {
      const c = custo(restantes[i] as ProcessoCandidato);
      if (c < melhorCusto) {
        melhor = i;
        melhorCusto = c;
      }
    }
    const [escolhido] = restantes.splice(melhor, 1);
    if (escolhido === undefined) break;
    escolhidos.push(escolhido);
    if (escolhido.advogado !== null)
      porAdvogado.set(escolhido.advogado, (porAdvogado.get(escolhido.advogado) ?? 0) + 1);
    porCliente.set(escolhido.clienteId, (porCliente.get(escolhido.clienteId) ?? 0) + 1);
    for (const b of escolhido.bancos) porBanco.set(b, (porBanco.get(b) ?? 0) + 1);
  }
  return escolhidos;
}

// ── Fase do processo ──────────────────────────────────────────────────────────

export type FaseProcesso =
  'distribuido' | 'andamento' | 'sentenca' | 'execucao' | 'apurado' | 'pago' | 'perdido';

/** Ordem da régua (do mais novo ao desfecho) — a mesma da composição. */
export const FASES: readonly { readonly fase: FaseProcesso; readonly rotulo: string }[] = [
  { fase: 'distribuido', rotulo: 'Distribuído' },
  { fase: 'andamento', rotulo: 'Em andamento' },
  { fase: 'sentenca', rotulo: 'Sentença' },
  { fase: 'execucao', rotulo: 'Execução' },
  { fase: 'apurado', rotulo: 'Valor apurado' },
  { fase: 'pago', rotulo: 'Pago' },
  { fase: 'perdido', rotulo: 'Encerrado sem êxito' },
];

export function rotuloDaFase(fase: FaseProcesso): string {
  return FASES.find((f) => f.fase === fase)?.rotulo ?? fase;
}

const RE_SENTENCA = /julgad|procedente|senten[çc]a|ac[óo]rd[ãa]o/i;
const RE_NAO_SENTENCA = /conclus|aguard|remetid|encaminh/i;

export function faseDoProcesso(
  andamento: AndamentoProcesso | null,
  resultado: ResultadoProcesso | null,
): FaseProcesso {
  if (resultado?.situacao === 'pago') return 'pago';
  if (resultado?.situacao === 'perdido') return 'perdido';
  if (resultado?.situacao === 'apurado') return 'apurado';
  if (andamento === null) return 'distribuido';
  if (andamento.emExecucao) return 'execucao';
  const movimentos = andamento.movimentos.filter((m) => !/distribui/i.test(m.nome));
  if (movimentos.some((m) => RE_SENTENCA.test(m.nome) && !RE_NAO_SENTENCA.test(m.nome)))
    return 'sentenca';
  return movimentos.length > 0 ? 'andamento' : 'distribuido';
}

// ── Painel ────────────────────────────────────────────────────────────────────

export interface Investidor {
  readonly cpf: string;
  readonly nome: string;
  readonly email: string;
  readonly telefone: string;
  readonly ativo: boolean;
  readonly criadoEm: string;
}

/** Um processo na carteira (ns 'investidor-alocacoes', chave = dígitos). */
export interface AlocacaoProcesso {
  readonly cpf: string;
  readonly loteId: string;
  readonly numero: string;
  readonly clienteId: string;
  readonly clienteNome: string;
  readonly bancos: readonly string[];
  /** Advogado no momento da alocação (o painel prefere o atual). */
  readonly advogado: string | null;
  readonly cadastradoEm: string;
  readonly alocadoEm: string;
}

/** Uma carteira adicionada = um crédito (ns 'investidor-lotes'). */
export interface LoteCarteira {
  readonly id: string;
  readonly cpf: string;
  readonly criadoEm: string;
  readonly criadoPor: string;
  /** O crédito comprado (parte da empresa). Ausente ⇒ processos × R$ 5.000. */
  readonly credito?: number;
  readonly processos: readonly string[];
  readonly retirados: readonly {
    readonly numero: string;
    readonly em: string;
    readonly motivo: string;
    readonly por: string;
  }[];
}

export type TipoValor = 'referencia' | 'apurado' | 'recebido' | 'sem-exito';

export interface ProcessoNoPainel {
  readonly numero: string;
  readonly iniciais: string;
  /** Só no painel do ADMIN (nomesCompletos); nunca vai ao investidor. */
  readonly clienteNome?: string;
  readonly loteId: string;
  readonly bancos: readonly string[];
  readonly advogado: string | null;
  readonly tribunal: string;
  readonly orgao: string;
  readonly fase: FaseProcesso;
  readonly faseRotulo: string;
  readonly ultimaMovimentacao: { readonly nome: string; readonly data: string } | null;
  /** AAAA-MM-DD — ajuizamento (DataJud) ou cadastro no Jurídico. */
  readonly desde: string;
  readonly mesesDecorridos: number;
  /** O que o processo vale para o investidor HOJE (antes do teto da carteira). */
  readonly valor: {
    readonly tipo: TipoValor;
    /** Referência (R$ 5.000), 50% do valor apurado/recebido, ou zero. */
    readonly parte: number;
    /** Valor TOTAL do processo (apurado ou recebido); null = em curso. */
    readonly valorDoProcesso: number | null;
    /** Data do lançamento do valor (apuração, pagamento ou encerramento). */
    readonly em: string | null;
  };
  readonly alocadoEm: string;
}

export interface CarteiraNoPainel {
  readonly id: string;
  readonly criadoEm: string;
  readonly credito: number;
  readonly limite: number;
  readonly processos: number;
  /** Totais JÁ com o teto (crédito + 20%) aplicado. */
  readonly valorAtual: number;
  readonly recebido: number;
  readonly apurado: number;
  readonly aReceber: number;
  /** Só no painel do ADMIN: o que passou do teto e fica com a empresa. */
  readonly excedenteEmpresa?: number;
}

export type TipoExtrato = 'carteira' | 'apurado' | 'pago' | 'perdido' | 'correcao' | 'retirado';

export interface LinhaExtrato {
  readonly em: string;
  readonly tipo: TipoExtrato;
  readonly descricao: string;
  /** Variação no valor da carteira, já com o teto (positivo = aumentou). */
  readonly valor: number;
}

export interface PainelInvestidor {
  readonly cpf: string;
  readonly nome: string;
  readonly geradoEm: string;
  readonly totais: {
    readonly processos: number;
    readonly credito: number;
    /** Teto de recebimento (crédito + 20%). */
    readonly limite: number;
    /** Valor da carteira hoje (com o teto): recebido + apurado + a receber. */
    readonly valorAtual: number;
    readonly recebido: number;
    /** Valor apurado na execução, aguardando o pagamento. */
    readonly apurado: number;
    /** Referência dos processos em curso. */
    readonly aReceber: number;
    readonly emCurso: number;
    readonly apurados: number;
    readonly pagos: number;
    readonly perdidos: number;
    /** Valor total dos processos (R$ 10.000 de referência cada). */
    readonly valorDosProcessos: number;
    /** Só no painel do ADMIN: o que passou do teto e fica com a empresa. */
    readonly excedenteEmpresa?: number;
  };
  readonly carteiras: readonly CarteiraNoPainel[];
  readonly porFase: readonly {
    readonly fase: FaseProcesso;
    readonly rotulo: string;
    readonly processos: number;
    readonly valor: number;
  }[];
  readonly processos: readonly ProcessoNoPainel[];
  readonly extrato: readonly LinhaExtrato[];
  readonly premissas: {
    readonly valorReferenciaProcesso: number;
    readonly parteDaEmpresa: number;
    readonly referenciaPorProcesso: number;
    readonly limiteSobreCredito: number;
    readonly prazoEstimadoMeses: number;
  };
}

type Situacao = LancamentoResultado['situacao'];

function valorDoLancamento(l: Pick<LancamentoResultado, 'situacao' | 'valorRecebido'>): {
  tipo: TipoValor;
  parte: number;
} {
  if (l.situacao === 'pago')
    return { tipo: 'recebido', parte: centavos((l.valorRecebido ?? 0) * PARTE_DA_EMPRESA) };
  if (l.situacao === 'apurado')
    return { tipo: 'apurado', parte: centavos((l.valorRecebido ?? 0) * PARTE_DA_EMPRESA) };
  if (l.situacao === 'perdido') return { tipo: 'sem-exito', parte: 0 };
  return { tipo: 'referencia', parte: REFERENCIA_DO_INVESTIDOR };
}

const moeda = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function mesesEntre(de: string, ate: Date): number {
  const inicio = Date.parse(`${de.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((ate.getTime() - inicio) / (30.44 * DIA_MS)));
}

/** Um movimento que mexe no valor BRUTO de uma carteira (antes do teto). */
interface EventoBruto {
  readonly em: string;
  readonly tipo: TipoExtrato;
  readonly descricao: string;
  readonly bruto: number;
}

export function montarPainelInvestidor(entrada: {
  readonly investidor: Investidor;
  readonly alocacoes: readonly AlocacaoProcesso[];
  readonly lotes: readonly LoteCarteira[];
  readonly andamentos: readonly AndamentoProcesso[];
  readonly resultados: readonly ResultadoProcesso[];
  /** Advogado ATUAL por cliente do Jurídico (clienteId → nome). */
  readonly advogadoAtual: ReadonlyMap<string, string>;
  readonly agora: Date;
  readonly nomesCompletos: boolean;
}): PainelInvestidor {
  const { investidor, agora } = entrada;
  const andamentoPor = new Map(entrada.andamentos.map((a) => [a.numero.replace(/\D/g, ''), a]));
  const resultadoPor = new Map(entrada.resultados.map((r) => [r.numero.replace(/\D/g, ''), r]));
  const alocacoes = entrada.alocacoes.filter((a) => a.cpf === investidor.cpf);
  const eventosPorLote = new Map<string, EventoBruto[]>();
  const eventos = (loteId: string): EventoBruto[] => {
    const lista = eventosPorLote.get(loteId) ?? [];
    eventosPorLote.set(loteId, lista);
    return lista;
  };

  const processos = alocacoes
    .map((a): ProcessoNoPainel => {
      const chave = a.numero.replace(/\D/g, '');
      const andamento = andamentoPor.get(chave) ?? null;
      const resultado = resultadoPor.get(chave) ?? null;
      const fase = faseDoProcesso(andamento, resultado);
      const numero = numeroCnj(a.numero);

      // Cada lançamento DEPOIS da alocação mexe no valor bruto da carteira.
      let parteAtual = REFERENCIA_DO_INVESTIDOR;
      let situacaoAtual: Situacao = 'em-andamento';
      for (const l of resultado?.historico ?? []) {
        if (l.em < a.alocadoEm) continue;
        const { parte } = valorDoLancamento(l);
        if (l.situacao === situacaoAtual && parte === parteAtual) continue;
        // Pagamento que só confirma o valor apurado (mesmo valor) também entra.
        const tipo: TipoExtrato =
          l.situacao === 'em-andamento'
            ? 'correcao'
            : l.situacao === situacaoAtual
              ? 'correcao'
              : l.situacao;
        const valorProcesso = moeda(l.valorRecebido ?? 0);
        const descricao =
          tipo === 'apurado'
            ? `Processo ${numero}: valor apurado na execução — ${valorProcesso} no processo, sua parte ${moeda(parte)}`
            : tipo === 'pago'
              ? `Processo ${numero} pago: ${valorProcesso} no processo — sua parte ${moeda(parte)}`
              : tipo === 'perdido'
                ? `Processo ${numero} encerrado sem êxito`
                : `Correção do processo ${numero}: sua parte passa a ${moeda(parte)}`;
        eventos(a.loteId).push({ em: l.em, tipo, descricao, bruto: centavos(parte - parteAtual) });
        parteAtual = parte;
        situacaoAtual = l.situacao;
      }

      const ultimo = andamento?.movimentos[0] ?? null;
      const desde = (andamento?.dataAjuizamento ?? '') || a.cadastradoEm;
      const atual =
        resultado === null
          ? valorDoLancamento({ situacao: 'em-andamento', valorRecebido: null })
          : valorDoLancamento(resultado);
      return {
        numero,
        iniciais: iniciaisDoNome(a.clienteNome),
        ...(entrada.nomesCompletos ? { clienteNome: a.clienteNome } : {}),
        loteId: a.loteId,
        bancos: a.bancos,
        advogado: entrada.advogadoAtual.get(a.clienteId) ?? a.advogado,
        tribunal: andamento?.tribunal ?? '',
        orgao: andamento?.orgaoJulgador ?? '',
        fase,
        faseRotulo: rotuloDaFase(fase),
        ultimaMovimentacao:
          ultimo === null
            ? null
            : { nome: ultimo.nome.replace(/^DJEN · /, ''), data: ultimo.dataHora.slice(0, 10) },
        desde: desde.slice(0, 10),
        mesesDecorridos: mesesEntre(desde, agora),
        valor: {
          tipo: atual.tipo,
          parte: atual.parte,
          valorDoProcesso:
            atual.tipo === 'apurado' || atual.tipo === 'recebido'
              ? (resultado?.valorRecebido ?? null)
              : null,
          em: atual.tipo === 'referencia' ? null : (resultado?.data ?? null),
        },
        alocadoEm: a.alocadoEm,
      };
    })
    .sort(
      (x, y) =>
        FASES.findIndex((f) => f.fase === y.fase) - FASES.findIndex((f) => f.fase === x.fase) ||
        x.desde.localeCompare(y.desde),
    );

  // As carteiras: as gravadas + uma virtual para alocação sem lote (defensivo).
  const lotes: LoteCarteira[] = entrada.lotes.filter((l) => l.cpf === investidor.cpf);
  for (const a of alocacoes) {
    if (lotes.some((l) => l.id === a.loteId)) continue;
    const doLote = alocacoes.filter((x) => x.loteId === a.loteId);
    lotes.push({
      id: a.loteId,
      cpf: investidor.cpf,
      criadoEm: doLote.map((x) => x.alocadoEm).sort()[0] ?? a.alocadoEm,
      criadoPor: '—',
      processos: doLote.map((x) => x.numero),
      retirados: [],
    });
  }

  const extrato: LinhaExtrato[] = [];
  const carteiras = lotes
    .map((lote): CarteiraNoPainel => {
      const credito = lote.credito ?? lote.processos.length * REFERENCIA_DO_INVESTIDOR;
      const limite = limiteDoCredito(credito);
      const n = lote.processos.length;
      const entradaDoCredito: EventoBruto = {
        em: lote.criadoEm,
        tipo: 'carteira',
        descricao: `Crédito de ${moeda(credito)} adicionado: ${String(n)} processo(s) de ${moeda(REFERENCIA_DO_INVESTIDOR)} cada — limite de recebimento ${moeda(limite)}`,
        bruto: centavos(n * REFERENCIA_DO_INVESTIDOR),
      };
      const movimentos: EventoBruto[] = [
        entradaDoCredito,
        ...lote.retirados.map((r): EventoBruto => ({
          em: r.em,
          tipo: 'retirado',
          descricao: `Processo ${numeroCnj(r.numero)} retirado da carteira${r.motivo !== '' ? ` — ${r.motivo}` : ''}`,
          bruto: -REFERENCIA_DO_INVESTIDOR,
        })),
        ...(eventosPorLote.get(lote.id) ?? []),
      ].sort(
        (x, y) =>
          x.em.localeCompare(y.em) || Number(y.tipo === 'carteira') - Number(x.tipo === 'carteira'),
      );
      // O extrato anda com o TETO: a variação mostrada é a do valor limitado.
      let bruto = 0;
      let limitado = 0;
      for (const m of movimentos) {
        bruto = centavos(bruto + m.bruto);
        const novo = Math.min(bruto, limite);
        const valor = centavos(novo - limitado);
        extrato.push({
          em: m.em,
          tipo: m.tipo,
          descricao:
            valor !== m.bruto && m.tipo !== 'carteira'
              ? `${m.descricao} (limite da carteira: ${moeda(limite)})`
              : m.descricao,
          valor,
        });
        limitado = novo;
      }

      const doLote = processos.filter((p) => p.loteId === lote.id);
      const soma = (tipo: TipoValor): number =>
        centavos(
          doLote.filter((p) => p.valor.tipo === tipo).reduce((s, p) => s + p.valor.parte, 0),
        );
      const recebido = Math.min(soma('recebido'), limite);
      const apurado = Math.min(soma('apurado'), centavos(limite - recebido));
      const aReceber = Math.min(soma('referencia'), centavos(limite - recebido - apurado));
      const brutoAtual = soma('recebido') + soma('apurado') + soma('referencia');
      return {
        id: lote.id,
        criadoEm: lote.criadoEm,
        credito,
        limite,
        processos: doLote.length,
        valorAtual: centavos(recebido + apurado + aReceber),
        recebido,
        apurado,
        aReceber,
        ...(entrada.nomesCompletos
          ? { excedenteEmpresa: centavos(Math.max(0, brutoAtual - limite)) }
          : {}),
      };
    })
    .sort((x, y) => x.criadoEm.localeCompare(y.criadoEm));

  // Mais recente primeiro; no mesmo instante, a entrada do crédito é a mais antiga.
  extrato.sort(
    (x, y) =>
      y.em.localeCompare(x.em) || Number(x.tipo === 'carteira') - Number(y.tipo === 'carteira'),
  );

  const total = (
    campo: 'credito' | 'limite' | 'valorAtual' | 'recebido' | 'apurado' | 'aReceber',
  ): number => centavos(carteiras.reduce((s, c) => s + c[campo], 0));
  const porFase = FASES.map(({ fase, rotulo }) => {
    const daFase = processos.filter((p) => p.fase === fase);
    return {
      fase,
      rotulo,
      processos: daFase.length,
      valor: centavos(daFase.reduce((s, p) => s + p.valor.parte, 0)),
    };
  }).filter((f) => f.processos > 0);

  return {
    cpf: investidor.cpf,
    nome: investidor.nome,
    geradoEm: agora.toISOString(),
    totais: {
      processos: processos.length,
      credito: total('credito'),
      limite: total('limite'),
      valorAtual: total('valorAtual'),
      recebido: total('recebido'),
      apurado: total('apurado'),
      aReceber: total('aReceber'),
      emCurso: processos.filter((p) => p.valor.tipo === 'referencia').length,
      apurados: processos.filter((p) => p.fase === 'apurado').length,
      pagos: processos.filter((p) => p.fase === 'pago').length,
      perdidos: processos.filter((p) => p.fase === 'perdido').length,
      valorDosProcessos: processos.length * VALOR_REFERENCIA_PROCESSO,
      ...(entrada.nomesCompletos
        ? {
            excedenteEmpresa: centavos(
              carteiras.reduce((s, c) => s + (c.excedenteEmpresa ?? 0), 0),
            ),
          }
        : {}),
    },
    carteiras,
    porFase,
    processos,
    extrato,
    premissas: {
      valorReferenciaProcesso: VALOR_REFERENCIA_PROCESSO,
      parteDaEmpresa: PARTE_DA_EMPRESA,
      referenciaPorProcesso: REFERENCIA_DO_INVESTIDOR,
      limiteSobreCredito: LIMITE_SOBRE_CREDITO,
      prazoEstimadoMeses: PRAZO_ESTIMADO_MESES,
    },
  };
}
