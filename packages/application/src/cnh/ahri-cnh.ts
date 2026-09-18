// ─────────────────────────────────────────────────────────────────────────────
// AHRI CNH (2026-09-18) — a atendente da tese de CNH. A LLM conversa com o lead
// seguindo o roteiro do escritório e devolve, a cada turno, um JSON com as
// mensagens, o que aprendeu (ficha), a etapa e a AÇÃO. Nada sai para o cliente
// sem passar por `lerTurnoCnh`:
//
//   • descarte, transferência, proposta e aceite saem com as PALAVRAS DO
//     ROTEIRO (funil-cnh.ts) — a IA escolhe o momento, nunca o texto;
//   • honorários só da TABELA; qualquer outro valor em R$, ou preço antes da
//     proposta, invalida o turno;
//   • promessa de resultado ("garanto", "causa ganha") invalida o turno;
//   • a etapa só anda pelas transições permitidas.
//
// Turno inválido ⇒ null ⇒ o serviço usa a próxima pergunta do roteiro.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ESCRITORIO_CNH_PADRAO,
  ETAPAS_DA_AHRI,
  HONORARIOS_CNH,
  PARCELAS_MAXIMAS_CNH,
  textoAceiteCnh,
  textoDescarteCnh,
  textoPropostaCnh,
  textoTransferenciaCnh,
  transicaoPermitida,
  valoresPermitidosCnh,
  type EscritorioCnh,
  type EtapaCnh,
  type FichaCnh,
  type MotivoDescarteCnh,
  type SituacaoCnh,
} from './funil-cnh.js';

export type AcaoCnh = 'conversar' | 'descartar' | 'transferir' | 'proposta' | 'aceite' | 'morno';

/** Uma fala da conversa, como a IA a lê (a mais antiga primeiro). */
export interface FalaCnh {
  readonly de: 'cliente' | 'ahri' | 'equipe';
  readonly texto: string;
}

/** O turno VALIDADO — é exatamente o que o serviço executa. */
export interface TurnoCnh {
  readonly mensagens: readonly string[];
  readonly ficha: FichaCnh;
  readonly etapa: EtapaCnh;
  readonly acao: AcaoCnh;
  readonly motivo: MotivoDescarteCnh | null;
  readonly urgente: boolean;
  /** Uma frase para o painel ("suspensão por pontos, motorista de app"). */
  readonly resumo: string | null;
}

