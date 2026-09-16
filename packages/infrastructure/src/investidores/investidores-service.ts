// ─────────────────────────────────────────────────────────────────────────────
// INVESTIDORES SERVICE (2026-09-16) — cadastro (ato do Admin), acesso por CPF
// (convite → senha própria → CPF + senha, o MESMO fluxo do Painel de Sócios),
// a montagem da carteira (proposta do Jarvis + confirmação do dono), a retirada
// de um processo e o PAINEL do investidor.
//
// Fontes: o Painel Jurídico (processos, andamentos DataJud/DJEN e o RESULTADO
// lançado pelo dono) e as entregas do Admin (advogado responsável). A regra de
// valores vive em carteira-investidor.ts; aqui só persistência e orquestração.
// ─────────────────────────────────────────────────────────────────────────────
import {
  SENHA_MINIMA,
  assinarTokenPortal,
  hashSenha,
  normalizarCpf,
  validarTokenPortalDetalhado,
  verificarSenha,
} from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import type {
  AndamentoProcesso,
  ClienteJuridico,
  ContratoJuridico,
  ResultadoProcesso,
} from '../juridico/juridico-service.js';
import { montarPastasPorAdvogado, type EntregaAoAdvogado } from '../juridico/pastas-advogado.js';
import {
  montarPainelInvestidor,
  numeroCnj,
  REFERENCIA_DO_INVESTIDOR,
  selecionarProcessos,
  type AlocacaoProcesso,
  type Investidor,
  type LoteCarteira,
  type PainelInvestidor,
  type ProcessoCandidato,
} from './carteira-investidor.js';

const NS_INVESTIDORES = 'investidores';
const NS_CREDENCIAIS = 'credenciais-investidor';
const NS_ALOCACOES = 'investidor-alocacoes';
const NS_LOTES = 'investidor-lotes';

export const USO_CONVITE_INVESTIDOR = 'convite-investidor';
export const VALIDADE_CONVITE_INVESTIDOR_DIAS = 7;
const CREDENCIAIS_INVALIDAS = 'credenciais inválidas';

export type ResultadoInvestidores<T = undefined> =
  (T extends undefined ? { ok: true } : { ok: true; valor: T }) | { ok: false; error: string };

export interface InvestidoresDeps {
  readonly json: JsonStore;
  readonly clock: { now(): Date };
  /** Segredo que ASSINA os convites (o mesmo segredo de acesso do Admin). */
  readonly secret: string;
  readonly juridico: {
    listarContratos(): Promise<readonly ContratoJuridico[]>;
    listarClientes(): Promise<readonly ClienteJuridico[]>;
    listarAndamentos(): Promise<readonly AndamentoProcesso[]>;
    listarResultados(): Promise<readonly ResultadoProcesso[]>;
  };
  /** Clientes entregues pelo Admin a cada advogado (o advogado responsável). */
  readonly entregas: () => Promise<readonly EntregaAoAdvogado[]>;
}

export interface InvestidorResumoAdmin extends Investidor {
  readonly temSenha: boolean;
  readonly processos: number;
  readonly credito: number;
  readonly limite: number;
  readonly valorAtual: number;
  readonly recebido: number;
  readonly apurado: number;
}

interface CredencialInvestidor {
  readonly cpf: string;
  readonly hash: string;
  readonly atualizadaEm: string;
}

interface DadosDaCarteira {
  readonly contratos: readonly ContratoJuridico[];
  readonly clientes: readonly ClienteJuridico[];
  readonly andamentos: readonly AndamentoProcesso[];
  readonly resultados: readonly ResultadoProcesso[];
  readonly advogadoPorCliente: ReadonlyMap<string, string>;
  readonly alocacoes: readonly AlocacaoProcesso[];
  readonly lotes: readonly LoteCarteira[];
}

export class InvestidoresService {
  constructor(private readonly deps: InvestidoresDeps) {}

  private agora(): string {
    return this.deps.clock.now().toISOString();
  }

  // ── Cadastro ────────────────────────────────────────────────────────────────

  async investidor(cpfBruto: string): Promise<Investidor | null> {
    const cpf = normalizarCpf(cpfBruto);
    if (cpf === null) return null;
    return (await this.deps.json.get(NS_INVESTIDORES, cpf)) as Investidor | null;
  }

