import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AHRIOS — Advogado',
  description: 'Portal do Advogado AHRIOS — trabalho jurídico sobre processos atribuídos.',
};

// Portal operacional: nunca pré-renderizar no build (sem API no build Docker).
export const dynamic = 'force-dynamic';

// GO-LIVE-04: o layout raiz é NU — nenhum painel renderiza antes da autenticação.
// O shell (sidebar/menu) vive em app/(painel)/layout.tsx, só para autenticados.
const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
