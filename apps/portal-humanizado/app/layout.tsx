// Layout raiz do Portal do ATENDIMENTO HUMANIZADO (Onda 2, 2026-07-31) —
// apartado do Admin: a secretária só vê a mesa dela.
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reconstrua — Atendimento Humanizado',
  description:
    'A mesa da fase 2: clientes que confirmaram o interesse, contato humanizado e coleta de procuração, RG e comprovante.',
};

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
