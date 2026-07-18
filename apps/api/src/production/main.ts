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
