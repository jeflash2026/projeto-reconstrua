'use client';
// Menu do painel (marca o item ativo pela rota) com os contadores do dia.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

export const Nav = ({
  atencao,
  followups,
}: {
  atencao: number;
  followups: number;
}): ReactElement => {
  const rota = usePathname();
  const ativo = (href: string): string =>
    (href === '/' ? rota === '/' || rota.startsWith('/leads') : rota.startsWith(href))
      ? 'ativo'
      : '';
  return (
    <nav className="nav">
      <Link className={ativo('/')} href="/">
        Funil
        {atencao > 0 ? <span className="contador">{atencao}</span> : null}
      </Link>
      <Link className={ativo('/followups')} href="/followups">
        Follow-ups
        {followups > 0 ? <span className="contador">{followups}</span> : null}
      </Link>
      <Link className={ativo('/config')} href="/config">
        Configuração
      </Link>
    </nav>
  );
};
