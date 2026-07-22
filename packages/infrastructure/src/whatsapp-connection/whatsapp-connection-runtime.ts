// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP CONNECTION RUNTIME — orquestra a conexão do WhatsApp pelo Portal Admin:
// status, criar nova instância, QR, CONFIRMAR (valida ownerJid == número oficial) e
// DESCARTAR. Persiste a config PENDENTE (instância/apiKey/número) no ConfigStore
// EXISTENTE — aplicada no PRÓXIMO restart controlado (sem hot-reload). Audita cada
// ação (durável, B5.3). NUNCA retorna apiKey/segredos ao chamador.
//
// Regra de ativação: só considera válida a instância cujo ownerJid corresponde ao
// número OFICIAL. Número divergente ⇒ NÃO ativa; pede novo QR.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { ConfigStore, ProductionConfig } from '@reconstrua/application';
import { DEFAULT_PRODUCTION_CONFIG } from '@reconstrua/application';
import type { ObservabilityRuntime } from '@reconstrua/application';
import type { EvolutionInstanceClient } from './evolution-instance-client.js';
import { numberFromOwnerJid } from './evolution-instance-client.js';

export interface WhatsAppActor {
  /** Perfil que executa a ação (para auditoria e gate). */
  readonly role: 'admin' | 'founder';
}

export interface WhatsAppStatus {
  /** Config ATIVA (o que a aplicação usa agora — do ambiente/boot). */
  readonly active: { readonly instance: string; readonly number: string };
  /** Config PENDENTE persistida (aguardando restart controlado); null se igual à ativa. */
  readonly pending: { readonly instance: string; readonly number: string } | null;
  readonly hasPendingApply: boolean;
  /** Estado ao vivo da Evolution para a instância corrente (pendente ou ativa). */
  readonly live: {
    readonly state: string;
    readonly ownerJid: string | null;
    readonly number: string;
  } | null;
  readonly matchesOfficial: boolean;
  readonly officialNumber: string;
  readonly webhookUrl: string;
  readonly lastSyncAt: string | null;
  /** GO-LIVE-03 (item 6): pré-condições DECLARADAS — a tela diz o que falta em vez
   *  de exibir botões que falham em silêncio (Lei 9: ausência declarada). */
  readonly capabilities: {
    readonly canManageInstances: boolean;
    readonly missing: readonly string[];
  };
  /** GO-LIVE-06 (BUG 2): a instância detectada pelo número oficial (nome real na
   *  Evolution), que pode divergir da configurada; null se o número não está conectado. */
  readonly resolvedInstance: string | null;
}

export interface CreateResult {
  readonly instanceName: string;
  readonly qr: { readonly base64: string | null; readonly pairingCode: string | null };
}

export interface ConfirmResult {
  readonly connected: boolean;
  readonly ownerJid: string | null;
  readonly number: string;
  readonly matchesOfficial: boolean;
  readonly error: string | null;
}

export interface WhatsAppConnectionDeps {
  readonly client: EvolutionInstanceClient;
  readonly configStore: ConfigStore;
  readonly observability: ObservabilityRuntime;
  readonly clock: Clock;
  /** Número oficial esperado (só dígitos), ex.: '554137989737'. */
  readonly officialNumber: string;
  /** Config ATIVA (do ambiente) — só instância/número, nunca segredos. */
  readonly active: { readonly instance: string; readonly number: string };
  readonly webhookUrl: string;
  readonly webhookSecret: string;
  /** Pré-condições do gerenciamento de instâncias (criar/descartar). */
  readonly management: {
    readonly hasGlobalKey: boolean; // EVOLUTION_GLOBAL_API_KEY presente
    readonly hasFounderGate: boolean; // FOUNDER_ACCESS_SECRET presente
  };
  /** GO-LIVE-05 (BUG 2) — sondas do diagnóstico (banco e filas). Best-effort. */
  readonly diagnostics?: {
    readonly baseUrl: string;
    readonly db?: () => Promise<void>;
    readonly queue?: () => Promise<number>;
  };
}

