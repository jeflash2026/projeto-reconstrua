import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seu caso — Reconstrua',
  description: 'Acompanhamento do seu caso, escrito pela AHRI.',
  robots: { index: false, follow: false }, // página privada — nunca indexada
};

// A carta é sempre escrita para AGORA — nunca pré-renderizada no build.
export const dynamic = 'force-dynamic';

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
