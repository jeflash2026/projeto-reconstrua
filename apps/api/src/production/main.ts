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

  // [TRACE] instrumentação temporária: captura qualquer throw ao montar o servidor.
  let main: ReturnType<typeof buildProductionServer>;
  try {
    main = buildProductionServer({ prod, env, startedAt });
    process.stdout.write('[TRACE] buildProductionServer() OK\n');
  } catch (e) {
    process.stderr.write(`[TRACE] buildProductionServer() THROW: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    throw e;
  }
  const admin = buildAdminServer(prod.adminView);
  const advogado = buildAdvogadoServer(prod.advogadoView);
  const lx = buildLawyerExperienceServer(prod.lxView);

  // [TRACE] eventos do http.Server do MAIN (a porta ${port} que recebe "Connection reset")
  main.server.on('listening', () => process.stdout.write('[TRACE] main http.Server: evento "listening"\n'));
  main.server.on('connection', (socket) => {
    process.stdout.write(`[TRACE] connection <- ${String(socket.remoteAddress)}:${String(socket.remotePort)}\n`);
    socket.on('error', (err) => process.stderr.write(`[TRACE] socket "error": ${err.stack ?? String(err)}\n`));
    socket.on('close', (hadError) => process.stdout.write(`[TRACE] socket "close" hadError=${String(hadError)}\n`));
  });
  main.server.on('clientError', (err: Error) => {
    process.stderr.write(`[TRACE] http.Server "clientError": ${err.stack ?? String(err)}\n`);
  });
  main.server.on('request', (req) => process.stdout.write(`[TRACE] http.Server "request": ${String(req.method)} ${String(req.url)}\n`));
  // [TRACE] servidor TCP puro
  main.server.on('close', () => process.stdout.write('[TRACE] server "close"\n'));
  main.server.on('drop', (data) => process.stdout.write(`[TRACE] server "drop": ${JSON.stringify(data)}\n`));
  main.server.on('error', (err: Error) => process.stderr.write(`[TRACE] server "error": ${err.stack ?? String(err)}\n`));

  // [TRACE] captura throw em app.ready() (registro de plugins/hooks/rotas)
  try {
    await main.ready();
    process.stdout.write('[TRACE] main.ready() OK\n');
  } catch (e) {
    process.stderr.write(`[TRACE] main.ready() THROW: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
    throw e;
  }

  process.stdout.write(`[TRACE] chamando main.listen(${String(port)})...\n`);
  await main.listen({ port, host: '0.0.0.0' });
  process.stdout.write(`[TRACE] main.listen(${String(port)}) RESOLVEU\n`);

  // [TRACE] estado do servidor TCP puro + AUTO-TESTE (o processo conversa consigo mesmo?)
  process.stdout.write(`[TRACE] server.address()=${JSON.stringify(main.server.address())} · server.listening=${String(main.server.listening)}\n`);
  try {
    const selfUrl = `http://127.0.0.1:${String(port)}/production/health`;
    process.stdout.write(`[TRACE] auto-teste: GET ${selfUrl}\n`);
    const res = await fetch(selfUrl);
    const body = await res.text();
    process.stdout.write(`[TRACE] auto-teste status=${String(res.status)}\n`);
    process.stdout.write(`[TRACE] auto-teste headers=${JSON.stringify(Object.fromEntries(res.headers.entries()))}\n`);
    process.stdout.write(`[TRACE] auto-teste body=${body}\n`);
  } catch (e) {
    process.stderr.write(`[TRACE] auto-teste FALHOU (o processo NÃO fala consigo mesmo): ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  }

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

// [TRACE] handlers globais — qualquer exceção não tratada sai com stack completo.
process.on('uncaughtException', (err) => {
  process.stderr.write(`[TRACE] uncaughtException: ${err.stack ?? String(err)}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[TRACE] unhandledRejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : JSON.stringify(reason)}\n`);
});

// Executado apenas quando o DONO roda este arquivo (node dist/production/main.js).
void main();
