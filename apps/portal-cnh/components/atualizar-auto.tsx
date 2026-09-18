'use client';
// Recarrega os dados da página a cada N segundos (conversas ao vivo), sem
// perder o que a pessoa está digitando: só o servidor re-renderiza.
import { useRouter } from 'next/navigation';
import { useEffect, type ReactElement } from 'react';

export const AtualizarAuto = ({ segundos = 15 }: { segundos?: number }): ReactElement | null => {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, segundos * 1_000);
    return () => {
      clearInterval(id);
    };
  }, [router, segundos]);
  return null;
};
