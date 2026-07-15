'use client';
// Tempo real por atualização periódica dos dados do servidor (router.refresh).
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AutoRefresh = ({ seconds = 5 }: { seconds?: number }): null => {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, seconds * 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [router, seconds]);
  return null;
};

export default AutoRefresh;
