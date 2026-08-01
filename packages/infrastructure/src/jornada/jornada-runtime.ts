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
  capturarCpf,
  capturarIdentificacao,
  derivarEtapa,
  ehAdiamento,
  capturarEstado,
  ehDesistencia,
  ehSobreDossieOuLink,
  interpretarInteresse,
  vaiReceberCobranca,
  novaJornada,
  registroDoTurnoConcluido,
  responderTurno,
  separarCidadeEstado,
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
  /** UF (decreto 2026-07-29) — opcional: registros antigos não têm o campo. */
  readonly estado?: string | null;
  /** Decreto 2026-07-26 — OPCIONAL na persistência: os registros gravados antes
   *  do decreto não têm o campo e devem continuar carregando (⇒ cpf null). */
  readonly cpf?: string | null;
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
  /** O caso JÁ está concluído (HISCON recebido / portal liberado) segundo uma
   *  fonte confiável (living-memory), MESMO que o onboarding-documental tenha
   *  divergido? Sem isto, a jornada re-pedia o HISCON já recebido (caso Maria
   *  Angela, 2026-07-23). Opcional (ausente ⇒ só o onboarding decide). */
  readonly casoConcluido?: (chatId: string) => Promise<boolean>;
  /** Decreto 2026-07-31 (caso REAL Rosana): o PARECER que a AHRI já enviou ao
   *  cliente. Sem isto, ela NEGAVA o próprio dossiê ("não tem nenhum link") e
   *  chegou a tratar a mensagem dela mesma como golpe. null = ainda não houve
   *  parecer (a AHRI diz a verdade: a análise está em andamento). */
  readonly parecerDoCliente?: (chatId: string) => Promise<{
    readonly link: string;
    readonly contratos: number;
    readonly indicios: number;
  } | null>;
}

export class JornadaComercialRuntime {
  constructor(private readonly deps: JornadaRuntimeDeps) {}

  private async carregar(chatId: string): Promise<JornadaRecord> {
    const raw = (await this.deps.json.get(NS, chatId)) as Persisted | null;
    if (raw === null) return novaJornada(chatId, this.deps.clock.now());
    return {
      ...raw,
      estado: raw.estado ?? null,
      cpf: raw.cpf ?? null,
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
    // O caso é concluído se o onboarding registrou o HISCON OU se uma fonte
    // confiável (living-memory / portal liberado) diz que sim — cobre a divergência
    // de projeção que fazia a AHRI re-pedir um HISCON já recebido.
    const concluidoPorOutraFonte =
      (await this.deps.casoConcluido?.(chatId).catch(() => false)) ?? false;
    const onboardingCompleto =
      visao !== null && visao.faltando.length === 0 && visao.recebidos.length > 0;
    return {
      registro,
      docsRecebidos: visao?.recebidos.length ?? 0,
      docsCompletos: onboardingCompleto || concluidoPorOutraFonte,
      // Decreto HISCON-ONLY (2026-07-22): enquanto não há onboarding semeado
      // (ex.: lead que só consentiu), o próximo documento é SEMPRE o HISCON — NUNCA
      // RG/CNH (isso é da Jornada 2, conduzida pelo advogado no portal).
      proximoDocumento: visao?.proximo ?? 'HISCON (histórico de empréstimos consignados do INSS)',
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

      // CPF (decreto 2026-07-26) — capturado em QUALQUER etapa, inclusive na
      // ANÁLISE: quem já entregou o HISCON recebe o follow-up de CPF e responde
      // com o número; sem esta captura fora da triagem, a resposta se perderia.
      if (r.cpf === null) {
        const cpf = capturarCpf(texto);
        if (cpf !== null) {
          await this.salvar({ ...r, cpf, ultimaCaptura: 'cpf', atualizadoEm: now });
          this.deps.observability.event('jornada', `cpf capturado chat=${chatId}`, now);
          return;
        }
      }

      // Caso REAL Humberto (16 99747-7435, 2026-07-30): cidade numa bolha
      // ("Ribeirão preto") e o estado na SEGUINTE ("São Paulo"). A segunda
      // bolha não era entendida e o fluxo cobrava "Cidade - UF" em loop,
      // trançando duas conversas. Agora: com cidade registrada e estado
      // faltando, uma mensagem que é SÓ um estado (UF ou por extenso) completa
      // o registro em silêncio — a resposta segue a etapa atual, sem repetir
      // nenhum script (ultimaCaptura null ⇒ nunca re-dispara a explicação).
      if (r.cidade !== null && r.estado === null) {
        const uf = capturarEstado(texto);
        if (uf !== null) {
          await this.salvar({ ...r, estado: uf, ultimaCaptura: null, atualizadoEm: now });
          this.deps.observability.event('jornada', `estado capturado (${uf}) chat=${chatId}`, now);
          return;
        }
      }

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
          // Caso Maria Aparecida (2026-07-29): a captura PODE corrigir um campo
          // já preenchido (nome de uma palavra que era a cidade, e vice-versa) —
          // o capturado tem precedência sobre o registro antigo.
          const cidadeBruta = capturado.cidade ?? r.cidade;
          const { cidade, estado } =
            cidadeBruta !== null
              ? separarCidadeEstado(cidadeBruta)
              : { cidade: null, estado: null };
          await this.salvar({
            ...r,
            nome: capturado.nome ?? r.nome,
            cidade,
            estado: estado ?? r.estado,
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
    // Caso REAL Rosana (2026-07-31, 21:20): "o link não abre" ⇒ a AHRI NEGOU o
    // dossiê que ela mesma enviou e tratou a própria mensagem como golpe. Em
    // QUALQUER etapa, falar do dossiê/link tem resposta AUTORADA: o link volta
    // (com os números reais) ou a verdade — a análise ainda está em andamento.
    if (entrada.tipo === 'texto' && ehSobreDossieOuLink(entrada.texto)) {
      const parecer = (await this.deps.parecerDoCliente?.(chatId).catch(() => null)) ?? null;
      if (parecer !== null) {
        return MENSAGENS_JORNADA.dossieReenvio(parecer.link, parecer.contratos, parecer.indicios);
      }
      // Sem parecer, só respondemos se a jornada governa a etapa (fase 1) — na
      // conversa livre o LLM segue com o contexto (que já declara a ausência).
      if (derivarEtapa(fatos) !== 'CONCLUIDA') return MENSAGENS_JORNADA.dossieAindaNaoPronto;
    }
    // CPF CAPTURADO NESTE TURNO na CONCLUIDA ⇒ a confirmação é AUTORADA — caso
    // real 51 9109-4367 (2026-07-27): o cliente respondeu ao follow-up com o
    // CPF, o atalho abaixo entregava a voz ao LLM (que não sabia do pedido) e a
    // AHRI negou o próprio pedido ("se em algum momento precisarmos do CPF, eu
    // falo"). Quem pediu, confirma. As demais etapas já tratam o 'cpf' dentro
    // do responderTurno (na TRIAGEM a confirmação emenda o pedido do HISCON).
    if (
      fatos.registro.ultimaCaptura === 'cpf' &&
      entrada.tipo === 'texto' &&
      capturarCpf(entrada.texto) !== null && // a confirmação fala NO turno do número
      derivarEtapa(fatos) === 'CONCLUIDA'
    )
      return MENSAGENS_JORNADA.cpfRegistradoEmAnalise;
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
