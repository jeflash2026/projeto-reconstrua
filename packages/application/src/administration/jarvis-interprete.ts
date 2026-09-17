// ─────────────────────────────────────────────────────────────────────────────
// INTÉRPRETE DO JARVIS (2026-09-17, pedido do dono: "queria que me entendesse
// com poucas palavras, igual falar com o Claude"). Caso real: "ahri adicione no
// juridico: FRANCISCO NUNES DA SILVA Banco Mercantil do Brasil - 4002326-40…"
// tudo numa linha só — os reconhecedores por padrão não acharam o cliente.
//
// Agora a LLM ENTENDE a mensagem (com a conversa recente como contexto) e
// devolve a INTENÇÃO em JSON. A LLM não executa nada: a intenção vira o MESMO
// comando dos reconhecedores determinísticos, que segue o MESMO trilho (plano
// + confirmação do dono). E nada inventado passa: todo nº de processo tem de
// estar no texto do dono, e o texto de uma mensagem ditada tem de ser um
// trecho LITERAL do que ele escreveu (decreto 2026-07-30). Resposta inválida ⇒
// null ⇒ o runtime cai nos reconhecedores determinísticos de sempre.
// ─────────────────────────────────────────────────────────────────────────────
import {
  nomeApresentavel,
  type ClienteComProcessos,
  type ComandoCarteiraInvestidor,
  type ComandoDistribuicao,
  type ComandoMensagem,
  type ComandoProcessosJuridico,
  type ComandoRelatorio,
  type RecorteRelatorio,
} from './jarvis.js';

/** Um turno da conversa do Founder Console (o mais antigo primeiro). */
export interface TurnoConversa {
  readonly de: 'dono' | 'ahri';
  readonly texto: string;
}

export type IntencaoJarvis =
  | { readonly acao: 'cadastrar_processos'; readonly comando: ComandoProcessosJuridico }
  | { readonly acao: 'mensagem'; readonly comando: ComandoMensagem }
  | { readonly acao: 'carteira_investidor'; readonly comando: ComandoCarteiraInvestidor }
  | { readonly acao: 'relatorio'; readonly comando: ComandoRelatorio }
  | { readonly acao: 'distribuir'; readonly comando: ComandoDistribuicao }
  | { readonly acao: 'cobrar_cpf' }
  | { readonly acao: 'esclarecer'; readonly pergunta: string }
  | { readonly acao: 'responder' };

/** Quantos turnos da conversa acompanham cada pedido (e o teto de cada um). */
export const TURNOS_DE_CONTEXTO = 12;
const TETO_DO_TURNO = 2_000;

