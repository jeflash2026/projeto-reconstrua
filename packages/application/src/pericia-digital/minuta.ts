// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · GERADOR DE MINUTA (Decreto 2026-07-24, item 8)
// Monta a MINUTA TÉCNICA em 26 seções, com marca d'água obrigatória enquanto não
// aprovada, cada dado transcrito com segurança (nunca inventado) e uma TRAVA que
// recusa qualquer conclusão jurídica proibida. A IA NÃO figura como autora.
// ─────────────────────────────────────────────────────────────────────────────
import { exigeMarcaDagua, type StatusPericia } from './caso-pericial.js';
import type { Achado } from './achado.js';
import type { FichaContrato } from './fichas-contrato.js';
import type { AnaliseAssinatura, ItemTrilha, MetadadosPdf } from './analise-tecnica.js';
import {
  CONCLUSOES_PERMITIDAS,
  NAO_APRESENTADO,
  campoSeguro,
  termosProibidosEncontrados,
  type TipoConclusao,
} from './linguagem-segura.js';

export const MARCA_DAGUA = 'MINUTA AUTOMATIZADA - NÃO ASSINADA - NÃO UTILIZAR EM JUÍZO';

export interface PeritoAssinante {
  readonly nome: string;
  readonly cpf: string;
  readonly qualificacao: string;
  readonly registroProfissional: string | null;
  readonly assinadoEm: string;
  readonly hashVersao: string;
}

export interface Quesito {
  readonly pergunta: string;
  readonly resposta: string | null;
}

export interface EntradaMinuta {
  readonly status: StatusPericia;
  readonly numeroCaso: string;
  readonly geradoEm: string;
  readonly cliente: { nome: string | null; cpf: string | null; beneficio: string | null };
  readonly banco: string | null;
  readonly numeroProcesso: string | null;
  readonly objeto: string;
  readonly documentosExaminados: readonly string[];
  readonly documentosNaoApresentados: readonly string[];
  readonly resumoCustodia: readonly string[];
  readonly ferramentas: readonly string[];
  readonly fichas: readonly FichaContrato[];
  readonly achados: readonly Achado[];
  readonly quesitos: readonly Quesito[];
  readonly conclusaoSugerida: TipoConclusao | null;
  readonly limitacoes: readonly string[];
  /** Análise técnica extraída dos documentos (Fase 3) — ausente ⇒ NÃO APRESENTADO. */
  readonly metadados?: readonly MetadadosPdf[];
  readonly assinaturas?: readonly AnaliseAssinatura[];
  readonly trilha?: readonly ItemTrilha[];
  /** Só presente quando ASSINADO — a máquina NUNCA preenche isto sozinha. */
  readonly perito: PeritoAssinante | null;
}

export interface SecaoMinuta {
  readonly numero: number;
  readonly titulo: string;
  readonly corpo: string;
}

export interface MinutaGerada {
  readonly secoes: readonly SecaoMinuta[];
  readonly texto: string;
  readonly marcaDagua: string | null;
  /** Termos proibidos encontrados no texto AUTOMÁTICO — não-vazio ⇒ NÃO emitir. */
  readonly bloqueios: readonly string[];
}

const lista = (itens: readonly string[]): string =>
  itens.length === 0 ? NAO_APRESENTADO : itens.map((i) => `  • ${i}`).join('\n');

function corpoDosAchados(achados: readonly Achado[]): string {
  const relevantes = achados.filter((a) => a.status !== 'DESCARTADO');
  if (relevantes.length === 0) return NAO_APRESENTADO;
  return relevantes
    .map((a) => {
      const ref = a.origem
        ? `${a.origem.nomeArquivo}${a.origem.pagina !== null ? `, p. ${String(a.origem.pagina)}` : ''}`
        : NAO_APRESENTADO;
      return (
        `  [${a.gravidade}] ${a.titulo}\n` +
        `    Tipo: ${a.tipoFato} · Origem: ${ref}\n` +
        `    ${a.descricao}\n` +
        `    Método: ${campoSeguro(a.metodo)} · Ferramenta: ${campoSeguro(a.ferramenta)}\n` +
        `    Resultado: ${campoSeguro(a.resultado)} · Limitação: ${campoSeguro(a.limitacao)}`
      );
    })
    .join('\n\n');
}

