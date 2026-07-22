// ─────────────────────────────────────────────────────────────────────────────
// REAQUECIMENTO SERVICE (decreto 2026-07-22) — a execução do reaquecimento
// AUTORIZADO pelo admin: lista os leads frios (derivados dos fatos reais da
// jornada) e, quando o admin autoriza UM lead, envia a mensagem autorada do
// estágio e registra a tentativa (ns 'reaquecimento').
// NADA é automático: sem clique do admin, nenhum lead recebe mensagem.
// ─────────────────────────────────────────────────────────────────────────────
import {
  REAQUECIMENTO_HORAS_PARA_FRIO,
  derivarEstagioLead,
  mensagemDeReaquecimento,
  podeReaquecer,
  type EstagioLead,
  type FatosDaJornada,
} from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';

const NS = 'reaquecimento';
const NS_JORNADA = 'jornada';

interface HistoricoPersisted {
  readonly chatId: string;
  readonly tentativas: readonly { em: string; estagio: EstagioLead }[];
}

export interface LeadFrio {
  readonly chatId: string;
  readonly nome: string | null;
  readonly estagio: EstagioLead;
  readonly horasParado: number;
  readonly docsRecebidos: number;
  readonly proximoDocumento: string | null;
  readonly tentativas: number;
  readonly ultimaTentativaEm: string | null;
  /** false + motivo quando os guardrails bloqueiam (intervalo/teto). */
  readonly podeReaquecer: boolean;
  readonly motivoBloqueio: string | null;
}

export interface ReaquecimentoDeps {
  readonly json: JsonStore;
  /** Os FATOS da jornada do lead (o JornadaComercialRuntime real satisfaz). */
  readonly jornada: { fatos(chatId: string): Promise<FatosDaJornada> };
  /** O MESMO canal das mensagens automáticas (gateway + memória da conversa). */
  readonly enviar: (chatId: string, texto: string) => Promise<void>;
  readonly clock: Clock;
}

export class ReaquecimentoService {
  constructor(private readonly deps: ReaquecimentoDeps) {}

  private async historico(chatId: string): Promise<HistoricoPersisted> {
    const raw = (await this.deps.json.get(NS, chatId)) as HistoricoPersisted | null;
    return raw ?? { chatId, tentativas: [] };
  }

  /** Os leads FRIOS (silêncio ≥ 24h, jornada não concluída), mais recentes primeiro. */
  async leadsFrios(): Promise<readonly LeadFrio[]> {
    const now = this.deps.clock.now();
    const chats = await this.deps.json.keys(NS_JORNADA);
    const out: LeadFrio[] = [];
    for (const chatId of chats) {
      const fatos = await this.deps.jornada.fatos(chatId).catch(() => null);
      if (fatos === null) continue;
      const estagio = derivarEstagioLead(fatos);
      if (estagio === null) continue; // jornada concluída: não é lead frio
      const horasParado = (now.getTime() - fatos.registro.atualizadoEm.getTime()) / 3_600_000;
      if (horasParado < REAQUECIMENTO_HORAS_PARA_FRIO) continue; // ainda quente
      const h = await this.historico(chatId);
      const datas = h.tentativas.map((t) => new Date(t.em));
      const veredicto = podeReaquecer(datas, now);
      out.push({
        chatId,
        nome: fatos.registro.nome,
        estagio,
        horasParado: Math.floor(horasParado),
        docsRecebidos: fatos.docsRecebidos,
        proximoDocumento: fatos.proximoDocumento,
        tentativas: h.tentativas.length,
        ultimaTentativaEm: h.tentativas[h.tentativas.length - 1]?.em ?? null,
        podeReaquecer: veredicto.pode,
        motivoBloqueio: veredicto.motivo,
      });
    }
    out.sort((a, b) => a.horasParado - b.horasParado);
    return out;
  }

  /** Executa UM reaquecimento AUTORIZADO pelo admin. Guardrails valem sempre. */
  async reaquecer(
    chatId: string,
  ): Promise<{ ok: true; estagio: EstagioLead } | { ok: false; error: string }> {
    const now = this.deps.clock.now();
    const fatos = await this.deps.jornada.fatos(chatId).catch(() => null);
    if (fatos === null) return { ok: false, error: 'lead não encontrado' };
    const estagio = derivarEstagioLead(fatos);
    if (estagio === null) return { ok: false, error: 'jornada concluída — não é lead frio' };
    const h = await this.historico(chatId);
    const veredicto = podeReaquecer(
      h.tentativas.map((t) => new Date(t.em)),
      now,
    );
    if (!veredicto.pode) return { ok: false, error: veredicto.motivo ?? 'bloqueado' };

    const texto = mensagemDeReaquecimento(estagio, {
      nome: fatos.registro.nome,
      proximoDocumento: fatos.proximoDocumento,
      docsRecebidos: fatos.docsRecebidos,
    });
    await this.deps.enviar(chatId, texto);
    await this.deps.json.put(NS, chatId, {
      chatId,
      tentativas: [...h.tentativas, { em: now.toISOString(), estagio }],
    } satisfies HistoricoPersisted);
    return { ok: true, estagio };
  }
}