/** GO-LIVE-05 (BUG 2) — um passo do diagnóstico com a causa EXATA da falha. */
export interface DiagnosticStep {
  readonly step: string;
  readonly ok: boolean;
  readonly detail: string;
}
export interface DiagnosticReport {
  readonly ok: boolean;
  readonly steps: readonly DiagnosticStep[];
  readonly at: string;
}

export class WhatsAppConnectionRuntime {
  private lastSyncAt: Date | null = null;

  constructor(private readonly deps: WhatsAppConnectionDeps) {}

  private audit(action: string, actor: WhatsAppActor, detail: string): void {
    // Auditoria durável (B5.3): quem (perfil), quando, o quê. Sem segredos.
    this.deps.observability.event(
      'whatsapp-connection',
      `${action}:${actor.role}`,
      this.deps.clock.now(),
      detail,
    );
  }

  private async storedConfig(): Promise<ProductionConfig> {
    return (await this.deps.configStore.load()) ?? DEFAULT_PRODUCTION_CONFIG;
  }

  /** Persiste a config PENDENTE (instância/apiKey/número) sem tocar nos outros campos. */
  private async persistEvolution(patch: {
    instance?: string;
    apiKey?: string;
    whatsappNumber?: string;
  }): Promise<void> {
    const current = await this.storedConfig();
    await this.deps.configStore.save({
      ...current,
      evolution: {
        baseUrl: current.evolution.baseUrl,
        instance: patch.instance ?? current.evolution.instance,
        apiKey: patch.apiKey ?? current.evolution.apiKey,
        whatsappNumber: patch.whatsappNumber ?? current.evolution.whatsappNumber,
      },
    });
  }

  /** Status consolidado para a tela (nunca inclui segredos). */
  async getStatus(): Promise<WhatsAppStatus> {
    const stored = await this.storedConfig();
    const pendingInstance = stored.evolution.instance;
    const pendingNumber = stored.evolution.whatsappNumber;
    const current = pendingInstance !== '' ? pendingInstance : this.deps.active.instance;

    let live: WhatsAppStatus['live'] = null;
    let resolvedInstance = current;
    if (current !== '') {
      const snap = await this.deps.client.fetchInstance(current);
      if (snap !== null) {
        this.lastSyncAt = this.deps.clock.now();
        live = {
          state: snap.state,
          ownerJid: snap.ownerJid,
          number: numberFromOwnerJid(snap.ownerJid),
        };
      }
    }
    // GO-LIVE-06 (BUG 2): se a instância configurada não está conectada ao número
    // oficial, DESCOBRE a instância real pelo número (o nome configurado pode estar
    // errado no .env/config). A aplicação passa a refletir a instância correta.
    if (live === null || live.number !== this.deps.officialNumber) {
      const byNumber = await this.deps.client.findInstanceByNumber(this.deps.officialNumber);
      if (byNumber !== null) {
        this.lastSyncAt = this.deps.clock.now();
        live = {
          state: byNumber.state,
          ownerJid: byNumber.ownerJid,
          number: numberFromOwnerJid(byNumber.ownerJid),
        };
        resolvedInstance = byNumber.name;
      }
    }
    const hasPendingApply =
      pendingInstance !== '' &&
      (pendingInstance !== this.deps.active.instance || pendingNumber !== this.deps.active.number);

    const missing: string[] = [];
    if (!this.deps.management.hasGlobalKey) missing.push('EVOLUTION_GLOBAL_API_KEY');
    if (!this.deps.management.hasFounderGate) missing.push('FOUNDER_ACCESS_SECRET');

    return {
      active: this.deps.active,
      pending: hasPendingApply ? { instance: pendingInstance, number: pendingNumber } : null,
      hasPendingApply,
      live,
      matchesOfficial:
        live !== null && live.number === this.deps.officialNumber && live.state === 'open',
      officialNumber: this.deps.officialNumber,
      webhookUrl: this.deps.webhookUrl,
      lastSyncAt: this.lastSyncAt?.toISOString() ?? null,
      capabilities: { canManageInstances: missing.length === 0, missing },
      // GO-LIVE-06 (BUG 2): a instância REALMENTE detectada pelo número oficial
      // (pode diferir da configurada). null quando não há nenhuma conectada ao número.
      resolvedInstance:
        live !== null && live.number === this.deps.officialNumber ? resolvedInstance : null,
    };
  }

