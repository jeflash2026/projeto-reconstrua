// ─────────────────────────────────────────────────────────────────────────────
// PARADOS DEPOIS DO HISCON (decreto do dono, 2026-08-13).
//
// CASO REAL: o cliente mandou o HISCON, a AHRI leu, NÃO entregou o dossiê e
// ainda assim pediu a confirmação para ir à fase 2. O cliente ficou esperando um
// documento que nunca chegou — e do lado de cá parecia que ele "não respondeu".
//
// Esta varredura acha TODOS que estão nessa condição: entregaram o HISCON e
// continuam sem dossiê. Ela separa o que a máquina consegue destravar sozinha do
// que precisa de mão humana, porque o motivo muda o remédio:
//   • falta o CPF          → cobrar o CPF (a análise nem roda sem ele);
//   • HISCON ilegível      → releitura/revínculo, nunca mensagem ao cliente;
//   • pronto e sem dossiê  → a varredura do parecer entrega no próximo ciclo.
//
// E marca quem ainda está DENTRO DA JANELA DE 24H da Meta — só esses podem
// receber uma mensagem livre; fora da janela, só template. Nada é enviado aqui:
// a lista é para o dono decidir (decreto anti-automático).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';

const JANELA_META_MS = 24 * 60 * 60 * 1000;

export type SituacaoParado =
  /** Fase 1 completa e com contratos: o dossiê devia ter saído. */
  | 'pronto-sem-dossie'
  /** HISCON na mão, mas sem CPF — a análise não roda. */
  | 'falta-cpf'
  /** HISCON recebido e ilegível (0 contratos lidos) — problema de leitura. */
  | 'hiscon-ilegivel';

export interface ClienteParado {
  readonly chatId: string;
  readonly clienteId: string;
  readonly nome: string;
  readonly telefone: string;
  readonly situacao: SituacaoParado;
  /** Última vez que o CLIENTE falou (ISO) — é dela que sai a janela de 24h. */
  readonly ultimaEntradaEm: string | null;
  /** Dá para mandar mensagem livre agora? Fora da janela, só template. */
  readonly dentroDaJanela24h: boolean;
  /** A AHRI chegou a pedir o SIM sem ter mandado o dossiê? (o defeito em si) */
  readonly pediuSimSemDossie: boolean;
}

export interface ResumoParados {
  readonly geradoEm: string;
  readonly desde: string;
  readonly total: number;
  readonly dentroDaJanela24h: number;
  readonly pediramSimSemDossie: number;
  readonly clientes: readonly ClienteParado[];
}

export interface CandidatoParado {
  readonly chatId: string;
  readonly clienteId: string;
  readonly nome: string;
  readonly temCpf: boolean;
  readonly totalContratos: number;
}

export interface ParadosPosHisconDeps {
  readonly clock: Clock;
  /** Quem entregou HISCON (a fila da perícia, com CPF e contratos lidos). */
  readonly comHiscon: () => Promise<readonly CandidatoParado[]>;
  /** clienteIds que JÁ receberam o dossiê — estes estão fora da varredura. */
  readonly comDossie: () => Promise<ReadonlySet<string>>;
  /** UMA leitura por conversa (a conversa inteira vem numa consulta só): a
   *  última fala do cliente, para a janela de 24h, e as últimas falas da AHRI,
   *  para flagrar o pedido de SIM indevido. Eram dois acessos separados — em
   *  uma base de centenas de chats isso dobrava o custo da varredura à toa. */
  readonly conversa: (
    chatId: string,
  ) => Promise<{ ultimaEntradaEm: string | null; falasDaAhri: readonly string[] }>;
  /** O detector canônico do pedido de confirmação (mesma régua da rede). */
  readonly pediuConfirmacao: (texto: string) => boolean;
}

export class ParadosPosHiscon {
  constructor(private readonly deps: ParadosPosHisconDeps) {}

  /** `desdeMs`: janela de análise (padrão 72h — pega "ontem" com folga). */
  async varrer(desdeMs = 72 * 60 * 60 * 1000): Promise<ResumoParados> {
    const agora = this.deps.clock.now();
    const desde = new Date(agora.getTime() - desdeMs);
    const [candidatos, comDossie] = await Promise.all([
      this.deps.comHiscon(),
      this.deps.comDossie(),
    ]);

    const clientes: ClienteParado[] = [];
    for (const c of candidatos) {
      if (comDossie.has(c.clienteId)) continue; // já recebeu o dossiê

      const { ultimaEntradaEm, falasDaAhri } = await this.deps
        .conversa(c.chatId)
        .catch(() => ({ ultimaEntradaEm: null, falasDaAhri: [] as readonly string[] }));
      // A varredura olha para quem se mexeu na janela pedida: cliente parado há
      // meses é outro assunto (reaquecimento), não este defeito.
      if (ultimaEntradaEm === null || new Date(ultimaEntradaEm) < desde) continue;

      const situacao: SituacaoParado = !c.temCpf
        ? 'falta-cpf'
        : c.totalContratos === 0
          ? 'hiscon-ilegivel'
          : 'pronto-sem-dossie';

      clientes.push({
        chatId: c.chatId,
        clienteId: c.clienteId,
        nome: c.nome,
        telefone: c.chatId.split('@')[0] ?? c.chatId,
        situacao,
        ultimaEntradaEm,
        dentroDaJanela24h: agora.getTime() - new Date(ultimaEntradaEm).getTime() < JANELA_META_MS,
        pediuSimSemDossie: falasDaAhri.some((f) => this.deps.pediuConfirmacao(f)),
      });
    }

    // Quem foi enganado com o pedido de SIM primeiro, depois quem está dentro da
    // janela (a mensagem livre expira), depois o mais recente.
    clientes.sort(
      (a, b) =>
        Number(b.pediuSimSemDossie) - Number(a.pediuSimSemDossie) ||
        Number(b.dentroDaJanela24h) - Number(a.dentroDaJanela24h) ||
        (b.ultimaEntradaEm ?? '').localeCompare(a.ultimaEntradaEm ?? ''),
    );

    return {
      geradoEm: agora.toISOString(),
      desde: desde.toISOString(),
      total: clientes.length,
      dentroDaJanela24h: clientes.filter((c) => c.dentroDaJanela24h).length,
      pediramSimSemDossie: clientes.filter((c) => c.pediuSimSemDossie).length,
      clientes,
    };
  }
}
