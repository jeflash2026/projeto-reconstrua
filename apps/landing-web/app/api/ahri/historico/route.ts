// A conversa até agora (a caixa pergunta de tempos em tempos) — repassa à API.
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/ahri-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  return repassar(`/webchat/historico?token=${encodeURIComponent(token)}`, { method: 'GET' });
}