  /** Cria uma NOVA instância (destrutivo → gate Founder na rota) e configura o webhook. */
  async createNew(instanceName: string, actor: WhatsAppActor): Promise<CreateResult> {
    const created = await this.deps.client.createInstance(instanceName);
    await this.deps.client.setWebhook(instanceName, this.deps.webhookUrl, this.deps.webhookSecret);
    // Persiste como PENDENTE (instância + apiKey por-instância). Número só após confirmar o QR.
    await this.persistEvolution({
      instance: instanceName,
      apiKey: created.apiKey,
      whatsappNumber: '',
    });
    this.audit('create', actor, `instancia=${instanceName}`);
    const qr = await this.deps.client.connect(instanceName);
    return { instanceName, qr };
  }

  /** (Re)gera o QR de uma instância aguardando leitura. */
  async getQr(
    instanceName: string,
  ): Promise<{ base64: string | null; pairingCode: string | null }> {
    return this.deps.client.connect(instanceName);
  }

  /** Confirma a conexão: SÓ ativa se ownerJid corresponder ao número oficial. */
  async confirm(instanceName: string, actor: WhatsAppActor): Promise<ConfirmResult> {
    const snap = await this.deps.client.fetchInstance(instanceName);
    this.lastSyncAt = this.deps.clock.now();
    const ownerJid = snap?.ownerJid ?? null;
    const number = numberFromOwnerJid(ownerJid);
    const open = snap?.state === 'open';
    const matchesOfficial = open && number === this.deps.officialNumber;

    if (!matchesOfficial) {
      this.audit(
        'confirm-rejected',
        actor,
        `instancia=${instanceName} numero=${number || '-'} estado=${snap?.state ?? '-'}`,
      );
      const error = !open
        ? 'A instância ainda não está conectada. Leia o QR Code e tente novamente.'
        : 'O número conectado não corresponde ao número oficial da empresa.';
      return { connected: false, ownerJid, number, matchesOfficial: false, error };
    }

    // Número oficial confirmado → grava o número na config PENDENTE (aplica no restart).
    await this.persistEvolution({ instance: instanceName, whatsappNumber: number });
    this.audit('confirm-ok', actor, `instancia=${instanceName} numero=${number}`);
    return { connected: true, ownerJid, number, matchesOfficial: true, error: null };
  }

