// ─────────────────────────────────────────────────────────────────────────────
// REAQUECIMENTO DE LEADS (decreto 2026-07-22) — leads que esfriaram (do "só
// mandou oi" ao "enviou parte dos documentos e sumiu") podem ser REAQUECIDOS
// pela AHRI, mas SOMENTE com autorização manual do admin, lead a lead.
// Nada aqui dispara sozinho: esta camada só DERIVA o estágio, AUTORA a
// mensagem certa para o estágio e aplica os GUARDRAILS anti-spam.
// Tom: consultora jurídica — profissional, sem emojis (decreto caso Lucas).
// ─────────────────────────────────────────────────────────────────────────────
import { derivarEtapa, type FatosDaJornada } from './jornada-comercial.js';

/** Estágio do lead frio — decide a MENSAGEM do reaquecimento. */
export type EstagioLead =
  | 'SO_CONTATO' // mandou "oi"/pergunta e parou antes de se identificar
  | 'IDENTIFICADO' // deu nome (e talvez cidade) mas parou antes do interesse
  | 'CONSENTIU_SEM_DOCS' // confirmou interesse e não mandou nenhum documento
  | 'DOCS_PARCIAIS' // enviou parte dos documentos e sumiu
  | 'DESISTIU'; // disse que ia deixar quieto — reaquecer exige tato extra

/** Guardrails anti-spam — o reaquecimento NUNCA vira insistência robótica. */
export const REAQUECIMENTO_HORAS_PARA_FRIO = 24; // silêncio mínimo p/ aparecer na lista
export const REAQUECIMENTO_MIN_HORAS_ENTRE = 24; // intervalo mínimo entre tentativas
export const REAQUECIMENTO_MAX_TENTATIVAS = 3; // teto de tentativas por lead

/** O estágio do lead — null quando NÃO é reaquecível (jornada concluída). */
export function derivarEstagioLead(f: FatosDaJornada): EstagioLead | null {
  if (derivarEtapa(f) === 'CONCLUIDA') return null;
  const r = f.registro;
  if (r.desistiu) return 'DESISTIU';
  if (f.docsRecebidos > 0) return 'DOCS_PARCIAIS';
  if (r.consentiu) return 'CONSENTIU_SEM_DOCS';
  if (r.nome !== null) return 'IDENTIFICADO';
  return 'SO_CONTATO';
}

export interface VeredictoReaquecimento {
  readonly pode: boolean;
  readonly motivo: string | null;
}

/** O lead PODE ser reaquecido agora? (intervalo mínimo + teto de tentativas) */
export function podeReaquecer(tentativas: readonly Date[], now: Date): VeredictoReaquecimento {
  if (tentativas.length >= REAQUECIMENTO_MAX_TENTATIVAS) {
    return {
      pode: false,
      motivo: `limite de ${String(REAQUECIMENTO_MAX_TENTATIVAS)} tentativas atingido`,
    };
  }
  const ultima = tentativas.length > 0 ? tentativas[tentativas.length - 1] : null;
  if (ultima) {
    const horas = (now.getTime() - ultima.getTime()) / 3_600_000;
    if (horas < REAQUECIMENTO_MIN_HORAS_ENTRE) {
      return {
        pode: false,
        motivo: `última tentativa há menos de ${String(REAQUECIMENTO_MIN_HORAS_ENTRE)}h`,
      };
    }
  }
  return { pode: true, motivo: null };
}

export interface DadosDoReaquecimento {
  readonly nome: string | null;
  readonly proximoDocumento: string | null;
  readonly docsRecebidos: number;
}

