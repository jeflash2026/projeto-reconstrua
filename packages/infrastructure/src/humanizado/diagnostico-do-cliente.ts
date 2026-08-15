// ─────────────────────────────────────────────────────────────────────────────
// POR QUE ESTE CLIENTE NÃO ESTÁ NA MESA? (2026-08-13)
//
// A pergunta se repete: "fulano mandou o HISCON e não apareceu no humanizado".
// Até aqui cada caso virava investigação minha no código, e uma delas eu errei
// (diagnostiquei a Beatriz como "pediu confirmação sem dossiê" quando o defeito
// era outro). Adivinhar custa caro: manda a equipe consertar o que não quebrou.
//
// Isto percorre a CORRENTE INTEIRA para um cliente e mostra onde ela arrebentou:
//
//   conversa → CPF → HISCON recebido → HISCON legível → dossiê enviado
//            → cliente disse SIM → confirmação registrada → cadastro → mesa
//
// Cada elo responde sim/não com o detalhe, e o veredito nomeia o PRIMEIRO que
// falhou — é sempre esse que importa; os seguintes são consequência. Só leitura:
// nada é reparado nem enviado aqui.
// ─────────────────────────────────────────────────────────────────────────────

export interface EloDaCorrente {
  readonly id: string;
  readonly rotulo: string;
  readonly ok: boolean;
  /** O que o sistema realmente tem — nunca só "não". */
  readonly detalhe: string;
}

export interface DiagnosticoCliente {
  readonly chatId: string;
  readonly clienteId: string;
  readonly nome: string;
  readonly telefone: string;
  readonly naMesa: boolean;
  readonly elos: readonly EloDaCorrente[];
  /** O PRIMEIRO elo quebrado (o que importa) — null quando está tudo certo. */
  readonly bloqueio: string | null;
  /** O que fazer, em português de operação. */
  readonly oQueFazer: string;
}

export interface FatosDoCliente {
  readonly chatId: string;
  readonly clienteId: string;
  readonly nome: string;
  /** Mensagens trocadas — zero significa que a conversa nunca existiu aqui. */
  readonly mensagens: number;
  readonly cpf: string | null;
  readonly hisconRecebido: boolean;
  /** Contratos lidos do HISCON. 0 com HISCON recebido = ilegível. */
  readonly contratosLidos: number;
  readonly parecerEnviadoEm: string | null;
  readonly confirmadoEm: string | null;
  /** O cliente respondeu SIM depois do dossiê? (régua da conversa) */
  readonly disseSim: boolean;
  readonly naMesa: boolean;
  readonly descartado: boolean;
}

export interface DiagnosticoDeps {
  /** Acha por NOME ou TELEFONE — é assim que o dono conhece o cliente. */
  readonly procurar: (termo: string) => Promise<readonly FatosDoCliente[]>;
}

export class DiagnosticoDoCliente {
  constructor(private readonly deps: DiagnosticoDeps) {}

  async procurar(termo: string): Promise<readonly DiagnosticoCliente[]> {
    if (termo.trim().length < 3) return [];
    return (await this.deps.procurar(termo)).map((f) => diagnosticar(f));
  }
}

