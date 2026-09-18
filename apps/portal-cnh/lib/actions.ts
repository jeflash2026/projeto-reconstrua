'use server';
// ─────────────────────────────────────────────────────────────────────────────
// AÇÕES do Painel CNH (2026-09-18). O login confere a senha do painel
// (CNH_PAINEL_SENHA) em tempo constante; toda ação sobre um lead é assinada
// com o NOME da sessão — lido do cookie no servidor, nunca do navegador.
// ─────────────────────────────────────────────────────────────────────────────
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { postJson } from './api';
import { CNH_SESSION_COOKIE, cookieDeSessao, operadorDaSessao } from './session';

const SEGREDO = process.env['CNH_API_TOKEN'] ?? '';
const SENHA_PAINEL = process.env['CNH_PAINEL_SENHA'] ?? '';

export interface ResultadoAcao {
  ok: boolean;
  error?: string;
}

function senhaConfere(digitada: string): boolean {
  const a = Buffer.from(digitada);
  const b = Buffer.from(SENHA_PAINEL);
  return SENHA_PAINEL !== '' && a.length === b.length && timingSafeEqual(a, b);
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function entrar(nome: string, senha: string): Promise<ResultadoAcao> {
  if (SEGREDO === '' || SENHA_PAINEL === '')
    return { ok: false, error: 'painel sem CNH_API_TOKEN/CNH_PAINEL_SENHA configurados' };
  const limpo = nome.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (limpo.length < 2) return { ok: false, error: 'informe o seu nome' };
  if (!senhaConfere(senha)) return { ok: false, error: 'senha inválida' };
  cookies().set(CNH_SESSION_COOKIE, cookieDeSessao(SEGREDO, limpo), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' exige async
export async function sair(): Promise<void> {
  cookies().delete(CNH_SESSION_COOKIE);
}

/** O nome de quem está operando (a assinatura das ações). */
function operador(): string | null {
  return operadorDaSessao(SEGREDO, cookies().get(CNH_SESSION_COOKIE)?.value ?? '');
}

async function acaoNoLead(
  id: string,
  rota: string,
  corpo: Record<string, unknown> = {},
): Promise<ResultadoAcao> {
  const autor = operador();
  if (autor === null) return { ok: false, error: 'sessão expirada — entre de novo' };
  const limpo = id.replace(/\D/g, '');
  const r = await postJson<{ ok?: boolean; error?: string }>(
    `/cnh-api/admin/leads/${limpo}/${rota}`,
    { ...corpo, autor },
  );
  if (r === null) return { ok: false, error: 'serviço da CNH indisponível' };
  return r.ok === true ? { ok: true } : { ok: false, error: r.error ?? 'não foi possível' };
}

export async function assumirLead(id: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'assumir');
}
export async function devolverLead(id: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'devolver');
}
export async function mensagemAoLead(id: string, texto: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'mensagem', { texto });
}
export async function moverEtapaLead(id: string, etapa: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'etapa', { etapa });
}
export async function contratoEnviado(id: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'contrato');
}
export async function pagamentoConfirmado(id: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'pagamento');
}
export async function descartarLead(id: string, motivo: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'descartar', { motivo });
}
export async function reabrirLead(id: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'reabrir');
}
export async function marcarVistoLead(id: string): Promise<ResultadoAcao> {
  return acaoNoLead(id, 'visto');
}

/** Envia os follow-ups que o dono APROVOU (marcou) no painel. */
export async function enviarFollowups(
  ids: string[],
): Promise<{
  ok: boolean;
  error?: string;
  resultados?: { id: string; ok: boolean; detalhe: string }[];
}> {
  const autor = operador();
  if (autor === null) return { ok: false, error: 'sessão expirada — entre de novo' };
  const r = await postJson<{ resultados?: { id: string; ok: boolean; detalhe: string }[] }>(
    '/cnh-api/admin/followups/enviar',
    { ids, autor },
  );
  if (r?.resultados === undefined) return { ok: false, error: 'serviço da CNH indisponível' };
  return { ok: true, resultados: r.resultados };
}
