// ─────────────────────────────────────────────────────────────────────────────
// REAQUECIMENTO SERVICE (decreto 2026-07-22) — a execução do reaquecimento
// AUTORIZADO pelo admin: lista os leads frios (derivados dos fatos reais da
// jornada) e, quando o admin autoriza UM lead, envia a mensagem autorada do
// estágio e registra a tentativa (ns 'reaquecimento').
// NADA é automático: sem clique do admin, nenhum lead recebe mensagem.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MENSAGENS_JORNADA,
  REAQUECIMENTO_HORAS_PARA_FRIO,
  RETOMADA_MINUTOS_SEM_RESPOSTA,
  derivarEstagioLead,
  mensagemDeReaquecimento,
  mensagemDeRetomada,
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
  /** RETOMADA AUTOMÁTICA (decreto 2026-07-22): minutos desde a última mensagem
   *  do CLIENTE ainda sem resposta nossa — null quando já respondida. Ausente
   *  ⇒ a varredura de retomada não roda (só o reaquecimento manual). */
  readonly minutosSemResposta?: (chatId: string) => Promise<number | null>;
  readonly observability?: { event(area: string, message: string, at: Date): void };
}

const NS_RETOMADA = 'retomada';
// Decreto 2026-07-26 (CPF): quem JÁ entregou o HISCON mas não tem CPF recebe,
// UMA vez, o pedido do número — sem CPF a perícia não protocola o pedido
// administrativo nos bancos. Disparo autorizado pelo dono para as 09:00 BRT.
const NS_FOLLOWUP_CPF = 'followup-cpf';
const HORA_FOLLOWUP_CPF = 9; // 09:00 em America/Sao_Paulo

/** A hora local em São Paulo (0-23) — o tick roda em UTC no container. */
function horaEmSaoPaulo(now: Date): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).format(now);
  return Number(h);
}

interface RetomadaPersisted {
  readonly chatId: string;
  readonly tentativas: readonly string[]; // ISO
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

  /** FOLLOW-UP DE CPF (decreto 2026-07-26) — quem JÁ entregou o HISCON e não
   *  tem CPF recebe, UMA única vez, o pedido do número (texto ditado pelo dono).
   *  Roda só na janela das 09:00 em São Paulo; idempotente por conversa (o
   *  registro em ns 'followup-cpf' impede o segundo envio). Best-effort: falha
   *  de um contato nunca impede os demais nem derruba o tick. */
  /** Trava de reentrância: a varredura leva segundos (N clientes × fatos) e o
   *  tick pode disparar de novo no meio — duas varreduras viam o registro
   *  ausente e ENVIAVAM DUAS VEZES (caso real 51 9109-4367, 09:02 duplicado). */
  private cpfEmVarredura = false;

  async varreduraCpf(now: Date): Promise<number> {
    if (horaEmSaoPaulo(now) !== HORA_FOLLOWUP_CPF) return 0;
    if (this.cpfEmVarredura) return 0; // outra varredura em curso ⇒ nunca duplica
    this.cpfEmVarredura = true;
    let enviados = 0;
    try {
      const chats = await this.deps.json.keys(NS_JORNADA);
      for (const chatId of chats) {
        try {
          if ((await this.deps.json.get(NS_FOLLOWUP_CPF, chatId)) !== null) continue; // já pedido
          const fatos = await this.deps.jornada.fatos(chatId);
          if (!fatos.docsCompletos) continue; // ainda não entregou o HISCON
          if (fatos.registro.cpf !== null) continue; // já temos o CPF
          // REGISTRA ANTES de enviar (claim-then-send): se algo falhar depois,
          // perdemos no máximo um envio — jamais mandamos dois ao mesmo cliente.
          await this.deps.json.put(NS_FOLLOWUP_CPF, chatId, {
            chatId,
            pedidoEm: now.toISOString(),
          });
          await this.deps.enviar(chatId, MENSAGENS_JORNADA.followUpCpf);
          this.deps.observability?.event('followup-cpf', `cpf solicitado chat=${chatId}`, now);
          enviados += 1;
        } catch {
          // best-effort por conversa
        }
      }
    } finally {
      this.cpfEmVarredura = false;
    }
    return enviados;
  }

  /** RETOMADA AUTOMÁTICA (decreto 2026-07-22): varre as conversas cuja ÚLTIMA
   *  palavra foi do cliente sem resposta nossa (turno caído) há 30+ minutos e
   *  CONTINUA o fluxo do ponto exato — com desculpa pela demora. Guardrails:
   *  1 retomada por 24h por conversa, máximo 3 (mesma régua do reaquecimento).
   *  Best-effort: roda no tick temporal; falha nunca derruba o tick. */
  async varreduraRetomada(now: Date): Promise<number> {
    const detector = this.deps.minutosSemResposta;
    if (!detector) return 0;
    let retomadas = 0;
    const chats = await this.deps.json.keys(NS_JORNADA);
    for (const chatId of chats) {
      try {
        const minutos = await detector(chatId);
        if (minutos === null || minutos < RETOMADA_MINUTOS_SEM_RESPOSTA) continue;
        const fatos = await this.deps.jornada.fatos(chatId);
        if (derivarEstagioLead(fatos) === null) continue; // concluída
        if (fatos.registro.desistiu) continue; // desistiu: só reaquecimento MANUAL
        const raw = (await this.deps.json.get(NS_RETOMADA, chatId)) as RetomadaPersisted | null;
        const tentativas = raw?.tentativas ?? [];
        const veredicto = podeReaquecer(
          tentativas.map((t) => new Date(t)),
          now,
        );
        if (!veredicto.pode) continue;
        const texto = mensagemDeRetomada({
          nome: fatos.registro.nome,
          cidade: fatos.registro.cidade,
          consentiu: fatos.registro.consentiu,
          proximoDocumento: fatos.proximoDocumento,
          docsRecebidos: fatos.docsRecebidos,
        });
        await this.deps.enviar(chatId, texto);
        await this.deps.json.put(NS_RETOMADA, chatId, {
          chatId,
          tentativas: [...tentativas, now.toISOString()],
        } satisfies RetomadaPersisted);
        this.deps.observability?.event(
          'retomada',
          `conversa caída retomada chat=${chatId} silêncio=${String(minutos)}min`,
          now,
        );
        retomadas += 1;
      } catch {
        // best-effort por conversa: uma falha nunca impede as demais
      }
    }
    return retomadas;
  }
}
