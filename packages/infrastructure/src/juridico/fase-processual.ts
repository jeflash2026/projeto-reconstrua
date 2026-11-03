// ─────────────────────────────────────────────────────────────────────────────
// FASE PROCESSUAL (2026-11-03) — em que ponto da vida cada processo está, e há
// quanto tempo ele não anda.
//
// O painel mostrava o ÚLTIMO MOVIMENTO em texto cru ("Conclusos para
// despacho") e mais nada. Com 109 processos isso não responde às duas
// perguntas que o dono faz todo dia: quantos já chegaram perto do dinheiro, e
// quais pararam. Um processo parado não emite sinal nenhum — ele só não
// aparece, e é assim que se perde prazo e se perde cliente.
//
// A fase é a MAIS ADIANTADA já alcançada, nunca a do último movimento: um
// despacho ordinário depois da sentença não devolve o processo para a
// instrução. Processo anda para a frente.
//
// NÃO confundir com o `faseDoProcesso` do módulo do INVESTIDOR: aquele mistura
// o resultado financeiro (apurado/pago/perdido) e responde "onde está o meu
// dinheiro". Este é sobre andamento e paralisia, e responde "o que precisa da
// minha atenção". As duas réguas convivem de propósito e não devem ser unidas
// sem decisão do dono — a do investidor já está na tela de quem comprou.
// ─────────────────────────────────────────────────────────────────────────────
import type { AndamentoProcesso } from './juridico-service.js';

export type FaseProcessual =
  | 'distribuido'
  | 'instrucao'
  | 'sentenca'
  | 'recurso'
  | 'transitado'
  | 'execucao'
  | 'pagamento'
  | 'encerrado';

interface DefinicaoDeFase {
  readonly fase: FaseProcessual;
  readonly ordem: number;
  readonly rotulo: string;
  /** Dias sem movimento a partir dos quais a fase é considerada PARADA. */
  readonly limiteParado: number;
  /** Reconhece a fase pelo nome do movimento. */
  readonly padrao: RegExp | null;
}

/** A escada, da distribuição ao dinheiro. A ordem é o que manda. */
export const ESCADA_PROCESSUAL: readonly DefinicaoDeFase[] = [
  {
    fase: 'distribuido',
    ordem: 0,
    rotulo: 'Distribuído',
    limiteParado: 45,
    padrao: null, // é o piso: todo processo cadastrado começa aqui
  },
  {
    fase: 'instrucao',
    ordem: 1,
    rotulo: 'Em instrução',
    limiteParado: 90,
    padrao:
      /cita[çc][ãa]o|contesta[çc][ãa]o|r[ée]plica|audi[êe]ncia|per[íi]cia|laudo|saneador|especifica[çc][ãa]o de provas|impugna[çc][ãa]o/i,
  },
  {
    fase: 'sentenca',
    ordem: 2,
    rotulo: 'Sentença',
    limiteParado: 45,
    padrao: /senten[çc]a|julgado procedente|julgado improcedente|resolu[çc][ãa]o do m[ée]rito/i,
  },
  {
    fase: 'recurso',
    ordem: 3,
    rotulo: 'Recurso',
    limiteParado: 120,
    padrao: /apela[çc][ãa]o|recurso|ac[óo]rd[ãa]o|agravo|embargos de declara[çc][ãa]o/i,
  },
  {
    fase: 'transitado',
    ordem: 4,
    rotulo: 'Trânsito em julgado',
    limiteParado: 30,
    padrao: /tr[âa]nsito em julgado|certid[ãa]o de tr[âa]nsito/i,
  },
  {
    fase: 'execucao',
    ordem: 5,
    rotulo: 'Execução',
    limiteParado: 60,
    padrao: /cumprimento de senten[çc]a|execu[çc][ãa]o|penhora|bloqueio|sisbajud|arresto/i,
  },
  {
    fase: 'pagamento',
    ordem: 6,
    rotulo: 'Pagamento',
    limiteParado: 45,
    padrao:
      /alvar[áa]|levantamento|dep[óo]sito judicial|\brpv\b|precat[óo]rio|requisi[çc][ãa]o de pequeno valor|pagamento efetuado/i,
  },
  {
    fase: 'encerrado',
    ordem: 7,
    rotulo: 'Encerrado',
    limiteParado: Number.MAX_SAFE_INTEGER,
    padrao: /arquivamento definitivo|baixa definitiva|arquivado definitivamente/i,
  },
];

