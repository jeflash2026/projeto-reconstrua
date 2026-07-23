'use client';
// SAIR — botão-cliente chamando a server action (o idioma <form action={fn}> é
// do React 19; os tipos do React 18 dos portais o rejeitam no build Docker).
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { logoutSocio } from '../lib/actions';

export function SairButton(): ReactElement {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        void logoutSocio().then(() => {
          router.push('/login');
          router.refresh();
        });
      }}
    >
      Sair
    </button>
  );
}
