// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · BASE DE CONHECIMENTO (Decreto 2026-07-24, Fase 5)
// Material de CONSULTA do perito humano — os procedimentos e as fronteiras legais
// da PRÓPRIA Central. NÃO cita normas externas com número (não inventamos ABNT,
// lei ou jurisprudência: isso seria "norma técnica aplicada" fabricada, proibida).
// É referência para o humano decidir; a automação nunca conclui a partir daqui.
// Read-only: a base é curada no código e versionada como qualquer outra regra.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoriaConhecimentoPericial =
  | 'FRONTEIRA_LEGAL' // o que a automação nunca afirma
  | 'PROCEDIMENTO' // como conduzir cada etapa
  | 'CADEIA_CUSTODIA' // integridade e rastreabilidade
  | 'MODELO_QUESITO' // quesitos-modelo para o perito adaptar
  | 'LGPD'; // minimização e direitos do titular

export interface EntradaConhecimento {
  readonly id: string;
  readonly categoria: CategoriaConhecimentoPericial;
  readonly titulo: string;
  readonly corpo: string;
}

/** Base curada. Conteúdo VERDADEIRO sobre o funcionamento desta Central — nunca
 *  citações externas inventadas. O perito adapta os modelos ao caso concreto. */
export const BASE_CONHECIMENTO: readonly EntradaConhecimento[] = [
  {
    id: 'fl-nunca-inventar',
    categoria: 'FRONTEIRA_LEGAL',
    titulo: 'A automação nunca inventa dado ausente',
    corpo:
      'Quando um elemento (IP, geolocalização, data/hora, IMEI, UUID, user-agent, ' +
      'certificado, hash, prova de vida, biometria, manifestação de vontade, número ' +
      'de contrato, banco, valor, norma aplicada, ferramenta) não está nos documentos, ' +
      'registra-se exatamente "NÃO APRESENTADO NOS DOCUMENTOS ANALISADOS" ou "NÃO FOI ' +
      'POSSÍVEL VERIFICAR COM OS ELEMENTOS DISPONÍVEIS". A ausência de um documento ' +
      'nunca é, por si, prova de fraude.',
  },
  {
    id: 'fl-nunca-concluir',
    categoria: 'FRONTEIRA_LEGAL',
    titulo: 'A automação nunca conclui fraude/falsidade/nulidade',
    corpo:
      'Termos como fraude, falsidade, inexistência, nulidade e dano moral são ' +
      'conclusões jurídicas. A minuta é bloqueada se algum deles escapar para as ' +
      'seções analíticas. Só o perito humano, revisando e assinando, valida a ' +
      'conclusão. A IA não figura como autora nem perita.',
  },
  {
    id: 'proc-portao-unico',
    categoria: 'PROCEDIMENTO',
    titulo: 'Portão único de emissão (revisão humana obrigatória)',
    corpo:
      'A minuta só pode ser emitida quando: aprovada e assinada por perito nomeado, ' +
      'sem achado crítico em aberto, com consistência de cabeçalho×corpo e sem ' +
      'bloqueio de linguagem. Enquanto não emitida, carrega a marca d’água ' +
      '"MINUTA AUTOMATIZADA - NÃO ASSINADA - NÃO UTILIZAR EM JUÍZO".',
  },
  {
    id: 'proc-hiscon',
    categoria: 'PROCEDIMENTO',
    titulo: 'O HISCON localiza e organiza — não conclui',
    corpo:
      'O HISCON serve para localizar contratos, iniciar a análise, identificar ' +
      'descontos/divergências e gerar o checklist de documentos. Ele não prova ' +
      'contratação nem autoria; divergência é fato a investigar, não conclusão.',
  },
  {
    id: 'cc-hash-encadeado',
    categoria: 'CADEIA_CUSTODIA',
    titulo: 'Cadeia de custódia por hash encadeado',
    corpo:
      'Cada evento da custódia é encadeado por SHA-256 sobre o hash anterior mais o ' +
      'conteúdo do evento. Qualquer adulteração quebra a cadeia e é detectada na ' +
      'verificação. O documento original é imutável e recebe hash no registro.',
  },
  {
    id: 'lgpd-minimizacao',
    categoria: 'LGPD',
    titulo: 'Minimização e mascaramento por papel',
    corpo:
      'Papéis restritos (advogado, auditor, visualizador) recebem CPF, RG, benefício ' +
      'e telefones mascarados; a minuta exibida tem a PII solta redigida. Mascarar é ' +
      'projeção de leitura — nunca altera o armazenamento nem a cadeia de custódia. ' +
      'A anonimização atende o direito de exclusão preservando a auditabilidade.',
  },
  {
    id: 'mq-assinatura',
    categoria: 'MODELO_QUESITO',
    titulo: 'Quesito-modelo: assinatura eletrônica',
    corpo:
      'Os documentos apresentam assinatura eletrônica com ByteRange/estrutura ' +
      'verificável? Em caso positivo, a validação da cadeia do certificado depende de ' +
      'conferência externa por fonte oficial documentada. Ausência de assinatura ICP ' +
      'não invalida, por si, o documento — registra-se a limitação.',
  },
  {
    id: 'mq-biometria',
    categoria: 'MODELO_QUESITO',
    titulo: 'Quesito-modelo: biometria / prova de vida',
    corpo:
      'Os arquivos permitem verificar liveness, vínculo com a sessão e vínculo ' +
      'criptográfico com o contrato? Cada item é observação sujeita à revisão do ' +
      'perito. A posse de uma imagem não se confunde com a autoria da contratação, e ' +
      'não se afirma replay/injection/reaproveitamento sem evidência técnica ' +
      'suficiente.',
  },
];

export const CATEGORIAS_CONHECIMENTO: readonly CategoriaConhecimentoPericial[] = [
  'FRONTEIRA_LEGAL',
  'PROCEDIMENTO',
  'CADEIA_CUSTODIA',
  'MODELO_QUESITO',
  'LGPD',
];

/** Lista as entradas, opcionalmente filtrando por categoria. */
export function listarConhecimento(
  categoria?: CategoriaConhecimentoPericial,
): readonly EntradaConhecimento[] {
  if (categoria === undefined) return BASE_CONHECIMENTO;
  return BASE_CONHECIMENTO.filter((e) => e.categoria === categoria);
}

/** Busca simples por termo no título/corpo (case/acentos-insensível o bastante
 *  para consulta rápida). Termo vazio ⇒ tudo. */
export function buscarConhecimento(termo: string): readonly EntradaConhecimento[] {
  const t = termo.trim().toLowerCase();
  if (t === '') return BASE_CONHECIMENTO;
  return BASE_CONHECIMENTO.filter(
    (e) => e.titulo.toLowerCase().includes(t) || e.corpo.toLowerCase().includes(t),
  );
}