  /**
   * GO-LIVE-05 (BUG 2) — DIAGNÓSTICO: sonda cada dependência e diz EXATAMENTE
   * onde falhou (variáveis, conexão Evolution, autenticação, instância, webhook,
   * banco, filas). Nenhuma exceção escapa — cada passo vira uma linha com a causa.
   */
  async diagnose(): Promise<DiagnosticReport> {
    const steps: DiagnosticStep[] = [];
    const add = (step: string, ok: boolean, detail: string): void => {
      steps.push({ step, ok, detail });
    };
    const d = this.deps.diagnostics;

    // 1) VARIÁVEIS obrigatórias.
    const baseUrl = d?.baseUrl ?? '';
    add(
      'Variáveis de ambiente',
      baseUrl !== '' && this.deps.management.hasGlobalKey,
      [
        baseUrl === '' ? 'EVOLUTION_BASE_URL ausente' : `EVOLUTION_BASE_URL=${baseUrl}`,
        this.deps.management.hasGlobalKey
          ? 'EVOLUTION_GLOBAL_API_KEY presente'
          : 'EVOLUTION_GLOBAL_API_KEY ausente',
        this.deps.management.hasFounderGate
          ? 'FOUNDER_ACCESS_SECRET presente'
          : 'FOUNDER_ACCESS_SECRET ausente',
      ].join(' · '),
    );

    // 2/3) CONEXÃO + AUTENTICAÇÃO com a Evolution (sonda crua: status/erro reais).
    const probe = await this.deps.client.probe();
    add(
      'Conexão com a Evolution',
      probe.reached || probe.status !== null,
      probe.error ?? `alcançada (HTTP ${String(probe.status)})`,
    );
    add(
      'Autenticação (chave global)',
      probe.status !== 401 && probe.status !== 403,
      probe.status === 401 || probe.status === 403
        ? `Evolution recusou a chave global (HTTP ${String(probe.status)}) — verifique EVOLUTION_GLOBAL_API_KEY`
        : probe.reached
          ? 'chave global aceita'
          : 'não avaliada (Evolution inacessível)',
    );

    // 4) INSTÂNCIA — GO-LIVE-06 (BUG 2): o que importa é o NÚMERO oficial estar
    // conectado; o nome pode divergir do configurado. Descobrimos a instância real
    // pelo número e, se divergir, dizemos EXATAMENTE qual nome usar.
    const configured = this.deps.active.instance || (await this.storedConfig()).evolution.instance;
    const byNumber = await this.deps.client.findInstanceByNumber(this.deps.officialNumber);
    if (byNumber !== null) {
      const divergente = configured !== '' && configured !== byNumber.name;
      add(
        'Instância',
        true,
        `número oficial ${this.deps.officialNumber} conectado na instância "${byNumber.name}" (estado: ${byNumber.state})` +
          (divergente
            ? ` — configurado como "${configured}"; ajuste EVOLUTION_INSTANCE para "${byNumber.name}"`
            : ''),
      );
    } else {
      add(
        'Instância',
        false,
        probe.reached
          ? `nenhuma instância conectada ao número oficial ${this.deps.officialNumber} (configurado: "${configured || '—'}"; encontradas: ${probe.instanceNames.join(', ') || 'nenhuma'})`
          : 'não avaliada (Evolution inacessível)',
      );
    }

    // 5) WEBHOOK configurado (URL + segredo presentes).
    add(
      'Webhook',
      this.deps.webhookUrl !== '' && this.deps.webhookSecret !== '',
      this.deps.webhookUrl === ''
        ? 'webhookUrl ausente'
        : this.deps.webhookSecret === ''
          ? 'WEBHOOK_SECRET ausente'
          : `${this.deps.webhookUrl}`,
    );

    // 6) BANCO (toca o Postgres via configStore).
    if (d?.db) {
      try {
        await d.db();
        add('Banco de dados', true, 'Postgres acessível');
      } catch (e) {
        add('Banco de dados', false, e instanceof Error ? e.message : 'falha ao consultar o banco');
      }
    }

    // 7) FILAS (outbox/dispatcher).
    if (d?.queue) {
      try {
        const pending = await d.queue();
        add('Filas (outbox)', true, `${String(pending)} entrega(s) pendente(s)`);
      } catch (e) {
        add('Filas (outbox)', false, e instanceof Error ? e.message : 'falha ao consultar a fila');
      }
    }

    this.audit(
      'diagnose',
      { role: 'admin' },
      `passos=${String(steps.length)} ok=${String(steps.every((s) => s.ok))}`,
    );
    return { ok: steps.every((s) => s.ok), steps, at: this.deps.clock.now().toISOString() };
  }

  /** Descarta uma instância (destrutivo → gate Founder + confirmação na rota). */
  async discard(instanceName: string, actor: WhatsAppActor): Promise<void> {
    await this.deps.client.logout(instanceName);
    await this.deps.client.deleteInstance(instanceName);
    // Se a pendente era esta, limpa a instância/número pendentes (mantém baseUrl).
    const stored = await this.storedConfig();
    if (stored.evolution.instance === instanceName) {
      await this.persistEvolution({ instance: '', apiKey: '', whatsappNumber: '' });
    }
    this.audit('discard', actor, `instancia=${instanceName}`);
  }
}
