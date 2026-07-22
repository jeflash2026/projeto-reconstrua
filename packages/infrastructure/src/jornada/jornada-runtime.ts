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
  ehAdiamento,
  ehDesistencia,
  interpretarInteresse,
  vaiReceberCobranca,
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
  readonly avisosDeAdiamento?: number;
  readonly desistiu?: boolean;
  readonly cobrancasSeguidas?: number;
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
    return {
      ...raw,
      aguardandoProgressao: raw.aguardandoProgressao === true,
      avisosDeAdiamento: raw.avisosDeAdiamento ?? 0,
      desistiu: raw.desistiu === true,
      cobrancasSeguidas: raw.cobrancasSeguidas ?? 0,
      atualizadoEm: new Date(raw.atualizadoEm),
    };
  }

  /** O registro JÁ existe? (false = esta é a PRIMEIRA mensagem da conversa.) */
  private async jaExiste(chatId: string): Promise<boolean> {
    return (await this.deps.json.get(NS, chatId)) !== null;
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
        // Caso Denise (2026-07-21): a PRIMEIRA mensagem ("Olá! Posso ter mais
        // informações?") chega ANTES de qualquer pergunta — nada nela é nome/
        // cidade, salvo apresentação explícita ("me chamo…"). Sem este guarda,
        // a pergunta do cliente virava o nome ("Prazer, Olá! Posso ter…!").
        const primeiraMensagem = !(await this.jaExiste(chatId));
        if (primeiraMensagem && !/\b(me\s+chamo|meu\s+nome)\b/i.test(texto)) {
          await this.salvar({ ...r, ultimaCaptura: null, atualizadoEm: now });
          return;
        }
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
          await this.salvar({
            ...r,
            consentiu: true,
            recusou: false,
            ultimaCaptura: 'consentimento',
            atualizadoEm: now,
          });
          this.deps.observability.event('jornada', `consentimento chat=${chatId}`, now);
        } else if (interesse === 'nao') {
          await this.salvar({ ...r, recusou: true, ultimaCaptura: null, atualizadoEm: now });
        } else {
          await this.salvar({ ...r, ultimaCaptura: null, atualizadoEm: now });
        }
        return;
      }

      // Caso Lucas: DESISTÊNCIA na triagem ⇒ marca (a cobrança cessa; a
      // despedida deste turno é da resposta autorada). RETOMADA: interesse novo
      // reativa o funil do ponto onde parou.
      if (etapa === 'TRIAGEM' && ehDesistencia(texto)) {
        await this.salvar({ ...r, desistiu: true, ultimaCaptura: null, atualizadoEm: now });
        this.deps.observability.event('jornada', `desistencia chat=${chatId}`, now);
        return;
      }
      if (etapa === 'TRIAGEM' && r.desistiu && interpretarInteresse(texto) === 'sim') {
        await this.salvar({
          ...r,
          desistiu: false,
          ultimaCaptura: 'consentimento',
          atualizadoEm: now,
        });
        this.deps.observability.event('jornada', `retomada chat=${chatId}`, now);
        return;
      }
      // TRIAGEM: adiamento é FATO capturável ("posso deixar p amanhã") — conta
      // os avisos (1º = acolhimento completo; repetição = "Combinado!" curto).
      if (etapa === 'TRIAGEM' && ehAdiamento(texto)) {
        await this.salvar({
          ...r,
          ultimaCaptura: 'adiamento',
          avisosDeAdiamento: r.avisosDeAdiamento + 1,
          atualizadoEm: now,
        });
        this.deps.observability.event(
          'jornada',
          `adiamento chat=${chatId} avisos=${String(r.avisosDeAdiamento + 1)}`,
          now,
        );
        return;
      }
      // ESCADA DE COBRANÇA (2026-07-22): texto que cairá na cobrança conta o
      // degrau — 1ª padrão, 2ª reforço, 3ª+ conversa humana (nunca eco mudo).
      if (etapa === 'TRIAGEM' && vaiReceberCobranca(texto)) {
        await this.salvar({
          ...r,
          cobrancasSeguidas: r.cobrancasSeguidas + 1,
          ultimaCaptura: null,
          atualizadoEm: now,
        });
        return;
      }
      // TRIAGEM/CONCLUIDA: nada a capturar; limpa a nuance do turno anterior.
      if (r.ultimaCaptura !== null)
        await this.salvar({ ...r, ultimaCaptura: null, atualizadoEm: now });
    } catch (e) {
      this.deps.observability.error(
        'jornada',
        'captura',
        now,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  /** A RESPOSTA AUTORADA do turno — '' quando a jornada NÃO governa (CONCLUIDA). */
  async responder(chatId: string, entrada: EntradaDoTurno): Promise<string> {
    const fatos = await this.fatos(chatId);
    const concluidaAgora =
      entrada.tipo === 'documento' &&
      registroDoTurnoConcluido(fatos, entrada) &&
      fatos.docsCompletos;
    // CONCLUIDA delega ao LLM — EXCETO o turno do ÚLTIMO documento, cuja
    // resposta ("documentação completa") é a despedida da própria jornada.
    if (derivarEtapa(fatos) === 'CONCLUIDA' && !concluidaAgora) return '';
    const resposta = responderTurno(fatos, entrada);
    // Ack emitido com o registro AINDA processando ⇒ marca: a classificação
    // tardia deve FALAR a progressão sozinha (o subscriber checa o marcador).
    if (
      entrada.tipo === 'documento' &&
      resposta === MENSAGENS_JORNADA.ackDocumento &&
      !fatos.registro.aguardandoProgressao
    ) {
      await this.salvar({
        ...fatos.registro,
        aguardandoProgressao: true,
        atualizadoEm: this.deps.clock.now(),
      }).catch(() => undefined);
    }
    // 15ª rodada: o turno FALOU o fato ⇒ marcador antigo morre (evita a dupla
    // "✅ Registrado" — progressão tardia + resposta do turno para o mesmo doc).
    if (
      entrada.tipo === 'documento' &&
      resposta !== MENSAGENS_JORNADA.ackDocumento &&
      fatos.registro.aguardandoProgressao
    ) {
      await this.salvar({
        ...fatos.registro,
        aguardandoProgressao: false,
        atualizadoEm: this.deps.clock.now(),
      }).catch(() => undefined);
    }
    return resposta;
  }

  /** 15ª rodada — chega um documento NOVO (pré-turno): qualquer progressão
   *  pendente do envio anterior está SUPERADA — o próprio turno falará o estado
   *  fresco (fato ou ack+marcador novo). Sem isso, um marcador velho fazia o
   *  subscriber E a resposta do turno anunciarem o MESMO registro (mensagem 2×).
   *  Documento chegando também ZERA os avisos de adiamento (a espera acabou). */
  async aoReceberDocumento(chatId: string): Promise<void> {
    await this.concluirProgressao(chatId).catch(() => undefined);
    const r = await this.carregar(chatId);
    // Documento chegando = a espera acabou E a desistência foi superada.
    if (
      r.avisosDeAdiamento > 0 ||
      r.ultimaCaptura === 'adiamento' ||
      r.desistiu ||
      r.cobrancasSeguidas > 0
    ) {
      await this.salvar({
        ...r,
        avisosDeAdiamento: 0,
        desistiu: false,
        cobrancasSeguidas: 0,
        ultimaCaptura: null,
        atualizadoEm: this.deps.clock.now(),
      }).catch(() => undefined);
    }
  }

  /** O turno respondeu só o ack e a progressão ainda não foi falada? */
  async estaAguardandoProgressao(chatId: string): Promise<boolean> {
    return (await this.carregar(chatId)).aguardandoProgressao;
  }

  /** A progressão foi falada (pelo subscriber tardio ou pelo próprio turno). */
  async concluirProgressao(chatId: string): Promise<void> {
    const r = await this.carregar(chatId);
    if (r.aguardandoProgressao)
      await this.salvar({ ...r, aguardandoProgressao: false, atualizadoEm: this.deps.clock.now() });
  }
}
