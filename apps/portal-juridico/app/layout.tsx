import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Painel Jurídico — Projeto Reconstrua',
  description: 'Gestão de clientes, processos, guias e perícias.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
