// ─────────────────────────────────────────────────────────────────────────────
// ACOMPANHAMENTO PROCESSUAL NO PAINEL DO ADVOGADO (2026-09-11) — cada
// comunicação publicada no DJEN com texto (intimação, despacho, decisão) vira
// um PARECER curto para o advogado: o que o juiz determinou, quem precisa agir,
// o prazo escrito no texto e o próximo passo. Gerado UMA vez por comunicação
// (guardado) — o painel só lê.
//
// Regras: o parecer usa SOMENTE o texto publicado; o LLM não calcula datas. O
// VENCIMENTO é estimado aqui, em dias úteis a partir da publicação no DJEN
// (disponibilização + 1 dia útil; o prazo corre do dia útil seguinte), sem
// feriados locais — é uma estimativa conservadora e a tela diz para conferir
// a contagem oficial no eproc.
//
// O advogado vê só os clientes que o Admin ENTREGOU a ele; o cruzamento Admin ×
// Jurídico é pelo NOME, como nas pastas do Painel Jurídico.
// ─────────────────────────────────────────────────────────────────────────────
import {
  diaEmBrasilia,
  type AndamentoProcesso,
  type ClienteJuridico,
  type ContratoJuridico,
  type MovimentoProcesso,
  type ResultadoJuridico,
} from './juridico-service.js';
import { chaveDeNome, type EntregaAoAdvogado } from './pastas-advogado.js';

// ── Prazo: estimativa em dias úteis ───────────────────────────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Feriados NACIONAIS de data fixa (MM-DD). Móveis e locais ficam de fora —
 *  por isso o vencimento é "estimado". */
const FERIADOS_NACIONAIS = new Set([
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
]);

function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00.000Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round(
    (Date.parse(`${ate}T12:00:00.000Z`) - Date.parse(`${de}T12:00:00.000Z`)) / DIA_MS,
  );
}

/** Dia útil forense: seg–sex, fora dos feriados nacionais fixos e do recesso
 *  de 20/12 a 20/01 (CPC art. 220 — prazos suspensos). */
export function ehDiaUtilForense(dia: string): boolean {
  const semana = new Date(`${dia}T12:00:00.000Z`).getUTCDay();
  if (semana === 0 || semana === 6) return false;
  const mmdd = dia.slice(5, 10);
  if (mmdd >= '12-20' || mmdd <= '01-20') return false;
  return !FERIADOS_NACIONAIS.has(mmdd);
}

function proximoDiaUtil(dia: string): string {
  let d = somarDias(dia, 1);
  while (!ehDiaUtilForense(d)) d = somarDias(d, 1);
  return d;
}

/** Vencimento ESTIMADO de um prazo de `dias` contado de uma comunicação
 *  disponibilizada no DJEN em `disponibilizadoEm` (AAAA-MM-DD). Publicação =
 *  1º dia útil após a disponibilização; o prazo começa no dia útil seguinte
 *  (CPC art. 224). Dias úteis por padrão (CPC art. 219); em dias corridos, o
 *  vencimento em dia não útil passa para o próximo útil. */
export function estimarVencimento(
  disponibilizadoEm: string,
  dias: number,
  corridos = false,
): string | null {
  if (!RE_DIA.test(disponibilizadoEm) || !Number.isInteger(dias) || dias < 1 || dias > 365)
    return null;
  const publicacao = proximoDiaUtil(disponibilizadoEm);
  if (corridos) {
    const fim = somarDias(publicacao, dias);
    return ehDiaUtilForense(fim) ? fim : proximoDiaUtil(fim);
  }
  let d = publicacao;
  for (let i = 0; i < dias; i += 1) d = proximoDiaUtil(d);
  return d;
}

// ── Parecer (LLM) ─────────────────────────────────────────────────────────────

export type TomDoParecer = 'favoravel' | 'desfavoravel' | 'neutro';

export interface DeterminacaoDoJuizo {
  readonly oQue: string;
  /** Quem precisa agir: "advogado", "parte autora", "banco réu"… */
  readonly responsavel: string;
  /** Só quando o número de dias está ESCRITO no texto. */
  readonly prazoDias: number | null;
  readonly diasCorridos: boolean;
}

