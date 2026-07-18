import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AHRIOS — Administração',
  description: 'Portal Administrativo AHRIOS — operação em tempo real sobre Read Models.',
};

// Portal 100% operacional: NUNCA pré-renderizar no build (o build Docker não tem
// API — páginas estáticas assariam "API indisponível" na imagem). Tudo dinâmico.
export const dynamic = 'force-dynamic';

// GO-LIVE-03 (item 3): o layout raiz é NU — sem sidebar, sem menu, sem rotas.
// O shell do painel vive em app/(painel)/layout.tsx, que só envolve rotas
// autenticadas. Visitante em /login não vê NADA além do formulário de acesso.
const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
