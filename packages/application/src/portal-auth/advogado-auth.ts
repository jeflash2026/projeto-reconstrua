// ─────────────────────────────────────────────────────────────────────────────
// AUTH RUNTIME COMPARTILHADO (GO-LIVE-04) · PROVIDER DO ADVOGADO — o fluxo
// decretado: convite do escritório → criar senha → entrar → sessão → painel.
//
//  • NUNCA cadastro público: o convite só nasce para advogado JÁ cadastrado e
//    ATIVO no diretório (ato do Administrador), assinado e com validade curta.
//  • NUNCA criação pela URL: definir senha exige o convite válido; login exige
//    credencial INDIVIDUAL previamente criada. A senha global de transporte
//    (segredo do portal) deixa de autenticar pessoas.
//  • FAIL-CLOSED em tudo: sem credencial ⇒ nega; inativo ⇒ nega; erro genérico
//    único no login (nunca revela se o ID existe ou qual fator falhou).
// ─────────────────────────────────────────────────────────────────────────────
import type { StaffStore } from '../admin-portal/staff-directory.js';
import { assinarTokenPortal, validarTokenPortalDetalhado } from './auth-tokens.js';
import { SENHA_MINIMA, hashSenha, verificarSenha } from './senha.js';

export const USO_CONVITE_ADVOGADO = 'convite-advogado';
export const VALIDADE_CONVITE_DIAS = 7;

/** Credencial individual de acesso a um portal (chave = pessoa, nunca canal). */
export interface CredencialPortal {
  readonly sujeitoId: string;
  readonly hash: string;
  readonly atualizadaEm: Date;
}

export interface CredenciaisStore {
  load(sujeitoId: string): Promise<CredencialPortal | null>;
  save(credencial: CredencialPortal): Promise<void>;
}

export interface AdvogadoAuthDeps {
  readonly staff: StaffStore;
  readonly credenciais: CredenciaisStore;
  /** Segredo que ASSINA convites (o mesmo segredo de acesso do portal — nada novo). */
  readonly secret: string;
}

export type ResultadoAuth =
  | { readonly ok: true; readonly advogadoId: string; readonly nome: string }
  | { readonly ok: false; readonly error: string };

const CREDENCIAIS_INVALIDAS = 'credenciais inválidas';

export class AdvogadoAuthRuntime {
  constructor(private readonly deps: AdvogadoAuthDeps) {}

  /** Advogado cadastrado, ativo e do papel certo? (guard único, fail-closed) */
  private async advogadoAtivo(advogadoId: string): Promise<{ id: string; name: string } | null> {
    const member = await this.deps.staff.byId(advogadoId);
    if (member === null || member.role !== 'advogado' || !member.active) return null;
    return { id: member.id, name: member.name };
  }

  /** ATO DO ADMINISTRADOR: convite assinado (7 dias) — só para advogado ativo. */
  async emitirConvite(advogadoId: string, now: Date): Promise<string | null> {
    if (this.deps.secret === '') return null; // fail-closed
    const member = await this.advogadoAtivo(advogadoId);
    if (member === null) return null;
    return assinarTokenPortal(member.id, USO_CONVITE_ADVOGADO, VALIDADE_CONVITE_DIAS, now, this.deps.secret);
  }

  /** O advogado cria a PRÓPRIA senha a partir do convite (nunca pela URL crua). */
  async definirSenha(token: string, senha: string, now: Date): Promise<ResultadoAuth> {
    const convite = validarTokenPortalDetalhado(token, USO_CONVITE_ADVOGADO, now, this.deps.secret);
    if (convite === null) return { ok: false, error: 'convite inválido ou expirado — peça um novo ao escritório' };
    const member = await this.advogadoAtivo(convite.sub);
    if (member === null) return { ok: false, error: 'cadastro não encontrado ou inativo — fale com o escritório' };
    // GO-LIVE-04.1 · CONVITE NÃO É REUTILIZÁVEL: se já existe senha criada DEPOIS
    // da emissão deste convite, ele morreu. Redefinição exige convite NOVO do
    // escritório (emitido após a senha atual) — nunca um link antigo vazado.
    const existente = await this.deps.credenciais.load(member.id);
    if (existente !== null && existente.atualizadaEm.getTime() >= convite.emitidoEm.getTime()) {
      return { ok: false, error: 'este convite já foi utilizado — peça um novo ao escritório' };
    }
    if (senha.length < SENHA_MINIMA) return { ok: false, error: `a senha precisa ter pelo menos ${String(SENHA_MINIMA)} caracteres` };
    await this.deps.credenciais.save({ sujeitoId: member.id, hash: hashSenha(senha), atualizadaEm: now });
    return { ok: true, advogadoId: member.id, nome: member.name };
  }

  /** LOGIN individual: ID + senha própria. Erro único — nunca vaza qual fator falhou. */
  async login(advogadoId: string, senha: string): Promise<ResultadoAuth> {
    const member = await this.advogadoAtivo(advogadoId.trim());
    if (member === null) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    const credencial = await this.deps.credenciais.load(member.id);
    if (credencial === null) return { ok: false, error: CREDENCIAIS_INVALIDAS }; // sem convite concluído ⇒ nega
    if (!verificarSenha(senha, credencial.hash)) return { ok: false, error: CREDENCIAIS_INVALIDAS };
    return { ok: true, advogadoId: member.id, nome: member.name };
  }
}
