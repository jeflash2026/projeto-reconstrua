// LAYOUT do painel (guarda de sessão + faixa com a marca, o menu e a sessão).
// Defesa em profundidade: além do middleware, a sessão é validada aqui.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';
import { Nav } from '../../components/nav';
import { SairButton } from '../../components/sair-button';
import { getJson, type ResumoCnh } from '../../lib/api';
import { CNH_SESSION_COOKIE, operadorDaSessao } from '../../lib/session';

const SEGREDO = process.env['CNH_API_TOKEN'] ?? '';

export default async function PainelLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const operador = operadorDaSessao(SEGREDO, cookies().get(CNH_SESSION_COOKIE)?.value ?? '');
  if (operador === null) redirect('/login');
  const resumo = await getJson<ResumoCnh>('/cnh-api/admin/resumo');

  return (
    <>
      <header className="faixa">
        <div className="faixa-inner">
          <a className="marca" href="/cnh">
            <img src="/cnh/icone.png" alt="" />
            <div>
              <div className="marca-nome">
                Reconstrua <span>CNH</span>
              </div>
              <div className="marca-sub">Painel de captação</div>
            </div>
          </a>
          <Nav atencao={resumo?.precisamDeAtencao ?? 0} followups={resumo?.followupsDevidos ?? 0} />
          <div className="sessao">
            <span>{operador}</span>
            <SairButton />
          </div>
        </div>
      </header>
      <main className="pagina">{children}</main>
    </>
  );
}
