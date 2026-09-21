// Mensagem do visitante para a AHRI — repassa à API (mesma entrada do WhatsApp).
import type { NextRequest } from 'next/server';
import { repassar } from '@/lib/ahri-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  const corpo = await request.text();
  return repassar('/webchat/mensagem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: corpo,
  });
}
