import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Projeto Reconstrua | Revisão de consignados INSS',
  description: 'Especialistas em revisão de contratos de empréstimos consignados do INSS.',
  metadataBase: new URL('https://projetoreconstrua.com.br'),
  openGraph: {
    title: 'Projeto Reconstrua',
    description: 'Inteligência jurídica e presença humana para revisar consignados INSS.',
    type: 'website',
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
