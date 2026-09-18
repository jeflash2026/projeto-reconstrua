'use client';
// SAIR — encerra a sessão do painel e volta ao login.
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { sair } from '../lib/actions';

export const SairButton = (): ReactElement => {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-sair"
      onClick={() => {
        void sair().then(() => {
          router.push('/login');
          router.refresh();
        });
      }}
    >
      Sair
    </button>
  );
};
