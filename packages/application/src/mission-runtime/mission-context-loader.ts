// ─────────────────────────────────────────────────────────────────────────────
// MISSION CONTEXT LOADER — carrega as identidades conhecidas da conversa/missão
// (Pessoa/Cliente/Missão/Verdade/Estado/Etapa…) do MissionIdentityMap, ou identidade
// vazia se for o primeiro contato. Também persiste a identidade evoluída no fim do turno.
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionIdentityMap } from './ports.js';
import { emptyIdentity, type MissionIdentity } from './types.js';

export class MissionContextLoader {
  constructor(private readonly map: MissionIdentityMap) {}

  async load(chatId: string): Promise<MissionIdentity> {
    return (await this.map.load(chatId)) ?? emptyIdentity(chatId);
  }

  async save(identity: MissionIdentity): Promise<void> {
    await this.map.save(identity);
  }
}
