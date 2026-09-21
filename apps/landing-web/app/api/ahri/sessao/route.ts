// Abre a sessão da conversa (nome + WhatsApp + campanha) — repassa à API.
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/ahri-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  const corpo = await request.text();
  return repassar('/webchat/sessao', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: corpo,
  });
}
