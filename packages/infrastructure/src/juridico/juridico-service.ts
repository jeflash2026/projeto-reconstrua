// ─────────────────────────────────────────────────────────────────────────────
// PAINEL JURÍDICO (decreto 2026-08-08) — o SEGUNDO painel do Reconstrua: a
// gestão do PÓS-PROTOCOLO, espelhada do sistema "Contratos Advocacia" do dono
// (pulsetest.clsolucoes.com): clientes com cadastro civil completo, processos
// judiciais (nº CNJ → bancos → contratos), guias financeiras por mês e a
// agenda de perícias judiciais. Tudo com autoria ("criado por Juliano") e
// histórico auditado, como no original.
//
// Acesso: dono + sócio — usuários próprios (ns 'juridico-usuarios', senha
// scrypt). Dados em ns 'juridico-*' no MESMO JsonStore (Postgres) e anexos no
// MESMO media store content-addressed dos demais módulos.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import type { PublicacaoDjen } from './djen-client.js';
// O valor base do processo e a parte da empresa vêm da FONTE ÚNICA — os mesmos
// números do Painel do Investidor (decisão do dono, 2026-09-17).
import {
  PARTE_DA_EMPRESA,
  VALOR_REFERENCIA_PROCESSO as VALOR_BASE_PROCESSO,
} from '../comercial/parametros-do-processo.js';

const NS_USUARIOS = 'juridico-usuarios';
const NS_CLIENTES = 'juridico-clientes';
const NS_CONTRATOS = 'juridico-contratos';
const NS_GUIAS = 'juridico-guias';
const NS_PERICIAS = 'juridico-pericias';
const NS_HISTORICO = 'juridico-historico';
const MAX_EVENTOS = 400;
const MAX_ANEXO_BYTES = 10 * 1024 * 1024; // como no original: 10 MB por arquivo

export type ResultadoJuridico<T = undefined> =
  (T extends undefined ? { ok: true } : { ok: true; valor: T }) | { ok: false; error: string };

// ── Tipos persistidos ────────────────────────────────────────────────────────

export interface UsuarioJuridico {
  readonly id: string;
  readonly usuario: string;
  readonly nome: string;
  readonly salt: string;
  readonly hash: string;
  readonly em: string;
}

export interface AnexoJuridico {
  readonly id: string;
  readonly nome: string;
  readonly mime: string;
  readonly sha256: string;
  readonly size: number;
  readonly em: string;
}

