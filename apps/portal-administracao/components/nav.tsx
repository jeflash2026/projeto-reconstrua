'use client';
// Navegação lateral (client: marca o item ativo pela rota).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

const ITEMS: ReadonlyArray<{ href: string; label: string } | { sep: string }> = [
  { href: '/', label: 'Centro de Comando' },
  { sep: 'Advogado' },
  { href: '/casos', label: 'Meus Casos' },
  { sep: 'Inteligência' },
  { href: '/inteligencia/dossies', label: 'Dossiês Jurídicos' },
  { href: '/inteligencia/hipoteses', label: 'Hipóteses' },
  { href: '/inteligencia/estrategias', label: 'Estratégias' },
  { href: '/inteligencia/conhecimento', label: 'Conhecimento' },
  { href: '/inteligencia/evolucao', label: 'Evolução do Catálogo' },
  { href: '/inteligencia/casos-aprendidos', label: 'Casos Aprendidos' },
  { sep: 'Operação' },
  { href: '/conexao-whatsapp', label: 'Conexão WhatsApp' },
  { href: '/operacao', label: 'Métricas' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/clientes-prontos', label: 'Prontos p/ Advogado' },
  { href: '/contratos-migrados', label: 'Contratos Migrados' },
  { href: '/missoes', label: 'Missões' },
  { href: '/documentos', label: 'Documentos' },
  { href: '/pericias', label: 'Perícias' },
  { sep: 'Equipe' },
  { href: '/advogados', label: 'Advogados' },
  { href: '/operadores', label: 'Operadores' },
  { href: '/supervisores', label: 'Supervisores' },
  { sep: 'Gestão' },
  { href: '/campanhas', label: 'Campanhas' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/custos-ia', label: 'Custos de IA' },
  { href: '/founder-console', label: 'Founder Console' },
  { sep: 'Sistema' },
  { href: '/configuracoes', label: 'Configurações' },
  { href: '/logs', label: 'Logs' },
  { href: '/health', label: 'Health' },
];

const Nav = (): ReactElement => {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((item, i) =>
        'sep' in item ? (
          <div key={`sep-${String(i)}`} className="sep">
            {item.sep}
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                ? 'active'
                : ''
            }
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
};

export default Nav;
