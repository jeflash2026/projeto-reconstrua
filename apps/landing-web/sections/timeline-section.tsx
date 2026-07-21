'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLayoutEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';

const checkpoints = [
  ['INÍCIO', 'Seu cenário, ouvido com cuidado.'],
  ['MAPA', 'Documentos transformados em contexto.'],
  ['ESTRATÉGIA', 'Leitura jurídica com direção clara.'],
  ['PRESENÇA', 'Acompanhamento pelo portal.'],
];

export function TimelineSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!sectionRef.current || !progressRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      const isMobile = window.matchMedia('(max-width: 760px)').matches;
      gsap.fromTo(progressRef.current, isMobile ? { scaleY: 0 } : { scaleX: 0 }, {
        ...(isMobile ? { scaleY: 1 } : { scaleX: 1 }),
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 72%',
          end: 'bottom 52%',
          scrub: 0.65,
        },
      });
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="journey section-shell"
      aria-label="Linha do tempo da jornada"
    >
      <div className="shell">
        <Reveal className="journey__intro">
          <span className="journey__number">01—05</span>
          <p>
            Cada caso tem o seu tempo. O nosso método tem um ritmo que você consegue acompanhar.
          </p>
        </Reveal>

        <div className="journey__rail">
          <div className="journey__rail-base" />
          <div className="journey__rail-progress" ref={progressRef} />
          {checkpoints.map(([title, text], index) => (
            <Reveal className="journey__checkpoint" delay={index * 0.08} key={title}>
              <span className="journey__pin">
                <i />
              </span>
              <span className="journey__index">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              {index < checkpoints.length - 1 && (
                <ChevronRight className="journey__arrow" size={16} />
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