/** Monta a corrente e nomeia o primeiro elo quebrado. Função pura. */
export function diagnosticar(f: FatosDoCliente): DiagnosticoCliente {
  const elos: EloDaCorrente[] = [
    {
      id: 'conversa',
      rotulo: 'Conversa existe',
      ok: f.mensagens > 0,
      detalhe: f.mensagens > 0 ? `${String(f.mensagens)} mensagem(ns)` : 'nenhuma mensagem',
    },
    {
      id: 'cpf',
      rotulo: 'CPF registrado',
      ok: f.cpf !== null,
      detalhe: f.cpf !== null ? 'registrado' : 'não consta',
    },
    {
      id: 'hiscon',
      rotulo: 'HISCON recebido',
      ok: f.hisconRecebido,
      detalhe: f.hisconRecebido ? 'recebido' : 'não recebido',
    },
    {
      id: 'leitura',
      rotulo: 'HISCON legível',
      ok: f.contratosLidos > 0,
      detalhe:
        f.contratosLidos > 0
          ? `${String(f.contratosLidos)} contrato(s) lidos`
          : f.hisconRecebido
            ? 'nenhum contrato foi lido do arquivo'
            : 'sem arquivo para ler',
    },
    {
      id: 'dossie',
      rotulo: 'Dossiê enviado',
      ok: f.parecerEnviadoEm !== null,
      detalhe:
        f.parecerEnviadoEm !== null ? `enviado em ${dia(f.parecerEnviadoEm)}` : 'não enviado',
    },
    {
      id: 'sim',
      // O que vale é o REGISTRO, não a fala: a mesa lê `confirmadoEm`. Cliente
      // que disse SIM e não foi registrado está bloqueado AQUI — foi assim que
      // o Oracio (e muitos outros) sumiram da mesa tendo confirmado.
      rotulo: 'Confirmação registrada',
      ok: f.confirmadoEm !== null,
      detalhe:
        f.confirmadoEm !== null
          ? `confirmado em ${dia(f.confirmadoEm)}`
          : f.disseSim
            ? 'disse SIM na conversa, mas o sistema não registrou'
            : 'ainda não respondeu',
    },
    {
      id: 'cadastro',
      rotulo: 'Cadastro próprio',
      ok: f.clienteId !== f.chatId,
      detalhe: f.clienteId !== f.chatId ? 'criado' : 'ainda não criado',
    },
    {
      id: 'mesa',
      rotulo: 'Na mesa do Humanizado',
      ok: f.naMesa,
      detalhe: f.naMesa ? 'aparece na mesa' : 'não aparece',
    },
  ];

  const quebrado = elos.find((e) => !e.ok) ?? null;
  const telefone = f.chatId.split('@')[0] ?? f.chatId;

  return {
    chatId: f.chatId,
    clienteId: f.clienteId,
    nome: f.nome,
    telefone,
    naMesa: f.naMesa,
    elos,
    bloqueio: f.descartado ? 'Descartado por desinteresse' : (quebrado?.rotulo ?? null),
    oQueFazer: oQueFazer(f, quebrado?.id ?? null),
  };
}

/** O remédio de cada bloqueio — o motivo muda o que a equipe faz. */
function oQueFazer(f: FatosDoCliente, bloqueio: string | null): string {
  if (f.descartado)
    return 'Está descartado por desinteresse. Se ele voltou a confirmar, reative na mesa — aí a corrente segue sozinha.';
  switch (bloqueio) {
    case null:
      return 'Nada a fazer: a corrente está inteira e ele está na mesa.';
    case 'conversa':
      return 'Nunca houve conversa com este número por aqui. Confira se o cliente escreveu de outro número.';
    case 'cpf':
      return 'Falta o CPF — sem ele a análise não roda. Cobre o CPF pela conversa.';
    case 'hiscon':
      return 'O HISCON não chegou. Oriente o passo a passo do Meu INSS e aguarde o PDF.';
    case 'leitura':
      return 'O HISCON chegou mas nenhum contrato foi lido — é problema NOSSO, de leitura. Use a Releitura HISCON ou o revínculo; não cobre nada do cliente.';
    case 'dossie':
      return 'A análise está pronta e o dossiê ainda não saiu. Envie pelo parecer em lote no Admin.';
    case 'sim':
      return f.disseSim
        ? 'Ele JÁ disse SIM e o sistema não registrou. Rode a Varredura da fase 2 — ela repara e o cliente entra na mesa.'
        : 'Ele recebeu o dossiê e ainda não respondeu. É hora de pedir a confirmação.';
    case 'cadastro':
      return 'Confirmou, mas o cadastro ainda não nasceu. A varredura do sistema cria sozinha no próximo ciclo; se demorar, rode a Varredura da fase 2.';
    case 'mesa':
      return 'Tem tudo e mesmo assim não aparece: rode a Varredura da fase 2, que regrava a confirmação na chave que a mesa lê.';
    default:
      return 'Sem diagnóstico.';
  }
}

function dia(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}