export const PROMPT_INTERPRETE_JARVIS = `Você é o INTÉRPRETE de comandos da AHRI no Founder Console do Projeto Reconstrua (revisão de empréstimos consignados do INSS). O dono escreve como falaria com uma pessoa: frases curtas, sem pontuação, com erros de digitação, colando listas do WhatsApp. A sua tarefa é ENTENDER o que ele quer e devolver SÓ um JSON, sem nenhum texto antes ou depois.

Use a CONVERSA RECENTE para entender mensagens curtas que dependem do que veio antes ("e pro Rodrigo?", "faz com 30", "cadastra esses aí", "agora pra SP").

AÇÕES POSSÍVEIS:

1. cadastrar_processos — cadastrar processos judiciais de clientes no Painel Jurídico. Sinal: números de processo no formato CNJ (0000000-00.0000.0.00.0000). Cada número é UM processo; o banco (réu) costuma vir antes do número; o nome do cliente vem antes dos processos dele, com ou sem dois-pontos, às vezes tudo numa linha só.
{"acao":"cadastrar_processos","clientes":[{"nome":"Nome Completo","processos":[{"banco":"Banco X","numero":"0000000-00.0000.0.00.0000"}]}]}
Copie os números EXATAMENTE como estão no texto. Inclua TODOS os números citados, cada um no cliente certo. Se não der para saber de qual cliente é um número, use "esclarecer".

2. mensagem — enviar uma mensagem de WhatsApp a um cliente. O texto sai EXATAMENTE como o dono ditou.
{"acao":"mensagem","destinatario":"nome do cliente ou telefone","texto":"o texto literal"}
"texto" tem de ser um trecho COPIADO LITERALMENTE da mensagem do dono. Se ele só descreveu o assunto ("avisa a Maria que o processo saiu") sem ditar as palavras, use "esclarecer" e peça o texto exato.

3. carteira_investidor — montar uma carteira de créditos judiciais para um investidor.
{"acao":"carteira_investidor","investidor":"nome ou null","credito":250000,"processos":null}
credito = valor em reais (número inteiro) ou null; processos = quantidade pedida ou null. Um dos dois é obrigatório.

4. relatorio — lista nominal (nome e telefone) de clientes.
{"acao":"relatorio","uf":"SP","recorte":"hiscon"}
uf = sigla do estado citado ou null (Brasil todo). recorte: "fase1" (clientes com CPF e HISCON), "sem-cpf" (mandaram o HISCON e falta o CPF), "hiscon" (todos com HISCON).

5. distribuir — mover ou distribuir contratos de clientes para um advogado.
{"acao":"distribuir","contratos":20,"advogado":"nome ou null"}

6. cobrar_cpf — disparar a cobrança do CPF para os clientes que mandaram o HISCON e ainda não mandaram o CPF.
{"acao":"cobrar_cpf"}

7. esclarecer — o dono quer uma das ações acima, mas falta um dado essencial que você não consegue deduzir nem pela conversa.
{"acao":"esclarecer","pergunta":"uma pergunta curta e natural"}

8. responder — todo o resto: perguntas, números, análises, conversa, cumprimentos, opiniões, dúvidas sobre clientes ou sobre a operação.
{"acao":"responder"}

REGRAS:
- Pergunta SOBRE um assunto não é comando: "quantos clientes faltam mandar o CPF?" é responder; "cobra o cpf deles" é cobrar_cpf.
- Nunca invente nome, número, valor ou texto que não esteja na mensagem ou na conversa.
- Na dúvida entre executar algo errado e perguntar, pergunte (esclarecer). Na dúvida entre comando e conversa, responder.
- Devolva APENAS o JSON.`;

/** O conteúdo do usuário para o intérprete: a conversa recente + a mensagem. */
export function entradaDoInterprete(mensagem: string, historico: readonly TurnoConversa[]): string {
  const conversa = historico
    .slice(-TURNOS_DE_CONTEXTO)
    .map((t) => `${t.de === 'dono' ? 'Dono' : 'AHRI'}: ${t.texto.slice(0, TETO_DO_TURNO)}`)
    .join('\n\n');
  return (
    (conversa !== '' ? `CONVERSA RECENTE (a mais antiga primeiro):\n${conversa}\n\n` : '') +
    `MENSAGEM ATUAL DO DONO:\n${mensagem}`
  );
}

const RE_CNJ = /\d{7}-?\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/gu;
const RECORTES: ReadonlySet<string> = new Set(['fase1', 'sem-cpf', 'hiscon']);
const UFS: ReadonlySet<string> = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
);

