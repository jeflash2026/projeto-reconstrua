// Layout raiz do Portal do SÓCIO — apartado do Admin (Decreto 2026-07-23).
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reconstrua — Painel do Sócio',
  description: 'A sua participação no resultado: quanto lhe cabe do potencial recuperável.',
};

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
