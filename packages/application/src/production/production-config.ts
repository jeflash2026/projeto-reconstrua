// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION CONFIG — a configuração REAL da operação: Evolution, provedores de
// LLM, Meta e os prompts globais. Vem do ambiente (bootstrap) e é EDITÁVEL e
// PERSISTIDA via ConfigStore (Admin Config). Segredos são MASCARADOS na leitura.
// ─────────────────────────────────────────────────────────────────────────────

export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'offline';

export interface ProductionConfig {
  readonly evolution: {
    readonly baseUrl: string;
    readonly instance: string;
    readonly apiKey: string;
    readonly whatsappNumber: string;
  };
  readonly llm: {
    readonly provider: LlmProvider;
    readonly openaiApiKey: string;
    readonly openaiModel: string;
    readonly anthropicApiKey: string;
    readonly anthropicModel: string;
    readonly geminiApiKey: string;
    readonly geminiModel: string;
  };
  readonly meta: { readonly accessToken: string; readonly pixelId: string };
  readonly prompts: {
    readonly global: string;
    readonly founder: string;
    readonly conversation: string;
    readonly memory: string;
    readonly admin: string;
  };
  /** URL pública (o checklist exige HTTPS). */
  readonly publicUrl: string;
}

export interface ConfigStore {
  load(): Promise<ProductionConfig | null>;
  save(config: ProductionConfig): Promise<void>;
}

export const DEFAULT_PRODUCTION_CONFIG: ProductionConfig = {
  evolution: { baseUrl: '', instance: '', apiKey: '', whatsappNumber: '' },
  llm: {
    provider: 'offline',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-sonnet-5',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
  },
  meta: { accessToken: '', pixelId: '' },
  prompts: {
    // PC-R5 — a PERSONA e as FRONTEIRAS (regra permanente; Presence §Fronteiras)
    // vivem AQUI, no mecanismo persistido/editável já existente (Admin Config).
    global:
      'Você é a AHRI — a inteligência que acompanha cada cliente do Reconstrua do primeiro contato até o fim do caso. ' +
      'Você fala em primeira pessoa, com calor humano, presença e calma: como alguém que conhece a pessoa, lembra do histórico e está do lado dela. ' +
      'Você NUNCA decide (você percebe e frasea o que foi decidido). Nunca invente fatos. Nunca dê aconselhamento jurídico. ' +
      'FRONTEIRAS INVIOLÁVEIS: nunca revele informações internas da empresa, dados de outros clientes ou estratégias operacionais; ' +
      'nunca prometa resultados, valores ou decisões que dependem da equipe humana; nunca ultrapasse o que a pessoa tem permissão de saber sobre o próprio caso.',
    founder: 'Narre os fatos administrativos fornecidos em linguagem natural e direta. Não acrescente dados.',
    conversation:
      'Fraseie a intenção decidida em linguagem humana, calorosa e breve, em pt-BR — como uma conversa de verdade, nunca como notificação de sistema. ' +
      'Responda ao que a pessoa realmente disse; acolha a emoção percebida antes do assunto. ' +
      'Nunca repita frases anteriores. Nunca prometa nada que não esteja na intenção ou nos fatos fornecidos.',
    memory: 'Extraia atributos pessoais explícitos do texto (nome, cidade, profissão, familiares). Devolva apenas o que está literalmente dito.',
    admin: 'Narre métricas administrativas com exatidão; nunca estime valores ausentes.',
  },
  publicUrl: '',
};

/** Lê o bootstrap do ambiente (o ConfigStore pode sobrescrever depois). */
export function configFromEnv(env: Readonly<Record<string, string | undefined>>): ProductionConfig {
  const d = DEFAULT_PRODUCTION_CONFIG;
  return {
    evolution: {
      baseUrl: env['EVOLUTION_BASE_URL'] ?? d.evolution.baseUrl,
      instance: env['EVOLUTION_INSTANCE'] ?? d.evolution.instance,
      apiKey: env['EVOLUTION_API_KEY'] ?? d.evolution.apiKey,
      whatsappNumber: env['WHATSAPP_NUMBER'] ?? d.evolution.whatsappNumber,
    },
    llm: {
      provider: (env['LLM_PROVIDER'] as LlmProvider | undefined) ?? d.llm.provider,
      openaiApiKey: env['OPENAI_API_KEY'] ?? d.llm.openaiApiKey,
      openaiModel: env['OPENAI_MODEL'] ?? d.llm.openaiModel,
      anthropicApiKey: env['ANTHROPIC_API_KEY'] ?? d.llm.anthropicApiKey,
      anthropicModel: env['ANTHROPIC_MODEL'] ?? d.llm.anthropicModel,
      geminiApiKey: env['GEMINI_API_KEY'] ?? d.llm.geminiApiKey,
      geminiModel: env['GEMINI_MODEL'] ?? d.llm.geminiModel,
    },
    meta: { accessToken: env['META_ACCESS_TOKEN'] ?? '', pixelId: env['META_PIXEL_ID'] ?? '' },
    prompts: d.prompts,
    publicUrl: env['PUBLIC_URL'] ?? '',
  };
}

function mask(secret: string): string {
  if (secret === '') return '';
  if (secret.length <= 6) return '••••';
  return `${secret.slice(0, 3)}••••${secret.slice(-3)}`;
}

/** Versão exibível (segredos mascarados) — o que a tela de config mostra. */
export function maskConfig(config: ProductionConfig): ProductionConfig {
  return {
    ...config,
    evolution: { ...config.evolution, apiKey: mask(config.evolution.apiKey) },
    llm: {
      ...config.llm,
      openaiApiKey: mask(config.llm.openaiApiKey),
      anthropicApiKey: mask(config.llm.anthropicApiKey),
      geminiApiKey: mask(config.llm.geminiApiKey),
    },
    meta: { ...config.meta, accessToken: mask(config.meta.accessToken) },
  };
}

/** Merge de edição: campos mascarados/vazios NÃO sobrescrevem segredos existentes. */
export function mergeConfigUpdate(current: ProductionConfig, update: ProductionConfig): ProductionConfig {
  const keep = (incoming: string, existing: string): string =>
    incoming === '' || incoming.includes('••••') ? existing : incoming;
  return {
    evolution: { ...update.evolution, apiKey: keep(update.evolution.apiKey, current.evolution.apiKey) },
    llm: {
      ...update.llm,
      openaiApiKey: keep(update.llm.openaiApiKey, current.llm.openaiApiKey),
      anthropicApiKey: keep(update.llm.anthropicApiKey, current.llm.anthropicApiKey),
      geminiApiKey: keep(update.llm.geminiApiKey, current.llm.geminiApiKey),
    },
    meta: { ...update.meta, accessToken: keep(update.meta.accessToken, current.meta.accessToken) },
    prompts: update.prompts,
    publicUrl: update.publicUrl,
  };
}
