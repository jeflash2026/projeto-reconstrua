'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

const ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/', label: 'Painel' },
  { href: '/processos', label: 'Meus Processos' },
  { href: '/pendencias', label: 'Pendências' },
  { href: '/solicitacoes', label: 'Solicitações' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/documentos', label: 'Documentos' },
  { href: '/protocolos', label: 'Protocolos' },
  { href: '/movimentacoes', label: 'Movimentações' },
  { href: '/arquivos', label: 'Arquivos' },
  { href: '/historico', label: 'Histórico' },
  { href: '/perfil', label: 'Perfil' },
];

const Nav = (): ReactElement => {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'active' : ''}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

export default Nav;
