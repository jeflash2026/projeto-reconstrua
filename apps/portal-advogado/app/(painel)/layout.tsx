// ─────────────────────────────────────────────────────────────────────────────
// SHELL DO PAINEL (GO-LIVE-04): a sidebar/menu SÓ existe DENTRO do grupo
// autenticado. /login e /convite (fora do grupo) renderizam nus — nenhuma rota,
// nenhum menu, nenhum dado é revelado a visitante. O gate de sessão continua no
// middleware (fail-closed) e o isolamento por atribuição continua na API.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactElement, ReactNode } from 'react';
import Nav from '../../components/nav';
import ThemeToggle from '../../components/theme-toggle';
import LogoutButton from '../../components/logout-button';

const PainelLayout = ({ children }: { children: ReactNode }): ReactElement => (
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
);

export default PainelLayout;