function corpoDasFichas(fichas: readonly FichaContrato[]): string {
  if (fichas.length === 0) return NAO_APRESENTADO;
  return fichas
    .map(
      (f, i) =>
        `  Contrato ${String(i + 1)}: ${f.contrato}\n` +
        `    Banco: ${f.bancoNome} (${f.bancoCodigo}) · Situação: ${f.situacao}\n` +
        `    Origem da averbação: ${f.origemAverbacao}\n` +
        `    Competência: ${f.competenciaInicio} a ${f.competenciaFim} · Parcelas: ${f.qtdeParcelas}\n` +
        `    Valor da parcela: ${f.valorParcela} · Valor liberado: ${f.valorEmprestado}\n` +
        `    Classificação: ${f.classificacao} — ${f.observacao}`,
    )
    .join('\n\n');
}

function corpoQuesitos(quesitos: readonly Quesito[]): string {
  if (quesitos.length === 0) return NAO_APRESENTADO;
  return quesitos
    .map(
      (q, i) =>
        `  ${String(i + 1)}. ${q.pergunta}\n     R: ${campoSeguro(q.resposta, 'nao-verificavel')}`,
    )
    .join('\n\n');
}

function corpoConclusao(tipo: TipoConclusao | null): string {
  if (tipo === null) return CONCLUSOES_PERMITIDAS.D; // sem sugestão ⇒ impossibilidade
  return (
    `${CONCLUSOES_PERMITIDAS[tipo]}\n\n` +
    'Observação: esta é uma sugestão técnica preliminar, sujeita à revisão e à decisão do perito ' +
    'responsável. Conclusões jurídicas competem ao advogado e a decisão final ao Poder Judiciário.'
  );
}

function corpoPerito(perito: PeritoAssinante | null): string {
  if (perito === null)
    return 'Documento ainda NÃO revisado e NÃO assinado por perito humano. Sem valor pericial.';
  return (
    `Perito responsável: ${perito.nome}\n` +
    `CPF: ${perito.cpf}\n` +
    `Qualificação: ${perito.qualificacao}\n` +
    `Registro profissional: ${campoSeguro(perito.registroProfissional)}\n` +
    `Revisado e assinado em: ${perito.assinadoEm}\n` +
    `Hash da versão assinada (SHA-256): ${perito.hashVersao}`
  );
}

function corpoMetadados(metadados: readonly MetadadosPdf[] | undefined): string {
  if (!metadados || metadados.length === 0) return NAO_APRESENTADO;
  return metadados
    .map(
      (m, i) =>
        `  Documento ${String(i + 1)} — versão PDF: ${m.versaoPdf} · criação: ${m.dataCriacao} · ` +
        `modificação: ${m.dataModificacao} · produtor: ${m.produtor} · revisões: ${String(m.revisoes)} · ` +
        `assinatura embutida: ${m.assinaturaEmbutida ? 'sim' : 'não'} (ferramenta: ${m.ferramenta})`,
    )
    .join('\n');
}

function corpoAssinaturas(assinaturas: readonly AnaliseAssinatura[] | undefined): string {
  if (!assinaturas || assinaturas.length === 0) return NAO_APRESENTADO;
  return assinaturas
    .map((a, i) => `  Documento ${String(i + 1)} — ${a.classificacao}: ${a.observacao}`)
    .join('\n');
}

function corpoTrilha(trilha: readonly ItemTrilha[] | undefined): string {
  if (!trilha || trilha.length === 0) return NAO_APRESENTADO;
  return trilha.map((t) => `  ${t.elemento}: ${t.status} — ${t.evidencia}`).join('\n');
}

/** Gera a minuta em 26 seções. NÃO emite conclusão jurídica; aplica a marca
 *  d'água enquanto não aprovada; devolve `bloqueios` se algum termo proibido
 *  escapou (o chamador NÃO deve emitir com bloqueios). */