export interface ParecerDoTexto {
  readonly resumo: string;
  readonly determinacoes: readonly DeterminacaoDoJuizo[];
  readonly exigeAcao: boolean;
  readonly proximoPasso: string;
  readonly tom: TomDoParecer;
}

/** Guardado em ns 'juridico-analises' — uma por comunicação. */
export interface AnaliseMovimento extends ParecerDoTexto {
  readonly chave: string;
  readonly processo: string;
  /** AAAA-MM-DD — disponibilização no DJEN. */
  readonly dataPublicacao: string;
  /** "Intimação", "Citação"… */
  readonly tipo: string;
  readonly geradoEm: string;
}

/** Parecer que falhou (texto ilegível/erro do LLM): tenta de novo nas
 *  próximas rodadas até MAX_TENTATIVAS — depois fica só o texto na tela. */
interface FalhaDeAnalise {
  readonly chave: string;
  readonly erro: string;
  readonly tentativas: number;
}

const NS_ANALISES = 'juridico-analises';
const NS_CIENCIA = 'juridico-analises-ciencia';
const MAX_TENTATIVAS = 3;
/** Comunicações mais antigas que isto não geram parecer nem alerta. */
const JANELA_DIAS = 120;
/** Ação exigida SEM prazo escrito fica em alerta por este período. */
const ALERTA_SEM_PRAZO_DIAS = 30;
/** Prazo vencido continua na lista de alertas por estes dias. */
const ALERTA_VENCIDO_DIAS = 5;
const TONS: ReadonlySet<string> = new Set(['favoravel', 'desfavoravel', 'neutro']);

export const PROMPT_PARECER_PROCESSUAL = `Você é o assistente jurídico do escritório e escreve para o ADVOGADO responsável pelo processo. Você recebe UMA comunicação publicada no Diário de Justiça Eletrônico Nacional (DJEN) — intimação, despacho, decisão ou sentença — de uma ação de consumidor contra banco (empréstimo consignado do INSS). O cliente do escritório é a parte autora.

Responda APENAS com JSON, sem nenhum texto fora dele:
{"resumo": string, "determinacoes": [{"oQue": string, "responsavel": string, "prazoDias": number | null, "diasCorridos": boolean}], "exigeAcao": boolean, "proximoPasso": string, "tom": "favoravel" | "desfavoravel" | "neutro"}

Regras:
- Use SOMENTE o que está escrito no texto. Não invente fatos, números, nomes, artigos nem fundamentos.
- "resumo": até 3 frases em português simples — o que o juiz decidiu ou determinou e o que isso significa para o caso.
- "determinacoes": cada ordem do juízo separada. "responsavel" diz quem precisa agir (ex.: "advogado", "parte autora", "banco réu", "cartório", "perito"). "prazoDias" só quando o número de dias estiver escrito no texto para aquela ordem; senão null. "diasCorridos" true só se o texto disser "dias corridos".
- Não calcule datas de vencimento.
- "exigeAcao": true se o advogado ou a parte autora precisa fazer algo.
- "proximoPasso": uma frase com a providência concreta que o texto pede do advogado; se nada for exigido, diga isso.
- "tom": "favoravel" ou "desfavoravel" para a parte autora; "neutro" quando for só andamento.
- Sem emojis e sem markdown.`;

function limpo(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Resposta do LLM → parecer validado (null = ilegível). */
export function parseParecer(raw: string): ParecerDoTexto | null {
  const inicio = raw.indexOf('{');
  const fim = raw.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(raw.slice(inicio, fim + 1));
  } catch {
    return null;
  }
  if (typeof bruto !== 'object' || bruto === null) return null;
  const o = bruto as Record<string, unknown>;
  const resumo = limpo(o['resumo'], 700);
  if (resumo === '') return null;
  const lista: readonly unknown[] = Array.isArray(o['determinacoes'])
    ? (o['determinacoes'] as unknown[])
    : [];
  const determinacoes = lista
    .slice(0, 8)
    .map((item): DeterminacaoDoJuizo => {
      const d = (item ?? {}) as Record<string, unknown>;
      const p = d['prazoDias'];
      return {
        oQue: limpo(d['oQue'], 400),
        responsavel: limpo(d['responsavel'], 60) || 'advogado',
        prazoDias: typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= 365 ? p : null,
        diasCorridos: d['diasCorridos'] === true,
      };
    })
    .filter((d) => d.oQue !== '');
  const tom = limpo(o['tom'], 20);
  return {
    resumo,
    determinacoes,
    // Ordem com prazo é ação exigida, diga o LLM o que disser.
    exigeAcao: o['exigeAcao'] === true || determinacoes.some((d) => d.prazoDias !== null),
    proximoPasso: limpo(o['proximoPasso'], 400),
    tom: TONS.has(tom) ? (tom as TomDoParecer) : 'neutro',
  };
}