export interface EnderecoJuridico {
  readonly logradouro: string;
  readonly numero: string;
  readonly bairro: string;
  readonly complemento: string;
  readonly cep: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface ClienteJuridico {
  readonly id: string;
  readonly nome: string;
  readonly nascimento: string;
  readonly sexo: string;
  readonly cpfCnpj: string;
  readonly rg: string;
  readonly orgaoEmissor: string;
  readonly ufEmissao: string;
  readonly email: string;
  readonly telefone: string;
  readonly celular1: string;
  readonly celular2: string;
  readonly endereco: EnderecoJuridico;
  readonly observacoes: string;
  readonly anexos: readonly AnexoJuridico[];
  readonly criadoPor: string;
  readonly em: string;
}

export type StatusContrato = 'ativo' | 'encerrado' | 'excluido';

export interface EventoContrato {
  readonly texto: string;
  readonly autor: string;
  readonly em: string;
}

export interface ContratoJuridico {
  readonly id: string;
  readonly clienteId: string;
  readonly processoNumero: string;
  readonly banco: string;
  readonly numero: string;
  /** Valor em reais (número decimal) — null quando não informado. */
  readonly valor: number | null;
  readonly assinatura: string | null;
  readonly inicio: string | null;
  readonly fimPrevisto: string | null;
  readonly observacoes: string;
  readonly status: StatusContrato;
  readonly encerramento: { readonly data: string; readonly motivo: string } | null;
  readonly exclusao: { readonly motivo: string; readonly em: string } | null;
  readonly anexos: readonly AnexoJuridico[];
  readonly historico: readonly EventoContrato[];
  readonly criadoPor: string;
  readonly em: string;
  readonly atualizadoEm: string;
}

export interface GuiaJuridica {
  readonly id: string;
  readonly processo: string;
  readonly nome: string;
  readonly advogado: string;
  readonly valor: number | null;
  readonly mes: string;
  readonly andamento: string;
  readonly criadoPor: string;
  readonly em: string;
}

export type SituacaoPericia =
  | 'agendada'
  | 'realizada'
  | 'reagendado'
  | 'pedir-reagendamento'
  | 'nao-compareceu'
  | 'audiencia-online'
  | 'cancelada';

export interface PericiaJuridica {
  readonly id: string;
  readonly processo: string;
  readonly assunto: string;
  readonly requerente: string;
  readonly requerido: string;
  readonly data: string | null;
  readonly horario: string | null;
  readonly local: string;
  readonly situacao: SituacaoPericia;
  readonly advogado: string;
  readonly andamento: string;
  readonly criadoPor: string;
  readonly em: string;
}

export interface EventoHistorico {
  readonly texto: string;
  readonly detalhe: string;
  readonly autor: string;
  readonly em: string;
}

export interface JuridicoDeps {
  readonly json: JsonStore;
  readonly media: MediaStorePort;
  readonly clock: Clock;
  /** DataJud (CNJ) — acompanhamento automático por nº CNJ (2026-08-08).
   *  Opcional: ausente ⇒ o botão "Atualizar andamentos" devolve erro legível. */
  readonly datajud?: {
    consultar(numeroCnj: string): Promise<AndamentoDatajud | null>;
  };
  /** DJEN (2026-09-10) — as COMUNICAÇÕES publicadas (distribuição, intimações
   *  com o texto do despacho). O eproc do TJSP não chega ao DataJud; o DJEN é
   *  quem traz os processos novos. Lança em falha (o erro vai literal à tela). */
  readonly djen?: {
    consultar(numeroCnj: string): Promise<readonly PublicacaoDjen[]>;
  };
}

/** Um ato do processo: movimentação (DataJud) ou comunicação publicada (DJEN). */
export interface MovimentoProcesso {
  readonly nome: string;
  readonly dataHora: string;
  /** DJEN: o texto da comunicação (despacho/decisão), já limpo. */
  readonly texto?: string;
  readonly link?: string | null;
  /** Ausente em registros antigos (= DataJud). */
  readonly fonte?: 'DATAJUD' | 'DJEN';
}

function chaveMovimento(m: MovimentoProcesso): string {
  return `${m.nome}|${m.dataHora}|${(m.texto ?? '').slice(0, 120)}`;
}

/** Junta as fontes: mais recentes primeiro, sem repetir o mesmo ato. */
function mesclarMovimentos(
  ...listas: readonly (readonly MovimentoProcesso[])[]
): MovimentoProcesso[] {
  const vistos = new Set<string>();
  const out: MovimentoProcesso[] = [];
  for (const m of listas.flat()) {
    const k = chaveMovimento(m);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(m);
  }
  return out.sort((a, b) => b.dataHora.localeCompare(a.dataHora)).slice(0, 40);
}

/** O primeiro texto não-vazio (capa: DataJud manda; DJEN completa). */
function primeiroTexto(...valores: readonly (string | null | undefined)[]): string {
  return valores.find((v): v is string => typeof v === 'string' && v !== '') ?? '';
}

/** O retrato de UM processo no DataJud (persistido em ns 'juridico-andamentos'). */
export interface AndamentoProcesso {
  readonly numero: string;
  readonly tribunal: string;
  readonly classe: string;
  readonly orgaoJulgador: string;
  readonly assunto: string;
  readonly grau: string;
  readonly dataAjuizamento: string;
  readonly ultimoMovimento: { readonly nome: string; readonly dataHora: string } | null;
  readonly movimentos: readonly MovimentoProcesso[];
  /** A classe indica fase de EXECUÇÃO (cumprimento de sentença)? */
  readonly emExecucao: boolean;
  /** O último movimento é MAIS NOVO que o da consulta anterior? */
  readonly novidade: boolean;
  readonly consultadoEm: string;
  readonly erro: string | null;
  /** VISTO do advogado (2026-08-08): dataHora do último movimento que alguém
   *  já conferiu — movimento mais novo que isto entra na fila de atenção. */
  readonly vistoAte?: string | null;
  readonly vistoPor?: string | null;
}

interface AndamentoDatajud {
  readonly numero: string;
  readonly tribunal: string;
  readonly classe: string;
  readonly orgaoJulgador: string;
  readonly assunto: string;
  readonly grau: string;
  readonly dataAjuizamento: string;
  readonly ultimoMovimento: { readonly nome: string; readonly dataHora: string } | null;
  readonly movimentos: readonly { readonly nome: string; readonly dataHora: string }[];
}

const NS_ANDAMENTOS = 'juridico-andamentos';
const NS_RESULTADOS = 'juridico-resultados';

/** RESULTADO DO PROCESSO (2026-09-16) — o valor REAL que o dono lança:
 *  APURADO na execução (já se sabe quanto o processo vai pagar, falta só o
 *  tempo processual), PAGO (recebido) — ambos com o valor TOTAL do processo,
 *  antes da divisão com o cliente — ou PERDIDO. Voltar para "em andamento"
 *  desfaz um lançamento errado. É a fonte do valor real na carteira dos
 *  investidores. */
export type SituacaoResultado = 'em-andamento' | 'apurado' | 'pago' | 'perdido';

export interface LancamentoResultado {
  readonly situacao: SituacaoResultado;
  /** Valor TOTAL do processo, apurado ou recebido (antes da divisão com o cliente). */
  readonly valorRecebido: number | null;
  /** AAAA-MM-DD do pagamento/encerramento. */
  readonly data: string | null;
  readonly observacao: string;
  readonly autor: string;
  readonly em: string;
}

export interface ResultadoProcesso extends LancamentoResultado {
  readonly numero: string;
  /** Todos os lançamentos, do mais antigo ao mais recente (o atual é o último). */
  readonly historico: readonly LancamentoResultado[];
}

// ── Validação de anexo (como no original: PDF/Word/Excel/imagens/TXT/CSV/ZIP) ─
const MAGIC: ReadonlyArray<{ mime: string; bytes: readonly number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  // PK = docx/xlsx/zip (todos são zip por dentro).
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

function id(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function limparNomeArquivo(bruto: string, fallback: string): string {
  return bruto.replace(/[^\w.\- ()]/g, '').slice(0, 120) || fallback;
}

function texto(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function valorNumerico(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100) / 100;
  if (typeof v === 'string') {
    // Aceita "1.234,56" (pt-BR) e "1234.56".
    const limpo = v.replace(/[^\d.,-]/g, '');
    if (limpo === '') return null;
    const normalizado = /,\d{1,2}$/.test(limpo)
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo.replace(/,/g, '');
    const n = Number(normalizado);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  return null;
}

/** PROCESSOS DISTRIBUÍDOS NO DIA (2026-09-10) — o card do dashboard. */
export interface DistribuidosNoDia {
  /** O dia civil em Brasília (AAAA-MM-DD). */
  readonly dia: string;
  readonly processos: number;
  readonly clientes: number;
  readonly itens: readonly {
    readonly processo: string;
    readonly banco: string;
    readonly clienteNome: string;
    readonly em: string;
  }[];
}

/** Dia civil em Brasília (UTC-3 fixo — sem horário de verão desde 2019). */
export function diaEmBrasilia(d: Date): string {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Processo = nº CNJ. Conta no dia em que o PRIMEIRO contrato dele foi
 *  cadastrado — contrato novo num processo antigo não conta de novo; os
 *  excluídos ficam fora. */
export function distribuidosNoDia(
  contratos: readonly ContratoJuridico[],
  nomePorCliente: ReadonlyMap<string, string>,
  agora: Date,
): DistribuidosNoDia {
  const hoje = diaEmBrasilia(agora);
  const primeiro = new Map<string, ContratoJuridico>();
  for (const c of contratos) {
    if (c.status === 'excluido') continue;
    const chave = c.processoNumero.replace(/\D/g, '');
    const atual = primeiro.get(chave);
    if (atual === undefined || c.em < atual.em) primeiro.set(chave, c);
  }
  const doDia = [...primeiro.values()]
    .filter((c) => diaEmBrasilia(new Date(c.em)) === hoje)
    .sort((a, b) => b.em.localeCompare(a.em));
  return {
    dia: hoje,
    processos: doDia.length,
    clientes: new Set(doDia.map((c) => c.clienteId)).size,
    itens: doDia.map((c) => ({
      processo: c.processoNumero,
      banco: c.banco,
      clienteNome: nomePorCliente.get(c.clienteId) ?? '—',
      em: c.em,
    })),
  };
}

/** Resultado de uma rodada de atualização dos andamentos. */
export type ResultadoAtualizacao =
  | { ok: true; consultados: number; encontrados: number; novidades: number; erros: number }
  | { ok: false; error: string };

export class JuridicoService {
  constructor(private readonly deps: JuridicoDeps) {}

  /** Rodada de atualização em curso — UMA por vez (2026-09-11): o job de 6h e
   *  o botão "Atualizar andamentos" não disputam o relay do DJEN, que limita
   *  as consultas do CNJ por IP. */
  private rodada: Promise<ResultadoAtualizacao> | null = null;
  private rodadaIniciadaEm: string | null = null;
  private ultimaRodada: (ResultadoAtualizacao & { terminouEm: string }) | null = null;

  private agora(): string {
    return this.deps.clock.now().toISOString();
  }

  // ── USUÁRIOS (dono + sócio) ────────────────────────────────────────────────

  async criarUsuario(usuario: string, nome: string, senha: string): Promise<ResultadoJuridico> {
    const login = texto(usuario, 60).toLowerCase();
    const nomeLimpo = texto(nome, 80);
    if (login === '' || nomeLimpo === '')
      return { ok: false, error: 'usuário e nome obrigatórios' };
    if (senha.length < 6) return { ok: false, error: 'senha muito curta (mínimo 6 caracteres)' };
    const existentes = (await this.deps.json.list(NS_USUARIOS)) as readonly UsuarioJuridico[];
    if (existentes.some((u) => u.usuario === login))
      return { ok: false, error: 'já existe um usuário com esse login' };
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(senha, salt, 32).toString('hex');
    const novo: UsuarioJuridico = {
      id: id('ju'),
      usuario: login,
      nome: nomeLimpo,
      salt,
      hash,
      em: this.agora(),
    };
    await this.deps.json.put(NS_USUARIOS, novo.id, novo);
    return { ok: true };
  }

  async login(
    usuario: string,
    senha: string,
  ): Promise<{ ok: true; id: string; nome: string } | { ok: false; error: string }> {
    const login = texto(usuario, 60).toLowerCase();
    const usuarios = (await this.deps.json.list(NS_USUARIOS)) as readonly UsuarioJuridico[];
    const alvo = usuarios.find((u) => u.usuario === login);
    if (alvo === undefined) return { ok: false, error: 'usuário ou senha inválidos' };
    const hash = scryptSync(senha, alvo.salt, 32);
    const esperado = Buffer.from(alvo.hash, 'hex');
    if (hash.length !== esperado.length || !timingSafeEqual(hash, esperado))
      return { ok: false, error: 'usuário ou senha inválidos' };
    return { ok: true, id: alvo.id, nome: alvo.nome };
  }

  async nomeDoUsuario(usuarioId: string): Promise<string | null> {
    const u = (await this.deps.json.get(NS_USUARIOS, usuarioId)) as UsuarioJuridico | null;
    return u?.nome ?? null;
  }

  /** Os acessos existentes (para o Painel Admin) — NUNCA expõe hash/salt. */
  async listarUsuarios(): Promise<
    readonly { id: string; usuario: string; nome: string; em: string }[]
  > {
    const usuarios = (await this.deps.json.list(NS_USUARIOS)) as readonly UsuarioJuridico[];
    return usuarios
      .map(({ id: usuarioId, usuario, nome, em }) => ({ id: usuarioId, usuario, nome, em }))
      .sort((a, b) => a.em.localeCompare(b.em));
  }

  async removerUsuario(usuarioId: string): Promise<ResultadoJuridico> {
    const u = (await this.deps.json.get(NS_USUARIOS, usuarioId)) as UsuarioJuridico | null;
    if (u === null) return { ok: false, error: 'acesso não encontrado' };
    await this.deps.json.del(NS_USUARIOS, usuarioId);
    return { ok: true };
  }

  // ── HISTÓRICO global (o feed do dashboard) ─────────────────────────────────

  private async registrarHistorico(
    textoEvento: string,
    detalhe: string,
    autor: string,
  ): Promise<void> {
    const atual = ((await this.deps.json.get(NS_HISTORICO, 'feed')) ?? { eventos: [] }) as {
      eventos: EventoHistorico[];
    };
    const eventos = [
      { texto: textoEvento, detalhe, autor, em: this.agora() },
      ...atual.eventos,
    ].slice(0, MAX_EVENTOS);
    await this.deps.json.put(NS_HISTORICO, 'feed', { eventos });
  }

  async historico(limite = 30): Promise<readonly EventoHistorico[]> {
    const atual = ((await this.deps.json.get(NS_HISTORICO, 'feed')) ?? { eventos: [] }) as {
      eventos: EventoHistorico[];
    };
    return atual.eventos.slice(0, limite);
  }

  // ── ANEXOS (validação como no original: 10 MB; PDF/imagem/Office/ZIP) ──────

  private async guardarAnexo(
    nomeBruto: string,
    base64: string,
  ): Promise<{ ok: true; anexo: AnexoJuridico } | { ok: false; error: string }> {
    let bytes: Buffer;
    try {
      const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
      bytes = Buffer.from(clean, 'base64');
    } catch {
      return { ok: false, error: 'arquivo inválido' };
    }
    if (bytes.length === 0) return { ok: false, error: 'arquivo vazio' };
    if (bytes.length > MAX_ANEXO_BYTES) return { ok: false, error: 'arquivo acima de 10 MB' };
    const nome = limparNomeArquivo(nomeBruto, 'anexo');
    const assinatura = MAGIC.find((m) => m.bytes.every((b, i) => bytes[i] === b));
    // TXT/CSV não têm magic bytes — aceitos pela extensão, como no original.
    const extensaoTexto = /\.(txt|csv)$/i.test(nome);
    const mime = assinatura?.mime ?? (extensaoTexto ? 'text/plain' : null);
    if (mime === null)
      return { ok: false, error: 'formato não aceito — PDF, Word, Excel, imagem, TXT, CSV ou ZIP' };
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!(await this.deps.media.has(sha256))) {
      await this.deps.media.put({ sha256, mime, size: bytes.length, bytes: new Uint8Array(bytes) });
    }
    return {
      ok: true,
      anexo: { id: id('ja'), nome, mime, sha256, size: bytes.length, em: this.agora() },
    };
  }

  private async lerAnexo(
    anexos: readonly AnexoJuridico[],
    anexoId: string,
  ): Promise<{ nome: string; mime: string; bytes: Uint8Array } | null> {
    const anexo = anexos.find((a) => a.id === anexoId);
    if (anexo === undefined) return null;
    const blob = await this.deps.media.read(anexo.sha256);
    if (blob === null) return null;
    return { nome: anexo.nome, mime: anexo.mime, bytes: blob.bytes };
  }

  // ── CLIENTES ───────────────────────────────────────────────────────────────

  async criarCliente(
    dados: Record<string, unknown>,
    autor: string,
  ): Promise<ResultadoJuridico<string>> {
    const nome = texto(dados['nome'], 160);
    if (nome === '') return { ok: false, error: 'nome do cliente é obrigatório' };
    const cliente: ClienteJuridico = {
      id: id('jc'),
      nome,
      nascimento: texto(dados['nascimento'], 10),
      sexo: texto(dados['sexo'], 20),
      cpfCnpj: texto(dados['cpfCnpj'], 20),
      rg: texto(dados['rg'], 20),
      orgaoEmissor: texto(dados['orgaoEmissor'], 20),
      ufEmissao: texto(dados['ufEmissao'], 2).toUpperCase(),
      email: texto(dados['email'], 120),
      telefone: texto(dados['telefone'], 20),
      celular1: texto(dados['celular1'], 20),
      celular2: texto(dados['celular2'], 20),
      endereco: {
        logradouro: texto(
          (dados['endereco'] as Record<string, unknown> | undefined)?.['logradouro'],
          160,
        ),
        numero: texto((dados['endereco'] as Record<string, unknown> | undefined)?.['numero'], 12),
        bairro: texto((dados['endereco'] as Record<string, unknown> | undefined)?.['bairro'], 80),
        complemento: texto(
          (dados['endereco'] as Record<string, unknown> | undefined)?.['complemento'],
          80,
        ),
        cep: texto((dados['endereco'] as Record<string, unknown> | undefined)?.['cep'], 10),
        cidade: texto((dados['endereco'] as Record<string, unknown> | undefined)?.['cidade'], 80),
        uf: texto(
          (dados['endereco'] as Record<string, unknown> | undefined)?.['uf'],
          2,
        ).toUpperCase(),
      },
      observacoes: texto(dados['observacoes'], 2000),
      anexos: [],
      criadoPor: autor,
      em: this.agora(),
    };
    await this.deps.json.put(NS_CLIENTES, cliente.id, cliente);
    await this.registrarHistorico('Cliente cadastrado.', nome, autor);
    return { ok: true, valor: cliente.id };
  }

  async atualizarCliente(
    clienteId: string,
    dados: Record<string, unknown>,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_CLIENTES, clienteId)) as ClienteJuridico | null;
    if (atual === null) return { ok: false, error: 'cliente não encontrado' };
    const criado = this.criarClienteDeEdicao(atual, dados);
    await this.deps.json.put(NS_CLIENTES, clienteId, criado);
    await this.registrarHistorico('Cliente atualizado.', criado.nome, autor);
    return { ok: true };
  }

  private criarClienteDeEdicao(
    atual: ClienteJuridico,
    dados: Record<string, unknown>,
  ): ClienteJuridico {
    const end = (dados['endereco'] ?? {}) as Record<string, unknown>;
    return {
      ...atual,
      nome: texto(dados['nome'], 160) || atual.nome,
      nascimento: texto(dados['nascimento'], 10),
      sexo: texto(dados['sexo'], 20),
      cpfCnpj: texto(dados['cpfCnpj'], 20),
      rg: texto(dados['rg'], 20),
      orgaoEmissor: texto(dados['orgaoEmissor'], 20),
      ufEmissao: texto(dados['ufEmissao'], 2).toUpperCase(),
      email: texto(dados['email'], 120),
      telefone: texto(dados['telefone'], 20),
      celular1: texto(dados['celular1'], 20),
      celular2: texto(dados['celular2'], 20),
      endereco: {
        logradouro: texto(end['logradouro'], 160),
        numero: texto(end['numero'], 12),
        bairro: texto(end['bairro'], 80),
        complemento: texto(end['complemento'], 80),
        cep: texto(end['cep'], 10),
        cidade: texto(end['cidade'], 80),
        uf: texto(end['uf'], 2).toUpperCase(),
      },
      observacoes: texto(dados['observacoes'], 2000),
    };
  }

  async listarClientes(): Promise<readonly ClienteJuridico[]> {
    const clientes = (await this.deps.json.list(NS_CLIENTES)) as readonly ClienteJuridico[];
    return [...clientes].sort((a, b) => b.em.localeCompare(a.em));
  }

  async obterCliente(clienteId: string): Promise<ClienteJuridico | null> {
    return (await this.deps.json.get(NS_CLIENTES, clienteId)) as ClienteJuridico | null;
  }

  async anexarAoCliente(
    clienteId: string,
    nomeArquivo: string,
    base64: string,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_CLIENTES, clienteId)) as ClienteJuridico | null;
    if (atual === null) return { ok: false, error: 'cliente não encontrado' };
    const guardado = await this.guardarAnexo(nomeArquivo, base64);
    if (!guardado.ok) return guardado;
    await this.deps.json.put(NS_CLIENTES, clienteId, {
      ...atual,
      anexos: [...atual.anexos, guardado.anexo],
    });
    await this.registrarHistorico('Anexo adicionado ao cliente.', atual.nome, autor);
    return { ok: true };
  }

