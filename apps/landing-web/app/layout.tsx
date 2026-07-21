import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.css';

// O preview do WhatsApp/redes lê o Open Graph daqui; a MESMA meta serve os
// dois domínios (com e sem www) porque é o mesmo app — metadataBase só define
// o endereço canônico das imagens.
export const metadata: Metadata = {
  title: 'Projeto Reconstrua | Revisão de consignados INSS',
  description:
    'Descontos no seu benefício do INSS podem estar errados. Você pode ter valores a recuperar — análise gratuita pelo WhatsApp.',
  metadataBase: new URL('https://projetoreconstrua.com.br'),
  icons: { icon: '/icone.png', apple: '/icone.png' },
  openGraph: {
    title: 'Projeto Reconstrua — você pode ter valores a recuperar do INSS',
    description:
      'Pagou desconto indevido no seu benefício do INSS? Nossa análise identifica contratos com cobrança errada e o que pode ser recuperado. Comece grátis pelo WhatsApp.',
    type: 'website',
    images: [{ url: '/og-preview.png', width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Rastreadores do TRÁFEGO PAGO (mesma regra da landing anterior): só entram
  // quando configurados no .env — nunca ids de exemplo.
  const pixelId = process.env['META_PIXEL_ID'] ?? '';
  const gaId = process.env['GA_MEASUREMENT_ID'] ?? '';
  return (
    <html lang="pt-BR">
      <body>
        {children}
        {pixelId !== '' ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
          </Script>
        ) : null}
        {gaId !== '' ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-config" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
