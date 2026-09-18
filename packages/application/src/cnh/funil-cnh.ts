// ─────────────────────────────────────────────────────────────────────────────
// FUNIL CNH (Reconstrua CNH, 2026-09-18) — o roteiro de atendimento da tese de
// CNH (suspensão e cassação) do escritório do Dr. Glauco Voigt, etapas 1 a 4:
// recepção → qualificação → viabilidade → proposta → aceite.
//
// Aqui vivem as REGRAS: etapas e transições, a ficha do lead, os motivos de
// descarte, a tabela de honorários e os TEXTOS CANÔNICOS do roteiro. A conversa
// é da AHRI (ahri-cnh.ts), mas preço, descarte, transferência e aceite saem
// SEMPRE com as palavras do roteiro — a IA decide o momento, nunca o valor.
// ─────────────────────────────────────────────────────────────────────────────

/** As etapas do funil (os rótulos seguem as colunas do roteiro original). */
export type EtapaCnh =
  | 'recepcao'
  | 'qualificacao'
  | 'viabilidade'
  | 'proposta'
  | 'morno'
  | 'aceito'
  | 'transferido'
  | 'descartado';

export const ETAPAS_CNH: readonly EtapaCnh[] = [
  'recepcao',
  'qualificacao',
  'viabilidade',
  'proposta',
  'morno',
  'aceito',
  'transferido',
  'descartado',
];

export const ROTULO_ETAPA_CNH: Readonly<Record<EtapaCnh, string>> = {
  recepcao: 'Recepção',
  qualificacao: 'Em qualificação',
  viabilidade: 'Explicação de viabilidade',
  proposta: 'Proposta enviada',
  morno: 'Lead morno',
  aceito: 'Coleta de dados',
  transferido: 'Com o advogado',
  descartado: 'Descarte',
};

/** Etapas em que a AHRI conversa sozinha. Nas outras, quem responde é gente
 *  (aceito e transferido) ou ninguém (descartado, até o cliente voltar). */
export const ETAPAS_DA_AHRI: ReadonlySet<EtapaCnh> = new Set<EtapaCnh>([
  'recepcao',
  'qualificacao',
  'viabilidade',
  'proposta',
  'morno',
]);

/** Para onde a AHRI pode levar o lead a partir de cada etapa (ficar na mesma
 *  etapa é sempre permitido). O painel pode mover para qualquer uma. */
const TRANSICOES: Readonly<Record<EtapaCnh, readonly EtapaCnh[]>> = {
  recepcao: ['qualificacao', 'descartado', 'transferido'],
  qualificacao: ['viabilidade', 'descartado', 'transferido'],
  viabilidade: ['proposta', 'morno', 'descartado', 'transferido'],
  proposta: ['aceito', 'morno', 'descartado', 'transferido'],
  morno: ['qualificacao', 'viabilidade', 'proposta', 'aceito', 'descartado', 'transferido'],
  aceito: [],
  transferido: [],
  descartado: [],
};

export function transicaoPermitida(de: EtapaCnh, para: EtapaCnh): boolean {
  return de === para || TRANSICOES[de].includes(para);
}

/** A situação que o cliente descreve na Pergunta 2 (ramos A a E do roteiro). */
export type SituacaoCnh =
  'aviso-suspensao' | 'suspensa' | 'cassacao' | 'indicacao-condutor' | 'outra';

export const ROTULO_SITUACAO_CNH: Readonly<Record<SituacaoCnh, string>> = {
  'aviso-suspensao': 'Carta do DETRAN avisando suspensão',
  suspensa: 'CNH já suspensa ou cumprindo suspensão',
  cassacao: 'Notificação ou decisão de cassação',
  'indicacao-condutor': 'Indicou condutor e os pontos vieram para ele',
  outra: 'Outra situação da habilitação (PPD, bloqueio de prontuário)',
};

export type TipoCasoCnh = 'suspensao' | 'cassacao';

/** Honorários FIXOS da tese (tabela do roteiro), à vista ou em até 2 vezes. */
export const HONORARIOS_CNH: Readonly<Record<TipoCasoCnh, number>> = {
  suspensao: 1_500,
  cassacao: 2_000,
};
export const PARCELAS_MAXIMAS_CNH = 2;

/** Os únicos valores em reais que podem aparecer numa conversa: os
 *  honorários e as parcelas. Qualquer outro número em R$ é invenção. */
