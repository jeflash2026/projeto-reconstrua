'use client';
// ATUALIZAÇÃO SILENCIOSA (UX): revalida a carta discretamente — sem flicker, sem
// spinner, sem "atualizado às…". Se algo mudou, entra com o mesmo fade de tudo.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AutoRefresh = ({ seconds }: { seconds: number }): null => {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, seconds * 1000);
    return () => {
      clearInterval(id);
    };
  }, [router, seconds]);
  return null;
};

export default AutoRefresh;