/** A mensagem AUTORADA do reaquecimento — certa para o estágio, nunca genérica. */
export function mensagemDeReaquecimento(estagio: EstagioLead, d: DadosDoReaquecimento): string {
  const tratamento = d.nome !== null && d.nome !== '' ? `Olá, ${primeiroNome(d.nome)}!` : 'Olá!';
  const proximo = d.proximoDocumento ?? 'o documento pendente';
  switch (estagio) {
    case 'SO_CONTATO':
      return (
        'Olá! Aqui é a Ahri, do Projeto Reconstrua. Você entrou em contato interessado(a) em saber mais e nossa conversa acabou parando.\n\n' +
        'Resumindo em uma linha: nossa equipe faz uma análise gratuita do seu consignado do INSS para verificar se existe algum desconto indevido no benefício — e, se houver, é possível buscar a revisão e a recuperação desses valores.\n\n' +
        'Quer que eu te explique como funciona? Sem custo e sem compromisso.'
      );
    case 'IDENTIFICADO':
      return (
        `${tratamento} Aqui é a Ahri, do Projeto Reconstrua. Nossa conversa parou antes de eu te explicar a análise.\n\n` +
        'Ela é gratuita: verificamos o seu consignado do INSS em busca de descontos indevidos no benefício — e, se houver, é possível buscar a revisão e a recuperação dos valores.\n\n' +
        'Você tem interesse em fazer essa análise?'
      );
    case 'CONSENTIU_SEM_DOCS':
      return (
        `${tratamento} Aqui é a Ahri, do Projeto Reconstrua. Você confirmou interesse na análise gratuita do seu consignado, e para começar preciso apenas de: ${proximo}.\n\n` +
        'Pode me enviar o arquivo em PDF por aqui mesmo. Se ficou alguma dúvida sobre o processo, me pergunte — estou à disposição.'
      );
    case 'DOCS_PARCIAIS':
      return (
        `${tratamento} Aqui é a Ahri, do Projeto Reconstrua. Sua análise gratuita está quase pronta para começar: já registrei ${String(d.docsRecebidos)} documento(s) e falta apenas: ${proximo}.\n\n` +
        'Quando puder enviar, seguimos exatamente de onde paramos. Qualquer dúvida, estou à disposição.'
      );
    case 'DESISTIU':
      return (
        `${tratamento} Aqui é a Ahri, do Projeto Reconstrua. Você preferiu não seguir com a análise — e essa decisão está totalmente respeitada.\n\n` +
        'Só quero deixar registrado que a análise continua gratuita e sem compromisso, e que este canal segue à sua disposição para qualquer dúvida. Se quiser retomar, é só me mandar uma mensagem.'
      );
  }
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

// ── RETOMADA AUTOMÁTICA (decreto 2026-07-22) ─────────────────────────────────
// Conversa CAÍDA = a última palavra foi do CLIENTE e a AHRI não respondeu
// (falha de turno). Diferente do reaquecimento (cliente sumiu): aqui a culpa é
// NOSSA — a retomada pede desculpa e CONTINUA o fluxo do ponto exato.

/** Minutos de silêncio nosso a partir dos quais a conversa conta como caída. */
export const RETOMADA_MINUTOS_SEM_RESPOSTA = 30;

export interface DadosDaRetomada {
  readonly nome: string | null;
  readonly cidade: string | null;
  readonly consentiu: boolean;
  readonly proximoDocumento: string | null;
  readonly docsRecebidos: number;
}

/** A mensagem que CONTINUA o fluxo do ponto exato onde a conversa caiu. */
export function mensagemDeRetomada(d: DadosDaRetomada): string {
  const desculpa = 'Desculpe a demora no retorno — tivemos uma instabilidade por aqui. ';
  const proximo = d.proximoDocumento ?? 'o documento pendente';
  if (d.docsRecebidos > 0 || d.consentiu) {
    return (
      desculpa +
      `Retomando o seu atendimento do ponto onde paramos: preciso de ${proximo}. Pode me enviar o arquivo em PDF por aqui mesmo. Qualquer dúvida, estou à disposição.`
    );
  }
  if (d.nome !== null && d.cidade !== null) {
    return (
      desculpa +
      'Retomando: nossa equipe analisa o seu consignado do INSS para verificar se existe alguma irregularidade nos descontos do benefício — a análise é gratuita e sem compromisso. Você tem interesse em fazer essa análise?'
    );
  }
  if (d.nome !== null) {
    return (
      desculpa + `Retomando o seu atendimento: e de qual cidade você fala, ${primeiroNome(d.nome)}?`
    );
  }
  return (
    desculpa +
    'Retomando o seu atendimento: pode me informar o seu nome completo e a cidade onde mora?'
  );
}
