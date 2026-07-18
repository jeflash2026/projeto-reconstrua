// ─────────────────────────────────────────────────────────────────────────────
// SHELL DO PAINEL (GO-LIVE-03 · item 3): a sidebar/menu SÓ existe DENTRO do grupo
// autenticado. O /login (fora do grupo) renderiza nu — nenhuma rota, nenhum menu
// é revelado a visitante. O gate de sessão continua no middleware (fail-closed).
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactElement, ReactNode } from 'react';
import Nav from '../../components/nav';
import ThemeToggle from '../../components/theme-toggle';
import LogoutButton from '../../components/logout-button';

const PainelLayout = ({ children }: { children: ReactNode }): ReactElement => (
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
);

export default PainelLayout;
