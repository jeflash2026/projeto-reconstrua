// ─────────────────────────────────────────────────────────────────────────────
// SÓCIOS (Decreto 2026-07-23) — o RATEIO do potencial recuperável e a IDENTIDADE
// do sócio (login por CPF). Filosofia: o sócio é uma pessoa com PARTICIPAÇÃO fixa
// no resultado da AHRI; nunca é staff operacional. A identidade de acesso é o CPF
// (só dígitos), e a participação é gravada em pontos-base (bps) do potencial TOTAL.
//
// Rateio decretado do potencial recuperável (100%):
//   • cliente ............ 60%
//   • advogado sócio ..... 20%
//   • AHRI (empresa) ..... 20%  = Josmael 5% + Juliano 5% + dono 10%
// Cada sócio do PAINEL carrega a fatia dele em bps (5% = 500, 10% = 1000).
// ─────────────────────────────────────────────────────────────────────────────

/** Um ponto percentual = 100 bps; o total é 10.000 bps (100%). */
export const BPS_TOTAL = 10_000;

/** O rateio de referência (para exibição transparente no painel), em bps. */
export const RATEIO_REFERENCIA = {
  cliente: 6_000,
  advogadoSocio: 2_000,
  ahriEmpresa: 2_000,
} as const;

/** Sócio: pessoa com participação fixa no resultado. Identidade = CPF (só dígitos). */
export interface Socio {
  /** CPF só com dígitos (11) — a identidade de login, imutável. */
  readonly cpf: string;
  readonly nome: string;
  /** Participação no potencial TOTAL, em bps (5% = 500; 10% = 1000). */
  readonly percentualBps: number;
  readonly ativo: boolean;
  readonly criadoEm: Date;
}

export interface SocioStore {
  byCpf(cpf: string): Promise<Socio | null>;
  all(): Promise<readonly Socio[]>;
  save(socio: Socio): Promise<void>;
}

/** Normaliza um CPF para SÓ os 11 dígitos. null se não formar um CPF plausível
 *  (11 dígitos e não todos iguais — rejeita 000…, 111…). Não valida dígito
 *  verificador para não travar cadastro por engano de esquema; o vínculo do
 *  convite (token.sub = cpf) já protege contra CPF de terceiro. */
export function normalizarCpf(bruto: string): string | null {
  const so = bruto.replace(/\D/g, '');
  if (so.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(so)) return null;
  return so;
}

/** Formata o CPF (000.000.000-00) para exibição. Entrada já normalizada ou não. */
export function formatarCpf(bruto: string): string {
  const so = bruto.replace(/\D/g, '');
  if (so.length !== 11) return bruto;
  return `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}-${so.slice(9)}`;
}

/** Participação em bps → percentual legível (500 → "5%", 1050 → "10,5%"). */
export function percentualLegivel(bps: number): string {
  const pct = bps / 100;
  const txt = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace('.', ',');
  return `${txt}%`;
}

/** O valor que CABE ao sócio: fatia (bps) do potencial total. Arredonda ao centavo. */
export function rateioDoSocio(potencialTotal: number, percentualBps: number): number {
  return Math.round((potencialTotal * percentualBps) / BPS_TOTAL / 0.01) * 0.01;
}
