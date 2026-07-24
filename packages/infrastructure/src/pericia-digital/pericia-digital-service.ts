// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · ORQUESTRADOR (Decreto 2026-07-24)
// Amarra o núcleo PURO (@reconstrua/application/pericia-digital) aos stores e à
// cadeia de custódia. Toda mudança de estado passa por: (1) validação da máquina
// de status, (2) invariantes legais (nunca inventar/concluir), (3) registro na
// custódia. A EMISSÃO só ocorre pelo portão único podeEmitir — nunca automática.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import {
  beneficiarioSeguro,
  fichasDoHiscon,
  gerarMinuta,
  podeEmitir,
  podeTransitar,
  validarAprovacaoPerito,
  verificarConsistencia,
  type Achado,
  type DadosAprovacaoPerito,
  type DadosDoCaso,
  type HisconExtraido,
  type Quesito,
  type StatusPericia,
  type TipoConclusao,
} from '@reconstrua/application';
import type { Clock, UuidGenerator } from '@reconstrua/domain';
import type { CasoPericial, CasoStore } from './caso-store.js';
import type { CustodiaService } from './custodia.js';
import { formatoDoNome, hashETamanho, type DocumentoPericial } from './documento-pericial.js';
import type { CategoriaDocumento, OrigemDocumento } from '@reconstrua/application';

export interface PericiaDigitalDeps {
  readonly casos: CasoStore;
  readonly custodia: CustodiaService;
  readonly clock: Clock;
  readonly uuid: UuidGenerator;
  /** Extrai o HISCON já parseado do cliente (reuso da PericiaService). */
  readonly extrairHiscon: (chatId: string) => Promise<HisconExtraido | null>;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const erro = <T>(error: string): Resultado<T> => ({ ok: false, error });

/** O "corpo" da análise para a trava de consistência: o que as fichas dizem. */
function corpoDoCaso(caso: CasoPericial): DadosDoCaso {
  const f = caso.fichas[0];
  return {
    nomeCliente: caso.dados.nomeCliente,
    cpf: caso.dados.cpf,
    numeroBeneficio: caso.dados.numeroBeneficio,
    banco: f && !f.bancoNome.startsWith('NÃO') ? f.bancoNome : null,
    cnpjBanco: null,
    numeroContrato: f && !f.contrato.startsWith('NÃO') ? f.contrato : null,
    numeroProcesso: caso.dados.numeroProcesso,
  };
}

export class PericiaDigitalService {
  constructor(private readonly deps: PericiaDigitalDeps) {}

  private agora(): string {
    return this.deps.clock.now().toISOString();
  }

  private async persistir(
    caso: CasoPericial,
    novoStatus: StatusPericia | null,
    custodia: {
      usuario: string;
      acao: string;
      detalhe?: string;
      motivo?: string;
      arquivoId?: string;
    },
  ): Promise<Resultado<CasoPericial>> {
    if (
      novoStatus !== null &&
      novoStatus !== caso.status &&
      !podeTransitar(caso.status, novoStatus)
    )
      return erro(`transição inválida: ${caso.status} → ${novoStatus}`);
    const atualizado: CasoPericial = {
      ...caso,
      status: novoStatus ?? caso.status,
      atualizadoEm: this.agora(),
    };
    await this.deps.casos.salvar(atualizado);
    await this.deps.custodia.registrar(caso.id, {
      usuario: custodia.usuario,
      acao: custodia.acao,
      detalhe: custodia.detalhe ?? null,
      motivo: custodia.motivo ?? null,
      arquivoId: custodia.arquivoId ?? null,
    });
    return ok(atualizado);
  }

  /** Cria o caso a partir do HISCON: fichas por contrato + dados âncora seguros. */
  async criarCasoDoHiscon(
    chatId: string,
    numeroCaso: string,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    if (await this.deps.casos.porChat(chatId))
      return erro('já existe caso pericial para este cliente');
    const extraido = await this.deps.extrairHiscon(chatId);
    if (extraido === null) return erro('sem HISCON legível para este cliente');
    const benef = beneficiarioSeguro(extraido);
    const caso: CasoPericial = {
      id: this.deps.uuid.next(),
      numeroCaso,
      chatId,
      status: 'CONTRATOS_IDENTIFICADOS',
      dados: {
        nomeCliente: extraido.beneficiario,
        cpf: null,
        numeroBeneficio: extraido.numeroBeneficio,
        banco: null,
        cnpjBanco: null,
        numeroContrato: null,
        numeroProcesso: null,
      },
      fichas: fichasDoHiscon(extraido),
      achados: [],
      documentos: [],
      quesitos: [],
      minutaVersoes: [],
      aprovacao: null,
      criadoEm: this.agora(),
      atualizadoEm: this.agora(),
    };
    await this.deps.casos.salvar(caso);
    await this.deps.custodia.registrar(caso.id, {
      usuario,
      acao: 'CASO_CRIADO',
      detalhe: `${String(caso.fichas.length)} contrato(s) identificados no HISCON de ${benef.nome}`,
    });
    return ok(caso);
  }