export function valoresPermitidosCnh(): ReadonlySet<number> {
  const valores = new Set<number>();
  for (const v of Object.values(HONORARIOS_CNH)) {
    valores.add(v);
    valores.add(Math.round((v / PARCELAS_MAXIMAS_CNH) * 100) / 100);
  }
  return valores;
}

export type MotivoDescarteCnh =
  | 'ja-tem-advogado'
  | 'multa-simples'
  | 'criminal'
  | 'cassacao-cumprida'
  | 'decisao-antiga-cumprida'
  | 'indicacao-fora-do-prazo'
  | 'sem-condicao'
  | 'outro';

export const ROTULO_DESCARTE_CNH: Readonly<Record<MotivoDescarteCnh, string>> = {
  'ja-tem-advogado': 'Já tem advogado',
  'multa-simples': 'Recurso de multa simples (sem risco à CNH)',
  criminal: 'Matéria criminal',
  'cassacao-cumprida': 'Cassação cumprida há mais de 2 anos',
  'decisao-antiga-cumprida': 'Decisão de mais de 5 anos, já cumprida',
  'indicacao-fora-do-prazo': 'Indicação de condutor fora do prazo',
  'sem-condicao': 'Sem condição de pagar',
  outro: 'Outro motivo',
};

/** A FICHA do lead — o que a AHRI apurou até agora. Tudo começa null. */
export interface FichaCnh {
  readonly nome: string | null;
  readonly cidade: string | null;
  readonly jaTemAdvogado: boolean | null;
  readonly situacao: SituacaoCnh | null;
  /** O problema nas palavras do cliente (uma ou duas frases). */
  readonly relato: string | null;
  /** Carta do DETRAN: recente (até 120 dias), antiga, ou não recebeu. */
  readonly cartaDetran: 'recente' | 'antiga' | 'nao-recebeu' | null;
  readonly cartaDetranQuando: string | null;
  /** Decisão final há mais de 5 anos sem cumprimento ⇒ possível prescrição. */
  readonly prescricaoPossivel: boolean | null;
  /** Motorista profissional (EAR) — alta prioridade (limite de 40 pontos). */
  readonly motoristaProfissional: boolean | null;
  readonly atividade: string | null;
  /** Nenhuma/poucas notificações ⇒ tese forte (Súmula 312/STJ). */
  readonly notificacoesAnteriores: 'nenhuma-ou-poucas' | 'todas' | 'nao-lembra' | null;
  /** Só no ramo de indicação de condutor (FICI em até 30 dias). */
  readonly indicacaoNoPrazo: boolean | null;
  readonly temDocumentos: boolean | null;
  readonly tipoCaso: TipoCasoCnh | null;
  /** Prazo curto (tese, 2026-09-18): a suspensão começa em dias ou o prazo de
   *  defesa está acabando — é o caso da ação judicial com pedido de liminar.
   *  Prioridade no painel; a AHRI segue o roteiro sem perder tempo. */
  readonly prazoCurto: boolean | null;
}

export const FICHA_CNH_VAZIA: FichaCnh = {
  nome: null,
  cidade: null,
  jaTemAdvogado: null,
  situacao: null,
  relato: null,
  cartaDetran: null,
  cartaDetranQuando: null,
  prescricaoPossivel: null,
  motoristaProfissional: null,
  atividade: null,
  notificacoesAnteriores: null,
  indicacaoNoPrazo: null,
  temDocumentos: null,
  tipoCaso: null,
  prazoCurto: null,
};

/** O escritório que a AHRI representa neste funil (configurável). */
export interface EscritorioCnh {
  /** Como a AHRI se refere ao advogado ("Dr. Glauco"). */
  readonly advogadoCurto: string;
  /** Nome completo ("Dr. Glauco Voigt"). */
  readonly advogadoCompleto: string;
  readonly area: string;
}

export const ESCRITORIO_CNH_PADRAO: EscritorioCnh = {
  advogadoCurto: 'Dr. Glauco',
  advogadoCompleto: 'Dr. Glauco Voigt',
  area: 'Direito de Trânsito',
};

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo relógio de Brasília (UTC-3). */
export function saudacaoDoHorario(agora: Date): string {
  const hora = (agora.getUTCHours() + 21) % 24;
  if (hora >= 5 && hora < 12) return 'bom dia';
  if (hora >= 12 && hora < 18) return 'boa tarde';
  return 'boa noite';
}