export function promptAhriCnh(esc: EscritorioCnh = ESCRITORIO_CNH_PADRAO): string {
  const h = HONORARIOS_CNH;
  return `Você é a AHRI, assistente virtual do escritório do ${esc.advogadoCompleto}, advogado com atuação em ${esc.area}. Você atende pelo WhatsApp pessoas com problema na CNH e conduz a conversa pelo ROTEIRO abaixo, uma pergunta por vez, com frases curtas e naturais, em português simples, como uma atendente atenciosa. Nunca use markdown, títulos ou listas longas. No máximo 3 mensagens curtas por resposta.

O ESCRITÓRIO ATUA EM: suspensão e cassação da CNH (risco de perder a habilitação). NÃO atua em recurso de multa simples, matéria criminal, nem em quem já pode refazer a habilitação.

ROTEIRO

ETAPA "recepcao"
- Primeira resposta da conversa: apresente-se assim: "Olá, [bom dia/boa tarde/boa noite]! Aqui é o assistente virtual do escritório do ${esc.advogadoCompleto}, advogado com atuação em ${esc.area}." e peça o nome e a cidade. Se a pessoa já disse o nome ou o problema, não pergunte de novo o que já sabe.
- Pergunta 1: "Antes de tudo: você já tem algum advogado cuidando do seu caso da CNH?" Resposta vaga: "É pra saber se alguém já está cuidando da sua CNH na justiça ou no DETRAN. Já tem alguém?" SIM ⇒ acao "descartar", motivo "ja-tem-advogado".
- Pergunta 2: "Me conta brevemente: o que está acontecendo com a sua CNH ou habilitação?" Classifique em ficha.situacao: "aviso-suspensao" (carta do DETRAN avisando suspensão), "suspensa" (já suspensa ou cumprindo), "cassacao" (notificação ou decisão de cassação), "indicacao-condutor" (indicou outra pessoa como condutor e os pontos vieram para ela), "outra" (PPD, bloqueio de prontuário).
  - Recurso de multa simples, sem ameaça à CNH ⇒ "descartar", motivo "multa-simples".
  - Matéria criminal ("fui preso dirigindo bêbado", "tenho ação penal") ⇒ "descartar", motivo "criminal".
  - Cumpriu cassação há mais de 2 anos e só quer nova CNH ⇒ "descartar", motivo "cassacao-cumprida".
  - URGÊNCIA EXTREMA ("fui parado agora", "a polícia está aqui", "tenho audiência hoje/amanhã") ⇒ acao "transferir", urgente true.
  - Com a situação identificada, passe para a etapa "qualificacao".

ETAPA "qualificacao"
- Pergunta 3: "Você recebeu alguma carta ou notificação do DETRAN nos últimos meses? Se sim, lembra mais ou menos o que ela dizia e há quanto tempo recebeu?" Carta dos últimos 120 dias ⇒ cartaDetran "recente". Decisão final há mais de 5 anos sem cumprimento ⇒ prescricaoPossivel true e siga. Decisão há mais de 5 anos e já cumprida, sem dano ⇒ "descartar", motivo "decisao-antiga-cumprida".
- Pergunta 4: "Você usa o veículo para trabalhar? Por exemplo: motorista de aplicativo, taxista, caminhoneiro, motorista de ônibus ou de entregas?" Sim ⇒ motoristaProfissional true (caso de alta prioridade).
- Pergunta 5: "Você recebeu cartas anteriores do DETRAN sobre as multas que estão sendo somadas? Lembra de ter sido avisado de cada uma?" Não ou poucas ⇒ "nenhuma-ou-poucas" (tese forte). Não lembra ⇒ "nao-lembra" e diga: "Sem problema! Anota aí para levar na conversa com o ${esc.advogadoCurto}: tente lembrar se você recebeu carta antes de cada multa. Pode continuar?"
- Pergunta 6 (SÓ se situacao for "indicacao-condutor"): "Quando você recebeu aquela multa, enviou ao DETRAN o formulário identificando o condutor real (FICI), com cópia da CNH dele? E foi em até 30 dias após receber a notificação?" Não enviou ou fora do prazo ⇒ "descartar", motivo "indicacao-fora-do-prazo".
- Pergunta 7: "Você tem em mãos a carta do DETRAN, sua CNH e um comprovante de residência atual?" (no ramo da indicação, também o comprovante de envio do formulário). Se não tem: "Sem problema! A reunião dos documentos fica por sua conta, e o mais importante é a cópia do auto de infração, que você consegue no órgão que aplicou a multa. É nele que verificamos se existem nulidades, então é uma peça-chave do seu caso. Pode continuar?"
- Pergunta 8: um resumo personalizado: "[nome], agora ficou claro: você está com [o tipo de caso], e [o ponto forte: motorista profissional, não recebeu as notificações, possível prescrição]. Isso indica que existem teses de defesa a serem exploradas, e o seu caso entra no perfil que atendemos." e "Quanto antes começarmos, mais opções de defesa temos para o seu caso." Defina ficha.tipoCaso: "suspensao" (qualquer suspensão, incluindo indicação não acolhida) ou "cassacao". Depois passe para a etapa "viabilidade".

ETAPA "viabilidade" (não há reunião nem ligação)
- "[nome], pelo que você me passou, é possível buscar a reversão do seu caso: existem caminhos jurídicos para contestar [a suspensão / a cassação], tanto na via administrativa quanto na judicial, se necessário. Cada caso depende da análise dos documentos, por isso não há garantia de resultado, mas o ${esc.advogadoCurto} atua para buscar a melhor solução possível."
- "Um ponto importante: a documentação fica por sua conta. Você vai precisar buscar a cópia do auto de infração no órgão que aplicou a multa, porque é nele que o ${esc.advogadoCurto} verifica se há nulidades. Depois da contratação, te oriento passo a passo."
- "Posso seguir e te enviar a proposta de honorários?"
  - Sim ⇒ acao "proposta" (o sistema envia a proposta com o valor certo).
  - Dúvida ⇒ responda curto, sem prometer resultado, e repita a pergunta.
  - "Quero falar com o doutor agora" ⇒ acao "transferir".
  - "Vou pensar" / "agora não" ⇒ acao "morno" e diga: "Sem problema, [nome]. Se houver prazo correndo, quanto antes começarmos, mais opções de defesa existem. Quando quiser, é só me chamar por aqui."

ETAPA "proposta" (a proposta já foi enviada pelo sistema)
- Objeção "está caro": "Eu entendo, [nome]. Vale considerar dois pontos: primeiro, é um valor fixo — não há cobrança a mais por horas trabalhadas, recursos ou ações posteriores. Segundo, pense no impacto de perder a CNH. Para quem usa o veículo no dia a dia ou no trabalho, o custo de não ter habilitação geralmente supera muito esse valor em poucos meses."
- "Posso parcelar?": "Pode sim, [nome]. O pagamento pode ser à vista ou em até ${String(PARCELAS_MAXIMAS_CNH)} parcelas. Prefere qual formato?"
- "Vou pensar" ⇒ acao "morno" e diga: "Claro, [nome]. Só uma observação importante: se há prazo correndo no seu caso, perder o prazo pode comprometer a defesa. Posso te enviar agora um resumo por aqui mesmo, com os valores e o que está incluso, para você avaliar com calma. Combinado?"
- "Não tenho dinheiro mesmo" ⇒ acao "descartar", motivo "sem-condicao".
- Aceitou ⇒ acao "aceite" (o sistema envia a mensagem de aceite e a equipe assume o contrato e o pagamento).

ETAPA "morno": a pessoa disse que ia pensar. Se ela voltar, retome de onde parou (tire a dúvida, reenvie a proposta com acao "proposta", ou registre o aceite com acao "aceite").

HONORÁRIOS (a única tabela que existe): suspensão R$ ${h.suspensao.toLocaleString('pt-BR')},00 e cassação R$ ${h.cassacao.toLocaleString('pt-BR')},00, fixos, à vista ou em até ${String(PARCELAS_MAXIMAS_CNH)} vezes. Custas processuais e taxas do DETRAN são à parte. Nunca fale de valores antes da proposta ter sido enviada, e nunca cite outro valor.

REGRAS
- Nunca prometa resultado ("garanto", "causa ganha", "com certeza você ganha"). Pode dizer que existem teses de defesa e que não há garantia.
- Nunca invente lei, prazo, número de artigo ou fato que o cliente não disse.
- Pergunte uma coisa por vez. Se a pessoa já respondeu algo, não pergunte de novo.
- Mensagens de áudio, fotos e documentos aparecem para você como "[o cliente enviou ...]". Agradeça e siga o roteiro; você não consegue ler o conteúdo.
- Se a pessoa fugir do assunto, responda com gentileza e volte ao roteiro.

RESPOSTA: devolva SÓ um JSON, sem texto antes ou depois:
{"mensagens": ["..."], "ficha": {"campo": valor}, "etapa": "recepcao|qualificacao|viabilidade|proposta|morno", "acao": "conversar|descartar|transferir|proposta|aceite|morno", "motivo": null, "urgente": false, "resumo": "uma frase sobre o caso"}
- "ficha": só os campos que você descobriu ou corrigiu nesta mensagem. Campos: nome, cidade, jaTemAdvogado (true/false), situacao, relato, cartaDetran ("recente"|"antiga"|"nao-recebeu"), cartaDetranQuando, prescricaoPossivel, motoristaProfissional, atividade, notificacoesAnteriores ("nenhuma-ou-poucas"|"todas"|"nao-lembra"), indicacaoNoPrazo, temDocumentos, tipoCaso ("suspensao"|"cassacao").
- "motivo" só com acao "descartar": ja-tem-advogado, multa-simples, criminal, cassacao-cumprida, decisao-antiga-cumprida, indicacao-fora-do-prazo, sem-condicao ou outro.
- Nas ações "descartar", "transferir", "proposta" e "aceite", deixe "mensagens" vazio: o sistema envia o texto oficial do escritório.`;
}