  /** Registra um documento (original imutável): metadados + hash SHA-256. */
  async registrarDocumento(
    casoId: string,
    input: {
      nomeOriginal: string;
      base64: string;
      categoria: CategoriaDocumento;
      origem: OrigemDocumento;
      responsavelEnvio: string;
      paginas?: number | null;
      contratoVinculado?: string | null;
      derivadoDe?: string | null;
    },
    usuario: string,
  ): Promise<Resultado<DocumentoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    const { hash, tamanho } = hashETamanho(input.base64);
    const doc: DocumentoPericial = {
      id: this.deps.uuid.next(),
      casoId,
      nomeOriginal: input.nomeOriginal,
      categoria: input.categoria,
      origem: input.origem,
      responsavelEnvio: input.responsavelEnvio,
      uploadEm: this.agora(),
      tamanho,
      formato: formatoDoNome(input.nomeOriginal),
      hashSha256: hash,
      paginas: input.paginas ?? null,
      contratoVinculado: input.contratoVinculado ?? null,
      versao: 1,
      derivadoDe: input.derivadoDe ?? null,
      statusAnalise: 'PENDENTE',
      acessos: [],
      alteracoes: [],
    };
    const atualizado: CasoPericial = {
      ...caso,
      documentos: [...caso.documentos, doc],
      atualizadoEm: this.agora(),
    };
    await this.deps.casos.salvar(atualizado);
    await this.deps.custodia.registrar(casoId, {
      usuario,
      acao: input.derivadoDe ? 'DOCUMENTO_DERIVADO' : 'DOCUMENTO_REGISTRADO',
      arquivoId: doc.id,
      detalhe: `${input.categoria} · ${input.nomeOriginal} · sha256=${hash.slice(0, 16)}…`,
    });
    return ok(doc);
  }

  /** Anexa um achado (nunca conclusivo — o tipo já barra CONCLUSAO_APROVADA_PERITO). */
  async registrarAchado(
    casoId: string,
    achado: Achado,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    return this.persistir({ ...caso, achados: [...caso.achados, achado] }, null, {
      usuario,
      acao: 'ACHADO_REGISTRADO',
      detalhe: `[${achado.gravidade}] ${achado.titulo}`,
    });
  }

  async adicionarQuesito(
    casoId: string,
    quesito: Quesito,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    return this.persistir({ ...caso, quesitos: [...caso.quesitos, quesito] }, null, {
      usuario,
      acao: 'QUESITO_ADICIONADO',
    });
  }

  /** Marca a documentação como pendente (aguardando documentos do banco). */
  async marcarDocumentacaoPendente(
    casoId: string,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    return this.persistir(caso, 'DOCUMENTACAO_PENDENTE', {
      usuario,
      acao: 'DOCUMENTACAO_PENDENTE',
    });
  }

