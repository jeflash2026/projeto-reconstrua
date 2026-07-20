// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUESTS SNAPSHOT ADAPTER (15C-1 · Parte 2 — Decisão B) — decorator do
// MissionSnapshotPort: enriquece o snapshot com o resumo das solicitações
// complementares do cliente. A cadeia fica: Conversation → SNAPSHOT → esta
// projeção → read model → aggregate. A conversa NUNCA consulta o banco.
// Best-effort: falha do read model ⇒ snapshot base intacto (nunca quebra o Brain).
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentRequestStore, MissionSnapshot, MissionSnapshotPort } from '@reconstrua/application';
import { emptySnapshot, resumoDocumentRequests } from '@reconstrua/application';

export class DocumentRequestsAwareSnapshotAdapter implements MissionSnapshotPort {
  constructor(
    private readonly inner: MissionSnapshotPort,
    private readonly store: DocumentRequestStore,
  ) {}

  async load(chatId: string): Promise<MissionSnapshot | null> {
    const base = await this.inner.load(chatId);
    const abertas = await this.store.abertasDoCliente(chatId).catch(() => []);
    if (abertas.length === 0) return base; // nada a acrescentar — snapshot intacto
    return { ...(base ?? emptySnapshot(chatId)), documentRequests: resumoDocumentRequests(abertas) };
  }
}
