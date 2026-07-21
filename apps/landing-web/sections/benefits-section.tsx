'use client';

import { motion } from 'framer-motion';
import { Check, Fingerprint, LockKeyhole, ScanLine } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { SectionHeading } from '@/components/ui/section-heading';
import { benefits } from '@/lib/content';

const layers = [
  { label: 'Criptografia de ponta a ponta', icon: LockKeyhole },
  { label: 'Leitura assistida por IA', icon: ScanLine },
  { label: 'Revisão jurídica especializada', icon: Fingerprint },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="benefits section-shell">
      <div className="shell">
        <div className="benefits__grid">
          <div className="benefits__statement">
            <SectionHeading
              eyebrow="Por que o Projeto Reconstrua"
              title={
                <>
                  Sofisticação não é distância. É <em>cuidado em cada detalhe.</em>
                </>
              }
              description="Construímos uma experiência que torna uma questão complexa menos solitária e mais compreensível."
            />

            <Reveal className="security-terminal">
              <div className="security-terminal__top">
                <span className="terminal-orb" />
                <span>AMBIENTE PROTEGIDO</span>
                <span className="terminal-code">PR/SEC-01</span>
              </div>
              <div className="security-terminal__body">
                {layers.map((layer) => {
                  const Icon = layer.icon;
                  return (
                    <div className="security-terminal__line" key={layer.label}>
                      <span className="security-terminal__icon">
                        <Icon aria-hidden="true" size={15} />
                      </span>
                      <span>{layer.label}</span>
                      <Check className="security-terminal__check" aria-hidden="true" size={15} />
                    </div>
                  );
                })}
              </div>
              <div className="security-terminal__scan" aria-hidden="true" />
            </Reveal>
          </div>

          <div className="benefit-list">
            {benefits.map((benefit, index) => (
              <motion.article
                className="benefit-row"
                key={benefit.index}
                initial={{ opacity: 0, x: 26 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.18 }}
                transition={{ duration: 0.65, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="benefit-row__index">{benefit.index}</span>
                <div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.description}</p>
                </div>
                <span className="benefit-row__line" />
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
