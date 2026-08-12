// ─────────────────────────────────────────────────────────────────────────────
// DOSSIÊ DE INVESTIDOR (2026-08-12) — os números que um comprador de participação
// pede, calculados do banco REAL, sem estimativa e sem número redondo.
//
// A tese que o dossiê sustenta não é "compre minha carteira": é "eu transformo
// um escritório de consignado numa operação que roda com uma fração da equipe, e
// provei na minha própria base". Por isso o centro do relatório é o FUNIL com as
// taxas de conversão de cada degrau e o CUSTO DE IA por cliente fechado — a
// máquina, não o estoque.
//
// Três disciplinas que este arquivo segue à risca:
//   • MEDIANA, não média — com dezenas (não milhares) de clientes, um outlier
//     move a média e mente para o investidor;
//   • toda métrica declara a FONTE (de onde no sistema o número saiu), porque
//     em diligência o comprador vai querer conferir;
//   • NENHUM dado pessoal sai daqui — sem nome, sem CPF, sem telefone. O dossiê
//     circula fora da empresa; a base do cliente não pode circular junto (LGPD).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';

/** Um degrau do funil — quantos chegaram e quanto isso representa. */
export interface EtapaFunil {
  readonly id: string;
  readonly rotulo: string;
  readonly explicacao: string;
  readonly quantidade: number;
  /** % de quem estava no degrau ANTERIOR (a taxa que o investidor lê). */
  readonly taxaDaAnterior: number | null;
  /** % do topo do funil (todos os contatos). */
  readonly taxaDoTopo: number;
}

/** Coorte mensal pelo mês do PRIMEIRO contato — mostra a máquina melhorando
 *  (ou não) ao longo do tempo, que é o que separa sorte de método. */
export interface CoorteMensal {
  readonly mes: string;
  readonly leads: number;
  readonly fase1: number;
  readonly confirmados: number;
  readonly fechados: number;
}

export interface EconomiaDossie {
  readonly custoIaUsd: number;
  readonly custoIaPorLeadUsd: number | null;
  /** A métrica-chave: quanto de IA custa cada cliente com documentação completa. */
  readonly custoIaPorClienteFechadoUsd: number | null;
  readonly chamadasDeIa: number;
}

export interface CarteiraDossie {
  readonly contratosAnalisados: number;
  readonly clientesComContrato: number;
  readonly potencialConfirmado: number;
  readonly clientesFechados: number;
  readonly potencialMedianoPorClienteFechado: number | null;
  readonly ufs: readonly { readonly uf: string; readonly clientes: number }[];
}

export interface VelocidadeDossie {
  /** Dias (mediana) do primeiro contato até o dossiê pericial sair. */
  readonly diasAteParecer: number | null;
  /** Dias (mediana) entre o dossiê e o SIM do cliente. */
  readonly diasParaConfirmar: number | null;
}

export interface Dossie {
  readonly geradoEm: string;
  readonly funil: readonly EtapaFunil[];
  readonly coortes: readonly CoorteMensal[];
  readonly economia: EconomiaDossie;
  readonly carteira: CarteiraDossie;
  readonly velocidade: VelocidadeDossie;
  /** De onde cada bloco veio — a diligência vai conferir. */
  readonly fontes: readonly { readonly bloco: string; readonly origem: string }[];
}

// ── O que o dossiê precisa ler (tudo já existe na montagem de produção) ───────

export interface SessaoDossie {
  readonly chatId: string;
  readonly openedAt: Date;
}
export interface HisconDossie {
  readonly clienteId: string;
  readonly chatId: string;
  readonly temCpf: boolean;
  readonly totalContratos: number;
}
export interface ParecerDossie {
  readonly clienteId: string;
  readonly enviadoEm: Date;
  readonly confirmadoEm: Date | null;
}
export interface MesaDossie {
  readonly clienteId: string;
  readonly chatId: string;
  readonly uf: string;
  readonly potencial: number;
  readonly completo: boolean;
  readonly descartado: boolean;
}
export interface CustoDossie {
  readonly custoUsd: number | null;
}

export interface DossieInvestidorDeps {
  readonly clock: Clock;
  /** Todo contato que já falou com a AHRI (o topo do funil). */
  readonly sessoes: () => Promise<readonly SessaoDossie[]>;
  readonly comHiscon: () => Promise<readonly HisconDossie[]>;
  readonly pareceres: () => Promise<readonly ParecerDossie[]>;
  readonly mesa: () => Promise<readonly MesaDossie[]>;
  readonly custos: () => Promise<readonly CustoDossie[]>;
}