  /** Inicia a análise de evidências (pré-requisito para gerar a minuta). */
  async iniciarAnalise(casoId: string, usuario: string): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    return this.persistir(caso, 'EVIDENCIAS_EM_ANALISE', { usuario, acao: 'ANALISE_INICIADA' });
  }

  /** Gera a minuta (rascunho). Bloqueia se algum termo proibido escapou. */
  async gerarMinuta(
    casoId: string,
    conclusaoSugerida: TipoConclusao | null,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    const inconsist = verificarConsistencia(caso.dados, corpoDoCaso(caso));
    if (inconsist.length > 0) return erro(inconsist[0]?.mensagem ?? 'erro de consistência');

    const minuta = gerarMinuta({
      status: 'MINUTA_GERADA',
      numeroCaso: caso.numeroCaso,
      geradoEm: this.agora(),
      cliente: {
        nome: caso.dados.nomeCliente,
        cpf: caso.dados.cpf,
        beneficio: caso.dados.numeroBeneficio,
      },
      banco: caso.dados.banco,
      numeroProcesso: caso.dados.numeroProcesso,
      objeto: 'Análise técnica dos contratos consignados constantes no HISCON.',
      documentosExaminados: caso.documentos.map((d) => d.nomeOriginal),
      documentosNaoApresentados: [],
      resumoCustodia: (await this.deps.custodia.trilha(casoId)).map(
        (e) => `${e.em} · ${e.acao} · ${e.usuario}`,
      ),
      ferramentas: ['Parser HISCON interno', 'Cadeia de custódia SHA-256'],
      fichas: caso.fichas,
      achados: caso.achados,
      quesitos: caso.quesitos,
      conclusaoSugerida,
      limitacoes: ['Análise limitada aos documentos apresentados nesta data.'],
      perito: null,
    });
    if (minuta.bloqueios.length > 0)
      return erro(`minuta bloqueada por termo proibido: ${minuta.bloqueios.join(', ')}`);

    const versao = caso.minutaVersoes.length + 1;
    const hash = createHash('sha256').update(minuta.texto).digest('hex');
    const comMinuta: CasoPericial = {
      ...caso,
      minutaVersoes: [
        ...caso.minutaVersoes,
        { versao, geradoEm: this.agora(), texto: minuta.texto, hash },
      ],
    };
    return this.persistir(comMinuta, 'MINUTA_GERADA', {
      usuario,
      acao: 'MINUTA_GERADA',
      detalhe: `versão ${String(versao)} · sha256=${hash.slice(0, 16)}…`,
    });
  }

  async submeterRevisao(casoId: string, usuario: string): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    if (caso.minutaVersoes.length === 0) return erro('gere a minuta antes de submeter à revisão');
    return this.persistir(caso, 'EM_REVISAO_PELO_PERITO', { usuario, acao: 'SUBMETIDO_A_REVISAO' });
  }

  async solicitarAjustes(
    casoId: string,
    motivo: string,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    return this.persistir(caso, 'AJUSTES_SOLICITADOS', {
      usuario,
      acao: 'AJUSTES_SOLICITADOS',
      motivo,
    });
  }

  /** Aprovação do perito humano — exige todos os campos + trava podeEmitir. */
  async aprovar(
    casoId: string,
    dadosPerito: DadosAprovacaoPerito,
    usuario: string,
  ): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    const val = validarAprovacaoPerito(dadosPerito);
    if (!val.ok) return erro(`aprovação incompleta: falta ${val.faltando.join(', ')}`);
    const inconsist = verificarConsistencia(caso.dados, corpoDoCaso(caso));
    const gate = podeEmitir({
      status: 'APROVADO_PELO_PERITO',
      achados: caso.achados,
      errosConsistencia: inconsist,
      bloqueiosMinuta: [],
      assinadaPorPerito: true,
    });
    if (!gate.pode) return erro(`não é possível aprovar: ${gate.motivos.join('; ')}`);
    const ultima = caso.minutaVersoes[caso.minutaVersoes.length - 1];
    if (!ultima) return erro('não há minuta para aprovar');
    const aprovado: CasoPericial = {
      ...caso,
      aprovacao: {
        perito: dadosPerito,
        aprovadoEm: this.agora(),
        hashVersao: ultima.hash,
        assinadoEm: null,
      },
    };
    return this.persistir(aprovado, 'APROVADO_PELO_PERITO', {
      usuario,
      acao: 'APROVADO_PELO_PERITO',
      detalhe: `perito ${dadosPerito.nomeCompleto} · hash ${ultima.hash.slice(0, 16)}…`,
    });
  }

  async assinar(casoId: string, usuario: string): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    if (caso.aprovacao === null) return erro('assinatura exige aprovação prévia do perito');
    const assinado: CasoPericial = {
      ...caso,
      aprovacao: { ...caso.aprovacao, assinadoEm: this.agora() },
    };
    return this.persistir(assinado, 'ASSINADO', {
      usuario,
      acao: 'ASSINADO',
      detalhe: `hash ${caso.aprovacao.hashVersao.slice(0, 16)}…`,
    });
  }

  async liberarParaAdvogado(casoId: string, usuario: string): Promise<Resultado<CasoPericial>> {
    const caso = await this.deps.casos.porId(casoId);
    if (caso === null) return erro('caso não encontrado');
    const gate = podeEmitir({
      status: caso.status,
      achados: caso.achados,
      errosConsistencia: verificarConsistencia(caso.dados, corpoDoCaso(caso)),
      bloqueiosMinuta: [],
      assinadaPorPerito: caso.aprovacao?.assinadoEm != null,
    });
    if (!gate.pode) return erro(`não é possível liberar: ${gate.motivos.join('; ')}`);
    return this.persistir(caso, 'LIBERADO_PARA_O_ADVOGADO', {
      usuario,
      acao: 'LIBERADO_PARA_ADVOGADO',
    });
  }
}