const primeiroNome = (nome: string | null): string => {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  return p === '' ? '' : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/** "Entendi, João." quando há nome; "Entendi." quando não há. */
const comNome = (antes: string, nome: string | null, depois: string): string => {
  const n = primeiroNome(nome);
  return n === '' ? `${antes}${depois}` : `${antes}, ${n}${depois}`;
};

/** "João, você…" quando há nome; "Você…" quando não há. */
const abre = (nome: string | null, frase: string): string => {
  const n = primeiroNome(nome);
  return n === '' ? frase.charAt(0).toUpperCase() + frase.slice(1) : `${n}, ${frase}`;
};

const reais = (v: number): string =>
  v
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
    // O Intl separa 'R$' do número com espaço INQUEBRÁVEL — no WhatsApp e na
    // validação queremos o espaço comum.
    .replace(/\u00a0/g, ' ');

// ── TEXTOS CANÔNICOS (as palavras do roteiro) ────────────────────────────────

/** Etapa 1 — a saudação e o pedido de nome e cidade. */
export function textoSaudacaoCnh(
  agora: Date,
  esc: EscritorioCnh = ESCRITORIO_CNH_PADRAO,
): string[] {
  const s = saudacaoDoHorario(agora);
  return [
    `Olá, ${s}! Aqui é o assistente virtual do escritório do ${esc.advogadoCompleto}, advogado com atuação em ${esc.area}.`,
    'Para começarmos, poderia me passar seu nome e a cidade onde mora?',
  ];
}

/** O encerramento de cada motivo de descarte — as palavras do roteiro. */
export function textoDescarteCnh(motivo: MotivoDescarteCnh, nome: string | null): string[] {
  switch (motivo) {
    case 'ja-tem-advogado':
      return [
        'Entendi! Nesse caso é melhor seguir com o profissional que já está te acompanhando. Qualquer coisa é só chamar.',
      ];
    case 'multa-simples':
      return [
        'Entendi! Nosso escritório atua especificamente em casos que envolvem risco de perder a habilitação. Para recurso de multa que não ameaça a sua CNH, o caminho é apresentar defesa direto no órgão autuador. Qualquer outra questão sobre habilitação, é só chamar.',
      ];
    case 'criminal':
      return [
        'Entendi. Pelo que você me contou, sua situação envolve matéria criminal, que está fora da nossa atuação. O caminho é procurar um advogado criminalista. Qualquer outra questão sobre CNH no futuro, estamos à disposição.',
      ];
    case 'cassacao-cumprida':
      return [
        'Como já passaram mais de 2 anos da cassação, a lei permite refazer o processo de habilitação direto no DETRAN — basta procurar uma autoescola. Não há necessidade de medida judicial. Qualquer dúvida no futuro, é só chamar.',
      ];
    case 'decisao-antiga-cumprida':
      return [
        comNome(
          'Entendi',
          nome,
          '. Pelo tempo que já passou e pelo que você me contou, infelizmente seu caso não se encaixa no perfil que atendemos no momento. Qualquer coisa no futuro, é só chamar.',
        ),
      ];
    case 'indicacao-fora-do-prazo':
      return [
        comNome(
          'Entendi',
          nome,
          '. Sem a indicação tempestiva do condutor, infelizmente os pontos foram lançados regularmente, e seu caso não se encaixa no perfil que atendemos. Qualquer coisa no futuro, é só chamar.',
        ),
      ];
    case 'sem-condicao':
      return [
        'Compreendo. Infelizmente, neste momento o escritório não trabalha com modelos alternativos para essa tese. Você pode buscar a Defensoria Pública do seu estado, que oferece assistência gratuita para quem comprovar hipossuficiência. Posso te ajudar com mais alguma coisa?',
      ];
    case 'outro':
      return [
        comNome(
          'Entendi',
          nome,
          '. Pelo que você me contou, seu caso não se encaixa no perfil que atendemos no momento. Qualquer coisa no futuro, é só chamar.',
        ),
      ];
  }
}

/** Etapa 4 — a proposta, com o valor da TABELA (nunca o que a IA escreveu). */
export function textoPropostaCnh(tipo: TipoCasoCnh, nome: string | null): string[] {
  const rotulo = tipo === 'suspensao' ? 'SUSPENSÃO' : 'CASSAÇÃO';
  return [
    abre(
      nome,
      `com base no que conversamos, identifico que seu caso é de ${rotulo}. Os honorários para essa atuação são fixos, no valor de ${reais(HONORARIOS_CNH[tipo])}, à vista ou parcelados em até ${String(PARCELAS_MAXIMAS_CNH)} vezes.`,
    ),
    'Esse valor cobre toda a atuação do escritório no seu caso — análise inicial, defesa administrativa, eventuais recursos e ação judicial, se necessária — até a decisão final. Custas processuais e taxas do DETRAN são tratadas à parte.',
    'Posso seguir adiante e te encaminhar o contrato para assinatura digital?',
  ];
}

/** O aceite: a equipe assume a coleta de dados, o contrato e o pagamento. */
export function textoAceiteCnh(
  nome: string | null,
  esc: EscritorioCnh = ESCRITORIO_CNH_PADRAO,
): string[] {
  return [
    `${comNome('Perfeito', nome, '!')} Vou te encaminhar o contrato e o link de pagamento para assinatura digital.`,
    `A equipe do ${esc.advogadoCurto} te envia tudo por aqui mesmo, com o passo a passo.`,
  ];
}

/** Urgência ou "quero falar com o doutor agora": o advogado assume. */
export function textoTransferenciaCnh(
  nome: string | null,
  esc: EscritorioCnh = ESCRITORIO_CNH_PADRAO,
): string[] {
  return [
    `${comNome('Entendi', nome, '.')} Vou passar o seu atendimento agora para o ${esc.advogadoCurto}, que continua com você por aqui.`,
  ];
}

/** PPD e bloqueio de prontuário: o escritório atende (tese, 2026-09-18), mas a
 *  tabela só tem suspensão e cassação — a proposta desses casos é do advogado. */
export function textoPropostaComAdvogadoCnh(
  nome: string | null,
  esc: EscritorioCnh = ESCRITORIO_CNH_PADRAO,
): string[] {
  return [
    `${comNome('Entendi', nome, '.')} Casos de PPD e de bloqueio de prontuário o ${esc.advogadoCurto} avalia pessoalmente antes de passar a proposta.`,
    `Vou passar o seu atendimento para ele, que continua com você por aqui.`,
  ];
}

/** O follow-up do lead morno (disparado pelo painel, com aprovação). */
export function textoFollowupCnh(nome: string | null): string {
  return `${comNome('Oi', nome, '!')} Passando para saber se ficou alguma dúvida sobre o seu caso da CNH. Se houver prazo correndo, quanto antes começarmos, mais opções de defesa existem. Posso te ajudar a seguir?`;
}

/** A próxima pergunta do roteiro pela ficha — a RESERVA quando a IA falha:
 *  o lead nunca fica sem resposta nem recebe texto inventado. */
export function proximaPerguntaCnh(ficha: FichaCnh, etapa: EtapaCnh, agora: Date): string[] {
  const nome = ficha.nome;
  if (nome === null) return textoSaudacaoCnh(agora);
  if (ficha.jaTemAdvogado === null)
    return [
      `${comNome('Prazer', nome, '.')} Antes de tudo: você já tem algum advogado cuidando do seu caso da CNH?`,
    ];
  if (ficha.situacao === null)
    return [
      abre(nome, 'me conta brevemente: o que está acontecendo com a sua CNH ou habilitação?'),
    ];
  if (ficha.cartaDetran === null)
    return [
      'Você recebeu alguma carta ou notificação do DETRAN nos últimos meses? Se sim, lembra mais ou menos o que ela dizia e há quanto tempo recebeu?',
    ];
  if (ficha.motoristaProfissional === null)
    return [
      abre(
        nome,
        'você usa o veículo para trabalhar? Por exemplo: motorista de aplicativo, taxista, caminhoneiro, motorista de ônibus ou de entregas?',
      ),
    ];
  if (ficha.notificacoesAnteriores === null)
    return [
      'Você recebeu cartas anteriores do DETRAN sobre as multas que estão sendo somadas? Lembra de ter sido avisado de cada uma?',
    ];
  if (ficha.situacao === 'indicacao-condutor' && ficha.indicacaoNoPrazo === null)
    return [
      'Quando você recebeu aquela multa, enviou ao DETRAN o formulário identificando o condutor real (FICI), com cópia da CNH dele? E foi em até 30 dias após receber a notificação?',
    ];
  if (ficha.temDocumentos === null)
    return [
      abre(
        nome,
        'você tem em mãos a carta do DETRAN, sua CNH e um comprovante de residência atual?',
      ),
    ];
  if (etapa === 'proposta' || etapa === 'morno')
    return ['Posso seguir adiante e te encaminhar o contrato para assinatura digital?'];
  return ['Posso seguir e te enviar a proposta de honorários?'];
}
