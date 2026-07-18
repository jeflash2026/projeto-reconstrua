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
  readonly live: { readonly state: string; readonly ownerJid: string | null; readonly number: string } | null;
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
}

export class WhatsAppConnectionRuntime {
  private lastSyncAt: Date | null = null;

  constructor(private readonly deps: WhatsAppConnectionDeps) {}

  private audit(action: string, actor: WhatsAppActor, detail: string): void {
    // Auditoria durável (B5.3): quem (perfil), quando, o quê. Sem segredos.
    this.deps.observability.event('whatsapp-connection', `${action}:${actor.role}`, this.deps.clock.now(), detail);
  }

  private async storedConfig(): Promise<ProductionConfig> {
    return (await this.deps.configStore.load()) ?? DEFAULT_PRODUCTION_CONFIG;
  }

  /** Persiste a config PENDENTE (instância/apiKey/número) sem tocar nos outros campos. */
  private async persistEvolution(patch: { instance?: string; apiKey?: string; whatsappNumber?: string }): Promise<void> {
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
    if (current !== '') {
      const snap = await this.deps.client.fetchInstance(current);
      if (snap !== null) {
        this.lastSyncAt = this.deps.clock.now();
        live = { state: snap.state, ownerJid: snap.ownerJid, number: numberFromOwnerJid(snap.ownerJid) };
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
      matchesOfficial: live !== null && live.number === this.deps.officialNumber && live.state === 'open',
      officialNumber: this.deps.officialNumber,
      webhookUrl: this.deps.webhookUrl,
      lastSyncAt: this.lastSyncAt?.toISOString() ?? null,
      capabilities: { canManageInstances: missing.length === 0, missing },
    };
  }

  /** Cria uma NOVA instância (destrutivo → gate Founder na rota) e configura o webhook. */
  async createNew(instanceName: string, actor: WhatsAppActor): Promise<CreateResult> {
    const created = await this.deps.client.createInstance(instanceName);
    await this.deps.client.setWebhook(instanceName, this.deps.webhookUrl, this.deps.webhookSecret);
    // Persiste como PENDENTE (instância + apiKey por-instância). Número só após confirmar o QR.
    await this.persistEvolution({ instance: instanceName, apiKey: created.apiKey, whatsappNumber: '' });
    this.audit('create', actor, `instancia=${instanceName}`);
    const qr = await this.deps.client.connect(instanceName);
    return { instanceName, qr };
  }

  /** (Re)gera o QR de uma instância aguardando leitura. */
  async getQr(instanceName: string): Promise<{ base64: string | null; pairingCode: string | null }> {
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
      this.audit('confirm-rejected', actor, `instancia=${instanceName} numero=${number || '-'} estado=${snap?.state ?? '-'}`);
      const error =
        !open
          ? 'A instância ainda não está conectada. Leia o QR Code e tente novamente.'
          : 'O número conectado não corresponde ao número oficial da empresa.';
      return { connected: false, ownerJid, number, matchesOfficial: false, error };
    }

    // Número oficial confirmado → grava o número na config PENDENTE (aplica no restart).
    await this.persistEvolution({ instance: instanceName, whatsappNumber: number });
    this.audit('confirm-ok', actor, `instancia=${instanceName} numero=${number}`);
    return { connected: true, ownerJid, number, matchesOfficial: true, error: null };
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