export class DossieInvestidor {
  constructor(private readonly deps: DossieInvestidorDeps) {}

  async gerar(): Promise<Dossie> {
    const [sessoes, comHiscon, pareceres, mesa, custos] = await Promise.all([
      this.deps.sessoes(),
      this.deps.comHiscon(),
      this.deps.pareceres(),
      this.deps.mesa(),
      this.deps.custos(),
    ]);

    const parecerPorCliente = new Map(pareceres.map((p) => [p.clienteId, p]));
    const fase1 = comHiscon.filter((c) => c.temCpf);
    const comContrato = fase1.filter((c) => c.totalContratos > 0);
    const comParecer = comHiscon.filter((c) => parecerPorCliente.has(c.clienteId));
    const confirmados = comHiscon.filter(
      (c) => (parecerPorCliente.get(c.clienteId)?.confirmadoEm ?? null) !== null,
    );
    const fechados = mesa.filter((m) => m.completo && !m.descartado);

    const funil = montarFunil([
      {
        id: 'contatos',
        rotulo: 'Contatos',
        explicacao: 'Pessoas que abriram conversa com a AHRI',
        quantidade: sessoes.length,
      },
      {
        id: 'hiscon',
        rotulo: 'Entregaram o HISCON',
        explicacao: 'Enviaram o extrato do INSS pelo passo a passo da AHRI',
        quantidade: comHiscon.length,
      },
      {
        id: 'fase1',
        rotulo: 'Fase 1 completa',
        explicacao: 'CPF + HISCON — pronto para a perícia digital',
        quantidade: fase1.length,
      },
      {
        id: 'elegiveis',
        rotulo: 'Com contrato analisável',
        explicacao: 'A perícia digital achou contratos na janela de 5 anos',
        quantidade: comContrato.length,
      },
      {
        id: 'parecer',
        rotulo: 'Receberam o dossiê',
        explicacao: 'O parecer pericial foi entregue ao cliente',
        quantidade: comParecer.length,
      },
      {
        id: 'confirmados',
        rotulo: 'Confirmaram o interesse',
        explicacao: 'Disseram SIM ao dossiê — o cadastro nasce aqui',
        quantidade: confirmados.length,
      },
      {
        id: 'fechados',
        rotulo: 'Documentação completa',
        explicacao: 'Procuração assinada, RG e comprovante — pronto para o advogado',
        quantidade: fechados.length,
      },
    ]);

    return {
      geradoEm: this.deps.clock.now().toISOString(),
      funil,
      coortes: montarCoortes(sessoes, comHiscon, parecerPorCliente, mesa),
      economia: montarEconomia(custos, sessoes.length, fechados.length),
      carteira: montarCarteira(comHiscon, mesa, fechados),
      velocidade: montarVelocidade(sessoes, comHiscon, pareceres),
      fontes: [
        { bloco: 'Contatos', origem: 'sessões abertas (ns sessions)' },
        { bloco: 'HISCON e contratos', origem: 'perícia digital sobre os documentos recebidos' },
        { bloco: 'Dossiê e confirmação', origem: 'ns parecer-enviado (enviadoEm / confirmadoEm)' },
        { bloco: 'Documentação e potencial', origem: 'mesa do Atendimento Humanizado' },
        { bloco: 'Custo de IA', origem: 'ns custo-llm — tokens reais × preço de tabela' },
      ],
    };
  }
}

// ── Cálculo (funções puras: o mesmo dado sempre dá o mesmo relatório) ─────────

function montarFunil(
  degraus: readonly { id: string; rotulo: string; explicacao: string; quantidade: number }[],
): readonly EtapaFunil[] {
  const topo = degraus[0]?.quantidade ?? 0;
  return degraus.map((d, i) => {
    const anterior = i === 0 ? null : (degraus[i - 1]?.quantidade ?? 0);
    return {
      ...d,
      taxaDaAnterior: anterior === null || anterior === 0 ? null : pct(d.quantidade / anterior),
      taxaDoTopo: topo === 0 ? 0 : pct(d.quantidade / topo),
    };
  });
}

