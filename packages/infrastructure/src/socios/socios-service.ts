// ─────────────────────────────────────────────────────────────────────────────
// SÓCIOS SERVICE (Decreto 2026-07-23) — orquestra cadastro (ato do Admin), a lista
// de participação e o PAINEL do sócio. A base do rateio é o potencial recuperável
// de TODOS os HISCON (fonte: a perícia). Nada aqui decide valores: só deriva o que
// cabe a cada sócio da participação (bps) gravada × o potencial total de hoje.
// ─────────────────────────────────────────────────────────────────────────────
import {
  montarPainelDoSocio,
  normalizarCpf,
  rateioDoSocio,
  type PainelSocio,
  type Socio,
  type SocioResumoAdmin,
  type SocioStore,
  type CredenciaisStore,
} from '@reconstrua/application';
import { percentualLegivel } from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';

/** A base do rateio: potencial recuperável total (100%) + nº de clientes que o compõem. */
export type BaseDoRateio = () => Promise<{ readonly total: number; readonly clientes: number }>;

export interface SociosServiceDeps {
  readonly socios: SocioStore;
  readonly credenciais: CredenciaisStore;
  readonly base: BaseDoRateio;
  readonly clock: Clock;
}

export type ResultadoCadastro =
  { readonly ok: true; readonly socio: Socio } | { readonly ok: false; readonly error: string };

export class SociosService {
  constructor(private readonly deps: SociosServiceDeps) {}

  /** ATO DO ADMIN: cadastra (ou atualiza nome/participação/estado de) um sócio por CPF.
   *  A senha NÃO nasce aqui — o sócio a cria pelo link (SocioAuthRuntime). */
  async cadastrar(input: {
    cpf: string;
    nome: string;
    percentualBps: number;
    ativo?: boolean;
  }): Promise<ResultadoCadastro> {
    const cpf = normalizarCpf(input.cpf);
    if (cpf === null) return { ok: false, error: 'CPF inválido — informe os 11 dígitos' };
    const nome = input.nome.trim();
    if (nome === '') return { ok: false, error: 'nome obrigatório' };
    if (!Number.isFinite(input.percentualBps) || input.percentualBps <= 0)
      return { ok: false, error: 'participação inválida (informe um percentual maior que zero)' };
    const existente = await this.deps.socios.byCpf(cpf);
    const socio: Socio = {
      cpf,
      nome,
      percentualBps: Math.round(input.percentualBps),
      ativo: input.ativo ?? existente?.ativo ?? true,
      criadoEm: existente?.criadoEm ?? this.deps.clock.now(),
    };
    await this.deps.socios.save(socio);
    return { ok: true, socio };
  }

  /** Lista para o Admin: participação, se já tem senha (fila de cadastro) e valor estimado. */
  async listaAdmin(): Promise<readonly SocioResumoAdmin[]> {
    const [{ total }, socios] = await Promise.all([this.deps.base(), this.deps.socios.all()]);
    const linhas: SocioResumoAdmin[] = [];
    for (const s of socios) {
      const cred = await this.deps.credenciais.load(s.cpf);
      linhas.push({
        cpf: s.cpf,
        nome: s.nome,
        percentualBps: s.percentualBps,
        percentual: percentualLegivel(s.percentualBps),
        ativo: s.ativo,
        temSenha: cred !== null,
        valorEstimado: rateioDoSocio(total, s.percentualBps),
      });
    }
    return linhas.sort((a, b) => b.percentualBps - a.percentualBps);
  }

  /** O PAINEL do sócio (o que ele vê ao entrar). null se o CPF não é sócio ativo. */
  async painel(cpfBruto: string): Promise<PainelSocio | null> {
    const cpf = normalizarCpf(cpfBruto);
    if (cpf === null) return null;
    const socio = await this.deps.socios.byCpf(cpf);
    if (socio === null || !socio.ativo) return null;
    const { total, clientes } = await this.deps.base();
    return montarPainelDoSocio(socio, total, clientes);
  }
}
