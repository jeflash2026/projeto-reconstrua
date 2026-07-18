// ─────────────────────────────────────────────────────────────────────────────
// SHELL DO PAINEL (GO-LIVE-03 · item 3): a sidebar/menu SÓ existe DENTRO do grupo
// autenticado. O /login (fora do grupo) renderiza nu — nenhuma rota, nenhum menu
// é revelado a visitante.
//
// GO-LIVE-04.1 · DEFESA EM PROFUNDIDADE: além do middleware, o PRÓPRIO layout
// valida a sessão no servidor antes de renderizar QUALQUER elemento (a homologação
// real provou que a raiz do basePath atravessava o matcher do middleware). Sem
// sessão válida ⇒ redirect('/login'). Fail-closed: segredo ausente ⇒ nada rende.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import Nav from '../../components/nav';
import ThemeToggle from '../../components/theme-toggle';
import LogoutButton from '../../components/logout-button';
import { ADMIN_SESSION_COOKIE, adminSessionToken, secretsMatch } from '../../lib/session';

const PainelLayout = ({ children }: { children: ReactNode }): ReactElement => {
  const secret = process.env['ADMIN_API_TOKEN'] ?? '';
  const presented = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? '';
  if (secret === '' || !secretsMatch(presented, adminSessionToken(secret))) {
    redirect('/login');
  }

  return (
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
};

export default PainelLayout;
