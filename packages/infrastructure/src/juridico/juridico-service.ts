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
  readonly movimentos: readonly { readonly nome: string; readonly dataHora: string }[];
  /** A classe indica fase de EXECUÇÃO (cumprimento de sentença)? */
  readonly emExecucao: boolean;
  /** O último movimento é MAIS NOVO que o da consulta anterior? */
  readonly novidade: boolean;
  readonly consultadoEm: string;
  readonly erro: string | null;
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

export class JuridicoService {
  constructor(private readonly deps: JuridicoDeps) {}

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

  /** Consulta TODOS os processos com contrato não-excluído no DataJud e grava
   *  o retrato de cada um. Ritmo suave (pausa entre consultas — API pública). */
  async atualizarAndamentos(): Promise<
    | { ok: true; consultados: number; encontrados: number; novidades: number; erros: number }
    | { ok: false; error: string }
  > {
    const datajud = this.deps.datajud;
    if (datajud === undefined)
      return { ok: false, error: 'DataJud não configurado nesta montagem' };
    const contratos = await this.listarContratos();
    const numeros = [
      ...new Set(contratos.filter((c) => c.status !== 'excluido').map((c) => c.processoNumero)),
    ];
    let encontrados = 0;
    let novidades = 0;
    let erros = 0;
    for (const numero of numeros) {
      const chave = numero.replace(/\D/g, '');
      const anterior = (await this.deps.json.get(NS_ANDAMENTOS, chave)) as AndamentoProcesso | null;
      try {
        const retrato = await datajud.consultar(numero);
        if (retrato === null) {
          await this.deps.json.put(NS_ANDAMENTOS, chave, {
            numero,
            tribunal: '',
            classe: '',
            orgaoJulgador: '',
            assunto: '',
            grau: '',
            dataAjuizamento: '',
            ultimoMovimento: anterior?.ultimoMovimento ?? null,
            movimentos: anterior?.movimentos ?? [],
            emExecucao: anterior?.emExecucao ?? false,
            novidade: false,
            consultadoEm: this.agora(),
            erro: 'processo não encontrado no DataJud (pode levar dias para indexar)',
          } satisfies AndamentoProcesso);
          continue;
        }
        encontrados += 1;
        const anteriorEm = anterior?.ultimoMovimento?.dataHora ?? null;
        const novidade =
          anteriorEm !== null &&
          retrato.ultimoMovimento !== null &&
          retrato.ultimoMovimento.dataHora > anteriorEm;
        if (novidade) novidades += 1;
        await this.deps.json.put(NS_ANDAMENTOS, chave, {
          ...retrato,
          emExecucao: /cumprimento de senten|execu[çc][ãa]o/i.test(retrato.classe),
          novidade,
          consultadoEm: this.agora(),
          erro: null,
        } satisfies AndamentoProcesso);
      } catch (e) {
        erros += 1;
        await this.deps.json.put(NS_ANDAMENTOS, chave, {
          ...(anterior ?? {
            numero,
            tribunal: '',
            classe: '',
            orgaoJulgador: '',
            assunto: '',
            grau: '',
            dataAjuizamento: '',
            ultimoMovimento: null,
            movimentos: [],
            emExecucao: false,
            novidade: false,
          }),
          numero,
          consultadoEm: this.agora(),
          erro: e instanceof Error ? e.message : String(e),
        } satisfies AndamentoProcesso);
      }
      // Ritmo suave com a API pública do CNJ.
      await new Promise((r) => setTimeout(r, 400));
    }
    await this.registrarHistorico(
      'Andamentos atualizados pelo DataJud.',
      `${String(numeros.length)} processo(s) consultado(s), ${String(novidades)} com novidade`,
      'DataJud',
    );
    return { ok: true, consultados: numeros.length, encontrados, novidades, erros };
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────

  async dashboard(): Promise<{
    clientes: number;
    contratos: number;
    ativos: number;
    encerrados: number;
    excluidos: number;
    recentes: readonly (ContratoJuridico & { clienteNome: string })[];
    porBanco: readonly { banco: string; total: number }[];
    historico: readonly EventoHistorico[];
  }> {
    const [clientes, contratos, eventos] = await Promise.all([
      this.listarClientes(),
      this.listarContratos(),
      this.historico(12),
    ]);
    const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));
    const naoExcluidos = contratos.filter((c) => c.status !== 'excluido');
    const porBanco = new Map<string, number>();
    for (const c of naoExcluidos) porBanco.set(c.banco, (porBanco.get(c.banco) ?? 0) + 1);
    return {
      clientes: clientes.length,
      contratos: naoExcluidos.length,
      ativos: contratos.filter((c) => c.status === 'ativo').length,
      encerrados: contratos.filter((c) => c.status === 'encerrado').length,
      excluidos: contratos.filter((c) => c.status === 'excluido').length,
      recentes: contratos.slice(0, 8).map((c) => ({
        ...c,
        clienteNome: nomePorCliente.get(c.clienteId) ?? '—',
      })),
      porBanco: [...porBanco.entries()]
        .map(([banco, total]) => ({ banco, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      historico: eventos,
    };
  }
}