  async anexoDoCliente(
    clienteId: string,
    anexoId: string,
  ): Promise<{ nome: string; mime: string; bytes: Uint8Array } | null> {
    const cliente = (await this.deps.json.get(NS_CLIENTES, clienteId)) as ClienteJuridico | null;
    if (cliente === null) return null;
    return this.lerAnexo(cliente.anexos, anexoId);
  }

  // ── PROCESSOS E CONTRATOS ──────────────────────────────────────────────────

  /** Cadastra um PROCESSO: nº CNJ + bancos, cada um com seus contratos —
   *  espelho do formulário "Novo processo" do original. Cada contrato vira um
   *  registro próprio (status/encerramento/anexos individuais). */
  async criarProcesso(
    dados: {
      clienteId: string;
      numero: string;
      status?: string;
      bancos: ReadonlyArray<{
        banco: string;
        contratos: ReadonlyArray<{
          numero: string;
          valor?: unknown;
          assinatura?: string;
          inicio?: string;
          fimPrevisto?: string;
          observacoes?: string;
        }>;
      }>;
    },
    autor: string,
  ): Promise<ResultadoJuridico> {
    const cliente = (await this.deps.json.get(
      NS_CLIENTES,
      dados.clienteId,
    )) as ClienteJuridico | null;
    if (cliente === null) return { ok: false, error: 'cliente não encontrado' };
    const numeroProcesso = texto(dados.numero, 40);
    if (numeroProcesso === '') return { ok: false, error: 'número do processo é obrigatório' };
    const status: StatusContrato = dados.status === 'encerrado' ? 'encerrado' : 'ativo';
    let cadastrados = 0;
    for (const bloco of dados.bancos) {
      const banco = texto(bloco.banco, 120);
      if (banco === '') continue;
      for (const c of bloco.contratos) {
        const numeroContrato = texto(c.numero, 40);
        if (numeroContrato === '') continue;
        const agora = this.agora();
        const contrato: ContratoJuridico = {
          id: id('jt'),
          clienteId: dados.clienteId,
          processoNumero: numeroProcesso,
          banco,
          numero: numeroContrato,
          valor: valorNumerico(c.valor),
          assinatura: texto(c.assinatura, 10) || null,
          inicio: texto(c.inicio, 10) || null,
          fimPrevisto: texto(c.fimPrevisto, 10) || null,
          observacoes: texto(c.observacoes, 2000),
          status,
          encerramento: null,
          exclusao: null,
          anexos: [],
          historico: [{ texto: 'Contrato cadastrado.', autor, em: agora }],
          criadoPor: autor,
          em: agora,
          atualizadoEm: agora,
        };
        await this.deps.json.put(NS_CONTRATOS, contrato.id, contrato);
        cadastrados += 1;
      }
    }
    if (cadastrados === 0) return { ok: false, error: 'nenhum contrato válido no cadastro' };
    await this.registrarHistorico(
      'Contrato cadastrado.',
      `${cliente.nome} · ${numeroProcesso}`,
      autor,
    );
    return { ok: true };
  }

