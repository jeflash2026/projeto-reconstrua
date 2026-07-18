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

  const port = Number(env['PORT'] ?? '3001');

  const main = buildProductionServer({ prod, env, startedAt });
  const admin = buildAdminServer(prod.adminView, {
    accessSecret: env['ADMIN_ACCESS_SECRET'] ?? '',
    founderSecret: env['FOUNDER_ACCESS_SECRET'] ?? '',
  });
  const advogado = buildAdvogadoServer(prod.advogadoView, { accessSecret: env['ADVOGADO_ACCESS_SECRET'] ?? '' });
  const lx = buildLawyerExperienceServer(prod.lxView);

  // [BOOT-DIAG] instrumentação TEMPORÁRIA: registra cada listen() concluído —
  // a ausência de uma linha identifica exatamente qual servidor não abriu.
  await main.listen({ port, host: '0.0.0.0' });
  process.stdout.write(`[BOOT-DIAG] listen OK: main :${String(port)}\n`);
  await admin.listen({ port: port + 1, host: '0.0.0.0' });
  process.stdout.write(`[BOOT-DIAG] listen OK: admin :${String(port + 1)}\n`);
  await advogado.listen({ port: port + 2, host: '0.0.0.0' });
  process.stdout.write(`[BOOT-DIAG] listen OK: advogado :${String(port + 2)}\n`);
  await lx.listen({ port: port + 3, host: '0.0.0.0' });
  process.stdout.write(`[BOOT-DIAG] listen OK: lx :${String(port + 3)}\n`);
  process.stdout.write(`AHRIOS em produção: main:${String(port)} admin:${String(port + 1)} advogado:${String(port + 2)} lx:${String(port + 3)}\n`);

  // Loop temporal pela ENTRADA ÚNICA serializada (A2/4C) + preparação noturna às 03h.
  // B5.3 — exceções antes ABSORVIDAS silenciosamente agora são registradas (memória +
  // stderr durável), sem alterar o comportamento do loop (continua tolerante a falhas).
  setInterval(() => {
    void prod.ingress.tick(clock.now()).catch((error: unknown) => {
      prod.observability.error('temporal', 'tick', clock.now(), error instanceof Error ? error.message : 'falha no tick temporal');
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

// [BOOT-DIAG] instrumentação TEMPORÁRIA: hoje um crash pós-boot morre SEM LOG
// (`void main()` + rejeições assíncronas). Loga a causa fatal no stderr e SAI com
// código 1 — semântica de crash preservada (o restart do Docker continua igual),
// mas a causa fica visível no `docker logs`.
process.on('uncaughtException', (error) => {
  process.stderr.write(`[BOOT-DIAG] uncaughtException FATAL: ${error.stack ?? error.message}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  process.stderr.write(`[BOOT-DIAG] unhandledRejection FATAL: ${msg}\n`);
  process.exit(1);
});

// Executado apenas quando o DONO roda este arquivo (node dist/production/main.js).
void main();
