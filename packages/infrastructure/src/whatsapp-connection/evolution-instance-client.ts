// ─────────────────────────────────────────────────────────────────────────────
// EVOLUTION INSTANCE CLIENT — administração de INSTÂNCIAS da Evolution (criar, QR,
// status, ownerJid, logout, delete, webhook). É SEPARADO do EvolutionGateway (que só
// ENVIA mensagens) e NÃO usa o HttpClient congelado — tem um HTTP próprio, injetável,
// com GET/POST/DELETE (Evolution admin exige verbos que o port de envio não tem).
//
// SEGREDO: usa a chave GLOBAL da Evolution (EVOLUTION_GLOBAL_API_KEY) apenas aqui,
// no backend. Nunca é retornada, logada ou enviada ao navegador (quem cuida disso é
// a camada de rota/serviço). Respostas da Evolution variam por versão → parse defensivo.
// ─────────────────────────────────────────────────────────────────────────────

export interface EvoHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** HTTP mínimo (injetável) — GET/POST/DELETE. Adapter de produção usa o `fetch` global. */
export interface EvoHttp {
  request(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    headers: Readonly<Record<string, string>>,
    body?: unknown,
  ): Promise<EvoHttpResponse>;
}

export class FetchEvoHttp implements EvoHttp {
  async request(
    method: 'GET' | 'POST' | 'DELETE',
    url: string,
    headers: Readonly<Record<string, string>>,
    body?: unknown,
  ): Promise<EvoHttpResponse> {
    const init: RequestInit = {
      method,
      headers: { 'content-type': 'application/json', ...headers },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await fetch(url, init);
    const text = await response.text();
    let parsed: unknown = null;
    if (text !== '') {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: response.status, body: parsed };
  }
}

export interface EvolutionAdminConfig {
  readonly baseUrl: string;
  /** Chave GLOBAL da Evolution — só backend; nunca exposta. */
  readonly globalApiKey: string;
}

export interface CreatedInstance {
  readonly instanceName: string;
  /** apikey por-instância retornada pela Evolution (usada depois para enviar/conectar). */
  readonly apiKey: string;
}

export interface QrCode {
  /** Data-URL/base64 do QR (quando a Evolution devolve imagem). */
  readonly base64: string | null;
  readonly pairingCode: string | null;
}

export interface InstanceSnapshot {
  readonly name: string;
  /** Ex.: '554137989737@s.whatsapp.net' — presente só quando conectada. */
  readonly ownerJid: string | null;
  /** 'open' | 'connecting' | 'close' (normalizado em minúsculas). */
  readonly state: string;
}

// ── parse defensivo (as respostas variam entre versões da Evolution) ────────────
function asStr(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}
function pick(obj: unknown, keys: readonly string[]): unknown {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) if (rec[k] !== undefined) return rec[k];
  return undefined;
}

export class EvolutionInstanceClient {
  constructor(
    private readonly http: EvoHttp,
    private readonly config: EvolutionAdminConfig,
  ) {}

  private base(): string {
    return this.config.baseUrl.replace(/\/+$/, '');
  }
  private gkey(): Readonly<Record<string, string>> {
    return { apikey: this.config.globalApiKey };
  }

  /** Cria uma instância nova (qrcode:true ⇒ nasce aguardando leitura). */
  async createInstance(instanceName: string): Promise<CreatedInstance> {
    const res = await this.http.request('POST', `${this.base()}/instance/create`, this.gkey(), {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    });
    if (res.status >= 300) throw new Error(`Evolution create falhou (HTTP ${String(res.status)})`);
    const hash = pick(res.body, ['hash']);
    const apiKey =
      asStr(hash) ?? asStr(pick(hash, ['apikey'])) ?? asStr(pick(res.body, ['apikey'])) ?? '';
    return { instanceName, apiKey };
  }

  /** Configura o webhook oficial (com o segredo) na instância. */
  async setWebhook(instanceName: string, url: string, secret: string): Promise<void> {
    const res = await this.http.request(
      'POST',
      `${this.base()}/webhook/set/${instanceName}`,
      this.gkey(),
      {
        webhook: { enabled: true, url, headers: { apikey: secret }, events: ['MESSAGES_UPSERT'] },
      },
    );
    if (res.status >= 300)
      throw new Error(`Evolution webhook/set falhou (HTTP ${String(res.status)})`);
  }

  /** Gera/obtém o QR atual da instância (aguardando leitura). */
  async connect(instanceName: string): Promise<QrCode> {
    const res = await this.http.request(
      'GET',
      `${this.base()}/instance/connect/${instanceName}`,
      this.gkey(),
    );
    if (res.status >= 300) throw new Error(`Evolution connect falhou (HTTP ${String(res.status)})`);
    const base64 =
      asStr(pick(res.body, ['base64'])) ?? asStr(pick(pick(res.body, ['qrcode']), ['base64']));
    const pairingCode =
      asStr(pick(res.body, ['pairingCode'])) ??
      asStr(pick(pick(res.body, ['qrcode']), ['pairingCode']));
    return { base64, pairingCode };
  }

