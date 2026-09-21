import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { WhatsAppFloat } from '@/components/whatsapp-float';
import { ChatAhri } from '@/components/chat-ahri';
import { BenefitsSection } from '@/sections/benefits-section';
import { FaqSection } from '@/sections/faq-section';
import { FinalCtaSection } from '@/sections/final-cta-section';
import { Footer } from '@/sections/footer';
import { HeroSection } from '@/sections/hero-section';
import { IndicatorsSection } from '@/sections/indicators-section';
import { Navbar } from '@/sections/navbar';
import { ProblemsSection } from '@/sections/problems-section';
import { ProcessSection } from '@/sections/process-section';
import { TestimonialsSection } from '@/sections/testimonials-section';
import { TimelineSection } from '@/sections/timeline-section';

// Runtime (não build-time): o número oficial vem do .env do serviço — a mesma
// regra da landing anterior (OFFICIAL_WHATSAPP_NUMBER; nunca o da instância).
export const dynamic = 'force-dynamic';

export default function Home() {
  // Decreto 2026-07-31: default = o número OFICIAL do canal Meta Cloud API.
  const numeroWhatsApp = (process.env['OFFICIAL_WHATSAPP_NUMBER'] ?? '5516996369934').replace(
    /\D/g,
    '',
  );
  // CANAL DE ENTRADA (2026-09-21): a conta oficial do WhatsApp foi desativada em
  // definitivo pela Meta (política comercial), então o CTA leva ao WEBCHAT
  // próprio — que é nosso e não pode ser banido. CANAL_DE_ENTRADA=whatsapp
  // devolve o wa.me no dia em que houver um número oficial de novo.
  const canalDeEntrada = process.env['CANAL_DE_ENTRADA'] === 'whatsapp' ? 'whatsapp' : 'webchat';
  return (
    <SmoothScroll>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemsSection />
        <ProcessSection />
        <TimelineSection />
        <BenefitsSection />
        <IndicatorsSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCtaSection numeroWhatsApp={numeroWhatsApp} canal={canalDeEntrada} />
      </main>
      <Footer />
      {/* A conversa acontece DENTRO da página (2026-09-21): a caixa da AHRI
          substitui o botão de WhatsApp enquanto não houver número oficial. */}
      {canalDeEntrada === 'webchat' ? (
        <ChatAhri />
      ) : (
        <WhatsAppFloat numero={numeroWhatsApp} canal={canalDeEntrada} />
      )}
    </SmoothScroll>
  );
}
