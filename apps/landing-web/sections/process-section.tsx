'use client';

import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { SectionHeading } from '@/components/ui/section-heading';
import { processSteps } from '@/lib/content';

export function ProcessSection() {
  return (
    <section id="como-funciona" className="process section-shell">
      <div className="shell">
        <div className="process__topline">
          <SectionHeading
            eyebrow="Uma jornada desenhada para respirar"
            title={
              <>
                O seu caso encontra <em>ordem</em> antes de encontrar um caminho.
              </>
            }
            description="A tecnologia mantém cada detalhe legível. A equipe mantém cada conversa humana."
          />
          <div className="process__seal" aria-label="Tecnologia com supervisão humana">
            <span>IA</span>
            <small>+ HUMANO</small>
          </div>
        </div>

        <div className="process-list">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.article
                className="process-row"
                key={step.number}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: index * 0.08 }}
              >
                <span className="process-row__number">{step.number}</span>
                <div className="process-row__symbol">
                  <Icon aria-hidden="true" size={19} strokeWidth={1.5} />
                </div>
                <div className="process-row__copy">
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
                <span className="process-row__status">{index === 0 ? 'COMEÇO' : 'ETAPA'}</span>
                {index < processSteps.length - 1 && (
                  <span className="process-row__connector" aria-hidden="true">
                    <ArrowDown size={15} />
                  </span>
                )}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
