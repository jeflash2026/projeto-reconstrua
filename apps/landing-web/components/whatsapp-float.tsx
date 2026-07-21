'use client';
// Botão FLUTUANTE de WhatsApp — o atalho permanente ao canal oficial (o link é
// montado no clique, com a campanha da visita no texto — atribuição preservada).
import { useEffect, useState, type ReactElement } from 'react';
import { linkWhatsApp } from '@/lib/whatsapp';

export function WhatsAppFloat({ numero }: { numero: string }): ReactElement {
  const [href, setHref] = useState('#');
  useEffect(() => {
    setHref(linkWhatsApp(numero));
  }, [numero]);
  return (
    <a
      className="wa-float"
      href={href}
      rel="nofollow noreferrer"
      target="_blank"
      aria-label="Falar no WhatsApp"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 60,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 18px',
        borderRadius: 999,
        background: '#1eb95c',
        color: '#fff',
        fontWeight: 600,
        boxShadow: '0 10px 30px rgba(0,0,0,.25)',
        textDecoration: 'none',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M.06 24l1.7-6.2A11.9 11.9 0 1 1 12 24a11.9 11.9 0 0 1-5.7-1.45L.06 24zM6.6 20l.4.24a9.9 9.9 0 1 0-3.4-3.4l.25.4-1 3.6z" />
      </svg>
      <span>Falar no WhatsApp</span>
    </a>
  );
}