function montarCoortes(
  sessoes: readonly SessaoDossie[],
  comHiscon: readonly HisconDossie[],
  parecerPorCliente: ReadonlyMap<string, ParecerDossie>,
  mesa: readonly MesaDossie[],
): readonly CoorteMensal[] {
  const clientePorChat = new Map(comHiscon.map((c) => [c.chatId, c]));
  const fechadoPorChat = new Set(
    mesa.filter((m) => m.completo && !m.descartado).map((m) => m.chatId),
  );
  const porMes = new Map<string, { leads: number; fase1: number; conf: number; fech: number }>();
  for (const s of sessoes) {
    const mes = s.openedAt.toISOString().slice(0, 7);
    const linha = porMes.get(mes) ?? { leads: 0, fase1: 0, conf: 0, fech: 0 };
    linha.leads += 1;
    const cliente = clientePorChat.get(s.chatId) ?? null;
    if (cliente !== null && cliente.temCpf) linha.fase1 += 1;
    if (
      cliente !== null &&
      (parecerPorCliente.get(cliente.clienteId)?.confirmadoEm ?? null) !== null
    )
      linha.conf += 1;
    if (fechadoPorChat.has(s.chatId)) linha.fech += 1;
    porMes.set(mes, linha);
  }
  return [...porMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, l]) => ({
      mes,
      leads: l.leads,
      fase1: l.fase1,
      confirmados: l.conf,
      fechados: l.fech,
    }));
}

function montarEconomia(
  custos: readonly CustoDossie[],
  leads: number,
  fechados: number,
): EconomiaDossie {
  const custoIaUsd = custos.reduce((s, c) => s + (c.custoUsd ?? 0), 0);
  return {
    custoIaUsd: arredondar(custoIaUsd, 2),
    custoIaPorLeadUsd: leads === 0 ? null : arredondar(custoIaUsd / leads, 4),
    custoIaPorClienteFechadoUsd: fechados === 0 ? null : arredondar(custoIaUsd / fechados, 2),
    chamadasDeIa: custos.length,
  };
}

function montarCarteira(
  comHiscon: readonly HisconDossie[],
  mesa: readonly MesaDossie[],
  fechados: readonly MesaDossie[],
): CarteiraDossie {
  const porUf = new Map<string, number>();
  for (const m of mesa) {
    if (m.descartado) continue;
    const uf = m.uf.trim() === '' ? '—' : m.uf;
    porUf.set(uf, (porUf.get(uf) ?? 0) + 1);
  }
  return {
    contratosAnalisados: comHiscon.reduce((s, c) => s + c.totalContratos, 0),
    clientesComContrato: comHiscon.filter((c) => c.totalContratos > 0).length,
    potencialConfirmado: arredondar(
      fechados.reduce((s, m) => s + m.potencial, 0),
      2,
    ),
    clientesFechados: fechados.length,
    potencialMedianoPorClienteFechado: mediana(fechados.map((m) => m.potencial)),
    ufs: [...porUf.entries()]
      .map(([uf, clientes]) => ({ uf, clientes }))
      .sort((a, b) => b.clientes - a.clientes),
  };
}

function montarVelocidade(
  sessoes: readonly SessaoDossie[],
  comHiscon: readonly HisconDossie[],
  pareceres: readonly ParecerDossie[],
): VelocidadeDossie {
  const aberturaPorChat = new Map(sessoes.map((s) => [s.chatId, s.openedAt]));
  const chatPorCliente = new Map(comHiscon.map((c) => [c.clienteId, c.chatId]));
  const ateParecer: number[] = [];
  const paraConfirmar: number[] = [];
  for (const p of pareceres) {
    const chatId = chatPorCliente.get(p.clienteId) ?? null;
    const abertura = chatId === null ? null : (aberturaPorChat.get(chatId) ?? null);
    if (abertura !== null) {
      const dias = emDias(abertura, p.enviadoEm);
      if (dias !== null) ateParecer.push(dias);
    }
    if (p.confirmadoEm !== null) {
      const dias = emDias(p.enviadoEm, p.confirmadoEm);
      if (dias !== null) paraConfirmar.push(dias);
    }
  }
  return {
    diasAteParecer: mediana(ateParecer),
    diasParaConfirmar: mediana(paraConfirmar),
  };
}

/** Diferença em dias, ignorando pares invertidos (dado sujo não vira métrica). */
function emDias(de: Date, ate: Date): number | null {
  const ms = ate.getTime() - de.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return arredondar(ms / 86_400_000, 1);
}

/** MEDIANA — com dezenas de casos, a média mente: um único cliente com muitos
 *  contratos (ou um lead esquecido há meses) desloca o número inteiro. */
function mediana(valores: readonly number[]): number | null {
  const limpos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (limpos.length === 0) return null;
  const meio = Math.floor(limpos.length / 2);
  const valor =
    limpos.length % 2 === 1
      ? (limpos[meio] ?? 0)
      : ((limpos[meio - 1] ?? 0) + (limpos[meio] ?? 0)) / 2;
  return arredondar(valor, 2);
}

function pct(fracao: number): number {
  return arredondar(fracao * 100, 1);
}

function arredondar(valor: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}
