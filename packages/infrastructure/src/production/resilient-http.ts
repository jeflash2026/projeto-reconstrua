// ─────────────────────────────────────────────────────────────────────────────
// RESILIENT HTTP — envoltório de PRODUÇÃO sobre o HttpClient (2B): RETRY com
// backoff exponencial em falha de rede/5xx/429, e OBSERVABILIDADE de cada
// tentativa. Usado pela Evolution e pelos LLMs. Reconnect = nova tentativa com
// backoff (HTTP é stateless; a sessão Evolution reconecta no lado dela).
// ─────────────────────────────────────────────────────────────────────────────
import type { ObservabilityRuntime, Sleeper } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { HttpClient, HttpResponse } from '../conversation/evolution/http-client.js';

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly factor: number;
}

export const DEFAULT_RETRY: RetryOptions = { maxAttempts: 3, baseDelayMs: 500, factor: 2 };

function retryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export class ResilientHttpClient implements HttpClient {
  constructor(
    private readonly inner: HttpClient,
    private readonly sleeper: Sleeper,
    private readonly observability: ObservabilityRuntime,
    private readonly clock: Clock,
    private readonly component: string,
    private readonly options: RetryOptions = DEFAULT_RETRY,
  ) {}

  async postJson(url: string, headers: Readonly<Record<string, string>>, body: unknown): Promise<HttpResponse> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      const t0 = this.clock.now().getTime();
      try {
        const response = await this.inner.postJson(url, headers, body);
        this.observability.latency(this.component, 'http', this.clock.now().getTime() - t0, this.clock.now());
        if (!retryable(response.status) || attempt === this.options.maxAttempts) {
          if (response.status >= 400) {
            this.observability.error(this.component, 'http-status', this.clock.now(), `status ${String(response.status)}`);
          }
          return response;
        }
        this.observability.error(this.component, 'http-retry', this.clock.now(), `status ${String(response.status)} (tentativa ${String(attempt)})`);
      } catch (error) {
        lastError = error;
        this.observability.error(
          this.component,
          'http-retry',
          this.clock.now(),
          `${error instanceof Error ? error.message : 'falha de rede'} (tentativa ${String(attempt)})`,
        );
        if (attempt === this.options.maxAttempts) break;
      }
      await this.sleeper.sleep(this.options.baseDelayMs * Math.pow(this.options.factor, attempt - 1));
    }
    throw lastError instanceof Error ? lastError : new Error('falha de rede após retries');
  }
}
