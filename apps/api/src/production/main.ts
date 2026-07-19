// ─────────────────────────────────────────────────────────────────────────────
// MAIN de produção — o ponto de entrada que O DONO executa (node/dist ou Docker).
// Monta a composição real, valida o GO-LIVE (qualquer item vermelho ⇒ NÃO SOBE),
// e só então escuta as portas. Loop temporal (scheduler→percepção) incluso.
// ─────────────────────────────────────────────────────────────────────────────
import { assembleProduction, ProductionGoLive } from '@reconstrua/infrastructure';
import { SystemClock, UuidV4Generator } from '@reconstrua/infrastructure';
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
    process.stdout.write('Produção BLOQUEADA. Corrija os itens acima (ou ALLOW_DEGRADED=true apenas para homologação).\n');
    process.exitCode = 1;
    return;
  }
  // B5.3 — DEGRADAÇÃO relevante: subir apesar de itens vermelhos fica registrado (durável).
  if (!report.ready && allowDegraded) {
    const red = report.results.filter((r) => !r.passed).map((r) => r.item).join(', ');
    prod.observability.degraded('go-live', 'degraded-start', clock.now(), `iniciado em modo degradado (ALLOW_DEGRADED); itens vermelhos: ${red}`);
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
        process.stdout.write(`ADMIN: primeiro administrador provisionado e verificado ("${created?.name ?? adminName}").\n`);
        adminReady = true;
        break;
      }
      process.stderr.write(`ADMIN: gravação não confirmada na releitura (tentativa ${String(attempt)}/5) — repetindo.\n`);
    } catch (error) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      process.stderr.write(`ADMIN: falha ao provisionar o administrador (tentativa ${String(attempt)}/5): ${detail}\n`);
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
  });
  const advogado = buildAdvogadoServer(prod.advogadoView, { accessSecret: env['ADVOGADO_ACCESS_SECRET'] ?? '' });
  const lx = buildLawyerExperienceServer(prod.lxView, {
    advogadoSecret: env['ADVOGADO_ACCESS_SECRET'] ?? '',
    adminSecret: env['ADMIN_ACCESS_SECRET'] ?? '',
  });

  await main.listen({ port, host: '0.0.0.0' });
  await admin.listen({ port: port + 1, host: '0.0.0.0' });
  await advogado.listen({ port: port + 2, host: '0.0.0.0' });
  await lx.listen({ port: port + 3, host: '0.0.0.0' });
  process.stdout.write(`AHRIOS em produção: main:${String(port)} admin:${String(port + 1)} advogado:${String(port + 2)} lx:${String(port + 3)}\n`);

  // Loop temporal pela ENTRADA ÚNICA serializada (A2/4C) + preparação noturna às 03h.
  // B5.3 — exceções antes ABSORVIDAS silenciosamente agora são registradas (memória +
  // stderr durável), sem alterar o comportamento do loop (continua tolerante a falhas).
  setInterval(() => {
    void prod.ingress.tick(clock.now()).catch((error: unknown) => {
      prod.observability.error('temporal', 'tick', clock.now(), error instanceof Error ? error.message : 'falha no tick temporal');
    });
    // PC-R3 — a varredura do NASCIMENTO do Portal (sem clique humano): quando a
    // AHRI reconhece que recebeu tudo, o fato nasce e a mensagem é entregue.
    void prod.nascimento.verificar(clock.now()).catch((error: unknown) => {
      prod.observability.error('nascimento', 'verificar', clock.now(), error instanceof Error ? error.message : 'falha na varredura do nascimento');
    });
    // GO-LIVE-02 — a varredura da DESPEDIDA (Modelo A): a relação se encerra
    // como começou — conversando. Fato antes da mensagem; envio único.
    void prod.despedida.verificar(clock.now()).catch((error: unknown) => {
      prod.observability.error('despedida', 'verificar', clock.now(), error instanceof Error ? error.message : 'falha na varredura da despedida');
    });
    // GO-LIVE-02 — traduções pendentes (fail-closed): nenhum balão nasce cru;
    // o que falhou na escrita é traduzido aqui assim que o LLM responder.
    void prod.traducao.reprocessarPendentes().catch((error: unknown) => {
      prod.observability.error('traducao', 'reprocessar', clock.now(), error instanceof Error ? error.message : 'falha no reprocesso de traduções');
    });
  }, 60_000);
  setInterval(() => {
    const now = clock.now();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      void prod.lxView.nightShift.run(now).catch((error: unknown) => {
        prod.observability.error('night-shift', 'run', now, error instanceof Error ? error.message : 'falha na preparação noturna');
      });
    }
  }, 60_000);
}

// Executado apenas quando o DONO roda este arquivo (node dist/production/main.js).
void main();
