'use client';

import { CheckCircle2, LoaderCircle, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { BrandMark } from '@/components/brand-mark';
import { linkWhatsApp } from '@/lib/whatsapp';

export function FinalCtaSection({ numeroWhatsApp }: { numeroWhatsApp: string }) {
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Decreto: o formulário LEVA AO WHATSAPP OFICIAL (nada de promessa vazia —
  // antes o submit não enviava a lugar nenhum). Nome + relato + campanha viajam
  // no texto do wa.me; o atendimento (AHRI) começa na primeira mensagem.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const dados = new FormData(event.currentTarget);
    const nomeCru = dados.get('name');
    const nome = typeof nomeCru === 'string' ? nomeCru : '';
    const relatoCru = dados.get('message');
    const relato = typeof relatoCru === 'string' ? relatoCru : '';
    window.open(linkWhatsApp(numeroWhatsApp, { nome, relato }), '_blank', 'noopener');
    setIsSubmitting(false);
    setIsSent(true);
  }

  return (
    <section id="analise" className="final-cta section-shell">
      <div className="shell">
        <div className="final-cta__panel">
          <div className="final-cta__ambient" aria-hidden="true" />
          <div className="final-cta__content">
            <span className="eyebrow">
              <span />
              Primeiro passo
            </span>
            <h2>
              O seu caso merece
              <br />
              <em>uma leitura mais justa.</em>
            </h2>
            <p>
              Conte-nos o básico. A equipe do Projeto Reconstrua orienta como iniciar a análise, com
              calma e discrição.
            </p>
            <div className="final-cta__confidence">
              <span>01</span>
              <p>Análise inicial sem compromisso de contratação.</p>
            </div>
          </div>

          <div className="intake-card">
            {isSent ? (
              <motion.div
                className="intake-card__success"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <CheckCircle2 size={36} strokeWidth={1.45} />
                <h3>Abrimos o seu WhatsApp.</h3>
                <p>
                  É só enviar a mensagem que preparamos — a análise começa na hora, pelo WhatsApp
                  oficial do Projeto Reconstrua.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="intake-card__brand">
                  <BrandMark compact />
                  <span>ANÁLISE INICIAL</span>
                </div>
                <label>
                  <span>Como podemos chamar você?</span>
                  <input
                    name="name"
                    type="text"
                    placeholder="Seu nome"
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  <span>Seu melhor WhatsApp</span>
                  <input
                    name="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                    required
                  />
                </label>
                <label>
                  <span>O que está acontecendo?</span>
                  <textarea
                    name="message"
                    placeholder="Conte brevemente sobre os descontos ou contratos que preocupam você."
                    rows={3}
                    required
                  />
                </label>
                <label className="intake-card__consent">
                  <input type="checkbox" required />
                  <span>Autorizo o contato para dar continuidade à análise inicial.</span>
                </label>
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />}
                  {isSubmitting ? 'Abrindo o WhatsApp...' : 'Quero entender meu caso'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
