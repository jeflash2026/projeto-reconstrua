// ─────────────────────────────────────────────────────────────────────────────
// SÓCIOS — persistência (Decreto 2026-07-23). Sócios chaveados por CPF (só dígitos)
// no namespace 'socios'; credenciais no namespace ISOLADO 'credenciais-socio' (nunca
// se misturam às do advogado). JsonStore homologado; datas revividas na fronteira.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  CredencialPortal,
  CredenciaisStore,
  Socio,
  SocioStore,
} from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import { reviveDates } from '../production/json-store.js';

const NS_SOCIOS = 'socios';
const NS_CRED_SOCIO = 'credenciais-socio';

export class JsonSocioStore implements SocioStore {
  constructor(private readonly store: JsonStore) {}
  async byCpf(cpf: string): Promise<Socio | null> {
    const raw = await this.store.get(NS_SOCIOS, cpf);
    return raw === null ? null : reviveDates<Socio>(raw, ['criadoEm']);
  }
  async all(): Promise<readonly Socio[]> {
    return (await this.store.list(NS_SOCIOS)).map((s) => reviveDates<Socio>(s, ['criadoEm']));
  }
  save(socio: Socio): Promise<void> {
    return this.store.put(NS_SOCIOS, socio.cpf, socio);
  }
}

export class JsonSocioCredenciaisStore implements CredenciaisStore {
  constructor(private readonly store: JsonStore) {}
  async load(sujeitoId: string): Promise<CredencialPortal | null> {
    const raw = await this.store.get(NS_CRED_SOCIO, sujeitoId);
    return raw === null ? null : reviveDates<CredencialPortal>(raw, ['atualizadaEm']);
  }
  save(credencial: CredencialPortal): Promise<void> {
    return this.store.put(NS_CRED_SOCIO, credencial.sujeitoId, credencial);
  }
}
