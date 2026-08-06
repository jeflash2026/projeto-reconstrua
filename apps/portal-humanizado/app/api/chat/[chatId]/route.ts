// PROXY DO CHAT DA EQUIPE (decreto 2026-08-05) — o browser da secretária fala
// com ESTA rota; o Bearer do Admin fica server-side. Diferente do proxy de
// pré-visualização antigo, aqui a SESSÃO é exigida (fail-closed): sem o cookie
// assinado, nada passa — o chat carrega conversas reais de clientes.
import { cookies } from 'next/headers';
import { API_BASE, authHeaders } from '../../../../lib/api';
import {
  HUMANIZADO_NOME_COOKIE,
  HUMANIZADO_SESSION_COOKIE,
  operadorDaSessao,
} from '../../../../lib/session';

export const dynamic = 'force-dynamic';

const SEGREDO = process.env['ADMIN_API_TOKEN'] ?? '';

function sessaoValida(): boolean {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  return operadorDaSessao(SEGREDO, cookie) !== null;
}

/** Quem atende assina a conversa — nome da sessão, fallback da equipe. */
function autorDaSessao(): string {
  const nome = (cookies().get(HUMANIZADO_NOME_COOKIE)?.value ?? '').trim();
  return nome.split(/\s+/)[0] || 'Equipe';
}

export async function GET(
  _request: Request,
  { params }: { params: { chatId: string } },
): Promise<Response> {
  if (!sessaoValida()) return Response.json({ error: 'sessão inválida' }, { status: 401 });
  const res = await fetch(
    `${API_BASE}/admin/humanizado/chat/${encodeURIComponent(params.chatId)}`,
    { cache: 'no-store', headers: authHeaders() },
  );
  return Response.json(await res.json().catch(() => ({})), { status: res.status });
}

interface AcaoChat {
  acao?: 'texto' | 'documento' | 'audio' | 'template' | 'confirmar' | 'lido';
  texto?: string;
  nome?: string;
  base64?: string;
  /** Áudio: o mime real da gravação (o gravador do portal produz audio/ogg). */
  mime?: string;
  mensagemId?: string;
  tipo?: string;
  /** Template: qual modelo e as variáveis do corpo ({{1}} = nome do cliente). */
  template?: string;
  variaveis?: string[];
}

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } },
): Promise<Response> {
  if (!sessaoValida()) return Response.json({ error: 'sessão inválida' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as AcaoChat;
  const autor = autorDaSessao();
  const chat = `${API_BASE}/admin/humanizado/chat/${encodeURIComponent(params.chatId)}`;
  const rotas: Record<string, { path: string; payload: unknown } | undefined> = {
    texto: { path: `${chat}/texto`, payload: { texto: body.texto, autor } },
    documento: {
      path: `${chat}/documento`,
      payload: { nome: body.nome, base64: body.base64, autor },
    },
    audio: {
      path: `${chat}/audio`,
      payload: { base64: body.base64, mime: body.mime, autor },
    },
    template: {
      path: `${chat}/template`,
      payload: { nome: body.template, variaveis: body.variaveis, autor },
    },
    confirmar: {
      path: `${chat}/confirmar`,
      payload: { mensagemId: body.mensagemId, tipo: body.tipo },
    },
    lido: { path: `${chat}/lido`, payload: {} },
  };
  const rota = rotas[body.acao ?? ''];
  if (rota === undefined) return Response.json({ error: 'ação desconhecida' }, { status: 400 });
  const res = await fetch(rota.path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(rota.payload),
    cache: 'no-store',
  });
  return Response.json(await res.json().catch(() => ({})), { status: res.status });
}
