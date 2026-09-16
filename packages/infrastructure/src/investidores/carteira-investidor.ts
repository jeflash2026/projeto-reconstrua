// ─────────────────────────────────────────────────────────────────────────────
// CARTEIRA DO INVESTIDOR (2026-09-16) — a parte PURA do painel de investidores.
//
// O modelo (decisão do dono): o investidor compra, antecipado, a PARTE DA
// EMPRESA no resultado de processos judiciais já distribuídos. Cada processo
// vale R$ 10.000 de REFERÊNCIA (raramente paga menos); a empresa fica com 50%
// e o cliente com 50% — a parte do investidor é a da empresa: R$ 5.000 por
// processo enquanto ele corre. Quando o processo termina, o dono lança no
// Jurídico o valor REAL recebido: a parte do investidor passa a ser 50% dele
// (mais ou menos que a referência); encerrado sem êxito = zero.
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
/** Referência da parte do investidor por processo (R$ 5.000). */
export const REFERENCIA_DO_INVESTIDOR = VALOR_REFERENCIA_PROCESSO * PARTE_DA_EMPRESA;
/** Prazo usado na régua de maturação (o dono estima 1 ano e meio a 2 anos). */
export const PRAZO_ESTIMADO_MESES = 24;

const DIA_MS = 24 * 60 * 60 * 1000;