export function gerarMinuta(e: EntradaMinuta): MinutaGerada {
  const c = e.cliente;
  const secoes: SecaoMinuta[] = [
    {
      numero: 1,
      titulo: 'Capa',
      corpo: `MINUTA DE PARECER TÉCNICO\nCaso nº ${e.numeroCaso}\nGerado em ${e.geradoEm}`,
    },
    {
      numero: 2,
      titulo: 'Identificação do documento',
      corpo: `Minuta técnica automatizada, sujeita a revisão e assinatura de perito humano.`,
    },
    {
      numero: 3,
      titulo: 'Identificação das partes',
      corpo: `Cliente: ${campoSeguro(c.nome)}\nCPF: ${campoSeguro(c.cpf)}\nBenefício: ${campoSeguro(c.beneficio)}\nInstituição financeira: ${campoSeguro(e.banco)}`,
    },
    { numero: 4, titulo: 'Identificação do contrato', corpo: corpoDasFichas(e.fichas) },
    { numero: 5, titulo: 'Objeto da análise', corpo: campoSeguro(e.objeto) },
    { numero: 6, titulo: 'Documentos e arquivos examinados', corpo: lista(e.documentosExaminados) },
    {
      numero: 7,
      titulo: 'Documentos solicitados e não apresentados',
      corpo: lista(e.documentosNaoApresentados),
    },
    { numero: 8, titulo: 'Preservação e cadeia de custódia', corpo: lista(e.resumoCustodia) },
    {
      numero: 9,
      titulo: 'Metodologia',
      corpo:
        'Análise documental técnica: localização e organização dos contratos a partir do HISCON, transcrição dos dados existentes, verificação de consistência interna e identificação de elementos e ausências. A ausência de um documento é registrada como tal, jamais como comprovação de fraude.',
    },
    { numero: 10, titulo: 'Ferramentas efetivamente utilizadas', corpo: lista(e.ferramentas) },
    { numero: 11, titulo: 'Análise do HISCON', corpo: corpoDasFichas(e.fichas) },
    { numero: 12, titulo: 'Análise do contrato eletrônico', corpo: NAO_APRESENTADO },
    { numero: 13, titulo: 'Metadados', corpo: corpoMetadados(e.metadados) },
    { numero: 14, titulo: 'Assinaturas eletrônicas', corpo: corpoAssinaturas(e.assinaturas) },
    { numero: 15, titulo: 'Trilha de auditoria', corpo: corpoTrilha(e.trilha) },
    { numero: 16, titulo: 'IP, geolocalização e dispositivo', corpo: NAO_APRESENTADO },
    { numero: 17, titulo: 'Selfie, biometria e prova de vida', corpo: NAO_APRESENTADO },
    { numero: 18, titulo: 'Documento de identificação', corpo: NAO_APRESENTADO },
    { numero: 19, titulo: 'Fluxo financeiro', corpo: NAO_APRESENTADO },
    { numero: 20, titulo: 'Inconsistências encontradas', corpo: corpoDosAchados(e.achados) },
    { numero: 21, titulo: 'Limitações da análise', corpo: lista(e.limitacoes) },
    { numero: 22, titulo: 'Respostas aos quesitos', corpo: corpoQuesitos(e.quesitos) },
    { numero: 23, titulo: 'Conclusão técnica', corpo: corpoConclusao(e.conclusaoSugerida) },
    {
      numero: 24,
      titulo: 'Ressalvas',
      corpo:
        'Análise limitada aos documentos apresentados. Elementos não apresentados ou não verificáveis estão assim indicados. Esta minuta não afirma fraude, falsidade, inexistência ou nulidade.',
    },
    { numero: 25, titulo: 'Anexos técnicos', corpo: lista(e.documentosExaminados) },
    { numero: 26, titulo: 'Identificação e assinatura do perito', corpo: corpoPerito(e.perito) },
  ];

  const marcaDagua = exigeMarcaDagua(e.status) ? MARCA_DAGUA : null;
  const cabecalho = marcaDagua !== null ? `*** ${marcaDagua} ***\n\n` : '';
  const texto =
    cabecalho +
    secoes.map((s) => `${String(s.numero)}. ${s.titulo}\n${s.corpo}`).join('\n\n') +
    (marcaDagua !== null ? `\n\n*** ${marcaDagua} ***` : '');

  // TRAVA: nenhum termo de conclusão jurídica proibida no conteúdo ANALÍTICO
  // (seções que carregam dados/achados/quesitos/conclusão). As seções fixas de
  // metodologia/ressalva NEGAM os termos por construção ("não afirma fraude…") e
  // são constantes institucionais seguras — não entram na trava.
  const SECOES_ANALITICAS = new Set([4, 11, 20, 22, 23]);
  const bloqueios = termosProibidosEncontrados(
    secoes
      .filter((s) => SECOES_ANALITICAS.has(s.numero))
      .map((s) => s.corpo)
      .join('\n'),
  );

  return { secoes, texto, marcaDagua, bloqueios };
}