const POR_FASE = new Map(ESCADA_PROCESSUAL.map((f) => [f.fase, f] as const));

export interface FaseDoProcesso {
  readonly fase: FaseProcessual;
  readonly rotulo: string;
  readonly ordem: number;
  /** AAAA-MM-DD do movimento que levou o processo a esta fase. */
  readonly desde: string | null;
  readonly diasNaFase: number | null;
  /** Dias desde o último movimento de QUALQUER natureza. */
  readonly diasSemMovimento: number | null;
  /** Passou do limite da fase sem andar. */
  readonly parado: boolean;
  /** Dias de tolerância da fase — o painel explica o porquê do alerta. */
  readonly limiteParado: number;
}

function diasEntre(deIso: string, ateIso: string): number | null {
  const de = Date.parse(deIso.slice(0, 10));
  const ate = Date.parse(ateIso.slice(0, 10));
  if (Number.isNaN(de) || Number.isNaN(ate)) return null;
  return Math.max(0, Math.round((ate - de) / 86_400_000));
}

/** A fase do processo e há quanto tempo ele não anda. `hoje` em ISO. */
export function faseProcessualDe(a: AndamentoProcesso, hoje: string): FaseDoProcesso {
  let alcancada = POR_FASE.get('distribuido') as DefinicaoDeFase;
  let desde: string | null = a.dataAjuizamento === '' ? null : a.dataAjuizamento;

  for (const m of a.movimentos) {
    for (const def of ESCADA_PROCESSUAL) {
      if (def.padrao === null || !def.padrao.test(m.nome)) continue;
      // Empate na mesma fase: fica a data MAIS ANTIGA, que é quando ela começou.
      if (def.ordem > alcancada.ordem) {
        alcancada = def;
        desde = m.dataHora;
      } else if (def.ordem === alcancada.ordem && desde !== null && m.dataHora < desde) {
        desde = m.dataHora;
      }
      break; // o primeiro padrão que casa classifica o movimento
    }
  }

  // A CLASSE manda mais que o texto: processo autuado como cumprimento de
  // sentença já está em execução mesmo sem movimento que diga isso.
  const execucao = POR_FASE.get('execucao') as DefinicaoDeFase;
  if (a.emExecucao && alcancada.ordem < execucao.ordem) {
    alcancada = execucao;
    desde = a.ultimoMovimento?.dataHora ?? desde;
  }

  const ultimo = a.ultimoMovimento?.dataHora ?? null;
  const diasSemMovimento = ultimo === null ? null : diasEntre(ultimo, hoje);
  return {
    fase: alcancada.fase,
    rotulo: alcancada.rotulo,
    ordem: alcancada.ordem,
    desde,
    diasNaFase: desde === null ? null : diasEntre(desde, hoje),
    diasSemMovimento,
    parado: diasSemMovimento !== null && diasSemMovimento > alcancada.limiteParado,
    limiteParado: alcancada.limiteParado,
  };
}

export interface ContagemPorFase {
  readonly fase: FaseProcessual;
  readonly rotulo: string;
  readonly ordem: number;
  readonly total: number;
  readonly parados: number;
}

/** Quantos processos em cada fase — na ordem da escada, sem buracos. */
export function contarPorFase(
  andamentos: readonly AndamentoProcesso[],
  hoje: string,
): readonly ContagemPorFase[] {
  const total = new Map<FaseProcessual, number>();
  const parados = new Map<FaseProcessual, number>();
  for (const a of andamentos) {
    const f = faseProcessualDe(a, hoje);
    total.set(f.fase, (total.get(f.fase) ?? 0) + 1);
    if (f.parado) parados.set(f.fase, (parados.get(f.fase) ?? 0) + 1);
  }
  return ESCADA_PROCESSUAL.map((def) => ({
    fase: def.fase,
    rotulo: def.rotulo,
    ordem: def.ordem,
    total: total.get(def.fase) ?? 0,
    parados: parados.get(def.fase) ?? 0,
  }));
}
