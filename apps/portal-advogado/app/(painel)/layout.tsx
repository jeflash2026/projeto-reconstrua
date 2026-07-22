// ─────────────────────────────────────────────────────────────────────────────
// SHELL DO PAINEL (GO-LIVE-04): a sidebar/menu SÓ existe DENTRO do grupo
// autenticado. /login e /convite (fora do grupo) renderizam nus.
//
// GO-LIVE-04.1 · DEFESA EM PROFUNDIDADE: além do middleware, o PRÓPRIO layout
// valida a sessão E a identidade no servidor antes de renderizar QUALQUER
// elemento (a homologação real provou que a raiz do basePath atravessava o
// matcher do middleware). Sem sessão válida ⇒ redirect('/login'). Fail-closed.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import Nav from '../../components/nav';
import ThemeToggle from '../../components/theme-toggle';
import LogoutButton from '../../components/logout-button';
import {
  ADVOGADO_ID_COOKIE,
  ADVOGADO_SESSION_COOKIE,
  advogadoSessionToken,
  secretsMatch,
} from '../../lib/session';

const PainelLayout = ({ children }: { children: ReactNode }): ReactElement => {
  const secret = process.env['ADVOGADO_API_TOKEN'] ?? '';
  const presented = cookies().get(ADVOGADO_SESSION_COOKIE)?.value ?? '';
  const identidade = cookies().get(ADVOGADO_ID_COOKIE)?.value ?? '';
  if (
    secret === '' ||
    identidade === '' ||
    !secretsMatch(presented, advogadoSessionToken(secret))
  ) {
    redirect('/login');
  }

  return (
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
};

export default PainelLayout;
