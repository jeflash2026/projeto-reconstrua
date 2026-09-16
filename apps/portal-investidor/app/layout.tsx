// Layout raiz do Portal do INVESTIDOR — apartado do Admin (2026-09-16).
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reconstrua — Painel do Investidor',
  description: 'A sua carteira de créditos judiciais: processos, fases e valores.',
  icons: { icon: '/investidor/icone.png' },
};

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
