// ─────────────────────────────────────────────────────────────────────────────
// MAIN de produção — o ponto de entrada que O DONO executa (node/dist ou Docker).
// Monta a composição real, valida o GO-LIVE (qualquer item vermelho ⇒ NÃO SOBE),
// e só então escuta as portas. Loop temporal (scheduler→percepção) incluso.
// ─────────────────────────────────────────────────────────────────────────────
import { assembleProduction, ProductionGoLive } from '@reconstrua/infrastructure';
import { SystemClock, UuidV4Generator } from '@reconstrua/infrastructure';
import { memoCurto, planilhaDeContratosDetalhada } from '@reconstrua/application';
import { buildProductionServer } from './production-server.js';
import { buildAdminServer } from '../admin/admin-server.js';
import { buildAdvogadoServer } from '../advogado/advogado-server.js';
import { buildLawyerExperienceServer } from '../lawyer-experience/lawyer-experience-server.js';

async function main(): Promise<void> {
  const env = process.env;
  const clock = new SystemClock();
  const startedAt = clock.now();
  const prod = assembleProduction({ clock, uuid: new UuidV4Generator(), env });

  // GO-LIVE bloqueante: nada sobe com item vermelho (a menos de override explícito de homologação).
  const report = await new ProductionGoLive(prod).verify(clock.now(), env);
  const allowDegraded = env['ALLOW_DEGRADED'] === 'true';
  process.stdout.write(`GO-LIVE: ${report.ready ? 'PRONTO' : 'BLOQUEADO'}\n`);
  for (const r of report.results) {
    process.stdout.write(`  [${r.passed ? 'OK ' : 'FAIL'}] ${r.item}: ${r.detail}\n`);
  }
  if (!report.ready && !allowDegraded) {
    process.stdout.write(
      'Produção BLOQUEADA. Corrija os itens acima (ou ALLOW_DEGRADED=true apenas para homologação).\n',
    );
    process.exitCode = 1;
    return;
  }
  // B5.3 — DEGRADAÇÃO relevante: subir apesar de itens vermelhos fica registrado (durável).
  if (!report.ready && allowDegraded) {
    const red = report.results
      .filter((r) => !r.passed)
      .map((r) => r.item)
      .join(', ');
    prod.observability.degraded(
      'go-live',
      'degraded-start',
      clock.now(),
      `iniciado em modo degradado (ALLOW_DEGRADED); itens vermelhos: ${red}`,
    );
  }

  // GO-LIVE-06.1 (BUG 1) — SEED do primeiro administrador: ROBUSTO, VISÍVEL e
  // VERIFICADO. Antes, uma exceção era engolida na observabilidade (invisível no
  // `docker logs`) e um único disparo no boot era frágil. Grava em
  // production.documents (namespace 'staff'). Agora: tenta até 5 vezes, IMPRIME o
  // resultado/erro no stdout/stderr (docker logs) e CONFIRMA por releitura — a
  // prova de que o administrador realmente persistiu no banco.
  const adminName = env['ADMIN_NAME'] ?? 'Administrador';
  let adminReady = false;
  for (let attempt = 1; attempt <= 5 && !adminReady; attempt += 1) {
    try {
      if (await prod.adminView.staff.isBootstrapped()) {
        process.stdout.write('ADMIN: já inicializado (nenhum seed necessário).\n');
        adminReady = true;
        break;
      }
      const created = await prod.adminView.staff.ensureBootstrapped(adminName);
      // VERIFICAÇÃO por releitura: prova que gravou de fato (não confia na escrita).
      if (await prod.adminView.staff.isBootstrapped()) {
        process.stdout.write(
          `ADMIN: primeiro administrador provisionado e verificado ("${created?.name ?? adminName}").\n`,
        );
        adminReady = true;
        break;
      }
      process.stderr.write(
        `ADMIN: gravação não confirmada na releitura (tentativa ${String(attempt)}/5) — repetindo.\n`,
      );
    } catch (error) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      process.stderr.write(
        `ADMIN: falha ao provisionar o administrador (tentativa ${String(attempt)}/5): ${detail}\n`,
      );
      prod.observability.error('bootstrap', 'seed-admin', clock.now(), detail);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
  if (!adminReady) {
    process.stderr.write(
      'ADMIN: NÃO foi possível provisionar o administrador após 5 tentativas. ' +
        'Verifique DATABASE_URL e a tabela production.documents (namespace "staff") nos logs acima.\n',
    );
  }

  const port = Number(env['PORT'] ?? '3001');

  const main = buildProductionServer({ prod, env, startedAt });
  const admin = buildAdminServer(prod.adminView, {
    accessSecret: env['ADMIN_ACCESS_SECRET'] ?? '',
    founderSecret: env['FOUNDER_ACCESS_SECRET'] ?? '',
    // Decreto Dossiê Pericial: HISCON parseado (contratos/migrados/indícios).
    pericia: prod.pericia,
    // Decreto 2026-07-21: convite→senha própria→login do perito.
    peritoAuth: prod.peritoAuth,
    // Onda 2 (2026-07-31): o Atendimento Humanizado (secretária, papel operador).
    humanizadoAuth: prod.humanizadoAuth,
    humanizado: prod.humanizado,
    // Decreto 2026-08-05: o CHAT do canal da equipe (número 41 na Meta) —
    // conversa 100% humana no portal; a AHRI nunca responde nele.
    chatHumanizado: prod.chatHumanizado,
    // Decreto 2026-08-11: a VARREDURA da fase 2 — quem confirmou e não chegou
    // à mesa do Humanizado (caso Oracio "e muitos outros").
    varreduraFase2: prod.varreduraFase2,
    // Decreto 2026-08-11: o cliente trocou de chip e continua o MESMO
    // atendimento pelo número novo (histórico, HISCON e cadastro vão junto).
    transferenciaNumero: prod.transferenciaNumero,
    // Decreto 2026-08-08: o PAINEL JURÍDICO (2º painel — dono + sócio).
    juridico: prod.juridico,
    // Reaquecimento FASE 1 (2026-08-07): template pelo número OFICIAL da AHRI.
    templateOficial: prod.enviarTemplateOficial,
    // 2026-08-09: disparos persistidos — o painel mostra quem interagiu.
    disparosOficial: prod.disparosOficial,
    // Onda 3 (2026-07-31): o parecer em LOTE para a base legada (ato do Admin).
    parecerLote: prod.parecerLote,
    // Decreto 2026-08-03: o funil real na Visão Executiva do Centro de Comando.
    funilResumo: prod.funilResumo,
    // Decreto 2026-08-04: o potencial CONFIRMADO (docs completos na mesa).
    potencialConfirmado: prod.potencialConfirmado,
    // Decreto 2026-08-04: a carteira de créditos do advogado parceiro.
    creditosAdvogado: prod.creditosAdvogado,
    // Custos de IA: gasto por cliente (conversa + leitura de documentos).
    custos: prod.custos,
    // Reaquecimento de leads frios — autorizado pelo admin, lead a lead.
    reaquecimento: prod.reaquecimento,
    // Decreto 2026-07-23: cadastro/lista/painel + convite (link)→CPF+senha→login do sócio.
    socios: prod.socios,
    socioAuth: prod.socioAuth,
    // Decreto 2026-07-24: fluxo do perito (em perícia/10 dias, credenciais, resposta do banco).
    periciaFluxo: prod.periciaFluxo,
    // Decreto 2026-07-24: mapa de clientes (distribuição por estado/cidade).
    mapaClientes: prod.mapaClientes,
    // Decreto 2026-07-26: o CPF coletado no funil, exibido no cadastro do cliente.
    jornadaCpf: async (chatId: string) => (await prod.jornadaComercial.fatos(chatId)).registro.cpf,
    // Decreto 2026-07-27: releitura comparativa do HISCON (só leitura).
    releitura: prod.releitura,
    // Decreto 2026-07-27 (caso Roberto): revínculo do HISCON ao anexo certo.
    revinculo: prod.revinculo,
    // Decreto 2026-07-29: o Jarvis do Founder Console.
    jarvis: prod.jarvis,
    // Decreto 2026-07-30: docs da fase 2 humana (procuração/RG/comprovante).
    docsEquipe: prod.docsEquipe,
    // Decreto 2026-07-31: canal do último contato (meta/evolution/webchat).
    canalDoChat: prod.canalDoChat,
    // Decreto 2026-07-24: Central de Perícia Digital (atrás de feature flag).
    periciaDigitalHabilitado: prod.periciaDigitalHabilitado,
    periciaDigital: prod.periciaDigital,
    periciaDigitalCasos: {
      todos: () => prod.periciaDigital.listarCasos(),
      porId: (id: string) => prod.periciaDigital.obterCaso(id),
    },
    periciaDigitalCustodia: {
      trilha: (id: string) => prod.periciaDigital.trilhaCustodia(id),
      verificar: (id: string) => prod.periciaDigital.verificarCustodia(id),
    },
  });
  // Decreto 2026-07-30: o cliente destinado chega ao advogado com o ESTUDO —
  // dossiê de contratos da janela + a MESMA planilha (CSV Excel-BR) do perito.
  // PERFORMANCE (2026-08-05, caso Gracielle "não abre"): a página do cliente
  // dispara estudo+ações em PARALELO e cada um resolvia o cliente varrendo a
  // LISTA COMPLETA sem cache. Memória curta com requentar: a lista vencida sai
  // na hora e a varredura nova corre por trás.
  const listaClientesMemo = memoCurto(
    async () => (await prod.adminView.clientes?.list()) ?? [],
    60_000,
    { requentar: true },
  );
  const clienteDoChat = async (
    chatId: string,
  ): Promise<{ clienteId: string; quem: string } | null> => {
    const lista = await listaClientesMemo();
    const c = lista.find((x) => x.chatId === chatId);
    return c ? { clienteId: c.clienteId, quem: c.quem } : null;
  };
  const advogado = buildAdvogadoServer(prod.advogadoView, {
    accessSecret: env['ADVOGADO_ACCESS_SECRET'] ?? '',
    estudo: {
      dossiePorChat: async (chatId) => {
        const cliente = await clienteDoChat(chatId);
        if (cliente === null || prod.adminView.perito === undefined) return null;
        const c = await prod.adminView.perito.contratos(cliente.clienteId);
        if (c === null || c.detalhado.contratos.length === 0) return null;
        const plan = planilhaDeContratosDetalhada(
          `Contratos — ${cliente.quem}`,
          c.detalhado,
          clock.now(),
        );
        const cpf = (await prod.jornadaComercial.fatos(chatId).catch(() => null))?.registro.cpf;
        return { quem: cliente.quem, cpf: cpf ?? null, colunas: plan.colunas, linhas: plan.linhas };
      },
      planilhaPorChat: async (chatId) => {
        const cliente = await clienteDoChat(chatId);
        if (cliente === null || prod.adminView.perito === undefined) return null;
        const gerada = await prod.adminView.perito.planilha(cliente.clienteId);
        return gerada !== null
          ? { nomeArquivo: gerada.nomeArquivo, mime: gerada.mime, conteudo: gerada.conteudo }
          : null;
      },
      // Decreto 2026-08-04: o dossiê de AÇÕES (o guia de agrupamento aplicado).
      acoesPorChat: (chatId) => prod.pericia.acoesDe(chatId),
    },
    // Decreto 2026-08-04: o encaminhamento abate os processos do cliente na
    // carteira do advogado parceiro (best-effort, idempotente por cliente).
    aoAtribuir: prod.abaterPorAtribuicao,
    // Decreto 2026-08-05: o advogado vê a PRÓPRIA carteira no painel dele.
    creditosAdvogado: prod.creditosAdvogado,
    // Decreto 2026-08-04 (noite): documentação completa LIBERA para o advogado
    // já; os 10 dias da perícia viram contagem informativa no card.
    completosHumanizado: async () =>
      (await prod.humanizado.clientes())
        .filter((c) => c.completo && !c.descartado)
        .map((c) => ({ clienteId: c.clienteId, chatId: c.chatId, nome: c.nome })),
    periciaDoChat: async (chatId) => {
      const p = (await prod.periciaFluxo.listar()).find((x) => x.chatId === chatId);
      return p !== undefined
        ? {
            iniciadaEm: p.iniciadaEm,
            prazoEm: p.prazoEm,
            diasRestantes: p.diasRestantes,
            horasRestantes: p.horasRestantes,
            expirado: p.expirado,
            // 2026-08-05: a RESPOSTA do banco encerra a espera antes do prazo —
            // o status do advogado atualiza pela condição, não só pelo relógio.
            respostaBanco: p.respostaBanco
              ? { texto: p.respostaBanco.texto, registradaEm: p.respostaBanco.registradaEm }
              : null,
          }
        : null;
    },
    docsEquipe: {
      listar: (chatId) => prod.docsEquipe.listar(chatId),
      baixar: (chatId, id) => prod.docsEquipe.baixar(chatId, id),
    },
  });
  const lx = buildLawyerExperienceServer(prod.lxView, {
    advogadoSecret: env['ADVOGADO_ACCESS_SECRET'] ?? '',
    adminSecret: env['ADMIN_ACCESS_SECRET'] ?? '',
  });

  await main.listen({ port, host: '0.0.0.0' });
  await admin.listen({ port: port + 1, host: '0.0.0.0' });
  await advogado.listen({ port: port + 2, host: '0.0.0.0' });
  await lx.listen({ port: port + 3, host: '0.0.0.0' });
  process.stdout.write(
    `AHRIOS em produção: main:${String(port)} admin:${String(port + 1)} advogado:${String(port + 2)} lx:${String(port + 3)}\n`,
  );

  // DEPLOY GRACIOSO (caso REAL Iracema 5551 9232-3343, 2026-07-31): o restart
  // do container (deploy/rebuild) matava o processo NO MEIO de um turno (~20s
  // de decisão) — a mensagem do cliente ficava registrada e a resposta nunca
  // nascia; nenhum erro, nenhum shadow report. Agora, no SIGTERM/SIGINT:
  //  1. fecha o servidor MAIN primeiro (webhook para de aceitar — a Meta
  //     reentrega o que chegar durante a troca);
  //  2. espera os turnos EM VOO terminarem (até 45s; compose dá 60s de graça);
  //  3. drena o outbox (entregas produzidas pelos turnos drenados) e morre.
  let encerrando = false;
  const encerrarComGraca = (sinal: string): void => {
    if (encerrando) return;
    encerrando = true;
    void (async () => {
      process.stdout.write(`[reconstrua] ${sinal}: encerrando com graça (drenando turnos)…\n`);
      await main.close().catch(() => undefined);
      await prod.drenarTurnos(45_000).catch(() => undefined);
      await prod.outbox.drainToIdle().catch(() => undefined);
      await Promise.allSettled([admin.close(), advogado.close(), lx.close()]);
      process.stdout.write('[reconstrua] turnos drenados — processo encerrado.\n');
      process.exit(0);
    })();
  };
  process.once('SIGTERM', () => {
    encerrarComGraca('SIGTERM');
  });
  process.once('SIGINT', () => {
    encerrarComGraca('SIGINT');
  });

  // AQUECIMENTO DOS CACHES (caso real 2026-08-05: após um restart da api, a
  // Central do Perito abria ZERADA — a varredura fria de "todos com HISCON"
  // passava dos 20s de timeout do portal e a página desistia). Depois do
  // boot, as varreduras caras são pré-computadas UMA vez em segundo plano;
  // best-effort: falha de aquecimento nunca afeta a produção.
  void (async () => {
    try {
      await prod.adminView.perito?.todosComHiscon();
    } catch {
      /* aquecimento é cortesia */
    }
    try {
      await prod.pericia.potencialDeTodos();
    } catch {
      /* idem */
    }
    try {
      await prod.humanizado.clientes();
    } catch {
      /* idem */
    }
    process.stdout.write('[reconstrua] caches aquecidos (perito/potencial/mesa).\n');
  })();

  // DECRETO 2026-07-30 (ban da Meta por "spam"): o loop temporal NÃO fala mais
  // com cliente nenhum por INICIATIVA própria. Saíram do ar: ingress.tick
  // (follow-ups agendados + lembretes de SLA + retomada + CPF das 09:00 — o
  // tick também está desarmado na montagem) e despedida.verificar. A AHRI só
  // fala quando o CLIENTE fala, ou quando o DONO manda (admin/Jarvis).
  //
  // EXCEÇÃO autorizada pelo dono (2026-07-30, mesma noite): o NASCIMENTO do
  // Portal permanece — a mensagem do link é a CONCLUSÃO da fase 1, consequência
  // direta do HISCON que o CLIENTE acabou de enviar (envio ÚNICO por cliente,
  // fato gravado antes da mensagem; jamais repete). Não é disparo frio.
  setInterval(() => {
    void prod.nascimento.verificar(clock.now()).catch((error: unknown) => {
      prod.observability.error(
        'nascimento',
        'verificar',
        clock.now(),
        error instanceof Error ? error.message : 'falha na varredura do nascimento',
      );
    });
    // GO-LIVE-02 — traduções pendentes (fail-closed): nenhum balão nasce cru;
    // o que falhou na escrita é traduzido aqui assim que o LLM responder.
    void prod.traducao.reprocessarPendentes().catch((error: unknown) => {
      prod.observability.error(
        'traducao',
        'reprocessar',
        clock.now(),
        error instanceof Error ? error.message : 'falha no reprocesso de traduções',
      );
    });
  }, 60_000);
  // 14ª rodada — BOMBA DE RETENTATIVAS: entregas pendentes (ex.: classificação
  // aguardando a transcrição da Vision) eram reprocessadas SÓ no próximo turno
  // (próxima mensagem do cliente). Sem mensagem nova, a progressão tardia
  // ("✅ Registrado…") nunca disparava. O drain é barato quando ocioso e o
  // claim das entregas é atômico (locked_by) — seguro ao lado do drain do turno.
  setInterval(() => {
    void prod.outbox.drainToIdle().catch((error: unknown) => {
      prod.observability.error(
        'outbox',
        'pump',
        clock.now(),
        error instanceof Error ? error.message : 'falha no pump do outbox',
      );
    });
  }, 10_000);
  setInterval(() => {
    const now = clock.now();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      void prod.lxView.nightShift.run(now).catch((error: unknown) => {
        prod.observability.error(
          'night-shift',
          'run',
          now,
          error instanceof Error ? error.message : 'falha na preparação noturna',
        );
      });
    }
  }, 60_000);
  // ACOMPANHAMENTO VIVO do Painel Jurídico (2026-08-08): consulta o DataJud
  // (leitura pública, nada de mensagens) para TODOS os processos ativos —
  // 3 min após o boot e a cada 6 horas. O dashboard mostra novidades e
  // alertas (execução, recebimento…) sem ninguém clicar em nada.
  const atualizarAndamentosJuridico = (): void => {
    void prod.juridico.atualizarAndamentos().catch((error: unknown) => {
      prod.observability.error(
        'juridico',
        'datajud',
        clock.now(),
        error instanceof Error ? error.message : 'falha na atualização de andamentos',
      );
    });
  };
  setTimeout(atualizarAndamentosJuridico, 3 * 60_000);
  setInterval(atualizarAndamentosJuridico, 6 * 60 * 60_000);
}

// Executado apenas quando o DONO roda este arquivo (node dist/production/main.js).
void main();
