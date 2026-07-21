'use client';

import { useEffect, useRef, useState } from 'react';

type CounterProps = {
  value: string;
};

export function Counter({ value }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const target = Number(value.replace(/\D/g, ''));
    const suffix = value.replace(/[0-9]/g, '');
    if (!target || !ref.current) return;

    let started = false;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const startedAt = performance.now();
        const duration = 1120;

        const update = (now: number) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 4);
          setDisplay(
            String(Math.round(target * eased)).padStart(value.startsWith('0') ? 2 : 1, '0') +
              suffix,
          );
          if (progress < 1) frame = requestAnimationFrame(update);
        };

        frame = requestAnimationFrame(update);
      },
      { threshold: 0.65 },
    );

    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return <span ref={ref}>{display}</span>;
}