// ── Chaves ────────────────────────────────────────────────────────────────────

/** FNV-1a 32 bits — chave curta e estável da comunicação. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A MESMA identidade de ato do Painel Jurídico (nome|data|início do texto). */
export function chaveDaComunicacao(numeroCnj: string, m: MovimentoProcesso): string {
  const digitos = numeroCnj.replace(/\D/g, '');
  return `${digitos}-${hash(`${m.nome}|${m.dataHora}|${(m.texto ?? '').slice(0, 120)}`)}`;
}

/** Comunicação que MERECE parecer: DJEN com texto, dentro da janela, fora a
 *  lista de distribuição (não traz ordem nenhuma). */
export function ehAnalisavel(m: MovimentoProcesso, desde: string): boolean {
  return (
    m.fonte === 'DJEN' &&
    (m.texto ?? '').length >= 40 &&
    !/distribui[çc][ãa]o/i.test(m.nome) &&
    m.dataHora.slice(0, 10) >= desde
  );
}

function ehAnalise(v: unknown): v is AnaliseMovimento {
  return (
    typeof v === 'object' && v !== null && typeof (v as { resumo?: unknown }).resumo === 'string'
  );
}

// ── Visão do advogado ─────────────────────────────────────────────────────────

export interface MovimentoComParecer extends MovimentoProcesso {
  readonly chave: string | null;
  readonly analise: AnaliseMovimento | null;
  /** Analisável e ainda sem parecer (a próxima rodada gera). */
  readonly aguardandoParecer: boolean;
}

export interface ProcessoAcompanhado {
  readonly numero: string;
  readonly bancos: readonly string[];
  readonly tribunal: string;
  readonly classe: string;
  readonly orgaoJulgador: string;
  readonly ultimoMovimento: { readonly nome: string; readonly dataHora: string } | null;
  /** null = ainda não consultado pelo acompanhamento automático. */
  readonly consultadoEm: string | null;
  readonly erro: string | null;
  readonly movimentos: readonly MovimentoComParecer[];
}

export interface ClienteAcompanhado {
  readonly nome: string;
  readonly chatId: string;
  /** null = entregue, mas ainda sem cadastro no Painel Jurídico. */
  readonly juridicoClienteId: string | null;
  readonly processos: readonly ProcessoAcompanhado[];
  /** Alertas ainda sem "ciente". */
  readonly alertas: number;
}

export interface DeterminacaoComVencimento extends DeterminacaoDoJuizo {
  readonly vencimentoEstimado: string | null;
  readonly diasRestantes: number | null;
}

export interface AlertaProcessual {
  readonly chave: string;
  readonly cliente: string;
  readonly chatId: string;
  readonly processo: string;
  readonly dataPublicacao: string;
  readonly tipo: string;
  readonly resumo: string;
  readonly proximoPasso: string;
  readonly determinacoes: readonly DeterminacaoComVencimento[];
  /** O vencimento mais próximo ainda por vir (ou o último, se todos venceram). */
  readonly vencimentoEstimado: string | null;
  readonly diasRestantes: number | null;
  readonly vencido: boolean;
  readonly ciente: boolean;
}

export interface PainelAcompanhamento {
  readonly hoje: string;
  readonly alertas: readonly AlertaProcessual[];
  readonly clientes: readonly ClienteAcompanhado[];
  /** Comunicações analisáveis ainda sem parecer. */
  readonly aguardandoParecer: number;
  /** false = LLM offline nesta montagem (o painel mostra só o texto). */
  readonly parecerDisponivel: boolean;
}

export interface DadosDoJuridico {
  readonly entregas: readonly EntregaAoAdvogado[];
  readonly clientes: readonly ClienteJuridico[];
  readonly contratos: readonly ContratoJuridico[];
  readonly andamentos: readonly AndamentoProcesso[];
}

