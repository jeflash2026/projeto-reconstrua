'use client';
// SAIR — encerra a sessão do advogado (limpa cookies) e volta ao login.
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAdvogado } from '../lib/actions';

const LogoutButton = (): ReactElement => {
  const router = useRouter();
  return (
    <button
      style={{ marginTop: 8, width: '100%' }}
      onClick={() => {
        void logoutAdvogado().then(() => {
          router.push('/login');
          router.refresh();
        });
      }}
    >
      Sair
    </button>
  );
};

export default LogoutButton;
