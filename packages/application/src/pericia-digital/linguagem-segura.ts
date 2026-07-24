// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · LINGUAGEM SEGURA (Decreto 2026-07-24)
//
// A REGRA FUNDAMENTAL do módulo: a automação NUNCA inventa dados nem conclui
// fraude/falsidade/invalidade. Quando um elemento não existe nos documentos,
// usa-se EXATAMENTE uma das frases canônicas abaixo. Conclusões jurídicas são do
// advogado; a decisão final é do Judiciário. A minuta é uma MINUTA — só o perito
// humano, revisando e assinando, transforma-a em documento válido.
//
// Este arquivo é puro (sem I/O) e é a fronteira que TODO texto gerado atravessa.
// ─────────────────────────────────────────────────────────────────────────────

/** As DUAS frases canônicas para ausência/impossibilidade — nada além delas. */
export const NAO_APRESENTADO = 'NÃO APRESENTADO NOS DOCUMENTOS ANALISADOS';
export const NAO_VERIFICAVEL = 'NÃO FOI POSSÍVEL VERIFICAR COM OS ELEMENTOS DISPONÍVEIS';

/** Termos de CONCLUSÃO JURÍDICA proibidos em qualquer texto AUTOMÁTICO (a minuta
 *  não afirma fraude, falsidade, inexistência, nulidade nem responsabilidade). */
export const CONCLUSOES_PROIBIDAS: readonly string[] = [
  'fraude comprovada',
  'fraude',
  'contrato falso',
  'assinatura falsa',
  'documento falso',
  'falsidade',
  'falsa',
  'falso',
  'inexistência da contratação',
  'inexistência absoluta',
  'contratação inexistente',
  'nulidade',
  'nulo',
  'ato ilícito',
  'ilícito',
  'responsabilidade civil',
  'dever de indenizar',
  'dano moral',
  'golpe',
  'estelionato',
  'crime',
  'falsificação',
  'adulteração comprovada',
];

/** Campos que a automação JAMAIS pode inventar (só transcreve se existir no doc). */
export const CAMPOS_NUNCA_INVENTADOS: readonly string[] = [
  'endereço IP',
  'geolocalização',
  'data',
  'horário',
  'IMEI',
  'UUID',
  'identificação de dispositivo',
  'user-agent',
  'metadados',
  'certificado digital',
  'hash',
  'prova de vida',
  'resultado biométrico',
  'manifestação de vontade',
  'assinatura',
  'número de contrato',
  'nome do banco',
  'valor',
  'norma técnica aplicada',
  'ferramenta utilizada',
  'resultado de consulta externa',
  'conclusão pericial',
];

/** As ÚNICAS conclusões técnicas que o sistema pode SUGERIR (nunca aprovar). */
export const CONCLUSOES_PERMITIDAS = {
  A: 'ELEMENTOS TECNICAMENTE CONSISTENTES',
  B: 'ELEMENTOS INSUFICIENTES PARA ATRIBUIÇÃO SEGURA DE AUTORIA',
  C: 'INCONSISTÊNCIAS TÉCNICAS RELEVANTES IDENTIFICADAS',
  D: 'IMPOSSIBILIDADE DE CONCLUSÃO COM OS DOCUMENTOS DISPONÍVEIS',
  E: 'NECESSIDADE DE DOCUMENTAÇÃO COMPLEMENTAR',
} as const;
export type TipoConclusao = keyof typeof CONCLUSOES_PERMITIDAS;

/** Redige um valor com segurança: presente ⇒ o próprio valor (transcrito, nunca
 *  inventado); ausente ⇒ a frase canônica. `motivo` escolhe qual ausência. */
export function campoSeguro(
  valor: string | number | null | undefined,
  motivo: 'ausente' | 'nao-verificavel' = 'ausente',
): string {
  if (valor === null || valor === undefined) {
    return motivo === 'nao-verificavel' ? NAO_VERIFICAVEL : NAO_APRESENTADO;
  }
  const s = String(valor).trim();
  return s === '' ? (motivo === 'nao-verificavel' ? NAO_VERIFICAVEL : NAO_APRESENTADO) : s;
}

/** Um texto AUTOMÁTICO viola a regra fundamental? Devolve os termos proibidos
 *  encontrados (vazio = seguro). Usado como TRAVA antes de emitir qualquer minuta.
 *  Observação: aplica-se ao conteúdo AUTORADO pela máquina — citações do perito
 *  humano (aprovação) passam por outra fronteira. */
export function termosProibidosEncontrados(texto: string): readonly string[] {
  const t = texto.toLowerCase();
  const achados = new Set<string>();
  for (const termo of CONCLUSOES_PROIBIDAS) {
    // Palavra/expressão delimitada por não-letra (evita casar dentro de outra).
    const re = new RegExp(`(^|[^a-zà-ú])${escaparRegex(termo)}([^a-zà-ú]|$)`, 'i');
    if (re.test(t)) achados.add(termo);
  }
  return [...achados];
}

/** true ⇒ o texto está livre de conclusão jurídica proibida (pode ser emitido). */
export function textoSeguro(texto: string): boolean {
  return termosProibidosEncontrados(texto).length === 0;
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