function centavos(v: number): number {
  return Math.round(v * 100) / 100;
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

/** Quantos processos uma carteira de `valor` em processos pede (≥ 1). */
export function processosParaValor(valor: number): number {
  return Math.max(1, Math.round(valor / VALOR_REFERENCIA_PROCESSO));
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
  'distribuido' | 'andamento' | 'sentenca' | 'execucao' | 'pago' | 'perdido';

/** Ordem da régua (do mais novo ao desfecho) — a mesma da composição. */
export const FASES: readonly { readonly fase: FaseProcesso; readonly rotulo: string }[] = [
  { fase: 'distribuido', rotulo: 'Distribuído' },
  { fase: 'andamento', rotulo: 'Em andamento' },
  { fase: 'sentenca', rotulo: 'Sentença' },
  { fase: 'execucao', rotulo: 'Execução' },
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

/** Uma carteira adicionada (ns 'investidor-lotes'). */
export interface LoteCarteira {
  readonly id: string;
  readonly cpf: string;
  readonly criadoEm: string;
  readonly criadoPor: string;
  /** O valor pedido no comando ("250 mil em processos"); null = por quantidade. */
  readonly valorPedido: number | null;
  readonly processos: readonly string[];
  readonly retirados: readonly {
    readonly numero: string;
    readonly em: string;
    readonly motivo: string;
    readonly por: string;
  }[];
}

export interface ProcessoNoPainel {
  readonly numero: string;
  readonly iniciais: string;
  /** Só no painel do ADMIN (nomesCompletos); nunca vai ao investidor. */
  readonly clienteNome?: string;
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
  readonly referencia: number;
  /** Parte do investidor no valor real (pago/perdido); null = em curso. */
  readonly realizado: number | null;
  /** Valor total recebido no processo (antes da divisão). */
  readonly valorRecebido: number | null;
  readonly desfechoEm: string | null;
  readonly alocadoEm: string;
}

export type TipoExtrato = 'carteira' | 'pago' | 'perdido' | 'correcao' | 'retirado';

export interface LinhaExtrato {
  readonly em: string;
  readonly tipo: TipoExtrato;
  readonly descricao: string;
  /** Variação no valor da carteira (positivo = aumentou). */
  readonly valor: number;
}

export interface PainelInvestidor {
  readonly cpf: string;
  readonly nome: string;
  readonly geradoEm: string;
  readonly totais: {
    readonly processos: number;
    /** Valor da carteira hoje: referência dos em curso + realizado dos encerrados. */
    readonly valorAtual: number;
    /** Referência original (R$ 5.000 × processos). */
    readonly referencia: number;
    readonly realizado: number;
    readonly aReceber: number;
    /** realizado − referência dos encerrados (quanto o real mexeu). */
    readonly ajuste: number;
    readonly emCurso: number;
    readonly pagos: number;
    readonly perdidos: number;
    /** Valor total dos processos (R$ 10.000 de referência cada). */
    readonly valorDosProcessos: number;
  };
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
    readonly prazoEstimadoMeses: number;
  };
}

function parteDoInvestidor(l: Pick<LancamentoResultado, 'situacao' | 'valorRecebido'>): number {
  if (l.situacao === 'pago') return centavos((l.valorRecebido ?? 0) * PARTE_DA_EMPRESA);
  if (l.situacao === 'perdido') return 0;
  return REFERENCIA_DO_INVESTIDOR;
}

const moeda = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function mesesEntre(de: string, ate: Date): number {
  const inicio = Date.parse(`${de.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((ate.getTime() - inicio) / (30.44 * DIA_MS)));
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
  const extrato: LinhaExtrato[] = [];

  const processos = entrada.alocacoes
    .filter((a) => a.cpf === investidor.cpf)
    .map((a): ProcessoNoPainel => {
      const chave = a.numero.replace(/\D/g, '');
      const andamento = andamentoPor.get(chave) ?? null;
      const resultado = resultadoPor.get(chave) ?? null;
      const fase = faseDoProcesso(andamento, resultado);
      const encerrado = resultado !== null && resultado.situacao !== 'em-andamento';

      // Extrato: cada lançamento DEPOIS da alocação mexe na parte do investidor.
      let atual = REFERENCIA_DO_INVESTIDOR;
      let situacaoAtual: LancamentoResultado['situacao'] = 'em-andamento';
      for (const l of resultado?.historico ?? []) {
        if (l.em < a.alocadoEm) continue;
        const novo = parteDoInvestidor(l);
        if (l.situacao === situacaoAtual && novo === atual) continue;
        const delta = centavos(novo - atual);
        const numero = numeroCnj(a.numero);
        // Pago a exatamente R$ 10.000 também entra (variação zero).
        const tipo: TipoExtrato =
          situacaoAtual === 'em-andamento' && l.situacao !== 'em-andamento'
            ? l.situacao
            : 'correcao';
        const descricao =
          tipo === 'pago'
            ? `Processo ${numero} pago: ${moeda(l.valorRecebido ?? 0)} no processo — sua parte ${moeda(novo)}`
            : tipo === 'perdido'
              ? `Processo ${numero} encerrado sem êxito`
              : `Correção do processo ${numero}: sua parte passa a ${moeda(novo)}`;
        extrato.push({ em: l.em, tipo, descricao, valor: delta });
        atual = novo;
        situacaoAtual = l.situacao;
      }

      const ultimo = andamento?.movimentos[0] ?? null;
      const desde = (andamento?.dataAjuizamento ?? '') || a.cadastradoEm;
      return {
        numero: numeroCnj(a.numero),
        iniciais: iniciaisDoNome(a.clienteNome),
        ...(entrada.nomesCompletos ? { clienteNome: a.clienteNome } : {}),
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
        referencia: REFERENCIA_DO_INVESTIDOR,
        realizado: encerrado ? parteDoInvestidor(resultado) : null,
        valorRecebido: encerrado ? resultado.valorRecebido : null,
        desfechoEm: encerrado ? resultado.data : null,
        alocadoEm: a.alocadoEm,
      };
    })
    .sort(
      (x, y) =>
        FASES.findIndex((f) => f.fase === y.fase) - FASES.findIndex((f) => f.fase === x.fase) ||
        x.desde.localeCompare(y.desde),
    );

  for (const lote of entrada.lotes.filter((l) => l.cpf === investidor.cpf)) {
    const n = lote.processos.length;
    extrato.push({
      em: lote.criadoEm,
      tipo: 'carteira',
      descricao: `Carteira adicionada: ${String(n)} processo(s) — ${moeda(n * VALOR_REFERENCIA_PROCESSO)} em processos, sua parte ${moeda(n * REFERENCIA_DO_INVESTIDOR)}`,
      valor: centavos(n * REFERENCIA_DO_INVESTIDOR),
    });
    for (const r of lote.retirados) {
      extrato.push({
        em: r.em,
        tipo: 'retirado',
        descricao: `Processo ${numeroCnj(r.numero)} retirado da carteira${r.motivo !== '' ? ` — ${r.motivo}` : ''}`,
        valor: -REFERENCIA_DO_INVESTIDOR,
      });
    }
  }
  // Mais recente primeiro; no mesmo instante, a entrada da carteira é a mais antiga.
  const ordem = (l: LinhaExtrato): number => (l.tipo === 'carteira' ? 0 : 1);
  extrato.sort((x, y) => y.em.localeCompare(x.em) || ordem(y) - ordem(x));

  const encerrados = processos.filter((p) => p.realizado !== null);
  const realizado = centavos(encerrados.reduce((s, p) => s + (p.realizado ?? 0), 0));
  const aReceber = centavos(
    processos.filter((p) => p.realizado === null).reduce((s, p) => s + p.referencia, 0),
  );
  const porFase = FASES.map(({ fase, rotulo }) => {
    const daFase = processos.filter((p) => p.fase === fase);
    return {
      fase,
      rotulo,
      processos: daFase.length,
      valor: centavos(daFase.reduce((s, p) => s + (p.realizado ?? p.referencia), 0)),
    };
  }).filter((f) => f.processos > 0);

  return {
    cpf: investidor.cpf,
    nome: investidor.nome,
    geradoEm: agora.toISOString(),
    totais: {
      processos: processos.length,
      valorAtual: centavos(realizado + aReceber),
      referencia: centavos(processos.length * REFERENCIA_DO_INVESTIDOR),
      realizado,
      aReceber,
      ajuste: centavos(realizado - encerrados.length * REFERENCIA_DO_INVESTIDOR),
      emCurso: processos.length - encerrados.length,
      pagos: processos.filter((p) => p.fase === 'pago').length,
      perdidos: processos.filter((p) => p.fase === 'perdido').length,
      valorDosProcessos: processos.length * VALOR_REFERENCIA_PROCESSO,
    },
    porFase,
    processos,
    extrato,
    premissas: {
      valorReferenciaProcesso: VALOR_REFERENCIA_PROCESSO,
      parteDaEmpresa: PARTE_DA_EMPRESA,
      referenciaPorProcesso: REFERENCIA_DO_INVESTIDOR,
      prazoEstimadoMeses: PRAZO_ESTIMADO_MESES,
    },
  };
}
