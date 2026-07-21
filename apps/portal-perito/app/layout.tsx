// Layout raiz do Portal do PERITO — apartado do Admin (Decreto 2026-07-21).
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reconstrua — Central do Perito',
  description: 'Fila da perícia, planilhas de contratos e confirmação dos pedidos administrativos.',
};

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
