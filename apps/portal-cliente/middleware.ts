// ─────────────────────────────────────────────────────────────────────────────
// ENTRADA PELO LINK MÁGICO: /portal?t=<token> → guarda o token em cookie httpOnly
// e redireciona para a URL LIMPA (o token nunca fica na barra de endereço nem no
// histórico). O Portal não valida nada aqui (não conhece segredos): a API é o
// único ponto de validação (Blueprint §3.2).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const token = request.nextUrl.searchParams.get('t');
  if (token === null || token === '') return NextResponse.next();

  const url = request.nextUrl.clone();
  url.searchParams.delete('t');
  const response = NextResponse.redirect(url);
  response.cookies.set('portal_cliente', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 90 * 24 * 60 * 60, // espelha a validade proposta do link
  });
  return response;
}

export const config = { matcher: ['/'] };
