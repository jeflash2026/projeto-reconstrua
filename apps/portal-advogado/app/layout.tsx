import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';
import Nav from '../components/nav';
import ThemeToggle from '../components/theme-toggle';
import LogoutButton from '../components/logout-button';

export const metadata: Metadata = {
  title: 'AHRIOS — Advogado',
  description: 'Portal do Advogado AHRIOS — trabalho jurídico sobre processos atribuídos.',
};

// Portal operacional: nunca pré-renderizar no build (sem API no build Docker).
export const dynamic = 'force-dynamic';

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => (
  <html lang="pt-BR">
    <body>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            AHRIOS <span>ADVOGADO</span>
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
