// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · ANÁLISE TÉCNICA (Decreto 2026-07-24, item 6)
// Analisadores que EXTRAEM apenas o que EXISTE no documento — nunca inventam. O
// que não está presente vira a frase canônica. Nenhuma conclusão jurídica: só
// classificação técnica, sempre sujeita à revisão do perito.
//
// Puro: recebe o conteúdo (base64 do arquivo e/ou o texto transcrito) e devolve
// resultados estruturados + a lista de elementos presentes/ausentes.
// ─────────────────────────────────────────────────────────────────────────────
import { NAO_APRESENTADO, campoSeguro } from './linguagem-segura.js';

// ── A. METADADOS (item 6A) — só o que o PDF realmente carrega ─────────────────
export interface MetadadosPdf {
  readonly versaoPdf: string;
  readonly dataCriacao: string;
  readonly dataModificacao: string;
  readonly produtor: string;
  readonly autor: string;
  /** Nº de atualizações incrementais (cada gravação adiciona um %%EOF). */
  readonly revisoes: number;
  /** Há dicionário de assinatura embutido? (marcador técnico, não conclusão). */
  readonly assinaturaEmbutida: boolean;
  /** true quando o conteúdo não parece um PDF (não força interpretação). */
  readonly naoEhPdf: boolean;
  /** Ferramenta usada nesta extração (rastreabilidade — item 6A). */
  readonly ferramenta: string;
}

const FERRAMENTA = 'analisador-pdf-interno v1';

function decodificar(base64: string): string {
  try {
    return Buffer.from(base64, 'base64').toString('latin1');
  } catch {
    return '';
  }
}

function extrair(re: RegExp, texto: string): string {
  return re.exec(texto)?.[1]?.trim() ?? '';
}

/** Lê os metadados estruturais do PDF (datas, produtor, versão, revisões,
 *  assinatura embutida). Datas em formato PDF (D:AAAAMMDD...) são transcritas
 *  como estão — não são reinterpretadas. */
export function analisarMetadadosPdf(base64: string): MetadadosPdf {
  const bruto = decodificar(base64);
  const naoEhPdf = !bruto.startsWith('%PDF-');
  const versao = extrair(/^%PDF-(\d\.\d)/, bruto);
  const criacao = extrair(/\/CreationDate\s*\(([^)]*)\)/, bruto);
  const modif = extrair(/\/ModDate\s*\(([^)]*)\)/, bruto);
  const produtor = extrair(/\/Producer\s*\(([^)]*)\)/, bruto);
  const autor = extrair(/\/Author\s*\(([^)]*)\)/, bruto);
  const eofs = (bruto.match(/%%EOF/g) ?? []).length;
  const temSig = /\/Type\s*\/Sig\b/.test(bruto) || /\/ByteRange\b/.test(bruto);
  return {
    versaoPdf: campoSeguro(naoEhPdf ? null : versao || null),
    dataCriacao: campoSeguro(criacao || null),
    dataModificacao: campoSeguro(modif || null),
    produtor: campoSeguro(produtor || null),
    autor: campoSeguro(autor || null),
    revisoes: Math.max(0, eofs),
    assinaturaEmbutida: temSig,
    naoEhPdf,
    ferramenta: FERRAMENTA,
  };
}

// ── B. ASSINATURAS ELETRÔNICAS (item 6B) — classificar SEM conclusão jurídica ─
export type ClassificacaoAssinatura =
  | 'ASSINATURA_NAO_DETECTADA'
  | 'ASSINATURA_ELETRONICA_SIMPLES'
  | 'ASSINATURA_ELETRONICA_AVANCADA'
  | 'ASSINATURA_ELETRONICA_QUALIFICADA'
  | 'ASSINATURA_DIGITALIZADA_COMO_IMAGEM'
  | 'RESULTADO_INDETERMINADO'
  | 'NECESSITA_VALIDACAO_EXTERNA';

export interface AnaliseAssinatura {
  readonly classificacao: ClassificacaoAssinatura;
  readonly observacao: string;
  readonly ferramenta: string;
}

/** Classifica a assinatura pelo que o arquivo carrega. NUNCA invalida por não ser
 *  ICP-Brasil; quando há assinatura criptográfica, aponta para validação externa
 *  oficial (VALIDAR/ITI). Sem elementos ⇒ não detectada. */
