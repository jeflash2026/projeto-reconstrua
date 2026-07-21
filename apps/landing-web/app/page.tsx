import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { WhatsAppFloat } from '@/components/whatsapp-float';
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
  const numeroWhatsApp = (process.env['OFFICIAL_WHATSAPP_NUMBER'] ?? '554137989737').replace(
    /D/g,
    '',
  );
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
        <FinalCtaSection numeroWhatsApp={numeroWhatsApp} />
      </main>
      <Footer />
      <WhatsAppFloat numero={numeroWhatsApp} />
    </SmoothScroll>
  );
}
