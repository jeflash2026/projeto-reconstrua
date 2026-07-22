// ─────────────────────────────────────────────────────────────────────────────
// A DESPEDIDA (GO-LIVE-02 · Bloqueador 1) — o espelho do NASCIMENTO: a relação
// que nasceu conversando se encerra conversando. Quando a etapa da AHRI se
// conclui (Modelo A — venda registrada), a AHRI se despede pessoalmente e devolve
// a promessa que abriu a relação: "estarei por aqui".
//
// Invariantes (as MESMAS do nascimento — padrão homologado no PC-R3):
//  • ENVIO ÚNICO: o FATO despedida é gravado ANTES da mensagem (Lei 8 — o fato
//    é a decisão; a mensagem é consequência). Crash ⇒ nunca duplica.
//  • NUNCA PREMATURA: só cliente RECONHECIDO com VENDA registrada (status
//    derivado VENDIDO na lista única — Regra 1).
//  • IDEMPOTENTE: fato existente ⇒ despedida já aconteceu; re-execuções no-op.
//  • NUNCA FRIA: texto homologado pelo Fundador — uma despedida, não um aviso.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientesList } from '../clientes/clientes-list.js';
import type { ComunicadorNascimento } from './nascimento.js';

/** O FATO canônico da despedida comunicada (chave = cliente, nunca canal). */
export interface DespedidaRegistro {
  readonly clienteId: string;
  readonly chatId: string;
  readonly comunicadaEm: Date;
}

export interface DespedidaStore {
  load(clienteId: string): Promise<DespedidaRegistro | null>;
  save(record: DespedidaRegistro): Promise<void>;
}

/** O texto HOMOLOGADO pelo Fundador — a relação nunca termina de forma fria. */
export function mensagemDespedida(nome: string): string {
  return (
    `Oi, ${nome}! Vim te contar pessoalmente: esta etapa do seu caso foi concluída. ` +
    'Foi um prazer acompanhar você até aqui — desde os primeiros documentos até este momento. ' +
    'E mesmo com essa etapa encerrada, uma coisa não muda: sempre que precisar conversar comigo, estarei por aqui.'
  );
}

export interface DespedidaDeps {
  readonly clientes: ClientesList;
  readonly despedida: DespedidaStore;
  /** A MESMA voz do nascimento (Brain decide; pipeline canônico entrega). */
  readonly comunicador: ComunicadorNascimento;
}

export interface DespedidaResumo {
  readonly verificados: number;
  readonly despedidos: readonly string[]; // clienteIds comunicados nesta varredura
}

export class DespedidaRuntime {
  constructor(private readonly deps: DespedidaDeps) {}

  /** A varredura da despedida — roda no MESMO tick temporal do nascimento (60s). */
  async verificar(now: Date): Promise<DespedidaResumo> {
    const { clientes, despedida, comunicador } = this.deps;

    const lista = await clientes.list(now);
    const despedidos: string[] = [];
    let verificados = 0;

    for (const cliente of lista) {
      // Candidato: RECONHECIDO (a relação — e a despedida — são com o cliente).
      if (cliente.clienteId === cliente.chatId) continue;
      verificados += 1;

      // Momento: a VENDA registrada (Modelo A) — status derivado da lista única.
      if (cliente.status !== 'VENDIDO') continue;

      // ENVIO ÚNICO / IDEMPOTÊNCIA: fato existente ⇒ despedida já aconteceu.
      if ((await despedida.load(cliente.clienteId)) !== null) continue;

      // O FATO nasce ANTES da mensagem (Lei 8): crash depois daqui ⇒ nunca duplica.
      await despedida.save({
        clienteId: cliente.clienteId,
        chatId: cliente.chatId,
        comunicadaEm: now,
      });

      // A DESPEDIDA nasce (texto homologado; entrega pelo pipeline canônico).
      const entregue = await comunicador.comunicar(
        cliente.chatId,
        cliente.clienteId,
        mensagemDespedida(cliente.quem),
      );
      if (entregue) despedidos.push(cliente.clienteId);
      // Brain vetou/canal falhou: o fato permanece (decisão tomada) — nunca
      // reenvio automático em loop; a conversa continua disponível (PC-R4).
    }

    return { verificados, despedidos };
  }
}