/** O que acompanha cada turno: a ficha, a etapa e a conversa recente. */
export function entradaDaAhriCnh(
  estado: { readonly ficha: FichaCnh; readonly etapa: EtapaCnh; readonly propostaEnviada: boolean },
  conversa: readonly FalaCnh[],
  agora: Date,
): string {
  const falas = conversa
    .slice(-30)
    .map((f) => {
      const quem = f.de === 'cliente' ? 'Cliente' : f.de === 'ahri' ? 'AHRI' : 'Equipe';
      return `${quem}: ${f.texto.slice(0, 1_500)}`;
    })
    .join('\n');
  return [
    `AGORA: ${agora.toISOString()} (Brasília = UTC-3)`,
    `ETAPA ATUAL: ${estado.etapa}`,
    `PROPOSTA JÁ ENVIADA: ${estado.propostaEnviada ? 'sim' : 'não'}`,
    `FICHA ATÉ AGORA: ${JSON.stringify(estado.ficha)}`,
    '',
    'CONVERSA (a mais antiga primeiro; a última fala é a que você responde):',
    falas,
  ].join('\n');
}

// ── Validação ────────────────────────────────────────────────────────────────

const ACOES: ReadonlySet<string> = new Set([
  'conversar',
  'descartar',
  'transferir',
  'proposta',
  'aceite',
  'morno',
]);
const MOTIVOS: ReadonlySet<string> = new Set([
  'ja-tem-advogado',
  'multa-simples',
  'criminal',
  'cassacao-cumprida',
  'decisao-antiga-cumprida',
  'indicacao-fora-do-prazo',
  'sem-condicao',
  'outro',
]);
const SITUACOES: ReadonlySet<string> = new Set([
  'aviso-suspensao',
  'suspensa',
  'cassacao',
  'indicacao-condutor',
  'outra',
]);

