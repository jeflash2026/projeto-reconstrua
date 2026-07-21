'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { MagneticButton } from '@/components/motion/magnetic-button';
import { navigation } from '@/lib/content';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={'site-header ' + (isScrolled ? 'site-header--scrolled' : '')}>
      <nav className="site-nav" aria-label="Navegação principal">
        <a className="brand-link" href="#inicio" aria-label="Ir para o início">
          <BrandMark />
        </a>

        <div className="nav-links">
          {navigation.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="nav-action">
          <MagneticButton href="#analise" showArrow={false} className="nav-cta">
            Analisar meu caso
          </MagneticButton>
        </div>

        <button
          className="nav-menu-toggle"
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mobile-nav"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22 }}
          >
            {navigation.map((item) => (
              <a href={item.href} key={item.href} onClick={() => setIsOpen(false)}>
                {item.label}
              </a>
            ))}
            <a href="#analise" className="mobile-nav__cta" onClick={() => setIsOpen(false)}>
              Analisar meu caso
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