/** O mínimo do JsonStore que o acompanhamento usa. */
export interface ArmazemAcompanhamento {
  get(ns: string, chave: string): Promise<unknown>;
  put(ns: string, chave: string, valor: unknown): Promise<unknown>;
  list(ns: string): Promise<unknown>;
}

export interface AcompanhamentoDeps {
  readonly json: ArmazemAcompanhamento;
  readonly clock: { now(): Date };
  /** system + user → texto. null = LLM offline (sem parecer; o texto aparece). */
  readonly completar: ((system: string, user: string) => Promise<string>) | null;
}

function dataBr(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

export class AcompanhamentoProcessual {
  /** Chaves em análise agora — duas rodadas não pagam o mesmo parecer. */
  private readonly emAnalise = new Set<string>();

  constructor(private readonly deps: AcompanhamentoDeps) {}

  private hoje(): string {
    return diaEmBrasilia(this.deps.clock.now());
  }

  private async listar(ns: string): Promise<readonly unknown[]> {
    const v = await this.deps.json.list(ns);
    return Array.isArray(v) ? (v as unknown[]) : [];
  }

  /** Gera o parecer das comunicações analisáveis que ainda não têm (mais
   *  recentes primeiro, até `limite` por rodada). Idempotente. */
  async analisarPendentes(
    andamentos: readonly AndamentoProcesso[],
    limite = 60,
  ): Promise<{ analisadas: number; erros: number; restantes: number }> {
    const completar = this.deps.completar;
    const desde = somarDias(this.hoje(), -JANELA_DIAS);
    const candidatas: { a: AndamentoProcesso; m: MovimentoProcesso; chave: string }[] = [];
    for (const a of andamentos)
      for (const m of a.movimentos)
        if (ehAnalisavel(m, desde))
          candidatas.push({ a, m, chave: chaveDaComunicacao(a.numero, m) });
    candidatas.sort((x, y) => y.m.dataHora.localeCompare(x.m.dataHora));

    let analisadas = 0;
    let erros = 0;
    let restantes = 0;
    for (const { a, m, chave } of candidatas) {
      if (this.emAnalise.has(chave)) continue;
      const atual = await this.deps.json.get(NS_ANALISES, chave);
      if (ehAnalise(atual)) continue;
      const tentativas = (atual as FalhaDeAnalise | null)?.tentativas ?? 0;
      if (tentativas >= MAX_TENTATIVAS) continue;
      if (completar === null || analisadas + erros >= limite) {
        restantes += 1;
        continue;
      }
      this.emAnalise.add(chave);
      try {
        const user = [
          `Processo: ${a.numero}`,
          `Classe: ${a.classe || '—'}`,
          `Órgão: ${a.orgaoJulgador || '—'}`,
          `Comunicação: ${m.nome.replace(/^DJEN · /, '')} disponibilizada em ${dataBr(m.dataHora.slice(0, 10))}`,
          '',
          'TEXTO DA COMUNICAÇÃO:',
          (m.texto ?? '').slice(0, 6000),
        ].join('\n');
        const parecer = parseParecer(await completar(PROMPT_PARECER_PROCESSUAL, user));
        if (parecer === null) throw new Error('parecer ilegível (resposta fora do formato)');
        await this.deps.json.put(NS_ANALISES, chave, {
          ...parecer,
          chave,
          processo: a.numero,
          dataPublicacao: m.dataHora.slice(0, 10),
          tipo: m.nome.replace(/^DJEN · /, ''),
          geradoEm: this.deps.clock.now().toISOString(),
        } satisfies AnaliseMovimento);
        analisadas += 1;
      } catch (e) {
        erros += 1;
        await this.deps.json.put(NS_ANALISES, chave, {
          chave,
          erro: e instanceof Error ? e.message : String(e),
          tentativas: tentativas + 1,
        } satisfies FalhaDeAnalise);
      } finally {
        this.emAnalise.delete(chave);
      }
    }
    return { analisadas, erros, restantes };
  }

  /** Os andamentos dos processos dos clientes ENTREGUES a este advogado. */
  andamentosDoAdvogado(advogadoId: string, dados: DadosDoJuridico): AndamentoProcesso[] {
    const numeros = new Set(
      this.clientesDoAdvogado(advogadoId, dados).flatMap((c) =>
        c.processos.map((p) => p.numero.replace(/\D/g, '')),
      ),
    );
    return dados.andamentos.filter((a) => numeros.has(a.numero.replace(/\D/g, '')));
  }

  private clientesDoAdvogado(
    advogadoId: string,
    dados: DadosDoJuridico,
  ): {
    nome: string;
    chatId: string;
    juridicoClienteId: string | null;
    processos: { numero: string; bancos: string[] }[];
  }[] {
    const processosPorCliente = new Map<
      string,
      Map<string, { numero: string; bancos: string[] }>
    >();
    for (const c of dados.contratos) {
      if (c.status === 'excluido') continue;
      const porNumero =
        processosPorCliente.get(c.clienteId) ??
        new Map<string, { numero: string; bancos: string[] }>();
      processosPorCliente.set(c.clienteId, porNumero);
      const chave = c.processoNumero.replace(/\D/g, '');
      const p = porNumero.get(chave) ?? { numero: c.processoNumero, bancos: [] };
      if (c.banco !== '' && !p.bancos.includes(c.banco)) p.bancos.push(c.banco);
      porNumero.set(chave, p);
    }
    const qtd = (id: string): number => processosPorCliente.get(id)?.size ?? 0;
    const porNome = new Map<string, ClienteJuridico>();
    for (const c of dados.clientes) {
      const k = chaveDeNome(c.nome);
      const atual = porNome.get(k);
      // Homônimo no jurídico: fica o cadastro que tem processo.
      if (atual === undefined || qtd(c.id) > qtd(atual.id)) porNome.set(k, c);
    }
    const vistos = new Set<string>();
    const out: {
      nome: string;
      chatId: string;
      juridicoClienteId: string | null;
      processos: { numero: string; bancos: string[] }[];
    }[] = [];
    for (const e of dados.entregas) {
      if (e.advogadoId !== advogadoId || vistos.has(e.chatId)) continue;
      vistos.add(e.chatId);
      const doJuridico = porNome.get(chaveDeNome(e.nome)) ?? null;
      out.push({
        nome: doJuridico?.nome ?? e.nome,
        chatId: e.chatId,
        juridicoClienteId: doJuridico?.id ?? null,
        processos:
          doJuridico === null ? [] : [...(processosPorCliente.get(doJuridico.id)?.values() ?? [])],
      });
    }
    return out;
  }

  async painelDoAdvogado(
    advogadoId: string,
    dados: DadosDoJuridico,
  ): Promise<PainelAcompanhamento> {
    const hoje = this.hoje();
    const desde = somarDias(hoje, -JANELA_DIAS);
    const [registros, ciencias] = await Promise.all([
      this.listar(NS_ANALISES),
      this.listar(NS_CIENCIA),
    ]);
    const analises = new Map<string, AnaliseMovimento>();
    for (const r of registros) if (ehAnalise(r)) analises.set(r.chave, r);
    const cientes = new Set(
      ciencias
        .map((c) => (c as { advogadoId?: unknown; chave?: unknown } | null) ?? {})
        .filter((c) => c.advogadoId === advogadoId && typeof c.chave === 'string')
        .map((c) => c.chave as string),
    );
    const andamentoPorNumero = new Map(
      dados.andamentos.map((a) => [a.numero.replace(/\D/g, ''), a] as const),
    );

    const alertas: AlertaProcessual[] = [];
    let aguardandoParecer = 0;
    const clientes: ClienteAcompanhado[] = this.clientesDoAdvogado(advogadoId, dados).map((c) => {
      const processos = c.processos.map((p): ProcessoAcompanhado => {
        const a = andamentoPorNumero.get(p.numero.replace(/\D/g, '')) ?? null;
        const movimentos = (a?.movimentos ?? []).slice(0, 15).map((m): MovimentoComParecer => {
          if (!ehAnalisavel(m, desde))
            return { ...m, chave: null, analise: null, aguardandoParecer: false };
          const chave = chaveDaComunicacao(p.numero, m);
          const analise = analises.get(chave) ?? null;
          if (analise === null) aguardandoParecer += 1;
          return { ...m, chave, analise, aguardandoParecer: analise === null };
        });
        for (const m of movimentos) {
          const alerta = m.analise === null ? null : this.alertaDe(m.analise, hoje);
          if (alerta !== null)
            alertas.push({
              ...alerta,
              cliente: c.nome,
              chatId: c.chatId,
              ciente: cientes.has(alerta.chave),
            });
        }
        return {
          numero: p.numero,
          bancos: p.bancos,
          tribunal: a?.tribunal ?? '',
          classe: a?.classe ?? '',
          orgaoJulgador: a?.orgaoJulgador ?? '',
          ultimoMovimento: a?.ultimoMovimento ?? null,
          consultadoEm: a?.consultadoEm ?? null,
          erro: a?.erro ?? null,
          movimentos,
        };
      });
      return {
        nome: c.nome,
        chatId: c.chatId,
        juridicoClienteId: c.juridicoClienteId,
        processos,
        alertas: 0,
      };
    });

    alertas.sort(
      (x, y) =>
        Number(x.ciente) - Number(y.ciente) ||
        (x.diasRestantes ?? Number.MAX_SAFE_INTEGER) -
          (y.diasRestantes ?? Number.MAX_SAFE_INTEGER) ||
        y.dataPublicacao.localeCompare(x.dataPublicacao),
    );
    const abertosPorChat = new Map<string, number>();
    for (const a of alertas)
      if (!a.ciente) abertosPorChat.set(a.chatId, (abertosPorChat.get(a.chatId) ?? 0) + 1);

    return {
      hoje,
      alertas,
      clientes: clientes
        .map((c) => ({ ...c, alertas: abertosPorChat.get(c.chatId) ?? 0 }))
        .sort((x, y) => y.alertas - x.alertas || x.nome.localeCompare(y.nome, 'pt-BR')),
      aguardandoParecer,
      parecerDisponivel: this.deps.completar !== null,
    };
  }

  /** A comunicação vira alerta quando exige ação: com prazo (até
   *  ALERTA_VENCIDO_DIAS depois de vencer) ou sem prazo escrito (por
   *  ALERTA_SEM_PRAZO_DIAS desde a publicação). */
  private alertaDe(
    a: AnaliseMovimento,
    hoje: string,
  ): Omit<AlertaProcessual, 'cliente' | 'chatId' | 'ciente'> | null {
    if (!a.exigeAcao) return null;
    const determinacoes = a.determinacoes.map((d): DeterminacaoComVencimento => {
      const vencimentoEstimado =
        d.prazoDias === null
          ? null
          : estimarVencimento(a.dataPublicacao, d.prazoDias, d.diasCorridos);
      return {
        ...d,
        vencimentoEstimado,
        diasRestantes: vencimentoEstimado === null ? null : diasEntre(hoje, vencimentoEstimado),
      };
    });
    const restantes = determinacoes
      .map((d) => d.diasRestantes)
      .filter((n): n is number => n !== null);
    let diasRestantes: number | null = null;
    if (restantes.length > 0) {
      const porVir = restantes.filter((n) => n >= 0);
      diasRestantes = porVir.length > 0 ? Math.min(...porVir) : Math.max(...restantes);
      if (diasRestantes < -ALERTA_VENCIDO_DIAS) return null;
    } else if (diasEntre(a.dataPublicacao, hoje) > ALERTA_SEM_PRAZO_DIAS) {
      return null;
    }
    return {
      chave: a.chave,
      processo: a.processo,
      dataPublicacao: a.dataPublicacao,
      tipo: a.tipo,
      resumo: a.resumo,
      proximoPasso: a.proximoPasso,
      determinacoes,
      vencimentoEstimado: diasRestantes === null ? null : somarDias(hoje, diasRestantes),
      diasRestantes,
      vencido: diasRestantes !== null && diasRestantes < 0,
    };
  }

  /** "Ciente" do advogado num alerta — só nos alertas DELE. */
  async marcarCiente(
    advogadoId: string,
    chave: string,
    dados: DadosDoJuridico,
  ): Promise<ResultadoJuridico> {
    const painel = await this.painelDoAdvogado(advogadoId, dados);
    if (!painel.alertas.some((a) => a.chave === chave))
      return { ok: false, error: 'alerta não encontrado entre os seus processos' };
    await this.deps.json.put(NS_CIENCIA, `${advogadoId}__${chave}`, {
      advogadoId,
      chave,
      em: this.deps.clock.now().toISOString(),
    });
    return { ok: true };
  }
}