export function classificarAssinatura(base64: string, textoTranscrito = ''): AnaliseAssinatura {
  const bruto = decodificar(base64);
  const temByteRange = /\/ByteRange\b/.test(bruto);
  const subFilter = extrair(/\/SubFilter\s*\/([A-Za-z0-9_.]+)/, bruto);
  const mencaoImagem = /assinatura|assinad/i.test(textoTranscrito) && !temByteRange;

  if (temByteRange) {
    // Assinatura criptográfica embutida — o TIPO (simples/avançada/qualificada) e a
    // conformidade exigem validação por serviço OFICIAL (VALIDAR/ITI) ou relatório
    // anexado pelo perito. A automação nunca conclui o tipo nem invalida sozinha.
    return {
      classificacao: 'NECESSITA_VALIDACAO_EXTERNA',
      observacao: `Assinatura criptográfica detectada (SubFilter: ${campoSeguro(subFilter || null)}). O tipo e a conformidade exigem validação por serviço oficial (VALIDAR/ITI) ou relatório anexado pelo perito. Não se invalida por não ser ICP-Brasil.`,
      ferramenta: FERRAMENTA,
    };
  }
  if (mencaoImagem) {
    return {
      classificacao: 'ASSINATURA_DIGITALIZADA_COMO_IMAGEM',
      observacao:
        'Há indício de assinatura como imagem/rubrica, sem dicionário de assinatura criptográfica. Requer análise do perito.',
      ferramenta: FERRAMENTA,
    };
  }
  return {
    classificacao: 'ASSINATURA_NAO_DETECTADA',
    observacao: NAO_APRESENTADO,
    ferramenta: FERRAMENTA,
  };
}

// ── C. TRILHA DE AUDITORIA (item 6C) — presença de cada elemento ──────────────
export type StatusElemento =
  | 'PRESENTE_E_VERIFICAVEL'
  | 'PRESENTE_MAS_INCOMPLETO'
  | 'PRESENTE_MAS_INCONSISTENTE'
  | 'NAO_APRESENTADO'
  | 'NAO_APLICAVEL'
  | 'NECESSITA_REVISAO_DO_PERITO';

export interface ItemTrilha {
  readonly elemento: string;
  readonly status: StatusElemento;
  readonly evidencia: string;
}

const PADROES_TRILHA: readonly { elemento: string; re: RegExp }[] = [
  { elemento: 'IP', re: /\b(\d{1,3}\.){3}\d{1,3}\b/ },
  { elemento: 'Data e horário', re: /\b\d{2}[/-]\d{2}[/-]\d{2,4}[ T]\d{2}:\d{2}/ },
  { elemento: 'Fuso horário', re: /\b(UTC|GMT|[-+]\d{2}:\d{2}|BRT|BRST)\b/ },
  { elemento: 'Geolocalização', re: /(lat(itude)?|long(itude)?)[:\s]/i },
  { elemento: 'User-agent', re: /user[-\s]?agent/i },
  { elemento: 'Navegador', re: /\b(chrome|firefox|safari|edge|opera)\b/i },
  { elemento: 'Sistema operacional', re: /\b(android|iphone|ios|windows|linux|mac os)\b/i },
  { elemento: 'IMEI', re: /\bimei\b/i },
  { elemento: 'UUID', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i },
  {
    elemento: 'Identificador da sessão',
    re: /(session[\s_-]?id|id[\s_-]?sess[aã]o|token[\s_-]?sess)/i,
  },
  { elemento: 'OTP', re: /\botp\b/i },
  { elemento: 'SMS', re: /\bsms\b/i },
  { elemento: 'E-mail', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { elemento: 'Token', re: /\btoken\b/i },
  { elemento: 'Carimbo de tempo', re: /(carimbo de tempo|timestamp)/i },
  { elemento: 'Hash do documento', re: /\b(sha-?256|md5|hash)\b/i },
];

/** Verifica CADA elemento da trilha no texto fornecido. Presença ≠ conclusão:
 *  reporta o que consta e transcreve um trecho como evidência; ausência é dita
 *  como tal. Nada é inventado. */
export function analisarTrilhaAuditoria(texto: string): readonly ItemTrilha[] {
  const corpo = texto ?? '';
  return PADROES_TRILHA.map(({ elemento, re }) => {
    const m = re.exec(corpo);
    if (m === null) return { elemento, status: 'NAO_APRESENTADO', evidencia: NAO_APRESENTADO };
    const idx = Math.max(0, m.index - 10);
    return {
      elemento,
      status: 'PRESENTE_MAS_INCOMPLETO',
      evidencia: `…${corpo
        .slice(idx, idx + 60)
        .replace(/\s+/g, ' ')
        .trim()}…`,
    };
  });
}

/** Resumo consolidado por documento (o que a UI/minuta exibe). */
export interface AnaliseDocumento {
  readonly metadados: MetadadosPdf | null;
  readonly assinatura: AnaliseAssinatura | null;
  readonly trilha: readonly ItemTrilha[];
}