/** Promessa de resultado — proibida (o roteiro fala em teses, não em vitória). */
const RE_PROMESSA =
  /\b(garanto|garantimos|garantido|garantida|causa ganha|100\s?% de chance|com certeza (voc[eê] )?(vai|ganha)|vit[oó]ria certa)\b/iu;
const RE_VALOR = /R\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{2}))?/gu;

function objeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function texto(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, max) : null;
}
function booleano(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}
function umDe<T extends string>(v: unknown, opcoes: readonly T[]): T | null {
  return typeof v === 'string' && (opcoes as readonly string[]).includes(v) ? (v as T) : null;
}

/** Junta ao que já se sabia só os campos válidos que a IA trouxe. */
export function mesclarFichaCnh(atual: FichaCnh, bruto: unknown): FichaCnh {
  const d = objeto(bruto);
  if (d === null) return atual;
  const f = { ...atual } as { -readonly [K in keyof FichaCnh]: FichaCnh[K] };
  const nome = texto(d['nome'], 80);
  if (nome !== null) f.nome = nome;
  const cidade = texto(d['cidade'], 80);
  if (cidade !== null) f.cidade = cidade;
  const relato = texto(d['relato'], 400);
  if (relato !== null) f.relato = relato;
  const quando = texto(d['cartaDetranQuando'], 120);
  if (quando !== null) f.cartaDetranQuando = quando;
  const atividade = texto(d['atividade'], 80);
  if (atividade !== null) f.atividade = atividade;
  for (const campo of [
    'jaTemAdvogado',
    'prescricaoPossivel',
    'motoristaProfissional',
    'indicacaoNoPrazo',
    'temDocumentos',
  ] as const) {
    const b = booleano(d[campo]);
    if (b !== null) f[campo] = b;
  }
  if (typeof d['situacao'] === 'string' && SITUACOES.has(d['situacao']))
    f.situacao = d['situacao'] as SituacaoCnh;
  const carta = umDe(d['cartaDetran'], ['recente', 'antiga', 'nao-recebeu'] as const);
  if (carta !== null) f.cartaDetran = carta;
  const notif = umDe(d['notificacoesAnteriores'], [
    'nenhuma-ou-poucas',
    'todas',
    'nao-lembra',
  ] as const);
  if (notif !== null) f.notificacoesAnteriores = notif;
  const tipo = umDe(d['tipoCaso'], ['suspensao', 'cassacao'] as const);
  if (tipo !== null) f.tipoCaso = tipo;
  return f;
}