function objeto(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function inteiro(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Espaços colapsados e aspas/pontuação de borda fora — para comparar trechos. */
function comparavel(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .trim();
}

/** O trecho ORIGINAL (quebras de linha preservadas) que corresponde ao texto
 *  devolvido pela LLM, palavra a palavra. null = não é um trecho literal. */
function trechoOriginal(fonte: string, corpo: string): string | null {
  const palavras = comparavel(corpo)
    .split(' ')
    .filter((p) => p !== '')
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (palavras.length === 0) return null;
  const m = new RegExp(palavras.join('\\s+'), 'u').exec(fonte);
  return m === null ? null : m[0];
}

/** "4002326-40.2026.8.26.0619" a partir dos 20 dígitos. */
function formatarCnj(d: string): string {
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

function digitosCnj(textoFonte: string): string[] {
  return [...textoFonte.matchAll(RE_CNJ)].map((m) => m[0].replace(/\D/g, ''));
}

/** Lê e VALIDA a resposta do intérprete. null = resposta inválida (o runtime
 *  cai nos reconhecedores determinísticos). */
export function lerIntencaoJarvis(
  bruto: string,
  mensagem: string,
  historico: readonly TurnoConversa[] = [],
): IntencaoJarvis | null {
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) return null;
  let dados: Record<string, unknown> | null;
  try {
    dados = objeto(JSON.parse(bruto.slice(inicio, fim + 1)));
  } catch {
    return null;
  }
  if (dados === null) return null;
  const falasDoDono = [
    mensagem,
    ...historico.slice(-TURNOS_DE_CONTEXTO).flatMap((t) => (t.de === 'dono' ? [t.texto] : [])),
  ];

  switch (dados['acao']) {
    case 'responder':
      return { acao: 'responder' };

    case 'esclarecer': {
      const pergunta = texto(dados['pergunta']);
      return pergunta === null ? null : { acao: 'esclarecer', pergunta };
    }

    case 'cobrar_cpf':
      return { acao: 'cobrar_cpf' };

    case 'distribuir': {
      const contratos = inteiro(dados['contratos']);
      if (contratos === null || contratos > 5_000) return null;
      return { acao: 'distribuir', comando: { contratos, advogadoNome: texto(dados['advogado']) } };
    }

    case 'relatorio': {
      const recorte = texto(dados['recorte']) ?? 'hiscon';
      if (!RECORTES.has(recorte)) return null;
      const ufBruta = texto(dados['uf'])?.toUpperCase() ?? null;
      if (ufBruta !== null && !UFS.has(ufBruta)) return null;
      return {
        acao: 'relatorio',
        comando: { uf: ufBruta, recorte: recorte as RecorteRelatorio },
      };
    }

    case 'carteira_investidor': {
      const credito = inteiro(dados['credito']);
      const processos = inteiro(dados['processos']);
      const valor = credito !== null && credito >= 1_000 ? credito : null;
      const quantidade = processos !== null && processos <= 2_000 ? processos : null;
      if (valor === null && quantidade === null) return null;
      return {
        acao: 'carteira_investidor',
        comando: { valor, processos: quantidade, investidorNome: texto(dados['investidor']) },
      };
    }

    case 'mensagem': {
      const destinatario = texto(dados['destinatario']);
      const corpo = texto(dados['texto']);
      if (destinatario === null || corpo === null) return null;
      // Decreto 2026-07-30: o texto sai EXATAMENTE como ditado — só vale um
      // trecho LITERAL do que o dono escreveu (nunca uma paráfrase da LLM).
      let literal: string | null = null;
      for (const fala of falasDoDono) {
        literal = trechoOriginal(fala, corpo);
        if (literal !== null) break;
      }
      if (literal === null) return null;
      return { acao: 'mensagem', comando: { destinatario, texto: literal } };
    }

    case 'cadastrar_processos': {
      const lista = Array.isArray(dados['clientes']) ? dados['clientes'] : [];
      const citados = new Set(falasDoDono.flatMap(digitosCnj));
      const daMensagem = new Set(digitosCnj(mensagem));
      const vistos = new Set<string>();
      const porNome = new Map<
        string,
        { nome: string; processos: { banco: string; numero: string }[] }
      >();
      for (const item of lista) {
        const c = objeto(item);
        const nome = texto(c?.['nome']);
        if (c === null || nome === null) return null;
        const chave = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
        const grupo = porNome.get(chave) ?? {
          nome: nomeApresentavel(nome.replace(/\s+/g, ' ')),
          processos: [],
        };
        porNome.set(chave, grupo);
        for (const p of Array.isArray(c['processos']) ? c['processos'] : []) {
          const proc = objeto(p);
          const digitos = (texto(proc?.['numero']) ?? '').replace(/\D/g, '');
          // Nº inventado (fora do que o dono escreveu) derruba a leitura inteira.
          if (digitos.length !== 20 || !citados.has(digitos)) return null;
          if (vistos.has(digitos)) continue;
          vistos.add(digitos);
          const banco = (texto(proc?.['banco']) ?? '').replace(/\s+/g, ' ').slice(0, 120);
          grupo.processos.push({
            banco: banco === '' ? 'BANCO (não informado)' : banco,
            numero: formatarCnj(digitos),
          });
        }
      }
      const clientes: ClienteComProcessos[] = [...porNome.values()].filter(
        (g) => g.processos.length > 0,
      );
      // Todo nº colado AGORA tem de ter dono — senão a leitura não serve.
      if (clientes.length === 0 || [...daMensagem].some((d) => !vistos.has(d))) return null;
      return { acao: 'cadastrar_processos', comando: { clientes, semCliente: 0 } };
    }

    default:
      return null;
  }
}