  async listarContratos(): Promise<readonly ContratoJuridico[]> {
    const contratos = (await this.deps.json.list(NS_CONTRATOS)) as readonly ContratoJuridico[];
    return [...contratos].sort((a, b) => b.em.localeCompare(a.em));
  }

  async obterContrato(contratoId: string): Promise<ContratoJuridico | null> {
    return (await this.deps.json.get(NS_CONTRATOS, contratoId)) as ContratoJuridico | null;
  }

  async editarContrato(
    contratoId: string,
    dados: Record<string, unknown>,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_CONTRATOS, contratoId)) as ContratoJuridico | null;
    if (atual === null) return { ok: false, error: 'contrato não encontrado' };
    const agora = this.agora();
    const editado: ContratoJuridico = {
      ...atual,
      banco: texto(dados['banco'], 120) || atual.banco,
      numero: texto(dados['numero'], 40) || atual.numero,
      processoNumero: texto(dados['processoNumero'], 40) || atual.processoNumero,
      valor: dados['valor'] !== undefined ? valorNumerico(dados['valor']) : atual.valor,
      assinatura: texto(dados['assinatura'], 10) || atual.assinatura,
      inicio: texto(dados['inicio'], 10) || atual.inicio,
      fimPrevisto: texto(dados['fimPrevisto'], 10) || atual.fimPrevisto,
      observacoes:
        dados['observacoes'] !== undefined ? texto(dados['observacoes'], 2000) : atual.observacoes,
      historico: [...atual.historico, { texto: 'Contrato editado.', autor, em: agora }],
      atualizadoEm: agora,
    };
    await this.deps.json.put(NS_CONTRATOS, contratoId, editado);
    return { ok: true };
  }

  async encerrarContrato(
    contratoId: string,
    data: string,
    motivo: string,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_CONTRATOS, contratoId)) as ContratoJuridico | null;
    if (atual === null) return { ok: false, error: 'contrato não encontrado' };
    if (atual.status === 'excluido') return { ok: false, error: 'contrato está nos excluídos' };
    const agora = this.agora();
    await this.deps.json.put(NS_CONTRATOS, contratoId, {
      ...atual,
      status: 'encerrado',
      encerramento: { data: texto(data, 10), motivo: texto(motivo, 500) },
      historico: [
        ...atual.historico,
        { texto: `Contrato encerrado. ${texto(motivo, 200)}`.trim(), autor, em: agora },
      ],
      atualizadoEm: agora,
    } satisfies ContratoJuridico);
    await this.registrarHistorico('Contrato encerrado.', `${atual.banco} · ${atual.numero}`, autor);
    return { ok: true };
  }

  async excluirContrato(
    contratoId: string,
    motivo: string,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_CONTRATOS, contratoId)) as ContratoJuridico | null;
    if (atual === null) return { ok: false, error: 'contrato não encontrado' };
    const agora = this.agora();
    await this.deps.json.put(NS_CONTRATOS, contratoId, {
      ...atual,
      status: 'excluido',
      exclusao: { motivo: texto(motivo, 500), em: agora },
      historico: [
        ...atual.historico,
        { texto: `Movido para excluídos. ${texto(motivo, 200)}`.trim(), autor, em: agora },
      ],
      atualizadoEm: agora,
    } satisfies ContratoJuridico);
    await this.registrarHistorico(
      'Contrato movido para excluídos.',
      `${atual.banco} · ${atual.numero}`,
      autor,
    );
    return { ok: true };
  }

  async anexarAoContrato(
    contratoId: string,
    nomeArquivo: string,
    base64: string,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_CONTRATOS, contratoId)) as ContratoJuridico | null;
    if (atual === null) return { ok: false, error: 'contrato não encontrado' };
    const guardado = await this.guardarAnexo(nomeArquivo, base64);
    if (!guardado.ok) return guardado;
    const agora = this.agora();
    await this.deps.json.put(NS_CONTRATOS, contratoId, {
      ...atual,
      anexos: [...atual.anexos, guardado.anexo],
      historico: [...atual.historico, { texto: 'Anexo adicionado.', autor, em: agora }],
      atualizadoEm: agora,
    } satisfies ContratoJuridico);
    return { ok: true };
  }

  async anexoDoContrato(
    contratoId: string,
    anexoId: string,
  ): Promise<{ nome: string; mime: string; bytes: Uint8Array } | null> {
    const contrato = (await this.deps.json.get(
      NS_CONTRATOS,
      contratoId,
    )) as ContratoJuridico | null;
    if (contrato === null) return null;
    return this.lerAnexo(contrato.anexos, anexoId);
  }

  // ── GUIAS ──────────────────────────────────────────────────────────────────

  async criarGuia(dados: Record<string, unknown>, autor: string): Promise<ResultadoJuridico> {
    const processo = texto(dados['processo'], 40);
    const nome = texto(dados['nome'], 160);
    const mes = texto(dados['mes'], 12);
    if (processo === '' || nome === '' || mes === '')
      return { ok: false, error: 'processo, nome e mês são obrigatórios' };
    const guia: GuiaJuridica = {
      id: id('jg'),
      processo,
      nome,
      advogado: texto(dados['advogado'], 80),
      valor: valorNumerico(dados['valor']),
      mes,
      andamento: texto(dados['andamento'], 500),
      criadoPor: autor,
      em: this.agora(),
    };
    await this.deps.json.put(NS_GUIAS, guia.id, guia);
    await this.registrarHistorico('Guia lançada.', `${nome} · ${processo}`, autor);
    return { ok: true };
  }

  async atualizarGuia(
    guiaId: string,
    dados: Record<string, unknown>,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_GUIAS, guiaId)) as GuiaJuridica | null;
    if (atual === null) return { ok: false, error: 'guia não encontrada' };
    await this.deps.json.put(NS_GUIAS, guiaId, {
      ...atual,
      processo: texto(dados['processo'], 40) || atual.processo,
      nome: texto(dados['nome'], 160) || atual.nome,
      advogado: dados['advogado'] !== undefined ? texto(dados['advogado'], 80) : atual.advogado,
      valor: dados['valor'] !== undefined ? valorNumerico(dados['valor']) : atual.valor,
      mes: texto(dados['mes'], 12) || atual.mes,
      andamento:
        dados['andamento'] !== undefined ? texto(dados['andamento'], 500) : atual.andamento,
    } satisfies GuiaJuridica);
    await this.registrarHistorico('Guia atualizada.', `${atual.nome} · ${atual.processo}`, autor);
    return { ok: true };
  }

  async removerGuia(guiaId: string, autor: string): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_GUIAS, guiaId)) as GuiaJuridica | null;
    if (atual === null) return { ok: false, error: 'guia não encontrada' };
    await this.deps.json.del(NS_GUIAS, guiaId);
    await this.registrarHistorico('Guia removida.', `${atual.nome} · ${atual.processo}`, autor);
    return { ok: true };
  }

  async listarGuias(): Promise<readonly GuiaJuridica[]> {
    const guias = (await this.deps.json.list(NS_GUIAS)) as readonly GuiaJuridica[];
    return [...guias].sort((a, b) => b.em.localeCompare(a.em));
  }

  // ── PERÍCIAS ───────────────────────────────────────────────────────────────

  async criarPericia(dados: Record<string, unknown>, autor: string): Promise<ResultadoJuridico> {
    const processo = texto(dados['processo'], 40);
    const requerente = texto(dados['requerente'], 160);
    const situacao = texto(dados['situacao'], 30) as SituacaoPericia;
    if (processo === '' || requerente === '' || situacao === ('' as SituacaoPericia))
      return { ok: false, error: 'processo, requerente e situação são obrigatórios' };
    const pericia: PericiaJuridica = {
      id: id('jp'),
      processo,
      assunto: texto(dados['assunto'], 160),
      requerente,
      requerido: texto(dados['requerido'], 160),
      data: texto(dados['data'], 10) || null,
      horario: texto(dados['horario'], 5) || null,
      local: texto(dados['local'], 160),
      situacao,
      advogado: texto(dados['advogado'], 80),
      andamento: texto(dados['andamento'], 1000),
      criadoPor: autor,
      em: this.agora(),
    };
    await this.deps.json.put(NS_PERICIAS, pericia.id, pericia);
    await this.registrarHistorico('Perícia cadastrada.', `${requerente} · ${processo}`, autor);
    return { ok: true };
  }

  async atualizarPericia(
    periciaId: string,
    dados: Record<string, unknown>,
    autor: string,
  ): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_PERICIAS, periciaId)) as PericiaJuridica | null;
    if (atual === null) return { ok: false, error: 'perícia não encontrada' };
    await this.deps.json.put(NS_PERICIAS, periciaId, {
      ...atual,
      processo: texto(dados['processo'], 40) || atual.processo,
      assunto: dados['assunto'] !== undefined ? texto(dados['assunto'], 160) : atual.assunto,
      requerente: texto(dados['requerente'], 160) || atual.requerente,
      requerido:
        dados['requerido'] !== undefined ? texto(dados['requerido'], 160) : atual.requerido,
      data: dados['data'] !== undefined ? texto(dados['data'], 10) || null : atual.data,
      horario: dados['horario'] !== undefined ? texto(dados['horario'], 5) || null : atual.horario,
      local: dados['local'] !== undefined ? texto(dados['local'], 160) : atual.local,
      situacao: (texto(dados['situacao'], 30) as SituacaoPericia) || atual.situacao,
      advogado: dados['advogado'] !== undefined ? texto(dados['advogado'], 80) : atual.advogado,
      andamento:
        dados['andamento'] !== undefined ? texto(dados['andamento'], 1000) : atual.andamento,
    } satisfies PericiaJuridica);
    await this.registrarHistorico(
      'Perícia atualizada.',
      `${atual.requerente} · ${atual.processo}`,
      autor,
    );
    return { ok: true };
  }

  async removerPericia(periciaId: string, autor: string): Promise<ResultadoJuridico> {
    const atual = (await this.deps.json.get(NS_PERICIAS, periciaId)) as PericiaJuridica | null;
    if (atual === null) return { ok: false, error: 'perícia não encontrada' };
    await this.deps.json.del(NS_PERICIAS, periciaId);
    await this.registrarHistorico(
      'Perícia removida.',
      `${atual.requerente} · ${atual.processo}`,
      autor,
    );
    return { ok: true };
  }

  async listarPericias(): Promise<readonly PericiaJuridica[]> {
    const pericias = (await this.deps.json.list(NS_PERICIAS)) as readonly PericiaJuridica[];
    return [...pericias].sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'));
  }

  // ── ACOMPANHAMENTO AUTOMÁTICO (DataJud/CNJ, 2026-08-08) ───────────────────
  // Somente LEITURA de dados públicos: classe, órgão julgador e movimentações
  // de cada processo ativo — o painel para de depender de digitação manual.

  async listarAndamentos(): Promise<readonly AndamentoProcesso[]> {
    return (await this.deps.json.list(NS_ANDAMENTOS)) as readonly AndamentoProcesso[];
  }

  /** Consulta AVULSA de um nº CNJ (tela de novo processo): devolve a capa
   *  pública na hora — classe, órgão, assunto, ajuizamento e movimentações.
   *  Nada é gravado; o cadastro continua sendo um ato explícito do usuário. */
  async consultarProcesso(
    numeroCnj: string,
  ): Promise<{ ok: true; capa: AndamentoDatajud } | { ok: false; error: string }> {
    const datajud = this.deps.datajud;
    if (datajud === undefined)
      return { ok: false, error: 'DataJud não configurado nesta montagem' };
    const digitos = numeroCnj.replace(/\D/g, '');
    if (digitos.length !== 20)
      return { ok: false, error: 'número CNJ inválido — precisa ter 20 dígitos' };
    try {
      const capa = await datajud.consultar(numeroCnj);
      if (capa === null)
        return {
          ok: false,
          error:
            'processo não encontrado no DataJud — confira o número (processos novos podem levar dias para indexar)',
        };
      return { ok: true, capa };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Consulta TODOS os processos com contrato não-excluído — DataJud (capa e
   *  movimentações) + DJEN (publicações: distribuição e intimações com o texto)
   *  — e grava o retrato de cada um. O eproc do TJSP não chega ao DataJud
   *  (2026-09-10): o DJEN é quem traz os processos novos. Ritmo suave.
   *  Uma rodada por vez: quem chama durante uma rodada recebe a MESMA. */
  atualizarAndamentos(): Promise<ResultadoAtualizacao> {
    if (this.rodada !== null) return this.rodada;
    this.rodadaIniciadaEm = this.agora();
    this.rodada = this.executarAtualizacao()
      .then((r) => {
        this.ultimaRodada = { ...r, terminouEm: this.agora() };
        return r;
      })
      .finally(() => {
        this.rodada = null;
        this.rodadaIniciadaEm = null;
      });
    return this.rodada;
  }

  /** Estado da atualização para a tela — a rodada leva minutos (o relay do
   *  DJEN pede ~3,5 s entre processos). */
  statusAtualizacao(): {
    atualizando: boolean;
    iniciadaEm: string | null;
    ultima: (ResultadoAtualizacao & { terminouEm: string }) | null;
  } {
    return {
      atualizando: this.rodada !== null,
      iniciadaEm: this.rodadaIniciadaEm,
      ultima: this.ultimaRodada,
    };
  }

  private async executarAtualizacao(): Promise<ResultadoAtualizacao> {
    const { datajud, djen } = this.deps;
    if (datajud === undefined && djen === undefined)
      return { ok: false, error: 'acompanhamento (DataJud/DJEN) não configurado nesta montagem' };
    const contratos = await this.listarContratos();
    const numeros = [
      ...new Set(contratos.filter((c) => c.status !== 'excluido').map((c) => c.processoNumero)),
    ];
    const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
    let encontrados = 0;
    let novidades = 0;
    let erros = 0;
    for (const numero of numeros) {
      const chave = numero.replace(/\D/g, '');
      const anterior = (await this.deps.json.get(NS_ANDAMENTOS, chave)) as AndamentoProcesso | null;

      let retrato: AndamentoDatajud | null = null;
      let erroDatajud: string | null = null;
      if (datajud !== undefined) {
        try {
          retrato = await datajud.consultar(numero);
        } catch (e) {
          erroDatajud = mensagem(e);
        }
      }
      // null = o DJEN não respondeu nesta rodada (mantém o que já estava guardado).
      let publicacoes: readonly PublicacaoDjen[] | null = null;
      let erroDjen: string | null = null;
      if (djen !== undefined) {
        try {
          publicacoes = await djen.consultar(numero);
        } catch (e) {
          erroDjen = mensagem(e);
        }
      }

      const anteriores = anterior?.movimentos ?? [];
      const doDatajud: readonly MovimentoProcesso[] =
        retrato !== null
          ? retrato.movimentos.map((m) => ({ ...m, fonte: 'DATAJUD' as const }))
          : anteriores.filter((m) => m.fonte !== 'DJEN');
      const doDjen: readonly MovimentoProcesso[] =
        publicacoes !== null
          ? publicacoes.map((p) => ({
              nome: `DJEN · ${p.tipo}`,
              dataHora: `${p.data}T12:00:00.000Z`,
              texto: p.texto,
              link: p.link,
              fonte: 'DJEN' as const,
            }))
          : anteriores.filter((m) => m.fonte === 'DJEN');
      const movimentos = mesclarMovimentos(doDatajud, doDjen);

      const achou = retrato !== null || (publicacoes !== null && publicacoes.length > 0);
      if (!achou) {
        const falhas = [
          erroDatajud !== null ? `DataJud: ${erroDatajud}` : null,
          erroDjen !== null ? `DJEN: ${erroDjen}` : null,
        ].filter((f): f is string => f !== null);
        if (falhas.length > 0) erros += 1;
        await this.deps.json.put(NS_ANDAMENTOS, chave, {
          numero,
          tribunal: anterior?.tribunal ?? '',
          classe: anterior?.classe ?? '',
          orgaoJulgador: anterior?.orgaoJulgador ?? '',
          assunto: anterior?.assunto ?? '',
          grau: anterior?.grau ?? '',
          dataAjuizamento: anterior?.dataAjuizamento ?? '',
          ultimoMovimento: anterior?.ultimoMovimento ?? null,
          movimentos,
          emExecucao: anterior?.emExecucao ?? false,
          novidade: false,
          consultadoEm: this.agora(),
          erro:
            falhas.length > 0
              ? falhas.join(' · ')
              : 'ainda sem registro: não indexado no DataJud e sem publicação no DJEN',
          vistoAte: anterior?.vistoAte ?? null,
          vistoPor: anterior?.vistoPor ?? null,
        } satisfies AndamentoProcesso);
      } else {
        encontrados += 1;
        // Novidade = qualquer ato que ainda não estava registrado (duas
        // publicações no MESMO dia também contam).
        const jaTinha = new Set(anteriores.map(chaveMovimento));
        const novidade =
          anterior !== null && movimentos.some((m) => !jaTinha.has(chaveMovimento(m)));
        if (novidade) novidades += 1;
        const capaDjen = publicacoes?.[0] ?? null;
        const classe = primeiroTexto(retrato?.classe, capaDjen?.classe, anterior?.classe);
        const topo = movimentos[0] ?? null;
        await this.deps.json.put(NS_ANDAMENTOS, chave, {
          numero,
          tribunal: primeiroTexto(retrato?.tribunal, capaDjen?.tribunal, anterior?.tribunal),
          classe,
          orgaoJulgador: primeiroTexto(
            retrato?.orgaoJulgador,
            capaDjen?.orgao,
            anterior?.orgaoJulgador,
          ),
          assunto: primeiroTexto(retrato?.assunto, anterior?.assunto),
          grau: primeiroTexto(retrato?.grau, anterior?.grau),
          dataAjuizamento: primeiroTexto(retrato?.dataAjuizamento, anterior?.dataAjuizamento),
          ultimoMovimento: topo === null ? null : { nome: topo.nome, dataHora: topo.dataHora },
          movimentos,
          emExecucao: /cumprimento de senten|execu[çc][ãa]o/i.test(classe),
          novidade,
          consultadoEm: this.agora(),
          erro: null,
          vistoAte: anterior?.vistoAte ?? null,
          vistoPor: anterior?.vistoPor ?? null,
        } satisfies AndamentoProcesso);
      }
      // Ritmo suave com as APIs públicas do CNJ.
      await new Promise((r) => setTimeout(r, 400));
    }
    await this.registrarHistorico(
      'Andamentos atualizados (DataJud + DJEN).',
      `${String(numeros.length)} processo(s) consultado(s), ${String(novidades)} com novidade`,
      'Acompanhamento',
    );
    return { ok: true, consultados: numeros.length, encontrados, novidades, erros };
  }

  // ── FILA DE MOVIMENTAÇÕES (2026-08-08) — processo que se mexeu entra na
  //    fila; sai quando o advogado dá o VISTO (assinado). Qualquer movimento
  //    conta — a fila é a caixa de entrada judicial do escritório. ───────────

  async filaMovimentacoes(): Promise<
    readonly {
      numero: string;
      clienteNome: string;
      classe: string;
      orgaoJulgador: string;
      ultimoMovimento: { nome: string; dataHora: string };
      /** Movimentos AINDA NÃO vistos (mais novos que o último visto). */
      naoVistos: readonly MovimentoProcesso[];
      pendente: boolean;
      vistoPor: string | null;
      vistoAte: string | null;
    }[]
  > {
    const [andamentos, contratos, clientes] = await Promise.all([
      this.listarAndamentos(),
      this.listarContratos(),
      this.listarClientes(),
    ]);
    const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));
    const clientesPorProcesso = new Map<string, string>();
    for (const c of contratos) {
      if (c.status === 'excluido') continue;
      const chave = c.processoNumero.replace(/\D/g, '');
      if (!clientesPorProcesso.has(chave))
        clientesPorProcesso.set(chave, nomePorCliente.get(c.clienteId) ?? '—');
    }
    return andamentos
      .filter((a) => a.ultimoMovimento !== null)
      .map((a) => {
        const vistoAte = a.vistoAte ?? null;
        const naoVistos = a.movimentos.filter((m) => vistoAte === null || m.dataHora > vistoAte);
        return {
          numero: a.numero,
          clienteNome: clientesPorProcesso.get(a.numero.replace(/\D/g, '')) ?? '—',
          classe: a.classe,
          orgaoJulgador: a.orgaoJulgador,
          ultimoMovimento: a.ultimoMovimento as { nome: string; dataHora: string },
          naoVistos: naoVistos.slice(0, 8),
          pendente: naoVistos.length > 0,
          vistoPor: a.vistoPor ?? null,
          vistoAte,
        };
      })
      .sort((x, y) => y.ultimoMovimento.dataHora.localeCompare(x.ultimoMovimento.dataHora));
  }

  /** O advogado CONFERIU o processo: tudo até o último movimento vira visto. */
  async darVisto(numeroCnj: string, autor: string): Promise<ResultadoJuridico> {
    const chave = numeroCnj.replace(/\D/g, '');
    const atual = (await this.deps.json.get(NS_ANDAMENTOS, chave)) as AndamentoProcesso | null;
    if (atual === null) return { ok: false, error: 'processo sem acompanhamento registrado' };
    await this.deps.json.put(NS_ANDAMENTOS, chave, {
      ...atual,
      vistoAte: atual.ultimoMovimento?.dataHora ?? this.agora(),
      vistoPor: autor,
      novidade: false,
    } satisfies AndamentoProcesso);
    await this.registrarHistorico(
      'Visto em movimentação.',
      `${numeroCnj} — até ${atual.ultimoMovimento?.dataHora.slice(0, 10) ?? 'hoje'}`,
      autor,
    );
    return { ok: true };
  }

  // ── RESULTADO DO PROCESSO (2026-09-16) ─────────────────────────────────────

  async listarResultados(): Promise<readonly ResultadoProcesso[]> {
    return (await this.deps.json.list(NS_RESULTADOS)) as readonly ResultadoProcesso[];
  }

  async resultadoDoProcesso(numeroCnj: string): Promise<ResultadoProcesso | null> {
    return (await this.deps.json.get(
      NS_RESULTADOS,
      numeroCnj.replace(/\D/g, ''),
    )) as ResultadoProcesso | null;
  }

  /** Lança (ou corrige) o desfecho de um processo cadastrado. Pago exige o
   *  valor total recebido; perdido zera; em andamento desfaz. Cada lançamento
   *  fica no histórico — o extrato do investidor mostra as correções. */
  async registrarResultado(
    numeroCnj: string,
    dados: { situacao?: unknown; valorRecebido?: unknown; data?: unknown; observacao?: unknown },
    autor: string,
  ): Promise<ResultadoJuridico<ResultadoProcesso>> {
    const chave = numeroCnj.replace(/\D/g, '');
    const contrato = (await this.listarContratos()).find(
      (c) => c.status !== 'excluido' && c.processoNumero.replace(/\D/g, '') === chave,
    );
    if (contrato === undefined) return { ok: false, error: 'processo não encontrado' };
    const situacao = dados.situacao;
    if (
      situacao !== 'em-andamento' &&
      situacao !== 'apurado' &&
      situacao !== 'pago' &&
      situacao !== 'perdido'
    )
      return {
        ok: false,
        error: 'situação inválida — use valor apurado, pago, perdido ou em andamento',
      };
    const comValor = situacao === 'pago' || situacao === 'apurado';
    const valor = comValor ? valorNumerico(dados.valorRecebido) : null;
    if (comValor && (valor === null || valor <= 0))
      return {
        ok: false,
        error:
          situacao === 'pago'
            ? 'informe o valor total recebido no processo'
            : 'informe o valor total apurado do processo',
      };
    const dataBruta = texto(dados.data, 10);
    if (dataBruta !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(dataBruta))
      return { ok: false, error: 'data inválida — use AAAA-MM-DD' };
    const anterior = await this.resultadoDoProcesso(chave);
    if (anterior === null && situacao === 'em-andamento')
      return { ok: false, error: 'o processo já está em andamento' };
    const lancamento: LancamentoResultado = {
      situacao,
      valorRecebido: situacao === 'perdido' ? 0 : valor,
      data: situacao === 'em-andamento' ? null : dataBruta || diaEmBrasilia(this.deps.clock.now()),
      observacao: texto(dados.observacao, 500),
      autor,
      em: this.agora(),
    };
    const resultado: ResultadoProcesso = {
      ...lancamento,
      numero: contrato.processoNumero,
      historico: [...(anterior?.historico ?? []), lancamento],
    };
    await this.deps.json.put(NS_RESULTADOS, chave, resultado);
    const reais = (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const rotulo =
      situacao === 'pago'
        ? `pago — ${reais}`
        : situacao === 'apurado'
          ? `valor apurado na execução — ${reais}`
          : situacao === 'perdido'
            ? 'encerrado sem êxito'
            : 'voltou para em andamento';
    await this.registrarHistorico(
      'Resultado do processo lançado.',
      `${contrato.processoNumero} — ${rotulo}`,
      autor,
    );
    return { ok: true, valor: resultado };
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────

  /** Movimentações que MERECEM alerta no dashboard (com o nome do cliente):
   *  fase de execução, dinheiro entrando, sentença, constrição e acordo. */
  private static readonly TIPOS_IMPORTANTES: ReadonlyArray<readonly [RegExp, string]> = [
    [
      /alvar[áa]|levantamento|dep[óo]sito judicial|pagamento|\brpv\b|precat[óo]rio|requisi[çc][ãa]o de pequeno valor/i,
      '💰 Recebimento',
    ],
    [/cumprimento de senten|execu[çc][ãa]o/i, '⚡ Execução'],
    [/tr[âa]nsito em julgado/i, '✅ Trânsito em julgado'],
    [/senten[çc]a|julgamento|procedente/i, '⚖ Sentença'],
    [/penhora|bloqueio|arresto|indisponibilidade/i, '🔒 Constrição'],
    [/acordo|homologa[çc][ãa]o/i, '🤝 Acordo'],
    // DJEN (2026-09-10): intimação publicada = prazo correndo para o advogado.
    [/^DJEN · Intima[çc][ãa]o/i, '📬 Intimação'],
  ];

  /** O valor da carteira ATIVA: base de R$ 10.000 por processo, corrigida pelo
   *  valor real de quem já teve o desfecho lançado (apurado/pago manda; sem
   *  êxito zera). Conta por nº CNJ — dois contratos do mesmo processo não
   *  contam duas vezes. Pura: recebe o que já foi lido do disco. */
  private static valorDaCarteira(
    contratos: readonly ContratoJuridico[],
    resultados: readonly ResultadoProcesso[],
  ): {
    processos: number;
    base: number;
    corrigido: number;
    comValorReal: number;
    empresa: number;
  } {
    const centavos = (v: number): number => Math.round(v * 100) / 100;
    const porNumero = new Map(resultados.map((r) => [r.numero.replace(/\D/g, ''), r]));
    const ativos = new Set(
      contratos
        .filter((c) => c.status === 'ativo')
        .map((c) => c.processoNumero.replace(/\D/g, ''))
        .filter((n) => n !== ''),
    );
    let corrigido = 0;
    let comValorReal = 0;
    for (const numero of ativos) {
      const r = porNumero.get(numero);
      if (r?.situacao === 'apurado' || r?.situacao === 'pago') {
        corrigido += r.valorRecebido ?? 0;
        comValorReal += 1;
      } else if (r?.situacao === 'perdido') {
        comValorReal += 1;
      } else {
        corrigido += VALOR_BASE_PROCESSO;
      }
    }
    return {
      processos: ativos.size,
      base: centavos(ativos.size * VALOR_BASE_PROCESSO),
      corrigido: centavos(corrigido),
      comValorReal,
      empresa: centavos(corrigido * PARTE_DA_EMPRESA),
    };
  }

  async dashboard(): Promise<{
    clientes: number;
    contratos: number;
    ativos: number;
    encerrados: number;
    excluidos: number;
    /** Valor dos processos ativos: a BASE de cada um, já CORRIGIDA pelo valor
     *  real de quem chegou à execução (apurado/pago) — perdido vale zero. */
    valorAtivos: number;
    /** A referência crua: processos ativos × R$ 10.000 (sem correção). */
    valorBase: number;
    /** Processos ativos distintos (nº CNJ) — a base conta por processo. */
    processosAtivos: number;
    /** Quantos já têm valor real lançado (apurado, pago ou sem êxito). */
    comValorReal: number;
    /** A parte da empresa sobre o valor corrigido. */
    valorEmpresa: number;
    /** A fração usada (0.49) — o painel mostra o percentual sem repetir a regra. */
    parteDaEmpresa: number;
    guias: { total: number; valor: number };
    periciasProximas: readonly PericiaJuridica[];
    alertas: readonly {
      tipo: string;
      clienteNome: string;
      processo: string;
      movimento: string;
      dataHora: string;
      novidade: boolean;
    }[];
    movimentacoesPendentes: number;
    ultimaConsultaDatajud: string | null;
    recentes: readonly (ContratoJuridico & { clienteNome: string })[];
    porBanco: readonly { banco: string; total: number }[];
    historico: readonly EventoHistorico[];
    distribuidosHoje: DistribuidosNoDia;
  }> {
    const [clientes, contratos, eventos, guias, pericias, andamentos, resultados] =
      await Promise.all([
        this.listarClientes(),
        this.listarContratos(),
        this.historico(12),
        this.listarGuias(),
        this.listarPericias(),
        this.listarAndamentos(),
        this.listarResultados(),
      ]);
    const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));
    const naoExcluidos = contratos.filter((c) => c.status !== 'excluido');
    const porBanco = new Map<string, number>();
    for (const c of naoExcluidos) porBanco.set(c.banco, (porBanco.get(c.banco) ?? 0) + 1);

    // ALERTAS (2026-08-08): movimentação IMPORTANTE nos últimos 60 dias — o
    // dashboard fala o cliente e a situação (execução, recebimento, sentença…).
    const clientesPorProcesso = new Map<string, string>();
    for (const c of naoExcluidos) {
      const chave = c.processoNumero.replace(/\D/g, '');
      if (!clientesPorProcesso.has(chave))
        clientesPorProcesso.set(chave, nomePorCliente.get(c.clienteId) ?? '—');
    }
    const corte = new Date(this.deps.clock.now().getTime() - 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const alertas: {
      tipo: string;
      clienteNome: string;
      processo: string;
      movimento: string;
      dataHora: string;
      novidade: boolean;
    }[] = [];
    for (const a of andamentos) {
      if (a.erro !== null && a.movimentos.length === 0) continue;
      const clienteNome = clientesPorProcesso.get(a.numero.replace(/\D/g, '')) ?? '—';
      // O movimento IMPORTANTE mais recente do processo (um alerta por processo).
      let melhor: { tipo: string; movimento: string; dataHora: string } | null = null;
      for (const m of a.movimentos) {
        if (m.dataHora.slice(0, 10) < corte) continue;
        const tipo = JuridicoService.TIPOS_IMPORTANTES.find(([re]) => re.test(m.nome))?.[1];
        if (tipo === undefined) continue;
        if (melhor === null || m.dataHora > melhor.dataHora)
          melhor = { tipo, movimento: m.nome, dataHora: m.dataHora };
      }
      // Classe de execução também alerta, mesmo sem movimento novo no período.
      if (melhor === null && a.emExecucao && a.ultimoMovimento !== null) {
        melhor = {
          tipo: '⚡ Execução',
          movimento: `${a.classe} — ${a.ultimoMovimento.nome}`,
          dataHora: a.ultimoMovimento.dataHora,
        };
      }
      if (melhor !== null)
        alertas.push({ ...melhor, clienteNome, processo: a.numero, novidade: a.novidade });
    }
    alertas.sort((x, y) => y.dataHora.localeCompare(x.dataHora));

    // VALOR DA CARTEIRA (2026-09-17, pedido do dono): cada processo vale a BASE
    // de R$ 10.000; quando o processo chega à execução e o valor real é lançado
    // (apurado ou pago), o real SUBSTITUI a base — para mais ou para menos — e
    // "sem êxito" vale zero. A conta é por processo (nº CNJ), não por contrato.
    const valores = JuridicoService.valorDaCarteira(contratos, resultados);

    const hoje = this.agora().slice(0, 10);
    const ultimaConsulta = andamentos.reduce<string | null>(
      (max, a) => (max === null || a.consultadoEm > max ? a.consultadoEm : max),
      null,
    );
    return {
      clientes: clientes.length,
      contratos: naoExcluidos.length,
      ativos: contratos.filter((c) => c.status === 'ativo').length,
      encerrados: contratos.filter((c) => c.status === 'encerrado').length,
      excluidos: contratos.filter((c) => c.status === 'excluido').length,
      valorAtivos: valores.corrigido,
      valorBase: valores.base,
      processosAtivos: valores.processos,
      comValorReal: valores.comValorReal,
      valorEmpresa: valores.empresa,
      parteDaEmpresa: PARTE_DA_EMPRESA,
      guias: {
        total: guias.length,
        valor: Math.round(guias.reduce((s, g) => s + (g.valor ?? 0), 0) * 100) / 100,
      },
      periciasProximas: pericias
        .filter((p) => p.situacao === 'agendada' && (p.data ?? '') >= hoje)
        .slice(0, 5),
      alertas: alertas.slice(0, 10),
      movimentacoesPendentes: andamentos.filter(
        (a) =>
          a.ultimoMovimento !== null &&
          ((a.vistoAte ?? null) === null || a.ultimoMovimento.dataHora > (a.vistoAte ?? '')),
      ).length,
      ultimaConsultaDatajud: ultimaConsulta,
      recentes: contratos.slice(0, 8).map((c) => ({
        ...c,
        clienteNome: nomePorCliente.get(c.clienteId) ?? '—',
      })),
      porBanco: [...porBanco.entries()]
        .map(([banco, total]) => ({ banco, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      historico: eventos,
      distribuidosHoje: distribuidosNoDia(contratos, nomePorCliente, this.deps.clock.now()),
    };
  }
}
