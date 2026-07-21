'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { useRef } from 'react';
import { MagneticButton } from '@/components/motion/magnetic-button';

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (reduceMotion || !heroRef.current) return;
    const bounds = heroRef.current.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    heroRef.current.style.setProperty('--mouse-x', x.toFixed(2) + '%');
    heroRef.current.style.setProperty('--mouse-y', y.toFixed(2) + '%');
  }

  return (
    <section
      id="inicio"
      ref={heroRef}
      className="hero"
      onPointerMove={handlePointerMove}
      aria-labelledby="hero-title"
    >
      <div className="hero__image" aria-hidden="true">
        <Image
          src="/images/ahri-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero__portrait"
        />
      </div>
      <div className="hero__image-wash" aria-hidden="true" />
      <div className="hero__mouse-light" aria-hidden="true" />
      <div className="hero__grain" aria-hidden="true" />
      <div className="hero__particles" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="hero__content shell">
        <motion.div
          className="hero__copy"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <p className="hero__eyebrow">
            <span className="pulse-dot" />
            Revisão de consignados INSS
          </p>
          <h1 id="hero-title">
            VOCÊ NÃO PRECISA
            <br />
            ENFRENTAR ISSO
            <span> SOZINHO.</span>
          </h1>
          <p className="hero__description">
            Especialistas em revisão de contratos de empréstimos consignados do INSS.
          </p>
          <div className="hero__actions">
            <MagneticButton href="#analise">Analisar meu caso</MagneticButton>
            <a className="quiet-button" href="#como-funciona">
              <span>Como funciona</span>
              <ChevronRight aria-hidden="true" size={17} />
            </a>
          </div>
          <div className="hero__trust">
            <ShieldCheck aria-hidden="true" size={17} strokeWidth={1.7} />
            <span>Seu primeiro passo é tratado com discrição.</span>
          </div>
        </motion.div>
      </div>

      <a className="hero__scroll-cue" href="#problemas" aria-label="Rolar para conhecer o projeto">
        <span>DESLIZE PARA DESCOBRIR</span>
        <ArrowDown size={15} aria-hidden="true" />
      </a>

      <div className="hero__edge-caption" aria-hidden="true">
        <span>AHRI / PRESENÇA &amp; PRECISÃO</span>
      </div>
    </section>
  );
}
