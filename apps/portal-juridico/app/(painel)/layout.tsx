// LAYOUT do painel (guarda de sessão + navegação) — sem sessão válida, tudo
// redireciona ao login. O nome da sessão assina os atos (como no original).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import { JURIDICO_NOME_COOKIE, JURIDICO_SESSION_COOKIE, usuarioDaSessao } from '../../lib/session';
import SairButton from '../../components/sair-button';

const SEGREDO = process.env['ADMIN_API_TOKEN'] ?? '';

export default function PainelLayout({ children }: { children: ReactNode }): ReactElement {
  const cookie = cookies().get(JURIDICO_SESSION_COOKIE)?.value ?? '';
  if (usuarioDaSessao(SEGREDO, cookie) === null) redirect('/login');
  const nome = (cookies().get(JURIDICO_NOME_COOKIE)?.value ?? '').trim() || 'Equipe';

  return (
    <>
      <header className="topo">
        <div className="topo-linha">
          <a className="topo-marca" href="/juridico">
            <span className="selo">⚖ Jurídico</span>
          </a>
          <nav className="topo-nav">
            <a href="/juridico">Dashboard</a>
            <a href="/juridico/clientes">Clientes</a>
            <a href="/juridico/guias">Guias</a>
            <a href="/juridico/pericias">Perícias</a>
            <a href="/juridico/processos">Processos</a>
          </nav>
          <div className="topo-user">
            <span>{nome}</span>
            <SairButton />
          </div>
        </div>
      </header>
      <main className="pagina">{children}</main>
    </>
  );
}
