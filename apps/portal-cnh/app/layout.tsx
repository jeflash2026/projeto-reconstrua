// Layout raiz do PAINEL CNH — apartado do Reconstrua (2026-09-18).
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reconstrua CNH — Painel',
  description: 'Funil de captação da tese de CNH: leads, conversas da AHRI, follow-ups e aceites.',
  icons: { icon: '/cnh/icone.png' },
};

// Tudo é dinâmico: o painel mostra conversas ao vivo.
export const dynamic = 'force-dynamic';

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
