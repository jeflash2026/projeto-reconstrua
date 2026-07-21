'use client';

import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Reveal } from '@/components/motion/reveal';
import { SectionHeading } from '@/components/ui/section-heading';
import { problems } from '@/lib/content';

export function ProblemsSection() {
  return (
    <section id="problemas" className="problems section-shell">
      <div className="shell">
        <SectionHeading
          eyebrow="O que olhamos com atenção"
          title={
            <>
              Quando uma parcela vira uma <em>incerteza,</em> a gente começa por entender.
            </>
          }
          description="Sem linguagem apressada. Sem pressão. Apenas informação organizada, leitura criteriosa e direção."
        />

        <div className="problem-grid">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <Reveal className="problem-card-wrap" delay={index * 0.08} key={problem.title}>
                <article className="problem-card">
                  <div className="problem-card__head">
                    <span className="problem-card__eyebrow">{problem.eyebrow}</span>
                    <span className="problem-card__icon">
                      <Icon aria-hidden="true" size={21} strokeWidth={1.45} />
                    </span>
                  </div>
                  <div className="problem-card__content">
                    <h3>{problem.title}</h3>
                    <p>{problem.description}</p>
                  </div>
                  <div className="problem-card__footer">
                    <span>{problem.measure}</span>
                    <motion.span
                      className="problem-card__arrow"
                      whileHover={{ rotate: 45 }}
                      transition={{ duration: 0.22 }}
                    >
                      <ArrowUpRight size={16} />
                    </motion.span>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
