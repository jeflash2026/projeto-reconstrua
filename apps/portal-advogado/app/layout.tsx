import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';
import Nav from '../components/nav';
import ThemeToggle from '../components/theme-toggle';

export const metadata: Metadata = {
  title: 'AHRIOS — Advogado',
  description: 'Portal do Advogado AHRIOS — trabalho jurídico sobre processos atribuídos.',
};

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
        </aside>
        <main className="main">{children}</main>
      </div>
    </body>
  </html>
);

export default RootLayout;
