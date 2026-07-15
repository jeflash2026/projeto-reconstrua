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

  const port = Number(env['PORT'] ?? '3001');
  const main = buildProductionServer({ prod, env, startedAt });
  const admin = buildAdminServer(prod.adminView);
  const advogado = buildAdvogadoServer(prod.advogadoView);
  const lx = buildLawyerExperienceServer(prod.lxView);

  await main.listen({ port, host: '0.0.0.0' });
  await admin.listen({ port: port + 1, host: '0.0.0.0' });
  await advogado.listen({ port: port + 2, host: '0.0.0.0' });
  await lx.listen({ port: port + 3, host: '0.0.0.0' });
  process.stdout.write(`AHRIOS em produção: main:${String(port)} admin:${String(port + 1)} advogado:${String(port + 2)} lx:${String(port + 3)}\n`);

  // Loop temporal pela ENTRADA ÚNICA serializada (A2/4C) + preparação noturna às 03h.
  setInterval(() => {
    void prod.ingress.tick(clock.now()).catch(() => undefined);
  }, 60_000);
  setInterval(() => {
    const now = clock.now();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
      void prod.lxView.nightShift.run(now).catch(() => undefined);
    }
  }, 60_000);
}

// Executado apenas quando o DONO roda este arquivo (node dist/production/main.js).
void main();
