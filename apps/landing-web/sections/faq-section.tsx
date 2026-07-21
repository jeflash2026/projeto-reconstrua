'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { SectionHeading } from '@/components/ui/section-heading';
import { faqItems } from '@/lib/content';

export function FaqSection() {
  const [openItem, setOpenItem] = useState(0);

  return (
    <section id="perguntas" className="faq section-shell">
      <div className="shell faq__layout">
        <div className="faq__lead">
          <SectionHeading
            eyebrow="Perguntas, respondidas"
            title={
              <>
                Tudo começa com uma conversa <em>sem ruído.</em>
              </>
            }
            description="Se a sua pergunta não estiver aqui, nossa equipe está preparada para ouvir."
          />
          <div className="faq__monogram" aria-hidden="true">
            R
          </div>
        </div>

        <div className="faq__items">
          {faqItems.map((item, index) => {
            const isOpen = index === openItem;
            return (
              <article
                className={'faq-item ' + (isOpen ? 'faq-item--open' : '')}
                key={item.question}
              >
                <button
                  className="faq-item__trigger"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenItem(isOpen ? -1 : index)}
                >
                  <span>{item.question}</span>
                  <i>{isOpen ? <Minus size={18} /> : <Plus size={18} />}</i>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq-item__answer-wrap"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="faq-item__answer">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
