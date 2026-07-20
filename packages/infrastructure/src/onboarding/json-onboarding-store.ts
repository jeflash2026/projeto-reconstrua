// ─────────────────────────────────────────────────────────────────────────────
// JSON ONBOARDING DOCUMENTAL STORE — persistência da contabilidade da Jornada 1
// sobre o JsonStore existente (PgJsonStore em produção; ns 'onboarding-documental',
// chave = chatId). Datas revividas na leitura.
// ─────────────────────────────────────────────────────────────────────────────
import type { OnboardingDocumentalState, OnboardingDocumentalStore } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

const NS = 'onboarding-documental';

interface Persisted {
  readonly chatId: string;
  readonly missionId: string | null;
  readonly recebidos: readonly { codigo: string; documentId: string; em: string }[];
  readonly atualizadoEm: string;
}

export class JsonOnboardingDocumentalStore implements OnboardingDocumentalStore {
  constructor(private readonly json: JsonStore) {}

  async load(chatId: string): Promise<OnboardingDocumentalState | null> {
    const raw = (await this.json.get(NS, chatId)) as Persisted | null;
    if (raw === null) return null;
    return {
      chatId: raw.chatId,
      missionId: raw.missionId,
      recebidos: raw.recebidos.map((r) => ({
        codigo: r.codigo as OnboardingDocumentalState['recebidos'][number]['codigo'],
        documentId: r.documentId,
        em: new Date(r.em),
      })),
      atualizadoEm: new Date(raw.atualizadoEm),
    };
  }

  async save(state: OnboardingDocumentalState): Promise<void> {
    const persisted: Persisted = {
      chatId: state.chatId,
      missionId: state.missionId,
      recebidos: state.recebidos.map((r) => ({ codigo: r.codigo, documentId: r.documentId, em: r.em.toISOString() })),
      atualizadoEm: state.atualizadoEm.toISOString(),
    };
    await this.json.put(NS, state.chatId, persisted);
  }
}
