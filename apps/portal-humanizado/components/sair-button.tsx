'use client';
// Botão SAIR — encerra a sessão da secretária e volta ao login.
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { logoutHumanizado } from '../lib/actions';

export const SairButton = (): ReactElement => {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        void logoutHumanizado().then(() => {
          router.push('/login');
          router.refresh();
        });
      }}
    >
      Sair
    </button>
  );
};
