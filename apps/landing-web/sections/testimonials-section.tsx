'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Quote } from 'lucide-react';
import { useState } from 'react';
import { SectionHeading } from '@/components/ui/section-heading';
import { testimonials } from '@/lib/content';

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const testimonial = testimonials[current];

  function previous() {
    setCurrent((index) => (index - 1 + testimonials.length) % testimonials.length);
  }

  function next() {
    setCurrent((index) => (index + 1) % testimonials.length);
  }

  return (
    <section className="testimonials section-shell">
      <div className="shell testimonials__layout">
        <SectionHeading
          eyebrow="Acolhimento que se percebe"
          title={
            <>
              Uma experiência que devolve <em>clareza e presença.</em>
            </>
          }
          description="Tratamos cada relato com reserva. Por isso, as identidades são sempre preservadas."
        />

        <div className="testimonial-stage">
          <div className="testimonial-stage__halo" aria-hidden="true" />
          <span className="testimonial-stage__ordinal">
            0{current + 1} / 0{testimonials.length}
          </span>
          <Quote
            className="testimonial-stage__quote-icon"
            aria-hidden="true"
            size={36}
            strokeWidth={1.2}
          />
          <motion.blockquote
            key={testimonial.quote}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            “{testimonial.quote}”
          </motion.blockquote>
          <motion.div
            className="testimonial-stage__source"
            key={testimonial.label + current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <span className="source-avatar">R</span>
            <div>
              <strong>{testimonial.label}</strong>
              <small>{testimonial.context}</small>
            </div>
          </motion.div>
          <div className="testimonial-stage__controls">
            <button type="button" aria-label="Depoimento anterior" onClick={previous}>
              <ArrowLeft size={18} />
            </button>
            <div className="testimonial-stage__dots" aria-hidden="true">
              {testimonials.map((_, index) => (
                <span className={index === current ? 'is-active' : ''} key={index} />
              ))}
            </div>
            <button type="button" aria-label="Próximo depoimento" onClick={next}>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