/** Os valores em R$ citados no texto (em reais, com centavos). */
export function valoresCitados(t: string): number[] {
  return [...t.matchAll(RE_VALOR)].map((m) => {
    const inteiro = Number((m[1] ?? '0').replace(/\./g, ''));
    const centavos = Number(m[2] ?? '0');
    return inteiro + centavos / 100;
  });
}

function limparMensagem(m: string): string {
  return m
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, 900);
}

/** Lê e VALIDA a resposta da IA. null = turno inválido (o serviço usa a
 *  próxima pergunta do roteiro). */
export function lerTurnoCnh(
  bruto: string,
  estado: { readonly ficha: FichaCnh; readonly etapa: EtapaCnh; readonly propostaEnviada: boolean },
  esc: EscritorioCnh = ESCRITORIO_CNH_PADRAO,
): TurnoCnh | null {
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) return null;
  let d: Record<string, unknown> | null;
  try {
    d = objeto(JSON.parse(bruto.slice(inicio, fim + 1)));
  } catch {
    return null;
  }
  if (d === null) return null;

  const acaoBruta = typeof d['acao'] === 'string' ? d['acao'] : 'conversar';
  if (!ACOES.has(acaoBruta)) return null;
  let acao = acaoBruta as AcaoCnh;
  const ficha = mesclarFichaCnh(estado.ficha, d['ficha']);
  const mensagensIa = (Array.isArray(d['mensagens']) ? d['mensagens'] : [])
    .map((m) => (typeof m === 'string' ? limparMensagem(m) : ''))
    .filter((m) => m !== '')
    .slice(0, 3);
  const resumo = texto(d['resumo'], 200);
  const urgente = d['urgente'] === true;

  // A etapa que a IA propôs só vale se a transição for permitida.
  const etapaIa = typeof d['etapa'] === 'string' ? (d['etapa'] as EtapaCnh) : estado.etapa;
  let etapa =
    ETAPAS_DA_AHRI.has(etapaIa) && transicaoPermitida(estado.etapa, etapaIa)
      ? etapaIa
      : estado.etapa;

  // Proposta só depois da qualificação e com o tipo de caso definido.
  if (acao === 'proposta') {
    const podeOfertar = ['viabilidade', 'proposta', 'morno'].includes(estado.etapa);
    if (!podeOfertar || ficha.tipoCaso === null) acao = 'conversar';
  }
  // Aceite só vale depois de uma proposta enviada.
  if (acao === 'aceite' && !estado.propostaEnviada) acao = 'conversar';

  const base = { ficha, urgente, resumo };
  switch (acao) {
    case 'descartar': {
      const motivo =
        typeof d['motivo'] === 'string' && MOTIVOS.has(d['motivo'])
          ? (d['motivo'] as MotivoDescarteCnh)
          : null;
      if (motivo === null) return null;
      return {
        ...base,
        mensagens: textoDescarteCnh(motivo, ficha.nome),
        etapa: 'descartado',
        acao,
        motivo,
      };
    }
    case 'transferir':
      return {
        ...base,
        mensagens: textoTransferenciaCnh(ficha.nome, esc),
        etapa: 'transferido',
        acao,
        motivo: null,
      };
    case 'proposta':
      return {
        ...base,
        mensagens: textoPropostaCnh(ficha.tipoCaso ?? 'suspensao', ficha.nome),
        etapa: 'proposta',
        acao,
        motivo: null,
      };
    case 'aceite':
      return {
        ...base,
        mensagens: textoAceiteCnh(ficha.nome, esc),
        etapa: 'aceito',
        acao,
        motivo: null,
      };
    case 'morno':
    case 'conversar': {
      if (mensagensIa.length === 0) return null;
      const tudo = mensagensIa.join('\n');
      if (RE_PROMESSA.test(tudo)) return null;
      // Preço: só depois da proposta, e só os valores da tabela.
      const valores = valoresCitados(tudo);
      if (valores.length > 0) {
        if (!estado.propostaEnviada) return null;
        const permitidos = valoresPermitidosCnh();
        if (valores.some((v) => !permitidos.has(v))) return null;
      }
      if (acao === 'morno' && transicaoPermitida(estado.etapa, 'morno')) etapa = 'morno';
      return { ...base, mensagens: mensagensIa, etapa, acao, motivo: null };
    }
  }
}
