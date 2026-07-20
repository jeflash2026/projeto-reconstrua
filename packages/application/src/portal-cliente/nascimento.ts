// ─────────────────────────────────────────────────────────────────────────────
// O NASCIMENTO DO PORTAL (PC-R3) — um MOMENTO da jornada, não uma feature: quando
// a AHRI reconhece que recebeu tudo, nasce uma nova relação. Sem clique humano.
//
// Invariantes (auditadas):
//  • ENVIO ÚNICO: o FATO liberacao-portal é gravado ANTES da mensagem (Lei 8 —
//    o fato é a decisão; a mensagem é consequência). Crash ⇒ nunca duplica.
//  • NUNCA PREMATURO: Readiness PRONTO + cliente RECONHECIDO + evidência REAL de
//    recebimento (documentos recebidos ≥ obrigatórios da matriz) + Brain sem veto.
//  • IDEMPOTENTE: candidato só existe sem fato; re-execuções são no-op.
//  • D2: texto homologado com {dias} da política única e {link} verbatim; a frase
//    final ("estarei aqui") é obrigatória — o relacionamento nunca termina.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClientesList } from '../clientes/clientes-list.js';
import type { MemoryStore } from '../living-memory/ports.js';
import { requirementsFor } from '../qualification/requirements-matrix.js';
import { emitirTokenCliente } from './token.js';
import type { LiberacaoPortal } from './acompanhamento.js';

export interface LiberacaoPortalStore {
  load(clienteId: string): Promise<LiberacaoPortal | null>;
  save(record: LiberacaoPortal): Promise<void>;
}

/** A voz que entrega a mensagem (Brain decide; pipeline canônico entrega). */
export interface ComunicadorNascimento {
  /** true = mensagem aceita para entrega; false = Brain vetou/canal indisponível. */
  comunicar(chatId: string, clienteId: string, texto: string): Promise<boolean>;
}

export interface NascimentoConfig {
  /** PROCESSING_ESTIMATE_DAYS — a MESMA política única do Portal (D1). */
  readonly estimativaDias: number;
  readonly validadeLinkDias: number;
  readonly publicUrl: string;
  readonly tokenSecret: string;
}

export interface NascimentoDeps {
  readonly clientes: ClientesList;
  readonly memory: MemoryStore;
  readonly liberacao: LiberacaoPortalStore;
  readonly comunicador: ComunicadorNascimento;
  readonly config: NascimentoConfig;
}

export interface NascimentoResumo {
  readonly verificados: number;
  readonly nascidos: readonly string[]; // clienteIds comunicados nesta varredura
}

/** O texto HOMOLOGADO (Decisão 2, revisado pelo decreto "Jornada Documental
 *  Inicial") — conteúdo do Fundador; slots determinísticos. É a ÚNICA mensagem
 *  oficial que encerra o ONBOARDING_DOCUMENTAL e marca a transição para a
 *  ANALISE_ADMINISTRATIVA. Toda a plataforma usa exclusivamente o D2. */
export function mensagemNascimento(dias: number, link: string): string {
  return (
    'Recebi toda a sua documentação inicial: HISCON, RG ou CNH e comprovante de endereço. ' +
    'Essa primeira etapa está concluída — você não precisa enviar mais nada por enquanto. ' +
    `Seu cadastro entrou agora na etapa de análise administrativa, que pode levar até ${String(dias)} dias úteis. ` +
    'Se algum documento complementar for necessário durante a análise, nossa equipe solicitará diretamente por este atendimento. ' +
    'Enquanto isso, você pode acompanhar as informações do seu processo pelo Portal do Cliente: ' +
    `${link} ` +
    'Sempre que houver alguma novidade, eu entrarei em contato automaticamente por aqui. ' +
    'Se precisar conversar comigo durante esse período, estarei aqui.'
  );
}

export class NascimentoPortalRuntime {
  constructor(private readonly deps: NascimentoDeps) {}

  /** A varredura do nascimento — roda no tick temporal existente (60s). */
  async verificar(now: Date): Promise<NascimentoResumo> {
    const { clientes, memory, liberacao, comunicador, config } = this.deps;
    if (config.tokenSecret === '') return { verificados: 0, nascidos: [] }; // fail-closed

    const lista = await clientes.list(now);
    const nascidos: string[] = [];
    let verificados = 0;

    for (const cliente of lista) {
      // Candidato: RECONHECIDO (chat é canal; a relação nasce com o cliente).
      if (cliente.clienteId === cliente.chatId) continue;
      verificados += 1;

      // ENVIO ÚNICO / IDEMPOTÊNCIA: fato existente ⇒ nascimento já aconteceu.
      if ((await liberacao.load(cliente.clienteId)) !== null) continue;

      // PRONTO (Readiness determinístico, já refletido na lista única).
      if (!cliente.pronto) continue;

      // NUNCA PREMATURO: evidência REAL de recebimento — a contabilidade de
      // pendências não basta se nenhum documento chegou de fato.
      const memoria = await memory.load(cliente.chatId);
      const recebidos = memoria?.documentsSent.length ?? 0;
      const obrigatorios = requirementsFor('GENERICO').requiredDocuments.length;
      if (recebidos < obrigatorios) continue;

      // O FATO nasce ANTES da mensagem (Lei 8): crash depois daqui ⇒ nunca
      // duplica; o cliente pode pedir o link em conversa (PC-R4).
      const comunicadoEm = now;
      await liberacao.save({
        clienteId: cliente.clienteId,
        chatId: cliente.chatId,
        comunicadoEm,
        estimativaDiasInformada: config.estimativaDias,
      });

      // O LINK nasce: extensão temporária da identidade do WhatsApp (D4).
      const token = emitirTokenCliente(cliente.clienteId, config.validadeLinkDias, now, config.tokenSecret);
      const link = `${config.publicUrl.replace(/\/+$/, '')}/portal?t=${token}`;

      // A MENSAGEM nasce (texto homologado; entrega pelo pipeline canônico).
      const entregue = await comunicador.comunicar(
        cliente.chatId,
        cliente.clienteId,
        mensagemNascimento(config.estimativaDias, link),
      );
      if (entregue) nascidos.push(cliente.clienteId);
      // Se o Brain vetar/canal falhar: o fato permanece (decisão tomada) e o
      // link renasce sob demanda na conversa — nunca reenvio automático em loop.
    }

    return { verificados, nascidos };
  }
}