  /** Estado de conexão da instância. */
  async connectionState(instanceName: string): Promise<string> {
    const res = await this.http.request(
      'GET',
      `${this.base()}/instance/connectionState/${instanceName}`,
      this.gkey(),
    );
    if (res.status >= 300) return 'close';
    const state = pick(pick(res.body, ['instance']), ['state']) ?? pick(res.body, ['state']);
    return (asStr(state) ?? 'close').toLowerCase();
  }

  /** Snapshot da instância (nome, ownerJid, estado) a partir de fetchInstances. */
  async fetchInstance(instanceName: string): Promise<InstanceSnapshot | null> {
    const res = await this.http.request(
      'GET',
      `${this.base()}/instance/fetchInstances`,
      this.gkey(),
    );
    if (res.status >= 300) return null;
    const list: unknown[] = Array.isArray(res.body) ? (res.body as unknown[]) : [];
    for (const raw of list) {
      const inst = pick(raw, ['instance']) ?? raw;
      const name = asStr(pick(inst, ['name', 'instanceName', 'id']));
      if (name !== instanceName) continue;
      return {
        name,
        ownerJid: asStr(pick(inst, ['ownerJid', 'owner', 'wuid'])),
        state: (
          asStr(pick(inst, ['connectionStatus', 'status', 'state'])) ?? 'close'
        ).toLowerCase(),
      };
    }
    return null;
  }

  /**
   * GO-LIVE-05 (BUG 2) — SONDA CRUA para o diagnóstico: devolve o status HTTP
   * REAL, o erro de rede REAL (ECONNREFUSED/DNS/timeout) e a lista de instâncias.
   * Nunca engole a causa (ao contrário de fetchInstance, que devolve null).
   */
  async probe(): Promise<{
    readonly reached: boolean;
    readonly status: number | null;
    readonly error: string | null;
    readonly instanceNames: readonly string[];
  }> {
    try {
      const res = await this.http.request(
        'GET',
        `${this.base()}/instance/fetchInstances`,
        this.gkey(),
      );
      const list: unknown[] = Array.isArray(res.body) ? (res.body as unknown[]) : [];
      const names = list
        .map((raw) => asStr(pick(pick(raw, ['instance']) ?? raw, ['name', 'instanceName', 'id'])))
        .filter((n): n is string => n !== null);
      return {
        reached: res.status < 300,
        status: res.status,
        error: res.status >= 300 ? `Evolution respondeu HTTP ${String(res.status)}` : null,
        instanceNames: names,
      };
    } catch (error) {
      // node fetch lança em falha de transporte; a causa real vive em .cause.
      const cause = (error as { cause?: unknown }).cause;
      const code =
        typeof cause === 'object' && cause !== null ? (cause as { code?: string }).code : undefined;
      const raw = error instanceof Error ? error.message : 'erro de rede';
      const detail =
        code === 'ECONNREFUSED'
          ? 'conexão recusada (Evolution fora do ar ou porta errada)'
          : code === 'ENOTFOUND'
            ? 'DNS não resolveu o host da Evolution (EVOLUTION_BASE_URL)'
            : code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT'
              ? 'timeout ao conectar na Evolution'
              : code !== undefined
                ? `${raw} (${code})`
                : raw;
      return { reached: false, status: null, error: detail, instanceNames: [] };
    }
  }

  /**
   * GO-LIVE-06 (BUG 2) — descobre a instância REAL pelo NÚMERO oficial (ownerJid),
   * independentemente do nome configurado. O que identifica a instância certa em
   * produção é o número da empresa, não um nome que pode estar desatualizado no
   * .env/config. Devolve o snapshot da instância conectada a esse número, ou null.
   */
  async findInstanceByNumber(number: string): Promise<InstanceSnapshot | null> {
    if (number === '') return null;
    // Resiliente como fetchInstance: falha de rede/HTTP ⇒ null (nunca propaga).
    let res: EvoHttpResponse;
    try {
      res = await this.http.request('GET', `${this.base()}/instance/fetchInstances`, this.gkey());
    } catch {
      return null;
    }
    if (res.status >= 300) return null;
    const list: unknown[] = Array.isArray(res.body) ? (res.body as unknown[]) : [];
    for (const raw of list) {
      const inst = pick(raw, ['instance']) ?? raw;
      const ownerJid = asStr(pick(inst, ['ownerJid', 'owner', 'wuid']));
      if (numberFromOwnerJid(ownerJid) === number) {
        return {
          name: asStr(pick(inst, ['name', 'instanceName', 'id'])) ?? '',
          ownerJid,
          state: (
            asStr(pick(inst, ['connectionStatus', 'status', 'state'])) ?? 'close'
          ).toLowerCase(),
        };
      }
    }
    return null;
  }

  async logout(instanceName: string): Promise<void> {
    await this.http.request(
      'DELETE',
      `${this.base()}/instance/logout/${instanceName}`,
      this.gkey(),
    );
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.http.request(
      'DELETE',
      `${this.base()}/instance/delete/${instanceName}`,
      this.gkey(),
    );
  }
}

/** Extrai só os dígitos do número a partir de um ownerJid ('55…@s.whatsapp.net'). */
export function numberFromOwnerJid(ownerJid: string | null): string {
  if (ownerJid === null) return '';
  const at = ownerJid.indexOf('@');
  const raw = at === -1 ? ownerJid : ownerJid.slice(0, at);
  return raw.replace(/\D/g, '');
}
