// ─────────────────────────────────────────────────────────────────────────────
// AUTH DO SÓCIO (Decreto 2026-07-23) — o MESMO fluxo consagrado convite→senha→
// login (Lei 12), mas com IDENTIDADE por CPF: o Admin cadastra o sócio (nome +
// CPF + participação) e gera um LINK; o sócio abre o link, confirma o CPF dele e
// cria a própria senha; o login exige APENAS CPF + senha.
//
//  • NUNCA cadastro público: o convite só nasce para sócio JÁ cadastrado e ativo.
//  • O convite é ASSINADO e vinculado ao CPF (sub = cpf) — o sócio não consegue
//    cadastrar-se com o CPF de outro; o CPF digitado tem de bater com o do convite.
//  • FAIL-CLOSED: sem sócio ativo ⇒ nega; sem credencial ⇒ nega; erro genérico
//    único no login (nunca revela se o CPF existe ou qual fator falhou).
//  • Convite não reutilizável: senha criada após a emissão mata o link.
// ─────────────────────────────────────────────────────────────────────────────
import { assinarTokenPortal, validarTokenPortalDetalhado } from '../portal-auth/auth-tokens.js';
import type { CredenciaisStore, ResultadoAuth } from '../portal-auth/advogado-auth.js';
import { SENHA_MINIMA, hashSenha, verificarSenha } from '../portal-auth/senha.js';
import { normalizarCpf, type SocioStore } from './socio-model.js';

export const USO_CONVITE_SOCIO = 'convite-socio';
export const VALIDADE_CONVITE_SOCIO_DIAS = 7;

const CREDENCIAIS_INVALIDAS = 'credenciais inválidas';

export interface SocioAuthDeps {
  readonly socios: SocioStore;
  readonly credenciais: CredenciaisStore;
  /** Segredo que ASSINA os convites (o mesmo segredo de acesso do painel). */
  readonly secret: string;
}

/** Resultado de auth do sócio: sujeito = CPF (só dígitos) + nome. */
export type ResultadoSocio =
  | { readonly ok: true; readonly cpf: string; readonly nome: string }
  | { readonly ok: false; readonly error: string };

export class SocioAuthRuntime {
  constructor(private readonly deps: SocioAuthDeps) {}

  private async socioAtivo(cpf: string): Promise<{ cpf: string; nome: string } | null> {
    const socio = await this.deps.socios.byCpf(cpf);
    if (socio === null || !socio.ativo) return null;
    return { cpf: socio.cpf, nome: socio.nome };
  }

  /** ATO DO ADMINISTRADOR: convite assinado (7 dias) — só para sócio ativo. */
  async emitirConvite(cpfBruto: string, now: Date): Promise<string | null> {
    if (this.deps.secret === '') return null; // fail-closed
    const cpf = normalizarCpf(cpfBruto);
    if (cpf === null) return null;
    const socio = await this.socioAtivo(cpf);
    if (socio === null) return null;
    return assinarTokenPortal(
      socio.cpf,
      USO_CONVITE_SOCIO,
      VALIDADE_CONVITE_SOCIO_DIAS,
      now,
      this.deps.secret,
    );
  }

  /** O sócio cria a PRÓPRIA senha a partir do convite, confirmando o CPF dele. */
  async definirSenha(
    token: string,
    cpfBruto: string,
    senha: string,
    now: Date,
  ): Promise<ResultadoSocio> {
    const convite = validarTokenPortalDetalhado(token, USO_CONVITE_SOCIO, now, this.deps.secret);
    if (convite === null)
      return { ok: false, error: 'convite inválido ou expirado — peça um novo link' };
    const cpf = normalizarCpf(cpfBruto);
    if (cpf === null || cpf !== convite.sub)
      return { ok: false, error: 'o CPF informado não confere com o do convite' };
    const socio = await this.socioAtivo(cpf);
    if (socio === null)
      return { ok: false, error: 'cadastro não encontrado ou inativo — fale com o administrador' };
    // Convite não reutilizável: senha criada após a emissão mata o link.
    const existente = await this.deps.credenciais.load(cpf);
    if (existente !== null && existente.atualizadaEm.getTime() >= convite.emitidoEm.getTime())
      return { ok: false, error: 'este convite já foi utilizado — peça um novo link' };
    if (senha.length < SENHA_MINIMA)
      return {
        ok: false,
        error: `a senha precisa ter pelo menos ${String(SENHA_MINIMA)} caracteres`,
      };
    await this.deps.credenciais.save({ sujeitoId: cpf, hash: hashSenha(senha), atualizadaEm: now });
    return { ok: true, cpf, nome: socio.nome };
  }

  /** LOGIN individual: CPF + senha própria. Erro único — nunca vaza qual fator falhou. */
  async login(cpfBruto: string, senha: string): Promise<ResultadoSocio> {
    const cpf = normalizarCpf(cpfBruto);
    if (cpf === null) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    const socio = await this.socioAtivo(cpf);
    if (socio === null) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    const credencial = await this.deps.credenciais.load(cpf);
    if (credencial === null) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    if (!verificarSenha(senha, credencial.hash)) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    return { ok: true, cpf, nome: socio.nome };
  }
}

// Reexporta para consumidores que só importam o módulo de sócios.
export type { ResultadoAuth };
