// ─────────────────────────────────────────────────────────────────────────────
// JSON ANEXO STORE (Decreto Tráfego Pago · B1) — persistência do documento que o
// ADVOGADO anexou para assinatura (procuração/contrato de honorários), sobre o
// JsonStore existente (PgJsonStore em produção; ns 'dr-anexos', chave requestId).
// ─────────────────────────────────────────────────────────────────────────────
import type { AnexoParaAssinatura, AnexoStore } from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';

const NS = 'dr-anexos';

export class JsonAnexoStore implements AnexoStore {
  constructor(private readonly json: JsonStore) {}

  async salvar(requestId: string, anexo: AnexoParaAssinatura): Promise<void> {
    await this.json.put(NS, requestId, anexo);
  }

  async porRequest(requestId: string): Promise<AnexoParaAssinatura | null> {
    const raw = (await this.json.get(NS, requestId)) as AnexoParaAssinatura | null;
    if (raw === null || typeof raw.base64 !== 'string' || raw.base64 === '') return null;
    return { fileName: raw.fileName, mimeType: raw.mimeType, base64: raw.base64 };
  }
}
