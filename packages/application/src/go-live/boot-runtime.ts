// ─────────────────────────────────────────────────────────────────────────────
// BOOT RUNTIME — inicializa TODOS os runtimes automaticamente, em ordem de
// dependência: valida dependências declaradas, sobe cada serviço, detecta falhas
// (isoladas — um falho não impede o diagnóstico dos demais) e registra a saúde.
//
// O Boot NÃO abre portas (o `.listen` é do dono — servidores sob controle do dono);
// ele prepara e valida a composição para o GO LIVE.
// ─────────────────────────────────────────────────────────────────────────────
import type { HealthRuntime, ComponentHealth } from './health-runtime.js';
import type { ObservabilityRuntime } from './observability-runtime.js';
import type { Clock } from '@reconstrua/domain';

export interface BootableComponent {
  readonly name: string;
  /** Nomes dos componentes que precisam estar ONLINE antes deste. */
  readonly dependsOn: readonly string[];
  start(): Promise<void>;
  check(): Promise<ComponentHealth>;
}

export interface BootReport {
  readonly ok: boolean;
  readonly started: readonly string[];
  readonly failed: readonly { readonly name: string; readonly error: string }[];
  readonly skipped: readonly { readonly name: string; readonly missingDependency: string }[];
}

export class BootRuntime {
  constructor(
    private readonly health: HealthRuntime,
    private readonly observability: ObservabilityRuntime,
    private readonly clock: Clock,
  ) {}

  async boot(components: readonly BootableComponent[]): Promise<BootReport> {
    const started: string[] = [];
    const failed: { name: string; error: string }[] = [];
    const skipped: { name: string; missingDependency: string }[] = [];
    const now = (): Date => this.clock.now();

    for (const component of components) {
      // Valida dependências: todas precisam ter subido ONLINE.
      const missing = component.dependsOn.find((dep) => !started.includes(dep));
      if (missing !== undefined) {
        skipped.push({ name: component.name, missingDependency: missing });
        this.health.report({
          component: component.name,
          status: 'OFFLINE',
          responseMs: null,
          queueDepth: null,
          memoryBytes: null,
          lastProcessedAt: null,
          detail: `dependência ausente: ${missing}`,
          reportedAt: now(),
        });
        continue;
      }
      try {
        const t0 = now().getTime();
        await component.start();
        const healthReport = await component.check();
        this.health.report(healthReport);
        if (healthReport.status === 'ONLINE') {
          started.push(component.name);
          this.observability.latency('boot', component.name, now().getTime() - t0, now());
          this.observability.event('boot', `${component.name}:started`, now());
        } else {
          failed.push({ name: component.name, error: healthReport.detail ?? `status ${healthReport.status}` });
          this.observability.error('boot', component.name, now(), healthReport.detail ?? healthReport.status);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'falha desconhecida';
        failed.push({ name: component.name, error: message });
        this.health.report({
          component: component.name,
          status: 'FAILED',
          responseMs: null,
          queueDepth: null,
          memoryBytes: null,
          lastProcessedAt: null,
          detail: message,
          reportedAt: now(),
        });
        this.observability.error('boot', component.name, now(), message);
      }
    }

    return { ok: failed.length === 0 && skipped.length === 0, started, failed, skipped };
  }
}
