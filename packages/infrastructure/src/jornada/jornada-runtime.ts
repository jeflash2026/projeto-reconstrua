// ─────────────────────────────────────────────────────────────────────────────
// JORNADA COMERCIAL RUNTIME (decreto 2026-07-20) — O ÚNICO governador do funil:
// persiste o registro (ns 'jornada'), CAPTURA fatos do texto (nome/cidade/
// consentimento — deterministicamente, no pré-hook serializado do ingress) e
// DERIVA etapa + resposta autorada. A LLM não participa de nenhuma decisão.
// A fonte da verdade documental continua sendo a contabilidade
// onboarding-documental (a mesma que alimenta ALIR/Readiness/nascimento).
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { ObservabilityRuntime, OnboardingDocumentalRuntime } from '@reconstrua/application';
import {
  MENSAGENS_JORNADA,
  capturarIdentificacao,
  derivarEtapa,
  interpretarInteresse,
  novaJornada,
  registroDoTurnoConcluido,
  responderTurno,
  type EntradaDoTurno,
  type EtapaJornada,
  type FatosDaJornada,
  type JornadaRecord,
} from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

const NS = 'jornada';

interface Persisted {
  readonly chatId: string;
  readonly nome: string | null;
  readonly cidade: string | null;
  readonly consentiu: boolean;
  readonly recusou: boolean;
  readonly ultimaCaptura: JornadaRecord['ultimaCaptura'];
  readonly aguardandoProgressao?: boolean;
  readonly atualizadoEm: string;
}

export interface JornadaRuntimeDeps {
  readonly json: JsonStore;
  readonly onboarding: OnboardingDocumentalRuntime;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
}

export class JornadaComercialRuntime {
  constructor(private readonly deps: JornadaRuntimeDeps) {}

  private async carregar(chatId: string): Promise<JornadaRecord> {
    const raw = (await this.deps.json.get(NS, chatId)) as Persisted | null;
    if (raw === null) return novaJornada(chatId, this.deps.clock.now());
    return { ...raw, aguardandoProgressao: raw.aguardandoProgressao === true, atualizadoEm: new Date(raw.atualizadoEm) };
  }

  private async salvar(r: JornadaRecord): Promise<void> {
    await this.deps.json.put(NS, r.chatId, { ...r, atualizadoEm: r.atualizadoEm.toISOString() });
  }

  /** Os FATOS completos (registro + contabilidade documental). */
  async fatos(chatId: string): Promise<FatosDaJornada> {
    const registro = await this.carregar(chatId);
    const visao = await this.deps.onboarding.visao(chatId).catch(() => null);
    return {
      registro,
      docsRecebidos: visao?.recebidos.length ?? 0,
      docsCompletos: visao !== null && visao.faltando.length === 0 && visao.recebidos.length > 0,
      proximoDocumento: visao?.proximo ?? 'RG (frente e verso) ou CNH',
      ultimoRegistrado: visao?.ultimoRegistrado ?? null,
      ultimoRegistroEm: visao?.ultimoRegistroEm ?? null,
    };
  }

  async etapa(chatId: string): Promise<EtapaJornada> {
    return derivarEtapa(await this.fatos(chatId));
  }

  /** PRÉ-HOOK (fila serializada do ingress): captura DETERMINÍSTICA dos fatos
   *  do texto — nome/cidade na identificação; interesse no consentimento.
   *  Roda ANTES do turno; a resposta (governada) já enxerga o capturado. */
  async aoReceberTexto(chatId: string, texto: string, now: Date): Promise<void> {
    try {
      const fatos = await this.fatos(chatId);
      const etapa = derivarEtapa(fatos);
      const r = fatos.registro;

      if (etapa === 'IDENTIFICACAO') {
        const capturado = capturarIdentificacao(texto, { nome: r.nome, cidade: r.cidade });
        if (capturado.nome !== null || capturado.cidade !== null) {
          const ultimaCaptura =
            capturado.nome !== null && capturado.cidade !== null
              ? 'nome-cidade'
              : capturado.nome !== null
                ? 'nome'
                : 'cidade';
          await this.salvar({
            ...r,
            nome: r.nome ?? capturado.nome,
            cidade: r.cidade ?? capturado.cidade,
            ultimaCaptura,
            atualizadoEm: now,
          });
          this.deps.observability.event('jornada', `captura ${ultimaCaptura} chat=${chatId}`, now);
        } else {
          await this.salvar({ ...r, ultimaCaptura: null, atualizadoEm: now });
        }
        return;
      }

      if (etapa === 'CONSENTIMENTO') {
        const interesse = interpretarInteresse(texto);
        if (interesse === 'sim') {
          await this.salvar({ ...r, consentiu: true, recusou: false, ultimaCaptura: 'consentimento', atualizadoEm: now });
          this.deps.observability.event('jornada', `consentimento chat=${chatId}`, now);
        } else if (interesse === 'nao') {
          await this.salvar({ ...r, recusou: true, ultimaCaptura: null, atualizadoEm: now });
        } else {
          await this.salvar({ ...r, ultimaCaptura: null, atualizadoEm: now });
        }
        return;
      }

      // TRIAGEM/CONCLUIDA: nada a capturar; limpa a nuance do turno anterior.
      if (r.ultimaCaptura !== null) await this.salvar({ ...r, ultimaCaptura: null, atualizadoEm: now });
    } catch (e) {
      this.deps.observability.error('jornada', 'captura', now, e instanceof Error ? e.message : String(e));
    }
  }

  /** A RESPOSTA AUTORADA do turno — '' quando a jornada NÃO governa (CONCLUIDA). */
  async responder(chatId: string, entrada: EntradaDoTurno): Promise<string> {
    const fatos = await this.fatos(chatId);
    const concluidaAgora = entrada.tipo === 'documento' && registroDoTurnoConcluido(fatos, entrada) && fatos.docsCompletos;
    // CONCLUIDA delega ao LLM — EXCETO o turno do ÚLTIMO documento, cuja
    // resposta ("documentação completa") é a despedida da própria jornada.
    if (derivarEtapa(fatos) === 'CONCLUIDA' && !concluidaAgora) return '';
    const resposta = responderTurno(fatos, entrada);
    // Ack emitido com o registro AINDA processando ⇒ marca: a classificação
    // tardia deve FALAR a progressão sozinha (o subscriber checa o marcador).
    if (entrada.tipo === 'documento' && resposta === MENSAGENS_JORNADA.ackDocumento && !fatos.registro.aguardandoProgressao) {
      await this.salvar({ ...fatos.registro, aguardandoProgressao: true, atualizadoEm: this.deps.clock.now() }).catch(() => undefined);
    }
    return resposta;
  }

  /** O turno respondeu só o ack e a progressão ainda não foi falada? */
  async estaAguardandoProgressao(chatId: string): Promise<boolean> {
    return (await this.carregar(chatId)).aguardandoProgressao;
  }

  /** A progressão foi falada (pelo subscriber tardio ou pelo próprio turno). */
  async concluirProgressao(chatId: string): Promise<void> {
    const r = await this.carregar(chatId);
    if (r.aguardandoProgressao) await this.salvar({ ...r, aguardandoProgressao: false, atualizadoEm: this.deps.clock.now() });
  }
}