  async listar(): Promise<readonly Investidor[]> {
    const todos = (await this.deps.json.list(NS_INVESTIDORES)) as readonly Investidor[];
    return [...todos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /** ATO DO ADMIN: cadastra (ou atualiza) um investidor por CPF. A senha NÃO
   *  nasce aqui — ele a cria pelo link. */
  async cadastrar(input: {
    cpf: string;
    nome: string;
    email?: string;
    telefone?: string;
    ativo?: boolean;
  }): Promise<ResultadoInvestidores<Investidor>> {
    const cpf = normalizarCpf(input.cpf);
    if (cpf === null) return { ok: false, error: 'CPF inválido — informe os 11 dígitos' };
    const nome = input.nome.replace(/\s+/g, ' ').trim();
    if (nome === '') return { ok: false, error: 'nome obrigatório' };
    const existente = await this.investidor(cpf);
    const investidor: Investidor = {
      cpf,
      nome,
      email: (input.email ?? existente?.email ?? '').trim(),
      telefone: (input.telefone ?? existente?.telefone ?? '').trim(),
      ativo: input.ativo ?? existente?.ativo ?? true,
      criadoEm: existente?.criadoEm ?? this.agora(),
    };
    await this.deps.json.put(NS_INVESTIDORES, cpf, investidor);
    return { ok: true, valor: investidor };
  }

  async listaAdmin(): Promise<readonly InvestidorResumoAdmin[]> {
    // A lista só soma valores: sem o advogado responsável (a leitura mais cara).
    const [investidores, dados] = await Promise.all([this.listar(), this.dados(false)]);
    const linhas: InvestidorResumoAdmin[] = [];
    for (const inv of investidores) {
      const painel = this.painelDe(inv, dados, true);
      linhas.push({
        ...inv,
        temSenha: (await this.deps.json.get(NS_CREDENCIAIS, inv.cpf)) !== null,
        processos: painel.totais.processos,
        credito: painel.totais.credito,
        limite: painel.totais.limite,
        valorAtual: painel.totais.valorAtual,
        recebido: painel.totais.recebido,
        apurado: painel.totais.apurado,
      });
    }
    return linhas;
  }

  // ── Acesso (convite → senha → login) ───────────────────────────────────────

  private async ativo(cpf: string): Promise<Investidor | null> {
    const inv = await this.investidor(cpf);
    return inv !== null && inv.ativo ? inv : null;
  }

  /** ATO DO ADMIN: link assinado de 7 dias — só para investidor ativo. */
  async emitirConvite(cpfBruto: string): Promise<string | null> {
    if (this.deps.secret === '') return null;
    const inv = await this.ativo(cpfBruto);
    if (inv === null) return null;
    return assinarTokenPortal(
      inv.cpf,
      USO_CONVITE_INVESTIDOR,
      VALIDADE_CONVITE_INVESTIDOR_DIAS,
      this.deps.clock.now(),
      this.deps.secret,
    );
  }

  /** O investidor cria a PRÓPRIA senha pelo convite, confirmando o CPF dele. */
  async definirSenha(
    token: string,
    cpfBruto: string,
    senha: string,
  ): Promise<ResultadoInvestidores<{ cpf: string; nome: string }>> {
    const now = this.deps.clock.now();
    const convite = validarTokenPortalDetalhado(
      token,
      USO_CONVITE_INVESTIDOR,
      now,
      this.deps.secret,
    );
    if (convite === null)
      return { ok: false, error: 'convite inválido ou expirado — peça um novo link' };
    const cpf = normalizarCpf(cpfBruto);
    if (cpf === null || cpf !== convite.sub)
      return { ok: false, error: 'o CPF informado não confere com o do convite' };
    const inv = await this.ativo(cpf);
    if (inv === null)
      return { ok: false, error: 'cadastro não encontrado ou inativo — fale com o escritório' };
    const existente = (await this.deps.json.get(
      NS_CREDENCIAIS,
      cpf,
    )) as CredencialInvestidor | null;
    if (existente !== null && Date.parse(existente.atualizadaEm) >= convite.emitidoEm.getTime())
      return { ok: false, error: 'este convite já foi utilizado — peça um novo link' };
    if (senha.length < SENHA_MINIMA)
      return {
        ok: false,
        error: `a senha precisa ter pelo menos ${String(SENHA_MINIMA)} caracteres`,
      };
    await this.deps.json.put(NS_CREDENCIAIS, cpf, {
      cpf,
      hash: hashSenha(senha),
      atualizadaEm: now.toISOString(),
    } satisfies CredencialInvestidor);
    return { ok: true, valor: { cpf, nome: inv.nome } };
  }

  /** CPF + senha. Erro único — nunca revela qual fator falhou. */
  async login(
    cpfBruto: string,
    senha: string,
  ): Promise<ResultadoInvestidores<{ cpf: string; nome: string }>> {
    const inv = await this.ativo(cpfBruto);
    if (inv === null) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    const cred = (await this.deps.json.get(NS_CREDENCIAIS, inv.cpf)) as CredencialInvestidor | null;
    if (cred === null || !verificarSenha(senha, cred.hash))
      return { ok: false, error: CREDENCIAIS_INVALIDAS };
    return { ok: true, valor: { cpf: inv.cpf, nome: inv.nome } };
  }

  // ── Carteira ────────────────────────────────────────────────────────────────

  private async dados(comAdvogados = true): Promise<DadosDaCarteira> {
    const [contratos, clientes, andamentos, resultados, alocacoes, lotes, entregas] =
      await Promise.all([
        this.deps.juridico.listarContratos(),
        this.deps.juridico.listarClientes(),
        this.deps.juridico.listarAndamentos(),
        this.deps.juridico.listarResultados(),
        this.deps.json.list(NS_ALOCACOES) as Promise<readonly AlocacaoProcesso[]>,
        this.deps.json.list(NS_LOTES) as Promise<readonly LoteCarteira[]>,
        comAdvogados
          ? this.deps.entregas().catch(() => [] as readonly EntregaAoAdvogado[])
          : Promise.resolve([] as readonly EntregaAoAdvogado[]),
      ]);
    const advogadoPorCliente = new Map<string, string>();
    for (const pasta of montarPastasPorAdvogado(entregas, clientes, contratos).pastas)
      for (const c of pasta.clientes)
        if (c.juridicoClienteId !== null && !advogadoPorCliente.has(c.juridicoClienteId))
          advogadoPorCliente.set(c.juridicoClienteId, pasta.advogado);
    return { contratos, clientes, andamentos, resultados, advogadoPorCliente, alocacoes, lotes };
  }

  /** Processos que podem entrar numa carteira: cadastrados no Jurídico com
   *  algum contrato ATIVO, sem desfecho lançado e fora de qualquer carteira. */
  private candidatos(d: DadosDaCarteira): ProcessoCandidato[] {
    const alocados = new Set(d.alocacoes.map((a) => a.numero.replace(/\D/g, '')));
    const encerrados = new Set(
      d.resultados
        .filter((r) => r.situacao !== 'em-andamento')
        .map((r) => r.numero.replace(/\D/g, '')),
    );
    const nomePor = new Map(d.clientes.map((c) => [c.id, c.nome]));
    const porNumero = new Map<
      string,
      { numero: string; clienteId: string; bancos: string[]; em: string; ativo: boolean }
    >();
    for (const c of d.contratos) {
      if (c.status === 'excluido') continue;
      const chave = c.processoNumero.replace(/\D/g, '');
      if (chave.length !== 20 || alocados.has(chave) || encerrados.has(chave)) continue;
      const p = porNumero.get(chave) ?? {
        numero: c.processoNumero,
        clienteId: c.clienteId,
        bancos: [],
        em: c.em,
        ativo: false,
      };
      if (c.banco !== '' && !p.bancos.includes(c.banco)) p.bancos.push(c.banco);
      if (c.em < p.em) p.em = c.em;
      if (c.status === 'ativo') p.ativo = true;
      porNumero.set(chave, p);
    }
    return [...porNumero.values()]
      .filter((p) => p.ativo)
      .map((p) => ({
        numero: numeroCnj(p.numero),
        clienteId: p.clienteId,
        clienteNome: nomePor.get(p.clienteId) ?? '—',
        bancos: p.bancos,
        advogado: d.advogadoPorCliente.get(p.clienteId) ?? null,
        cadastradoEm: p.em,
      }));
  }

  /** A PROPOSTA do Jarvis: `quantidade` processos espalhados por advogado,
   *  cliente e banco. Nada é gravado aqui. */
  async propostaCarteira(
    quantidade: number,
  ): Promise<{ itens: readonly ProcessoCandidato[]; disponiveis: number }> {
    const candidatos = this.candidatos(await this.dados());
    return { itens: selecionarProcessos(candidatos, quantidade), disponiveis: candidatos.length };
  }

  /** EXECUÇÃO (após a confirmação do dono): aloca os processos ao investidor
   *  como UMA carteira com o crédito comprado (null ⇒ processos × R$ 5.000).
   *  Quem ficou indisponível entre a proposta e a confirmação (outra carteira,
   *  desfecho lançado) é pulado e listado. */
  async alocar(
    cpfBruto: string,
    numeros: readonly string[],
    credito: number | null,
    por: string,
  ): Promise<
    ResultadoInvestidores<{ loteId: string; alocados: number; indisponiveis: readonly string[] }>
  > {
    const inv = await this.ativo(cpfBruto);
    if (inv === null) return { ok: false, error: 'investidor não encontrado ou inativo' };
    const d = await this.dados();
    const disponiveis = new Map(this.candidatos(d).map((c) => [c.numero.replace(/\D/g, ''), c]));
    const agora = this.agora();
    const loteId = `lote-${inv.cpf}-${String(this.deps.clock.now().getTime())}`;
    const alocados: string[] = [];
    const indisponiveis: string[] = [];
    for (const bruto of numeros) {
      const chave = bruto.replace(/\D/g, '');
      const c = disponiveis.get(chave);
      // Releitura na hora de gravar: processo nunca vai a duas carteiras.
      if (c === undefined || (await this.deps.json.get(NS_ALOCACOES, chave)) !== null) {
        indisponiveis.push(numeroCnj(bruto));
        continue;
      }
      await this.deps.json.put(NS_ALOCACOES, chave, {
        cpf: inv.cpf,
        loteId,
        numero: c.numero,
        clienteId: c.clienteId,
        clienteNome: c.clienteNome,
        bancos: c.bancos,
        advogado: c.advogado,
        cadastradoEm: c.cadastradoEm,
        alocadoEm: agora,
      } satisfies AlocacaoProcesso);
      disponiveis.delete(chave);
      alocados.push(c.numero);
    }
    if (alocados.length === 0)
      return { ok: false, error: 'nenhum dos processos está mais disponível — peça de novo' };
    await this.deps.json.put(NS_LOTES, loteId, {
      id: loteId,
      cpf: inv.cpf,
      criadoEm: agora,
      criadoPor: por,
      credito: credito ?? alocados.length * REFERENCIA_DO_INVESTIDOR,
      processos: alocados,
      retirados: [],
    } satisfies LoteCarteira);
    return { ok: true, valor: { loteId, alocados: alocados.length, indisponiveis } };
  }

  /** Tira um processo EM CURSO da carteira (erro de alocação, acordo com o
   *  investidor). Processo com desfecho lançado não sai — o valor já é dele. */
  async retirar(
    cpfBruto: string,
    numero: string,
    motivo: string,
    por: string,
  ): Promise<ResultadoInvestidores> {
    const cpf = normalizarCpf(cpfBruto);
    const chave = numero.replace(/\D/g, '');
    const alocacao = (await this.deps.json.get(NS_ALOCACOES, chave)) as AlocacaoProcesso | null;
    if (cpf === null || alocacao === null || alocacao.cpf !== cpf)
      return { ok: false, error: 'processo não está na carteira deste investidor' };
    const resultado = (await this.deps.juridico.listarResultados()).find(
      (r) => r.numero.replace(/\D/g, '') === chave,
    );
    if (resultado !== undefined && resultado.situacao !== 'em-andamento')
      return {
        ok: false,
        error:
          'processo com desfecho lançado não sai da carteira — o valor já pertence ao investidor',
      };
    await this.deps.json.del(NS_ALOCACOES, chave);
    const lote = (await this.deps.json.get(NS_LOTES, alocacao.loteId)) as LoteCarteira | null;
    if (lote !== null)
      await this.deps.json.put(NS_LOTES, lote.id, {
        ...lote,
        retirados: [
          ...lote.retirados,
          { numero: alocacao.numero, em: this.agora(), motivo: motivo.trim().slice(0, 300), por },
        ],
      } satisfies LoteCarteira);
    return { ok: true };
  }

  /** De quem é o processo (a ficha do Jurídico avisa antes de lançar o valor). */
  async investidorDoProcesso(numero: string): Promise<{ cpf: string; nome: string } | null> {
    const alocacao = (await this.deps.json.get(
      NS_ALOCACOES,
      numero.replace(/\D/g, ''),
    )) as AlocacaoProcesso | null;
    if (alocacao === null) return null;
    const inv = await this.investidor(alocacao.cpf);
    return { cpf: alocacao.cpf, nome: inv?.nome ?? '—' };
  }

  // ── Painel ──────────────────────────────────────────────────────────────────

  private painelDe(inv: Investidor, d: DadosDaCarteira, nomesCompletos: boolean): PainelInvestidor {
    return montarPainelInvestidor({
      investidor: inv,
      alocacoes: d.alocacoes,
      lotes: d.lotes,
      andamentos: d.andamentos,
      resultados: d.resultados,
      advogadoAtual: d.advogadoPorCliente,
      agora: this.deps.clock.now(),
      nomesCompletos,
    });
  }

  /** O painel. Para o INVESTIDOR (nomesCompletos=false) só se ativo e o cliente
   *  vai só por iniciais; o Admin vê os nomes (e investidores inativos). */
  async painel(cpfBruto: string, nomesCompletos = false): Promise<PainelInvestidor | null> {
    const inv = nomesCompletos ? await this.investidor(cpfBruto) : await this.ativo(cpfBruto);
    if (inv === null) return null;
    return this.painelDe(inv, await this.dados(), nomesCompletos);
  }
}
