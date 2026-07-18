import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';
import Nav from '../components/nav';
import ThemeToggle from '../components/theme-toggle';
import LogoutButton from '../components/logout-button';

export const metadata: Metadata = {
  title: 'AHRIOS — Administração',
  description: 'Portal Administrativo AHRIOS — operação em tempo real sobre Read Models.',
};

// Portal 100% operacional: NUNCA pré-renderizar no build (o build Docker não tem
// API — páginas estáticas assariam "API indisponível" na imagem). Tudo dinâmico.
export const dynamic = 'force-dynamic';

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            AHRIOS <span>ADMIN</span>
          </div>
          <Nav />
          <ThemeToggle />
          <LogoutButton />
        </aside>
        <main className="main">{children}</main>
      </div>
    </body>
  </html>
);

export default RootLayout;
